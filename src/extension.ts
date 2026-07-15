import * as vscode from 'vscode';
import { Commands } from './constants/commandIds';
import { runFixAllCommand } from './commands/fixAllCommand';
import { ConfigService } from './services/configService';
import { Logger } from './utils/logger';
import { createStatusBarItem } from './utils/statusBar';
import { createAutoFixOnSaveListener } from './listeners/autoFixOnSaveListener';

const OUTPUT_CHANNEL_NAME = 'Tailwind Warning Auto-Fix';

/**
 * Extension entry point. Called once by the VS Code extension host — see
 * package.json's `activationEvents: ["onStartupFinished"]` for why this
 * fires automatically shortly after VS Code finishes loading, rather than
 * waiting for the command to be run manually first.
 *
 * Eager activation matters for two reasons:
 *  1. The status bar button is created here — under the previous lazy
 *     (`onCommand`-only) activation, the button wouldn't exist until AFTER
 *     the user had already run the command some other way at least once.
 *  2. The Auto Fix on Save listener needs to be registered before any save
 *     happens — lazy activation would mean the feature silently does
 *     nothing until the command had already been invoked manually once,
 *     defeating the entire point of an automatic, save-triggered feature.
 *
 * This function is the ONLY place in the codebase that:
 *  - Instantiates concrete service/utility classes.
 *  - Calls vscode.commands.registerCommand / workspace.onWillSaveTextDocument.
 *  - Touches context.subscriptions.
 *
 * Every other module receives its dependencies as parameters (manual DI),
 * which is what keeps them independently testable.
 */
export function activate(context: vscode.ExtensionContext): void {
  const logger = new Logger(OUTPUT_CHANNEL_NAME);
  const configService = new ConfigService();

  logger.info('Tailwind Warning Auto-Fix activated.');

  const commandDisposable = vscode.commands.registerCommand(
    Commands.fixAllWarnings,
    () => runFixAllCommand(logger, configService)
  );

  const statusBarItem = createStatusBarItem();
  const autoFixOnSaveDisposable = createAutoFixOnSaveListener(configService, logger);

  // Logger wraps a vscode.OutputChannel, which is itself a Disposable —
  // exposing it here lets us register cleanup the same way as every other
  // resource, instead of relying on a separate deactivate()-time call.
  context.subscriptions.push(
    commandDisposable,
    statusBarItem,
    autoFixOnSaveDisposable,
    logger
  );
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
