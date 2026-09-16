import * as vscode from "vscode";
import { parseTailwindOptimizationMessage } from "../parsers/diagnosticParser";
import { parseTailwindConflictMessage } from "../parsers/conflictParser";
import { isLikelyTailwindDiagnostic } from "../services/diagnosticsService";
import { computeDeletionRange } from "../services/replacementService";
import { Commands } from "../constants/commandIds";
import { Logger } from "../utils/logger";

/**
 * Supplies native VS Code Quick Fix (lightbulb / Ctrl+.) actions for
 * individual Tailwind diagnostics, as an alternative entry point to the
 * batch "Fix All Warnings" command.
 *
 * This provider does NOT contain any new fix logic — every action it
 * offers reuses the exact same parsers and whitespace-safe deletion
 * helper as fixAllCommand.ts, so behavior is guaranteed identical whether
 * a fix is applied via the lightbulb or the batch command.
 *
 * SCOPE, consistent with the rest of the extension:
 *  - Optimization diagnostics get ONE action: replace with the suggested
 *    class. Marked `isPreferred` since it's guaranteed safe (see
 *    constants/regex.ts for why optimizations and conflicts are treated
 *    so differently throughout this codebase).
 *  - Conflict diagnostics get ONE action: remove the specific class the
 *    diagnostic is attached to (i.e. whichever one you clicked/hovered).
 *    Never offers to remove "the other side" automatically — that would
 *    require guessing without the user's explicit input, which is exactly
 *    what this extension avoids everywhere else.
 *  - A "Fix all Tailwind warnings in this file" action is appended once
 *    per invocation (not per diagnostic) when any Tailwind diagnostics are
 *    present, bridging back to the full batch command.
 */
export class TailwindCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  constructor(private readonly logger: Logger) {}

  public provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    try {
      const actions: vscode.CodeAction[] = [];

      for (const diagnostic of context.diagnostics) {
        if (!isLikelyTailwindDiagnostic(diagnostic)) {
          continue;
        }

        const optimization = parseTailwindOptimizationMessage(
          diagnostic.message,
        );
        if (optimization) {
          actions.push(
            this.buildReplaceAction(
              document,
              diagnostic,
              optimization.newClass,
            ),
          );
          continue;
        }

        const conflict = parseTailwindConflictMessage(diagnostic.message);
        if (conflict) {
          actions.push(
            this.buildRemoveAction(
              document,
              diagnostic,
              conflict.flaggedClass,
              conflict.conflictsWith,
            ),
          );
        }
      }

      if (actions.length > 0) {
        actions.push(this.buildFixAllAction());
      }

      return actions;
    } catch (error) {
      // A CodeActionProvider must never throw — that can surface as a
      // disruptive error notification or silently break the lightbulb menu
      // for every extension, not just this one. Log and return nothing.
      this.logger.error(
        "Unexpected error while providing Tailwind code actions.",
        error,
      );
      return [];
    }
  }

  private buildReplaceAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    newClass: string,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Replace with '${newClass}'`,
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;

    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, diagnostic.range, newClass);
    action.edit = edit;

    return action;
  }

  private buildRemoveAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic,
    flaggedClass: string,
    conflictsWith: string,
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      `Remove '${flaggedClass}' (conflicts with '${conflictsWith}')`,
      vscode.CodeActionKind.QuickFix,
    );
    action.diagnostics = [diagnostic];
    // Deliberately NOT isPreferred — unlike the optimization replace
    // action, this is a real, user-facing judgment call (see class
    // docblock), so it should never be visually promoted as "the" fix.

    const edit = new vscode.WorkspaceEdit();
    edit.delete(document.uri, computeDeletionRange(document, diagnostic.range));
    action.edit = edit;

    return action;
  }

  private buildFixAllAction(): vscode.CodeAction {
    const action = new vscode.CodeAction(
      "Fix all Tailwind warnings in this file",
      vscode.CodeActionKind.QuickFix,
    );
    action.command = {
      command: Commands.fixAllWarnings,
      title: "Fix all Tailwind warnings in this file",
    };
    return action;
  }
}
