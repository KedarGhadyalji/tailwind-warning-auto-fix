/**
 * All user-facing text lives here. Centralizing these strings means:
 *  - No hardcoded copy scattered across command/service files
 *  - A single place to extract into VS Code's localization (.nls.json) system later
 *  - Easy consistency review before Marketplace release
 */
export const Messages = {
  scanning: "Scanning Tailwind warnings...",
  noActiveEditor: "Open a file first.",
  noWarningsFound: "No Tailwind warnings found.",

  // The confirmation dialog only ever covers the optimization count —
  // conflicts always get their own individual Quick Pick regardless, so
  // there's nothing to batch-confirm for that category.
  confirmApplyTitle: (count: number): string =>
    `Found ${count} Tailwind optimization warning${count === 1 ? "" : "s"}.`,
  confirmApplyDetail: "Apply all fixes?",
  confirmApplyButton: "Apply",
  cancelButton: "Cancel",

  applyCancelled: "No changes were made.",

  editFailed: "Failed to apply Tailwind fixes. No changes were made.",

  unexpectedError:
    "An unexpected error occurred while fixing Tailwind warnings.",

  noWorkspaceFolder: "Open a folder or workspace first.",
  scanningWorkspace: "Scanning workspace for Tailwind warnings...",

  workspaceScanTruncated: (limit: number): string =>
    `This workspace has more than ${limit} matching files — only the first ` +
    `${limit} were scanned. Run the command again after fixing this batch to ` +
    `continue with the rest.`,

  confirmWorkspaceApplyTitle: (count: number, fileCount: number): string =>
    `Found ${count} Tailwind optimization warning${count === 1 ? "" : "s"} across ` +
    `${fileCount} file${fileCount === 1 ? "" : "s"}.`,
  // Deliberately more cautious than the single-file confirmation — many of
  // the affected files won't have been open in a visible tab, and this
  // command saves them automatically (see fixAllWorkspaceCommand.ts), so
  // there's no "review before saving" step the way there is for a single
  // open file.
  confirmWorkspaceApplyDetail:
    "This will modify and save these files. Make sure your changes are committed " +
    "to version control first. Apply all fixes?",

  /**
   * The single combined summary shown after the unified "Fix All Warnings"
   * command finishes — covers optimizations applied, conflicts resolved,
   * and anything skipped, in one readable sentence rather than two
   * disconnected notifications.
   */
  fixAllSummary: (
    optimizedCount: number,
    conflictsResolvedCount: number,
    skippedCount: number,
  ): string => {
    const parts: string[] = [];

    if (optimizedCount > 0) {
      parts.push(
        `${optimizedCount} optimization${optimizedCount === 1 ? "" : "s"} fixed`,
      );
    }

    if (conflictsResolvedCount > 0) {
      parts.push(
        `${conflictsResolvedCount} conflict${conflictsResolvedCount === 1 ? "" : "s"} resolved`,
      );
    }

    const base =
      parts.length > 0 ? `${parts.join(", ")}.` : "No changes applied.";

    return skippedCount > 0
      ? `${base} ${skippedCount} warning${skippedCount === 1 ? "" : "s"} skipped.`
      : base;
  },

  /** Same idea as fixAllSummary, with a file count folded in — used by the
   *  workspace-wide command. */
  fixAllWorkspaceSummary: (
    optimizedCount: number,
    conflictsResolvedCount: number,
    fileCount: number,
    skippedCount: number,
  ): string => {
    const parts: string[] = [];

    if (optimizedCount > 0) {
      parts.push(
        `${optimizedCount} optimization${optimizedCount === 1 ? "" : "s"} fixed`,
      );
    }

    if (conflictsResolvedCount > 0) {
      parts.push(
        `${conflictsResolvedCount} conflict${conflictsResolvedCount === 1 ? "" : "s"} resolved`,
      );
    }

    if (parts.length === 0) {
      return skippedCount > 0
        ? `No changes applied. ${skippedCount} warning${skippedCount === 1 ? "" : "s"} skipped.`
        : "No changes applied.";
    }

    const base = `${parts.join(", ")} across ${fileCount} file${fileCount === 1 ? "" : "s"}.`;

    return skippedCount > 0
      ? `${base} ${skippedCount} warning${skippedCount === 1 ? "" : "s"} skipped.`
      : base;
  },
} as const;
