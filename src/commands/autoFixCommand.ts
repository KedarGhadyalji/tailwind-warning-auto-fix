import * as vscode from "vscode";
import { scanTailwindDiagnostics } from "../services/diagnosticsService";
import { applyTailwindReplacements } from "../services/replacementService";
import { ConfigService } from "../services/configService";
import { Messages } from "../constants/messages";
import {
  showConfirmApplyDialog,
  showInfo,
  showWarning,
  showError,
} from "../utils/notification";
import { Logger } from "../utils/logger";

/**
 * Full orchestration for the "Tailwind: Auto Fix Optimization Warnings"
 * command.
 *
 * This function contains NO business logic of its own — it only:
 *  1. Validates preconditions (active editor).
 *  2. Delegates to diagnosticsService for reading + parsing diagnostics.
 *  3. Delegates to notification utils for user confirmation.
 *  4. Delegates to replacementService for the actual edit.
 *  5. Delegates to notification utils for the final summary.
 *
 * Every branch is wrapped so the extension can never crash the host —
 * per the "Never crash the extension" requirement.
 */
export async function runAutoFixCommand(
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

    const { parsed, skipped } = scanTailwindDiagnostics(document, logger);

    if (parsed.length === 0) {
      showInfo(Messages.noWarningsFound);
      return;
    }

    if (configService.shouldConfirmBeforeApply()) {
      const confirmed = await showConfirmApplyDialog(parsed.length);

      if (!confirmed) {
        logger.info("User cancelled the auto-fix confirmation dialog.");
        showInfo(Messages.applyCancelled);
        return;
      }
    }

    const result = await applyTailwindReplacements(document, parsed, logger);

    if (!result.editApplied) {
      showError(Messages.editFailed);
      return;
    }

    if (!configService.shouldShowSummary()) {
      return;
    }

    const totalSkipped = skipped.length + result.excludedCount;

    if (totalSkipped > 0) {
      showInfo(Messages.successWithSkipped(result.appliedCount, totalSkipped));
    } else {
      showInfo(Messages.successAllApplied(result.appliedCount));
    }
  } catch (error) {
    logger.error("Unexpected error while running auto-fix command.", error);
    showError(Messages.unexpectedError);
  }
}
