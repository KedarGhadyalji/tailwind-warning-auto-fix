import * as vscode from 'vscode';
import { scanTailwindDiagnostics } from '../services/diagnosticsService';
import { buildOptimizationTextEdits } from '../services/replacementService';
import { ConfigService } from '../services/configService';
import { Logger } from '../utils/logger';

/**
 * Registers the Auto Fix on Save listener and returns its Disposable for
 * extension.ts to push into context.subscriptions, consistent with every
 * other resource-creating function in this codebase.
 *
 * Uses `onWillSaveTextDocument` + `event.waitUntil(...)`, NOT
 * `onDidSaveTextDocument` + a follow-up `workspace.applyEdit()`. This
 * matters: `waitUntil` lets us hand back TextEdits that VS Code folds into
 * the SAME save operation, atomically. Editing AFTER the file is already
 * written to disk would re-dirty the document immediately and require a
 * second, redundant save to persist the fix — which would itself re-fire
 * save listeners, needing extra re-entrancy guarding to avoid looping.
 * Doing it via `waitUntil` sidesteps that whole class of problem.
 *
 * SCOPE: this listener ONLY ever fixes optimization warnings. It NEVER
 * touches class conflicts, even when autoFixOnSave is enabled — resolving
 * a conflict always requires an explicit, individual user decision. See
 * fixAllCommand.ts for the full reasoning. Unresolved conflicts stay
 * visible in the Problems panel and remain resolvable any time via
 * "Tailwind: Fix All Warnings".
 *
 * LOGGING: every invocation logs to the Output Channel regardless of
 * outcome — whether the listener fired at all, whether the setting is
 * enabled, how many diagnostics were inspected, and how many edits were
 * produced. This is deliberately verbose (more than the rest of the
 * codebase) because a save-triggered background listener has no other way
 * to report "nothing happened, and here's why" back to the user — there's
 * no confirmation dialog to fall back on for this feature.
 */
export function createAutoFixOnSaveListener(
  configService: ConfigService,
  logger: Logger
): vscode.Disposable {
  return vscode.workspace.onWillSaveTextDocument((event) => {
    const enabled = configService.shouldAutoFixOnSave();

    logger.info(
      `[AutoFixOnSave] onWillSaveTextDocument fired for ${event.document.uri.fsPath} ` +
        `(languageId: ${event.document.languageId}, autoFixOnSave setting: ${enabled}).`
    );

    if (!enabled) {
      logger.info(
        '[AutoFixOnSave] Setting is disabled — skipping. ' +
          'Enable "tailwindAutoOptimizer.autoFixOnSave" in Settings to turn this on.'
      );
      return;
    }

    event.waitUntil(computeAutoFixEdits(event.document, logger));
  });
}

/**
 * Computes the TextEdit[] to fold into the in-progress save.
 *
 * Wrapped entirely in try/catch: a bug here must NEVER prevent the user's
 * file from actually saving. On any error, this logs it and returns an
 * empty edit list rather than letting the exception propagate into VS
 * Code's save pipeline.
 */
async function computeAutoFixEdits(
  document: vscode.TextDocument,
  logger: Logger
): Promise<vscode.TextEdit[]> {
  try {
    const allDiagnosticsCount = vscode.languages.getDiagnostics(document.uri).length;
    logger.info(
      `[AutoFixOnSave] ${allDiagnosticsCount} total diagnostic(s) currently present ` +
        `for this document before filtering.`
    );

    const { parsed } = scanTailwindDiagnostics(document, logger);

    if (parsed.length === 0) {
      logger.info(
        '[AutoFixOnSave] No optimization warnings found — nothing to fix on this save. ' +
          'If you expected warnings here, confirm Tailwind CSS IntelliSense is installed, ' +
          'active, and has already flagged them in the Problems panel BEFORE saving.'
      );
      return [];
    }

    const { edits, excludedCount } = buildOptimizationTextEdits(parsed, logger);

    if (excludedCount > 0) {
      logger.warn(
        `[AutoFixOnSave] Excluded ${excludedCount} overlapping diagnostic(s).`
      );
    }

    logger.info(
      `[AutoFixOnSave] Fixing ${edits.length} optimization warning(s) in ` +
        `${document.uri.fsPath}.`
    );

    return edits;
  } catch (error) {
    logger.error('[AutoFixOnSave] Unexpected error while computing edits.', error);
    return [];
  }
}
