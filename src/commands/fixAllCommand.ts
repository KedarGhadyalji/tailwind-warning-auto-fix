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
  ConfigService,
  ConflictResolutionStrategy,
} from "../services/configService";
import { Messages } from "../constants/messages";
import {
  showInfo,
  showWarning,
  showError,
  showConfirmApplyDialog,
} from "../utils/notification";
import { Logger } from "../utils/logger";
import {
  LocatedConflictPair,
  LocatedConflictSingle,
} from "../types/diagnosticTypes";

/**
 * Full orchestration for the single-file "Tailwind: Fix All Warnings"
 * command.
 *
 * Sequence:
 *  1. Scan BOTH optimization diagnostics and conflict diagnostics up front,
 *     against the untouched document.
 *  2. If any optimization warnings exist, show ONE confirmation dialog
 *     covering all of them (respecting confirmBeforeApply).
 *  3. Resolve conflicts according to tailwindAutoOptimizer
 *     .conflictResolutionStrategy, via the shared conflictResolutionService
 *     (also used by the workspace-wide command — see fixAllWorkspaceCommand.ts):
 *       - 'ask' (default): one Quick Pick per UNIQUE conflicting pair,
 *         reused automatically for repeats of that same pair.
 *       - 'keepFirst' / 'keepLast': fully automatic, no prompts — an
 *         explicit accuracy trade-off the user opted into.
 *       - 'skip': conflicts are left untouched entirely.
 *  4. Build and apply ONE combined WorkspaceEdit for everything decided,
 *     atomically — one Undo reverts the entire operation.
 *  5. Show one combined summary.
 */
export async function runFixAllCommand(
  logger: Logger,
  configService: ConfigService,
): Promise<void> {
  try {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      showWarning(Messages.noActiveEditor);
      return;
    }

    const document = editor.document;

    showInfo(Messages.scanning);
    logger.info(`Scanning document: ${document.uri.fsPath}`);

    const { parsed: optimizationDiagnostics, skipped } =
      scanTailwindDiagnostics(document, logger);
    const { pairs, unpaired } = scanTailwindConflicts(document, logger);

    const totalWarningsFound =
      optimizationDiagnostics.length + pairs.length + unpaired.length;

    if (totalWarningsFound === 0) {
      showInfo(Messages.noWarningsFound);
      return;
    }

    if (
      optimizationDiagnostics.length > 0 &&
      configService.shouldConfirmBeforeApply()
    ) {
      const confirmed = await showConfirmApplyDialog(
        optimizationDiagnostics.length,
      );

      if (!confirmed) {
        logger.info("User cancelled the fix-all confirmation dialog.");
        showInfo(Messages.applyCancelled);
        return;
      }
    }

    const locatedPairs: LocatedConflictPair[] = pairs.map((pair) => ({
      uri: document.uri,
      pair,
    }));
    const locatedSingles: LocatedConflictSingle[] = unpaired.map((single) => ({
      uri: document.uri,
      single,
    }));

    const conflictRemovalRanges: vscode.Range[] = [];
    let conflictsSkipped = 0;

    const strategy: ConflictResolutionStrategy =
      configService.getConflictResolutionStrategy();

    if (strategy === "ask") {
      const pairResult = await resolveConflictPairsInteractively(locatedPairs);
      const singleResult =
        await resolveUnpairedConflictsInteractively(locatedSingles);
      conflictRemovalRanges.push(...pairResult.removals.map((r) => r.range));
      conflictRemovalRanges.push(...singleResult.removals.map((r) => r.range));
      conflictsSkipped += pairResult.skippedCount + singleResult.skippedCount;
    } else if (strategy === "keepFirst" || strategy === "keepLast") {
      const result = resolveConflictPairsAutomatically(
        locatedPairs,
        locatedSingles,
        strategy,
        logger,
      );
      conflictRemovalRanges.push(...result.removals.map((r) => r.range));
      conflictsSkipped += result.skippedCount;
    } else {
      // 'skip' — leave every conflict untouched.
      conflictsSkipped += pairs.length + unpaired.length;
    }

    const nothingChosen =
      optimizationDiagnostics.length === 0 &&
      conflictRemovalRanges.length === 0;

    if (nothingChosen) {
      showInfo(Messages.applyCancelled);
      return;
    }

    const result = await applyCombinedFixes(
      document,
      optimizationDiagnostics,
      conflictRemovalRanges,
      logger,
    );

    if (!result.editApplied) {
      showError(Messages.editFailed);
      return;
    }

    if (!configService.shouldShowSummary()) {
      return;
    }

    const totalSkipped =
      skipped.length + conflictsSkipped + result.excludedCount;

    showInfo(
      Messages.fixAllSummary(
        result.optimizationAppliedCount,
        result.conflictRemovedCount,
        totalSkipped,
      ),
    );
  } catch (error) {
    logger.error("Unexpected error while fixing Tailwind warnings.", error);
    showError(Messages.unexpectedError);
  }
}
