import * as vscode from "vscode";
import { Commands } from "../constants/commandIds";

/**
 * Creates the single status bar item that gives users one-click access to
 * the unified fix-all command, without needing the Command Palette or the
 * keybinding.
 *
 * Returned as a Disposable so extension.ts can push it into
 * context.subscriptions alongside every other resource — consistent with
 * the disposal pattern used for the command registration and the logger's
 * output channel.
 *
 * Deliberately NOT shown here — extension.ts decides visibility based on
 * whether the current workspace looks like a Tailwind project (see
 * services/projectDetectionService.ts), and re-evaluates it whenever
 * workspace folders change. This function only configures the item's
 * text/tooltip/command; the caller calls .show()/.hide() itself.
 */
export function createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );

  item.text = "$(sparkle) Fix Tailwind Warnings";
  item.tooltip = "Fix All Tailwind Warnings (Ctrl+Alt+G / Cmd+Alt+G)";
  item.command = Commands.fixAllWarnings;

  return item;
}
