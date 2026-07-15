/**
 * All user-facing text lives here. Centralizing these strings means:
 *  - No hardcoded copy scattered across command/service files
 *  - A single place to extract into VS Code's localization (.nls.json) system later
 *  - Easy consistency review before Marketplace release
 */
export const Messages = {
  scanning: 'Scanning Tailwind warnings...',
  noActiveEditor: 'Open a file first.',
  noWarningsFound: 'No Tailwind warnings found.',

  // The confirmation dialog only ever covers the optimization count —
  // conflicts always get their own individual Quick Pick regardless, so
  // there's nothing to batch-confirm for that category.
  confirmApplyTitle: (count: number): string =>
    `Found ${count} Tailwind optimization warning${count === 1 ? '' : 's'}.`,
  confirmApplyDetail: 'Apply all fixes?',
  confirmApplyButton: 'Apply',
  cancelButton: 'Cancel',

  applyCancelled: 'No changes were made.',

  editFailed: 'Failed to apply Tailwind fixes. No changes were made.',

  unexpectedError: 'An unexpected error occurred while fixing Tailwind warnings.',

  /**
   * The single combined summary shown after the unified "Fix All Warnings"
   * command finishes — covers optimizations applied, conflicts resolved,
   * and anything skipped, in one readable sentence rather than two
   * disconnected notifications.
   */
  fixAllSummary: (
    optimizedCount: number,
    conflictsResolvedCount: number,
    skippedCount: number
  ): string => {
    const parts: string[] = [];

    if (optimizedCount > 0) {
      parts.push(`${optimizedCount} optimization${optimizedCount === 1 ? '' : 's'} fixed`);
    }

    if (conflictsResolvedCount > 0) {
      parts.push(
        `${conflictsResolvedCount} conflict${conflictsResolvedCount === 1 ? '' : 's'} resolved`
      );
    }

    const base = parts.length > 0 ? `${parts.join(', ')}.` : 'No changes applied.';

    return skippedCount > 0
      ? `${base} ${skippedCount} warning${skippedCount === 1 ? '' : 's'} skipped.`
      : base;
  },
} as const;
