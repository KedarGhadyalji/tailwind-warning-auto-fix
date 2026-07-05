import * as vscode from "vscode";

/**
 * Represents a single Tailwind optimization warning after it has been
 * successfully parsed out of a raw VS Code Diagnostic message.
 *
 * This type intentionally carries the original `vscode.Diagnostic` alongside
 * the extracted class names, because the replacement layer needs the
 * diagnostic's `range` to perform a safe, targeted edit — never a document-wide
 * search.
 */
export interface ParsedTailwindDiagnostic {
  /** The original (unoptimized) Tailwind class, e.g. "max-w-[1600px]" */
  readonly oldClass: string;

  /** The suggested optimized Tailwind class, e.g. "max-w-400" */
  readonly newClass: string;

  /** The exact source diagnostic this was extracted from. Range is authoritative. */
  readonly diagnostic: vscode.Diagnostic;
}

/**
 * Represents a diagnostic that looked like a Tailwind optimization warning
 * (matched by source/severity) but whose message could not be parsed into
 * a valid old/new class pair. Tracked separately so the user can be told
 * "N warnings skipped" instead of the extension silently dropping them.
 */
export interface SkippedDiagnostic {
  readonly diagnostic: vscode.Diagnostic;
  readonly reason: string;
}

/**
 * The result of running the full diagnostics-scan phase, before any edits
 * have been applied. Used to decide whether to prompt the user and to build
 * the confirmation message (e.g. "Found 18 warnings").
 */
export interface DiagnosticScanResult {
  readonly parsed: ParsedTailwindDiagnostic[];
  readonly skipped: SkippedDiagnostic[];
}

/**
 * The final outcome after a WorkspaceEdit has been attempted, used to build
 * the post-completion summary notification.
 */
export interface FixSummary {
  readonly totalFound: number;
  readonly appliedCount: number;
  readonly skippedCount: number;
  readonly editApplied: boolean;
}
