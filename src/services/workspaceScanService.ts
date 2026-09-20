import * as vscode from "vscode";
import { Logger } from "../utils/logger";

/**
 * File-extension glob used to decide which files are even worth opening
 * for a workspace-wide scan.
 *
 * NOTE on why this uses an extension list, unlike everywhere else in this
 * extension: the "never hardcode language IDs" rule elsewhere is about
 * which DIAGNOSTICS get accepted once a file is already open — that stays
 * completely language-agnostic (see diagnosticsService.ts). This is a
 * different, unavoidable concern: deciding which files are worth opening
 * in the first place, out of potentially thousands in a workspace, most of
 * which (images, lockfiles, binaries) could never contain a Tailwind class
 * at all. This list mirrors every file type Tailwind CSS IntelliSense's
 * own documentation mentions supporting.
 */
const CANDIDATE_FILE_GLOB =
  "**/*.{html,htm,js,jsx,ts,tsx,vue,svelte,astro,php,mdx,md}";

const EXCLUDE_GLOB =
  "**/{node_modules,dist,out,build,.git,.next,.nuxt,.vscode-test}/**";

/** Hard cap on how many files a single workspace-wide run will consider,
 *  to keep worst-case runtime bounded on very large repositories. Exported
 *  so the command layer can detect truncation and warn the user, rather
 *  than silently scanning only a subset of the workspace. */
export const MAX_CANDIDATE_FILES = 500;

/** How long to wait for a language server to produce diagnostics for a
 *  freshly-opened file before giving up and reading whatever exists.
 *  There is no public VS Code API for "the language server has finished
 *  analyzing this file" — this is a best-effort heuristic, not a
 *  guarantee. Kept short because it's paid per file across potentially
 *  hundreds of files. */
const DIAGNOSTIC_WAIT_TIMEOUT_MS = 500;

/** How many files to open/wait-on concurrently. Balances overall scan
 *  speed against not overwhelming the language server with a burst of
 *  simultaneous file opens. */
const CONCURRENCY = 8;

export async function findCandidateFiles(): Promise<vscode.Uri[]> {
  return vscode.workspace.findFiles(
    CANDIDATE_FILE_GLOB,
    EXCLUDE_GLOB,
    MAX_CANDIDATE_FILES,
  );
}

async function openAndWaitForDiagnostics(
  uri: vscode.Uri,
  logger: Logger,
): Promise<vscode.TextDocument | null> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);

    // If diagnostics already exist (e.g. the file was already open and
    // analyzed elsewhere in the session), there's nothing to wait for.
    if (vscode.languages.getDiagnostics(uri).length > 0) {
      return document;
    }

    await new Promise<void>((resolve) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          disposable.dispose();
          resolve();
        }
      }, DIAGNOSTIC_WAIT_TIMEOUT_MS);

      const disposable = vscode.languages.onDidChangeDiagnostics((event) => {
        if (settled) {
          return;
        }
        if (
          event.uris.some((changed) => changed.toString() === uri.toString())
        ) {
          settled = true;
          clearTimeout(timeout);
          disposable.dispose();
          resolve();
        }
      });
    });

    return document;
  } catch (error) {
    logger.warn(
      `Skipped unreadable file during workspace scan: ${uri.fsPath} (${String(error)})`,
    );
    return null;
  }
}

export interface ScannedFile {
  readonly uri: vscode.Uri;
  readonly document: vscode.TextDocument;
}

/**
 * Opens every candidate file and waits (best-effort) for its diagnostics,
 * processing files in small concurrent batches rather than one at a time —
 * purely sequential processing would make a workspace-wide scan
 * impractically slow once the per-file wait is factored in across
 * potentially hundreds of files.
 *
 * Reports progress after each batch via onProgress and checks isCancelled
 * between batches, so the calling command can drive a cancellable VS Code
 * progress notification.
 */
export async function openFilesForScanning(
  uris: readonly vscode.Uri[],
  logger: Logger,
  onProgress: (completed: number, total: number) => void,
  isCancelled: () => boolean,
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];
  let completed = 0;

  for (let i = 0; i < uris.length; i += CONCURRENCY) {
    if (isCancelled()) {
      break;
    }

    const batch = uris.slice(i, i + CONCURRENCY);
    const opened = await Promise.all(
      batch.map((uri) => openAndWaitForDiagnostics(uri, logger)),
    );

    for (let j = 0; j < opened.length; j++) {
      const document = opened[j];
      if (document) {
        results.push({ uri: batch[j], document });
      }
      completed++;
    }

    onProgress(completed, uris.length);
  }

  return results;
}
