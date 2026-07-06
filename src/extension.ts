import * as vscode from "vscode";
import { Commands } from "./constants/commandIds";
import { runFixAllCommand } from "./commands/fixAllCommand";
import { ConfigService } from "./services/configService";
import { Logger } from "./utils/logger";
import { createStatusBarItem } from "./utils/statusBar";

const OUTPUT_CHANNEL_NAME = "Tailwind Warning Auto-Fix";

/**
 * Extension entry point. Called once by the VS Code extension host when
 * the extension is activated (i.e. the first time the registered command
 * is invoked, per the inferred `onCommand` activation event).
 *
 * This function is the ONLY place in the codebase that:
 *  - Instantiates concrete service/utility classes.
 *  - Calls vscode.commands.registerCommand.
 *  - Touches context.subscriptions.
 *
 * Every other module receives its dependencies as parameters (manual DI),
 * which is what keeps them independently testable.
 */
export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger(OUTPUT_CHANNEL_NAME);
  const configService = new ConfigService();

  logger.info("Tailwind Warning Auto-Fix activated.");

  const commandDisposable = vscode.commands.registerCommand(
    Commands.fixAllWarnings,
    () => runFixAllCommand(logger, configService),
  );

  const statusBarItem = createStatusBarItem();

  // Logger wraps a vscode.OutputChannel, which is itself a Disposable —
  // exposing it here lets us register cleanup the same way as every other
  // resource, instead of relying on a separate deactivate()-time call.
  context.subscriptions.push(commandDisposable, statusBarItem, logger);
}

/**
 * Called once by the extension host when the extension is deactivated
 * (window closing, extension disabled/uninstalled, or VS Code reloading).
 *
 * Left empty intentionally: all cleanup is already handled via
 * context.subscriptions in activate(). This function exists so the
 * lifecycle contract is explicit and discoverable, and so future
 * teardown logic (e.g. flushing telemetry) has an obvious home.
 */
export function deactivate(): void {
  // No manual cleanup required — see activate()'s context.subscriptions.
}
