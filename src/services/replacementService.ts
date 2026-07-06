import * as vscode from "vscode";
import { ParsedTailwindDiagnostic } from "../types/diagnosticTypes";
import { Logger } from "../utils/logger";

/**
 * Result of attempting to apply a batch of Tailwind class replacements.
 */
export interface ReplacementResult {
  readonly editApplied: boolean;
  readonly appliedCount: number;
  readonly excludedCount: number;
}

/**
 * Result of attempting to remove a batch of conflicting Tailwind classes.
 */
export interface RemovalResult {
  readonly editApplied: boolean;
  readonly removedCount: number;
  readonly excludedCount: number;
}

/**
 * Result of applying BOTH optimization replacements and conflict removals
 * in one combined, atomic WorkspaceEdit — used by the unified
 * "Tailwind: Fix All Warnings" command.
 */
export interface CombinedFixResult {
  readonly editApplied: boolean;
  readonly optimizationAppliedCount: number;
  readonly conflictRemovedCount: number;
  readonly excludedCount: number;
}

/**
 * Detects whether two ranges overlap (share any character position).
 * Adjacent-but-not-overlapping ranges (e.g. one ends where another begins)
 * are NOT considered overlapping.
 */
function rangesOverlap(a: vscode.Range, b: vscode.Range): boolean {
  return a.start.isBefore(b.end) && b.start.isBefore(a.end);
}

/**
 * Generic overlap guard: given any list of items and a way to read each
 * item's range, returns the subset with no mutual overlaps, excluding
 * later-appearing items when a conflict is found (deterministic tie-break
 * by document order). Shared by every edit-producing path in this file —
 * optimization replacements, conflict removals, and the combined fix —
 * so there is exactly one place this safety-critical logic lives.
 */
function excludeOverlapping<T>(
  items: readonly T[],
  getRange: (item: T) => vscode.Range,
  describe: (item: T) => string,
  logger: Logger,
): { accepted: T[]; excludedCount: number } {
  const sorted = [...items].sort((a, b) =>
    getRange(a).start.isBefore(getRange(b).start) ? -1 : 1,
  );

  const accepted: T[] = [];
  let excludedCount = 0;

  for (const candidate of sorted) {
    const overlapsExisting = accepted.some((existing) =>
      rangesOverlap(getRange(existing), getRange(candidate)),
    );

    if (overlapsExisting) {
      excludedCount++;
      logger.warn(`Excluded overlapping range: ${describe(candidate)}`);
      continue;
    }

    accepted.push(candidate);
  }

  return { accepted, excludedCount };
}

/**
 * Expands a diagnostic's range by one character to consume an adjacent
 * space, so deleting a class doesn't leave a double space (or a leading/
 * trailing space) behind — e.g. `class="text-left text-center"` removing
 * `text-left` should produce `class="text-center"`, not `class=" text-center"`.
 *
 * This only ever inspects the single character immediately before or after
 * the range on the SAME line — never a document-wide search, consistent
 * with every other range-based operation in this extension. Class names
 * are never expected to span multiple lines, so same-line-only is a safe
 * assumption here.
 */
function computeDeletionRange(
  document: vscode.TextDocument,
  range: vscode.Range,
): vscode.Range {
  const lineText = document.lineAt(range.end.line).text;

  const charAfter = lineText.charAt(range.end.character);
  if (charAfter === " ") {
    return new vscode.Range(range.start, range.end.translate(0, 1));
  }

  const charBefore =
    range.start.character > 0 ? lineText.charAt(range.start.character - 1) : "";
  if (charBefore === " ") {
    return new vscode.Range(range.start.translate(0, -1), range.end);
  }

  return range;
}

/**
 * Builds a single WorkspaceEdit containing one TextEdit per parsed
 * diagnostic (replacing `diagnostic.range` with `newClass`) and applies it
 * atomically.
 *
 * Kept as a standalone building block (not currently wired to any command
 * — see fixAllCommand.ts, which uses applyCombinedFixes instead) because
 * the roadmap's planned CodeActionProvider will want to apply a SINGLE
 * optimization fix via the lightbulb menu, independent of any conflict
 * handling.
 */
export async function applyTailwindReplacements(
  document: vscode.TextDocument,
  parsedDiagnostics: readonly ParsedTailwindDiagnostic[],
  logger: Logger,
): Promise<ReplacementResult> {
  if (parsedDiagnostics.length === 0) {
    return { editApplied: false, appliedCount: 0, excludedCount: 0 };
  }

  const { accepted, excludedCount } = excludeOverlapping(
    parsedDiagnostics,
    (d) => d.diagnostic.range,
    (d) => `class "${d.oldClass}"`,
    logger,
  );

  if (accepted.length === 0) {
    return { editApplied: false, appliedCount: 0, excludedCount };
  }

  const workspaceEdit = new vscode.WorkspaceEdit();

  for (const { diagnostic, newClass } of accepted) {
    workspaceEdit.replace(document.uri, diagnostic.range, newClass);
  }

  const editApplied = await vscode.workspace.applyEdit(workspaceEdit);

  if (!editApplied) {
    logger.error(
      `WorkspaceEdit failed to apply for ${accepted.length} intended replacements.`,
    );
    return { editApplied: false, appliedCount: 0, excludedCount };
  }

  logger.info(`Applied ${accepted.length} Tailwind class replacements.`);

  return { editApplied: true, appliedCount: accepted.length, excludedCount };
}

/**
 * Builds a single WorkspaceEdit deleting every given range (each
 * corresponding to one class the user explicitly chose to remove during
 * conflict resolution) and applies it atomically.
 *
 * Kept as a standalone building block for the same reason as
 * applyTailwindReplacements above — not currently wired to any command,
 * but available for future reuse.
 */
export async function removeClasses(
  document: vscode.TextDocument,
  ranges: readonly vscode.Range[],
  logger: Logger,
): Promise<RemovalResult> {
  if (ranges.length === 0) {
    return { editApplied: false, removedCount: 0, excludedCount: 0 };
  }

  const { accepted, excludedCount } = excludeOverlapping(
    ranges,
    (r) => r,
    () => "a conflict removal",
    logger,
  );

  if (accepted.length === 0) {
    return { editApplied: false, removedCount: 0, excludedCount };
  }

  const workspaceEdit = new vscode.WorkspaceEdit();

  for (const range of accepted) {
    workspaceEdit.delete(document.uri, computeDeletionRange(document, range));
  }

  const editApplied = await vscode.workspace.applyEdit(workspaceEdit);

  if (!editApplied) {
    logger.error(
      `WorkspaceEdit failed to apply for ${accepted.length} intended class removals.`,
    );
    return { editApplied: false, removedCount: 0, excludedCount };
  }

  logger.info(`Removed ${accepted.length} conflicting Tailwind classes.`);

  return { editApplied: true, removedCount: accepted.length, excludedCount };
}

/** Internal discriminated union used only to unify replace/delete items
 *  for the single combined overlap-check + WorkspaceEdit below. */
type CombinedEditItem =
  | {
      readonly kind: "replace";
      readonly range: vscode.Range;
      readonly newText: string;
    }
  | { readonly kind: "delete"; readonly range: vscode.Range };

/**
 * Builds and applies ONE WorkspaceEdit containing both optimization
 * replacements and conflict-resolution removals, computed entirely against
 * the original (pre-edit) document.
 *
 * This is why the unified "Fix All" command is not just "run both old
 * commands back to back": if the optimization edit were applied first, any
 * conflict-diagnostic range on the same line AFTER the edited span would
 * become stale (character offsets shift), corrupting the second edit.
 * Bundling everything into a single WorkspaceEdit sidesteps this entirely
 * — VS Code resolves all contained edits against the document as it was
 * when each range was captured, and applies them together.
 *
 * The overlap guard runs across BOTH categories combined, not each
 * separately, so a (theoretical) replace-range and delete-range that
 * happened to intersect would still be caught before corrupting text.
 */
export async function applyCombinedFixes(
  document: vscode.TextDocument,
  optimizationDiagnostics: readonly ParsedTailwindDiagnostic[],
  conflictRemovalRanges: readonly vscode.Range[],
  logger: Logger,
): Promise<CombinedFixResult> {
  if (
    optimizationDiagnostics.length === 0 &&
    conflictRemovalRanges.length === 0
  ) {
    return {
      editApplied: false,
      optimizationAppliedCount: 0,
      conflictRemovedCount: 0,
      excludedCount: 0,
    };
  }

  const items: CombinedEditItem[] = [
    ...optimizationDiagnostics.map(
      (d): CombinedEditItem => ({
        kind: "replace",
        range: d.diagnostic.range,
        newText: d.newClass,
      }),
    ),
    ...conflictRemovalRanges.map(
      (range): CombinedEditItem => ({ kind: "delete", range }),
    ),
  ];

  const { accepted, excludedCount } = excludeOverlapping(
    items,
    (item) => item.range,
    (item) =>
      item.kind === "replace"
        ? `replace -> "${item.newText}"`
        : "conflict removal",
    logger,
  );

  if (accepted.length === 0) {
    return {
      editApplied: false,
      optimizationAppliedCount: 0,
      conflictRemovedCount: 0,
      excludedCount,
    };
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  let optimizationAppliedCount = 0;
  let conflictRemovedCount = 0;

  for (const item of accepted) {
    if (item.kind === "replace") {
      workspaceEdit.replace(document.uri, item.range, item.newText);
      optimizationAppliedCount++;
    } else {
      workspaceEdit.delete(
        document.uri,
        computeDeletionRange(document, item.range),
      );
      conflictRemovedCount++;
    }
  }

  const editApplied = await vscode.workspace.applyEdit(workspaceEdit);

  if (!editApplied) {
    logger.error(
      `Combined WorkspaceEdit failed (${optimizationAppliedCount} replacements, ` +
        `${conflictRemovedCount} removals attempted).`,
    );
    return {
      editApplied: false,
      optimizationAppliedCount: 0,
      conflictRemovedCount: 0,
      excludedCount,
    };
  }

  logger.info(
    `Combined edit applied: ${optimizationAppliedCount} optimizations, ` +
      `${conflictRemovedCount} conflict removals.`,
  );

  return {
    editApplied: true,
    optimizationAppliedCount,
    conflictRemovedCount,
    excludedCount,
  };
}
