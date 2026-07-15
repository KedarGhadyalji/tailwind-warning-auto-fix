import * as vscode from 'vscode';

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
 * A class-conflict warning after parsing — e.g. from the message
 * "'text-left' applies the same CSS properties as 'text-center'."
 *
 * Unlike ParsedTailwindDiagnostic, resolving a conflict is NEVER
 * automatic — see conflictParser.ts and the regex constant for why. This
 * type only carries the parsed data; the decision of what to do with it
 * lives entirely in the command layer, driven by explicit user choice.
 */
export interface ParsedConflictDiagnostic {
  readonly flaggedClass: string;
  readonly conflictsWith: string;
  readonly diagnostic: vscode.Diagnostic;
}

/**
 * Tailwind CSS IntelliSense reports a conflict as TWO separate diagnostics
 * — one on each class, each naming the other. A ConflictPair represents
 * those two diagnostics matched back together, so the user can be asked
 * a single "which one should stay" question instead of two disconnected
 * ones.
 */
export interface ConflictPair {
  readonly a: ParsedConflictDiagnostic;
  readonly b: ParsedConflictDiagnostic;
}

/**
 * Result of scanning a document for class conflicts. `unpaired` covers the
 * rarer case where only one side of a conflict could be matched (e.g. if
 * a future IntelliSense version ever reports asymmetrically) — still
 * surfaced to the user rather than silently dropped.
 */
export interface ConflictScanResult {
  readonly pairs: ConflictPair[];
  readonly unpaired: ParsedConflictDiagnostic[];
}

/** The user's explicit choice for a single paired conflict. */
export type PairedConflictResolution = 'keepA' | 'keepB' | 'skip';

/** The user's explicit choice for a single unpaired conflict. */
export type SingleConflictResolution = 'remove' | 'skip';

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
