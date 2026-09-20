import * as vscode from "vscode";
import { Commands } from "./constants/commandIds";
import { runFixAllCommand } from "./commands/fixAllCommand";
import { runFixAllWorkspaceCommand } from "./commands/fixAllWorkspaceCommand";
import { ConfigService } from "./services/configService";
import { Logger } from "./utils/logger";
import { createStatusBarItem } from "./utils/statusBar";
import { createAutoFixOnSaveListener } from "./listeners/autoFixOnSaveListener";
import { detectsTailwindProject } from "./services/projectDetectionService";
import {
  scanTailwindDiagnostics,
  scanTailwindConflicts,
} from "./services/diagnosticsService";
import { TailwindCodeActionProvider } from "./providers/codeActionProvider";

const OUTPUT_CHANNEL_NAME = "Tailwind Warning Auto-Fix";

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

  logger.info("Tailwind Warning Auto-Fix activated.");

  const commandDisposable = vscode.commands.registerCommand(
    Commands.fixAllWarnings,
    () => runFixAllCommand(logger, configService),
  );

  const workspaceCommandDisposable = vscode.commands.registerCommand(
    Commands.fixAllWarningsInWorkspace,
    () => runFixAllWorkspaceCommand(logger, configService),
  );

  const statusBarItem = createStatusBarItem();
  const autoFixOnSaveDisposable = createAutoFixOnSaveListener(
    configService,
    logger,
  );

  const codeActionProviderDisposable =
    vscode.languages.registerCodeActionsProvider(
      "*",
      new TailwindCodeActionProvider(logger),
      {
        providedCodeActionKinds:
          TailwindCodeActionProvider.providedCodeActionKinds,
      },
    );

  /**
   * Whether the current WORKSPACE looks like a Tailwind project at all —
   * the expensive-ish half of the visibility check (a findFiles glob
   * search). Cached here rather than re-run on every editor switch or
   * diagnostics change, since it only needs re-evaluating when the set of
   * workspace folders actually changes.
   */
  let isTailwindProject = true;

  /**
   * Combines both layers and shows/hides the status bar item:
   *  1. Is this a Tailwind project at all? (cached, see above)
   *  2. Does the CURRENTLY ACTIVE file specifically have any Tailwind
   *     warnings right now? Cheap — just reads diagnostics VS Code has
   *     already computed, via the same scan functions the commands use.
   *
   * Synchronous and safe to call as often as needed (editor switches,
   * diagnostics changes) since step 2 only touches already-computed
   * diagnostics for a single document — no file I/O, no glob search.
   */
  const updateStatusBarVisibility = (): void => {
    const editor = vscode.window.activeTextEditor;

    if (!isTailwindProject || !editor) {
      statusBarItem.hide();
      return;
    }

    const { parsed } = scanTailwindDiagnostics(editor.document, logger);
    const { pairs, unpaired } = scanTailwindConflicts(editor.document, logger);
    const activeFileHasWarnings =
      parsed.length > 0 || pairs.length > 0 || unpaired.length > 0;

    if (activeFileHasWarnings) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };

  /**
   * Re-runs the (more expensive) project-level detection, then re-applies
   * the combined visibility check. Called once at startup and again
   * whenever workspace folders change, so opening a different project
   * (without a full window reload) updates visibility correctly.
   */
  const refreshProjectDetection = async (): Promise<void> => {
    isTailwindProject = await detectsTailwindProject(logger);
    updateStatusBarVisibility();
  };

  void refreshProjectDetection();

  const workspaceFoldersDisposable =
    vscode.workspace.onDidChangeWorkspaceFolders(
      () => void refreshProjectDetection(),
    );

  const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(() =>
    updateStatusBarVisibility(),
  );

  // onDidChangeDiagnostics fires globally for ANY file whose diagnostics
  // changed, which can be frequent while typing — filtering to only the
  // currently active document's URI keeps this from doing unnecessary work
  // for files the user isn't even looking at.
  const diagnosticsChangedDisposable = vscode.languages.onDidChangeDiagnostics(
    (event) => {
      const activeUri = vscode.window.activeTextEditor?.document.uri;
      if (!activeUri) {
        return;
      }
      if (event.uris.some((uri) => uri.toString() === activeUri.toString())) {
        updateStatusBarVisibility();
      }
    },
  );

  // Logger wraps a vscode.OutputChannel, which is itself a Disposable —
  // exposing it here lets us register cleanup the same way as every other
  // resource, instead of relying on a separate deactivate()-time call.
  context.subscriptions.push(
    commandDisposable,
    workspaceCommandDisposable,
    statusBarItem,
    autoFixOnSaveDisposable,
    codeActionProviderDisposable,
    workspaceFoldersDisposable,
    activeEditorDisposable,
    diagnosticsChangedDisposable,
    logger,
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
