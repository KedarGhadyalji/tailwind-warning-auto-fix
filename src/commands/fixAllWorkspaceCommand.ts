import * as vscode from "vscode";
import {
  scanTailwindDiagnostics,
  scanTailwindConflicts,
} from "../services/diagnosticsService";
import { applyCombinedFixes } from "../services/replacementService";
import {
  resolveConflictPairsAutomatically,
  resolveConflictPairsInteractively,
  resolveUnpairedConflictsInteractively,
} from "../services/conflictResolutionService";
import {
  findCandidateFiles,
  openFilesForScanning,
  MAX_CANDIDATE_FILES,
} from "../services/workspaceScanService";
import {
  ConfigService,
  ConflictResolutionStrategy,
} from "../services/configService";
import { Messages } from "../constants/messages";
import {
  showInfo,
  showWarning,
  showError,
  showConfirmWorkspaceApplyDialog,
} from "../utils/notification";
import { Logger } from "../utils/logger";
import {
  ConflictPair,
  LocatedConflictPair,
  LocatedConflictSingle,
  ParsedConflictDiagnostic,
  ParsedTailwindDiagnostic,
} from "../types/diagnosticTypes";

interface FileScanResult {
  readonly uri: vscode.Uri;
  readonly document: vscode.TextDocument;
  readonly optimizations: ParsedTailwindDiagnostic[];
  readonly skippedCount: number;
  readonly pairs: ConflictPair[];
  readonly unpaired: ParsedConflictDiagnostic[];
}

/**
 * Full orchestration for "Tailwind: Fix All Warnings in Workspace".
 *
 * Deliberately NOT bound to a keyboard shortcut or the status bar button —
 * Command Palette only. This is a meaningfully bigger-consequence action
 * than the single-file command (it can modify and save many files across
 * the workspace in one run), and shouldn't be one accidental keypress away.
 *
 * Sequence (two passes, not one giant multi-file edit, so this reuses the
 * exact same per-document scan/apply functions as the single-file command
 * unchanged):
 *
 *  PASS 1 (read-only): find candidate files, open each one (with a
 *  best-effort wait for its diagnostics — see workspaceScanService.ts),
 *  and scan for both categories. No edits happen yet.
 *
 *  Between passes: show ONE confirmation dialog with the accurate total
 *  optimization count across every file. Resolve conflicts using the same
 *  strategy setting as the single-file command, but with pair-deduplication
 *  applied GLOBALLY across all files — the same conflicting pair appearing
 *  in 50 files still only prompts once, not 50 times.
 *
 *  PASS 2 (write): for each file with anything to apply, build and apply
 *  its own WorkspaceEdit (via the existing applyCombinedFixes), then save
 *  it — most of these files won't have been open in a visible tab, so an
 *  unsaved invisible buffer would be confusing and easy to lose track of.
 */
export async function runFixAllWorkspaceCommand(
  logger: Logger,
  configService: ConfigService,
): Promise<void> {
  try {
    if (
      !vscode.workspace.workspaceFolders ||
      vscode.workspace.workspaceFolders.length === 0
    ) {
      showWarning(Messages.noWorkspaceFolder);
      return;
    }

    const candidateUris = await findCandidateFiles();

    if (candidateUris.length === 0) {
      showInfo(Messages.noWarningsFound);
      return;
    }

    if (candidateUris.length >= MAX_CANDIDATE_FILES) {
      logger.warn(
        `Workspace scan hit the ${MAX_CANDIDATE_FILES}-file cap — results may be incomplete.`,
      );
      showWarning(Messages.workspaceScanTruncated(MAX_CANDIDATE_FILES));
    }

    const fileResults: FileScanResult[] = [];

    const completedScan = await vscode.window.withProgress<boolean>(
      {
        location: vscode.ProgressLocation.Notification,
        title: Messages.scanningWorkspace,
        cancellable: true,
      },
      async (progress, token) => {
        const opened = await openFilesForScanning(
          candidateUris,
          logger,
          (completed, total) => {
            progress.report({
              message: `${completed} / ${total} files`,
              increment: 100 / total,
            });
          },
          () => token.isCancellationRequested,
        );

        if (token.isCancellationRequested) {
          logger.info("Workspace-wide scan cancelled by user.");
          return false;
        }

        for (const { uri, document } of opened) {
          const { parsed, skipped } = scanTailwindDiagnostics(document, logger);
          const { pairs, unpaired } = scanTailwindConflicts(document, logger);

          if (parsed.length > 0 || pairs.length > 0 || unpaired.length > 0) {
            fileResults.push({
              uri,
              document,
              optimizations: parsed,
              skippedCount: skipped.length,
              pairs,
              unpaired,
            });
          }
        }

        return true;
      },
    );

    if (!completedScan) {
      showInfo(Messages.applyCancelled);
      return;
    }

    const totalOptimizations = fileResults.reduce(
      (sum, file) => sum + file.optimizations.length,
      0,
    );
    const totalPairs = fileResults.reduce(
      (sum, file) => sum + file.pairs.length,
      0,
    );
    const totalUnpaired = fileResults.reduce(
      (sum, file) => sum + file.unpaired.length,
      0,
    );
    const totalParseSkipped = fileResults.reduce(
      (sum, file) => sum + file.skippedCount,
      0,
    );

    if (totalOptimizations === 0 && totalPairs === 0 && totalUnpaired === 0) {
      showInfo(Messages.noWarningsFound);
      return;
    }

    if (totalOptimizations > 0 && configService.shouldConfirmBeforeApply()) {
      const confirmed = await showConfirmWorkspaceApplyDialog(
        totalOptimizations,
        fileResults.length,
      );

      if (!confirmed) {
        logger.info(
          "User cancelled the workspace-wide fix-all confirmation dialog.",
        );
        showInfo(Messages.applyCancelled);
        return;
      }
    }

    // Flatten every file's conflicts into one workspace-wide list so
    // identical pairs get deduplicated across files, not just within one.
    const locatedPairs: LocatedConflictPair[] = [];
    const locatedSingles: LocatedConflictSingle[] = [];
    for (const file of fileResults) {
      for (const pair of file.pairs) {
        locatedPairs.push({ uri: file.uri, pair });
      }
      for (const single of file.unpaired) {
        locatedSingles.push({ uri: file.uri, single });
      }
    }

    const strategy: ConflictResolutionStrategy =
      configService.getConflictResolutionStrategy();
    let conflictsSkipped = 0;
    const removalsByUri = new Map<string, vscode.Range[]>();

    const addRemoval = (uri: vscode.Uri, range: vscode.Range): void => {
      const key = uri.toString();
      const list = removalsByUri.get(key) ?? [];
      list.push(range);
      removalsByUri.set(key, list);
    };

    if (strategy === "ask") {
      const pairResult = await resolveConflictPairsInteractively(locatedPairs);
      const singleResult =
        await resolveUnpairedConflictsInteractively(locatedSingles);
      for (const removal of [
        ...pairResult.removals,
        ...singleResult.removals,
      ]) {
        addRemoval(removal.uri, removal.range);
      }
      conflictsSkipped += pairResult.skippedCount + singleResult.skippedCount;
    } else if (strategy === "keepFirst" || strategy === "keepLast") {
      const result = resolveConflictPairsAutomatically(
        locatedPairs,
        locatedSingles,
        strategy,
        logger,
      );
      for (const removal of result.removals) {
        addRemoval(removal.uri, removal.range);
      }
      conflictsSkipped += result.skippedCount;
    } else {
      conflictsSkipped += locatedPairs.length + locatedSingles.length;
    }

    let totalOptimizationApplied = 0;
    let totalConflictsRemoved = 0;
    let totalExcluded = 0;
    let filesModified = 0;

    for (const file of fileResults) {
      const fileRemovals = removalsByUri.get(file.uri.toString()) ?? [];

      if (file.optimizations.length === 0 && fileRemovals.length === 0) {
        continue;
      }

      const result = await applyCombinedFixes(
        file.document,
        file.optimizations,
        fileRemovals,
        logger,
      );

      if (!result.editApplied) {
        logger.error(
          `Failed to apply edits to ${file.uri.fsPath} during workspace-wide fix.`,
        );
        continue;
      }

      totalOptimizationApplied += result.optimizationAppliedCount;
      totalConflictsRemoved += result.conflictRemovedCount;
      totalExcluded += result.excludedCount;
      filesModified++;

      // Persist immediately — most of these files weren't open in a
      // visible tab before this command ran, so leaving them as invisible,
      // unsaved buffers would be easy to lose track of.
      await file.document.save();
    }

    if (!configService.shouldShowSummary()) {
      return;
    }

    const totalSkipped = totalParseSkipped + conflictsSkipped + totalExcluded;

    showInfo(
      Messages.fixAllWorkspaceSummary(
        totalOptimizationApplied,
        totalConflictsRemoved,
        filesModified,
        totalSkipped,
      ),
    );
  } catch (error) {
    logger.error(
      "Unexpected error while fixing Tailwind warnings across the workspace.",
      error,
    );
    showError(Messages.unexpectedError);
  }
}
