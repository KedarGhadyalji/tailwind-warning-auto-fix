import * as vscode from "vscode";
import { Logger } from "../utils/logger";

const CONFIG_FILE_GLOB = "**/tailwind.config.{js,cjs,mjs,ts}";
const PACKAGE_JSON_GLOB = "**/package.json";
const NODE_MODULES_EXCLUDE = "**/node_modules/**";

/** Cap on how many package.json files we'll read when falling back to the
 *  dependency check — keeps this fast even in large monorepos, at the cost
 *  of a (rare) false negative if tailwindcss is declared only in a
 *  package.json beyond this many matches. */
const MAX_PACKAGE_JSON_FILES_TO_CHECK = 20;

/**
 * Determines whether the current workspace looks like a Tailwind project.
 *
 * Two checks, cheapest first:
 *  1. A `tailwind.config.{js,cjs,mjs,ts}` file anywhere in the workspace —
 *     covers Tailwind v3 and any v4 project that still keeps a config
 *     file. Filename-only glob match, no file reads needed.
 *  2. Falls back to scanning `package.json` files for a `tailwindcss`
 *     dependency — needed because Tailwind v4 supports a CSS-first setup
 *     (`@import "tailwindcss";`) with no config file at all.
 *
 * Both searches exclude `node_modules` and are capped, so this stays fast
 * even in large workspaces.
 *
 * If no workspace folder is open at all (a single loose file), this
 * returns true — there's no "project" to detect either way, and hiding
 * the button here would risk false negatives for anyone just testing a
 * single HTML file with real Tailwind classes in it.
 */
export async function detectsTailwindProject(logger: Logger): Promise<boolean> {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    logger.info(
      "[ProjectDetection] No workspace folder open — defaulting to visible.",
    );
    return true;
  }

  try {
    const configMatches = await vscode.workspace.findFiles(
      CONFIG_FILE_GLOB,
      NODE_MODULES_EXCLUDE,
      1,
    );

    if (configMatches.length > 0) {
      logger.info(
        `[ProjectDetection] Found ${configMatches[0].fsPath} — Tailwind project detected.`,
      );
      return true;
    }

    const packageJsonFiles = await vscode.workspace.findFiles(
      PACKAGE_JSON_GLOB,
      NODE_MODULES_EXCLUDE,
      MAX_PACKAGE_JSON_FILES_TO_CHECK,
    );

    for (const uri of packageJsonFiles) {
      if (await packageJsonHasTailwindDependency(uri)) {
        logger.info(
          `[ProjectDetection] Found tailwindcss dependency in ${uri.fsPath} — Tailwind project detected.`,
        );
        return true;
      }
    }

    logger.info(
      "[ProjectDetection] No tailwind.config file and no tailwindcss dependency found — hiding status bar button.",
    );
    return false;
  } catch (error) {
    logger.error(
      "[ProjectDetection] Unexpected error during detection — defaulting to visible.",
      error,
    );
    // Fail open: if detection itself breaks, showing the button is the
    // safer default (worst case, an unnecessary button) than hiding a
    // working feature from someone who does have a Tailwind project.
    return true;
  }
}

async function packageJsonHasTailwindDependency(
  uri: vscode.Uri,
): Promise<boolean> {
  try {
    // Reading via openTextDocument (rather than workspace.fs.readFile +
    // Buffer.from(...).toString()) deliberately avoids any dependency on
    // Node's global types (Buffer). This is a VS Code extension, but its
    // TypeScript compilation doesn't otherwise need Node's global ambient
    // types, and relying on them for one string decode isn't worth the
    // extra type-acquisition dependency.
    const document = await vscode.workspace.openTextDocument(uri);
    const parsed = JSON.parse(document.getText()) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return Boolean(
      parsed.dependencies?.tailwindcss || parsed.devDependencies?.tailwindcss,
    );
  } catch {
    // Unreadable or invalid JSON — skip this file, don't fail the whole scan.
    return false;
  }
}
