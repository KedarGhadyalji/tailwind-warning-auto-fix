import * as vscode from 'vscode';
import { Commands } from '../constants/commandIds';

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
 * Deliberately always visible (not conditioned on the active file's
 * language) since we don't hardcode which languages Tailwind CSS
 * IntelliSense supports — the command itself already handles "no warnings
 * found" gracefully if the active file has none.
 */
export function createStatusBarItem(): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  item.text = '$(sparkle) Fix Tailwind Warnings';
  item.tooltip = 'Fix All Tailwind Warnings (Ctrl+Alt+G / Cmd+Alt+G)';
  item.command = Commands.fixAllWarnings;
  item.show();

  return item;
}
