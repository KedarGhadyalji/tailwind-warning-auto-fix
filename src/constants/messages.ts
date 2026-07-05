/**
 * All user-facing text lives here. Centralizing these strings means:
 *  - No hardcoded copy scattered across command/service files
 *  - A single place to extract into VS Code's localization (.nls.json) system later
 *  - Easy consistency review before Marketplace release
 */
export const Messages = {
  scanning: "Scanning Tailwind optimization warnings...",
  noActiveEditor: "Open a file first.",
  noWarningsFound: "No Tailwind optimization warnings found.",

  confirmApplyTitle: (count: number): string =>
    `Found ${count} Tailwind optimization warning${count === 1 ? "" : "s"}.`,
  confirmApplyDetail: "Apply all fixes?",
  confirmApplyButton: "Apply",
  cancelButton: "Cancel",

  applyCancelled: "Auto-fix cancelled.",

  successAllApplied: (count: number): string =>
    `Successfully fixed ${count} Tailwind optimization warning${count === 1 ? "" : "s"}.`,

  successWithSkipped: (appliedCount: number, skippedCount: number): string =>
    `${appliedCount} fix${appliedCount === 1 ? "" : "es"} applied.\n\n` +
    `${skippedCount} warning${skippedCount === 1 ? "" : "s"} skipped because ` +
    `${skippedCount === 1 ? "it couldn't" : "they couldn't"} be parsed.`,

  editFailed: "Failed to apply Tailwind fixes. No changes were made.",

  unexpectedError:
    "An unexpected error occurred while fixing Tailwind warnings.",
} as const;
