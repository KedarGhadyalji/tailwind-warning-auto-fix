import * as vscode from "vscode";
import { Commands } from "../constants/commandIds";

/**
 * Creates the status bar item that gives users one-click access to the
 * auto-fix command, without needing the Command Palette or the keybinding.
 *
 * Returned as a Disposable so extension.ts can push it into
 * context.subscriptions alongside every other resource — consistent with
 * the disposal pattern used for the command registration and the logger's
 * output channel.
 *
 * Deliberately always visible (not conditioned on the active file's
 * language) since we don't hardcode which languages Tailwind CSS
 * IntelliSense supports — the command itself already handles "no warnings
 * found" gracefully if the active file has none.
 */
export function createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );

  item.text = "$(sparkle) Tailwind Fix";
  item.tooltip = "Auto Fix Optimization Warnings (Ctrl+Alt+T / Cmd+Alt+T)";
  item.command = Commands.autoFixOptimizationWarnings;
  item.show();

  return item;
}
