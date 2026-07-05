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
