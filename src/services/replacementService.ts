import * as vscode from "vscode";
import { ParsedTailwindDiagnostic } from "../types/diagnosticTypes";
import { Logger } from "../utils/logger";

/**
 * Result of attempting to apply a batch of Tailwind class replacements.
 */
export interface ReplacementResult {
  readonly editApplied: boolean;
  readonly appliedCount: number;
  /** Diagnostics that were excluded before the edit was even attempted
   *  (e.g. due to a detected range overlap). */
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
 * Filters out diagnostics whose ranges overlap with an already-accepted
 * diagnostic's range. This is a defensive guard — Tailwind CSS IntelliSense
 * should never emit overlapping ranges for distinct class occurrences, but
 * applying two edits to overlapping ranges in the same WorkspaceEdit would
 * produce corrupted text, so we never risk it.
 *
 * Diagnostics are processed in document order (by range start) so that when
 * an overlap is found, the earlier-appearing diagnostic wins and the later
 * one is excluded — a deterministic, predictable tie-break.
 */
function excludeOverlappingRanges(
  diagnostics: readonly ParsedTailwindDiagnostic[],
  logger: Logger,
): { accepted: ParsedTailwindDiagnostic[]; excludedCount: number } {
  const sorted = [...diagnostics].sort((a, b) =>
    a.diagnostic.range.start.isBefore(b.diagnostic.range.start) ? -1 : 1,
  );

  const accepted: ParsedTailwindDiagnostic[] = [];
  let excludedCount = 0;

  for (const candidate of sorted) {
    const overlapsExisting = accepted.some((existing) =>
      rangesOverlap(existing.diagnostic.range, candidate.diagnostic.range),
    );

    if (overlapsExisting) {
      excludedCount++;
      logger.warn(
        `Excluded overlapping diagnostic range for class "${candidate.oldClass}".`,
      );
      continue;
    }

    accepted.push(candidate);
  }

  return { accepted, excludedCount };
}

/**
 * Builds a single WorkspaceEdit containing one TextEdit per parsed
 * diagnostic (replacing `diagnostic.range` with `newClass`) and applies it
 * atomically.
 *
 * This function NEVER searches document text and NEVER uses
 * `document.getText()` + `string.replace()`. Every replacement targets
 * `diagnostic.range` exclusively, per project safety rules.
 */
export async function applyTailwindReplacements(
  document: vscode.TextDocument,
  parsedDiagnostics: readonly ParsedTailwindDiagnostic[],
  logger: Logger,
): Promise<ReplacementResult> {
  if (parsedDiagnostics.length === 0) {
    return { editApplied: false, appliedCount: 0, excludedCount: 0 };
  }

  const { accepted, excludedCount } = excludeOverlappingRanges(
    parsedDiagnostics,
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

  return {
    editApplied: true,
    appliedCount: accepted.length,
    excludedCount,
  };
}
