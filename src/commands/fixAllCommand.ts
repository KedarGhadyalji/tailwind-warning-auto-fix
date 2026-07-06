import * as vscode from "vscode";
import {
  scanTailwindDiagnostics,
  scanTailwindConflicts,
} from "../services/diagnosticsService";
import { applyCombinedFixes } from "../services/replacementService";
import { ConfigService } from "../services/configService";
import { Messages } from "../constants/messages";
import {
  showInfo,
  showWarning,
  showError,
  showConfirmApplyDialog,
  showConflictResolutionPick,
  showSingleConflictPick,
} from "../utils/notification";
import { Logger } from "../utils/logger";

/**
 * Full orchestration for the single "Tailwind: Fix All Warnings" command —
 * the one entry point users interact with, replacing what used to be two
 * separate commands.
 *
 * Sequence:
 *  1. Scan BOTH optimization diagnostics and conflict diagnostics up front,
 *     against the untouched document.
 *  2. If any optimization warnings exist, show ONE confirmation dialog
 *     covering all of them (respecting confirmBeforeApply).
 *  3. Walk through every conflict, one Quick Pick each — this step can
 *     never be skipped via settings, because conflicts are never safe to
 *     resolve automatically (see regex.ts for why).
 *  4. Build and apply ONE combined WorkspaceEdit for everything decided in
 *     steps 2–3, atomically — one Undo reverts the entire operation.
 *  5. Show one combined summary.
 *
 * Cancelling the step-2 confirmation aborts the ENTIRE command, including
 * any conflicts that were about to be asked about — a single predictable
 * "did nothing" outcome, rather than partially applying some categories
 * and not others.
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

    const conflictRemovalRanges: vscode.Range[] = [];
    let conflictsSkipped = 0;

    for (const pair of pairs) {
      const decision = await showConflictResolutionPick(
        pair.a.flaggedClass,
        pair.b.flaggedClass,
      );

      if (decision === "keepA") {
        conflictRemovalRanges.push(pair.b.diagnostic.range);
      } else if (decision === "keepB") {
        conflictRemovalRanges.push(pair.a.diagnostic.range);
      } else {
        conflictsSkipped++;
      }
    }

    for (const single of unpaired) {
      const decision = await showSingleConflictPick(
        single.flaggedClass,
        single.conflictsWith,
      );

      if (decision === "remove") {
        conflictRemovalRanges.push(single.diagnostic.range);
      } else {
        conflictsSkipped++;
      }
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
