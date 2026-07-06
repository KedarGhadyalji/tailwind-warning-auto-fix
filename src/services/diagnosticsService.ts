import * as vscode from "vscode";
import { TAILWIND_DIAGNOSTIC_SOURCE } from "../constants/regex";
import { parseTailwindOptimizationMessage } from "../parsers/diagnosticParser";
import { parseTailwindConflictMessage } from "../parsers/conflictParser";
import {
  ConflictPair,
  ConflictScanResult,
  DiagnosticScanResult,
  ParsedConflictDiagnostic,
  ParsedTailwindDiagnostic,
  SkippedDiagnostic,
} from "../types/diagnosticTypes";
import { Logger } from "../utils/logger";

/**
 * Determines whether a diagnostic is *likely* to originate from the
 * Tailwind CSS IntelliSense extension.
 *
 * We deliberately do NOT filter by language ID (per project rules — the
 * extension must work across JS/TS/JSX/TSX/HTML/Vue/Astro/Svelte/PHP/
 * Blade/MDX/etc. without a hardcoded list). Instead we rely on:
 *
 *  1. `diagnostic.source` matching the known Tailwind CSS IntelliSense
 *     source string (fast, cheap, primary signal).
 *  2. As a fallback, diagnostics with no source (some language server
 *     configurations omit it) are still allowed through to the parser —
 *     the parser's strict message-shape check is the real safety net,
 *     since no other extension is likely to emit this exact phrasing.
 */
function isLikelyTailwindDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  if (diagnostic.source) {
    return diagnostic.source === TAILWIND_DIAGNOSTIC_SOURCE;
  }
  // No source metadata present — defer the decision to message-shape parsing.
  return true;
}

/**
 * Reads all diagnostics for the given document, filters to those that look
 * like Tailwind optimization warnings, and parses each one.
 *
 * Diagnostics that look Tailwind-related but fail to parse are tracked as
 * "skipped" rather than silently dropped, per the requirement to report
 * skipped counts to the user. Diagnostics that turn out to be CONFLICT
 * warnings (a distinct, separately-handled category — see
 * conflictsCommand.ts) are excluded from both `parsed` and `skipped`
 * entirely, since mislabeling a known category as "unparsable" would be
 * misleading — they're handled correctly, just by a different command.
 *
 * This function ONLY reads `vscode.languages.getDiagnostics(uri)` — it never
 * scans document text, per the "never perform a global text search" rule.
 */
export function scanTailwindDiagnostics(
  document: vscode.TextDocument,
  logger: Logger,
): DiagnosticScanResult {
  const allDiagnostics = vscode.languages.getDiagnostics(document.uri);

  const parsed: ParsedTailwindDiagnostic[] = [];
  const skipped: SkippedDiagnostic[] = [];

  for (const diagnostic of allDiagnostics) {
    if (!isLikelyTailwindDiagnostic(diagnostic)) {
      continue;
    }

    const result = parseTailwindOptimizationMessage(diagnostic.message);

    if (result !== null) {
      parsed.push({
        oldClass: result.oldClass,
        newClass: result.newClass,
        diagnostic,
      });
      continue;
    }

    // Not an optimization warning — check if it's a known conflict warning
    // before concluding it's genuinely unparsable. Conflicts are handled by
    // a separate command/scan, not counted as a failure here.
    if (parseTailwindConflictMessage(diagnostic.message) !== null) {
      continue;
    }

    if (diagnostic.source === TAILWIND_DIAGNOSTIC_SOURCE) {
      skipped.push({
        diagnostic,
        reason: "Message did not match any known Tailwind warning format.",
      });
      logger.warn(
        `Skipped unparsable Tailwind diagnostic: "${diagnostic.message}"`,
      );
    }
  }

  logger.info(
    `Optimization scan complete: ${parsed.length} parsed, ${skipped.length} skipped, ` +
      `${allDiagnostics.length} total diagnostics inspected.`,
  );

  return { parsed, skipped };
}

/**
 * Reads all diagnostics for the given document and pairs up class-conflict
 * warnings.
 *
 * Tailwind CSS IntelliSense reports each conflict as TWO diagnostics — one
 * attached to each class, each naming the other as the conflicting class.
 * This function matches those pairs back together so the command layer can
 * ask the user a single question per conflict, not two disconnected ones.
 *
 * Pairing strategy: for each candidate, find another candidate whose
 * (flaggedClass, conflictsWith) is the exact reverse. If more than one
 * reciprocal candidate exists (e.g. the same two class names conflict in
 * multiple, unrelated places in the file), the one on the closest line is
 * chosen — a reasonable proximity heuristic, since genuinely paired
 * diagnostics for the same element are always on the same line.
 */
export function scanTailwindConflicts(
  document: vscode.TextDocument,
  logger: Logger,
): ConflictScanResult {
  const allDiagnostics = vscode.languages.getDiagnostics(document.uri);
  const candidates: ParsedConflictDiagnostic[] = [];

  for (const diagnostic of allDiagnostics) {
    if (!isLikelyTailwindDiagnostic(diagnostic)) {
      continue;
    }

    const result = parseTailwindConflictMessage(diagnostic.message);
    if (result !== null) {
      candidates.push({ ...result, diagnostic });
    }
  }

  const pairs: ConflictPair[] = [];
  const consumed = new Set<ParsedConflictDiagnostic>();

  for (const candidate of candidates) {
    if (consumed.has(candidate)) {
      continue;
    }

    let bestMatch: ParsedConflictDiagnostic | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const other of candidates) {
      if (other === candidate || consumed.has(other)) {
        continue;
      }

      const isReciprocal =
        other.flaggedClass === candidate.conflictsWith &&
        other.conflictsWith === candidate.flaggedClass;

      if (!isReciprocal) {
        continue;
      }

      const distance = Math.abs(
        other.diagnostic.range.start.line -
          candidate.diagnostic.range.start.line,
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = other;
      }
    }

    if (bestMatch) {
      pairs.push({ a: candidate, b: bestMatch });
      consumed.add(candidate);
      consumed.add(bestMatch);
    }
  }

  const unpaired = candidates.filter((candidate) => !consumed.has(candidate));

  logger.info(
    `Conflict scan complete: ${pairs.length} paired, ${unpaired.length} unpaired, ` +
      `${candidates.length} total conflict diagnostics found.`,
  );

  return { pairs, unpaired };
}
