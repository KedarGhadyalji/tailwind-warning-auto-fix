import * as vscode from "vscode";
import { Messages } from "../constants/messages";

/**
 * Thin wrapper around vscode.window.show*Message calls.
 *
 * Purpose: keep every command/service free of direct UI-string concerns,
 * and give us one place to adjust modal vs. non-modal behavior, button
 * wording, etc. across the whole extension.
 */

export async function showConfirmApplyDialog(
  warningCount: number,
): Promise<boolean> {
  const selection = await vscode.window.showInformationMessage(
    `${Messages.confirmApplyTitle(warningCount)} ${Messages.confirmApplyDetail}`,
    { modal: true },
    Messages.confirmApplyButton,
  );

  return selection === Messages.confirmApplyButton;
}

export function showInfo(message: string): void {
  void vscode.window.showInformationMessage(message);
}

export function showWarning(message: string): void {
  void vscode.window.showWarningMessage(message);
}

export function showError(message: string): void {
  void vscode.window.showErrorMessage(message);
}

/**
 * Prompts the user to choose which of two conflicting classes should stay.
 *
 * Dismissing the picker (Escape, click-away) resolves to 'skip' rather than
 * throwing or defaulting to a removal — per the safety principle that this
 * extension never deletes a class the user didn't explicitly choose to
 * remove.
 */
export async function showConflictResolutionPick(
  classA: string,
  classB: string,
): Promise<"keepA" | "keepB" | "skip"> {
  const keepAOption = `Keep '${classA}', remove '${classB}'`;
  const keepBOption = `Keep '${classB}', remove '${classA}'`;
  const skipOption = "Skip — leave both as-is";

  const selection = await vscode.window.showQuickPick(
    [keepAOption, keepBOption, skipOption],
    {
      placeHolder: `'${classA}' and '${classB}' set the same CSS property — which should stay?`,
      ignoreFocusOut: true,
    },
  );

  if (selection === keepAOption) {
    return "keepA";
  }
  if (selection === keepBOption) {
    return "keepB";
  }
  return "skip";
}

/**
 * Prompts the user about a conflict where only one side could be matched
 * (see ConflictScanResult.unpaired). Offers removing just the flagged class,
 * or skipping — never assumes removal is correct without explicit consent.
 */
export async function showSingleConflictPick(
  flaggedClass: string,
  conflictsWith: string,
): Promise<"remove" | "skip"> {
  const removeOption = `Remove '${flaggedClass}'`;
  const skipOption = "Skip — leave as-is";

  const selection = await vscode.window.showQuickPick(
    [removeOption, skipOption],
    {
      placeHolder: `'${flaggedClass}' conflicts with '${conflictsWith}' (only one side detected)`,
      ignoreFocusOut: true,
    },
  );

  return selection === removeOption ? "remove" : "skip";
}
