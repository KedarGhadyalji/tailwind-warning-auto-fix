import * as vscode from "vscode";
import { TAILWIND_DIAGNOSTIC_SOURCE } from "../constants/regex";
import { parseTailwindOptimizationMessage } from "../parsers/diagnosticParser";
import {
  DiagnosticScanResult,
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
 * skipped counts to the user.
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

    if (result === null) {
      // Only report as "skipped" (visible to the user) if it had a matching
      // source — otherwise we'd be flooding skipped-count with every
      // unrelated sourceless diagnostic (rare, but possible).
      if (diagnostic.source === TAILWIND_DIAGNOSTIC_SOURCE) {
        skipped.push({
          diagnostic,
          reason: "Message did not match expected optimization warning format.",
        });
        logger.warn(
          `Skipped unparsable Tailwind diagnostic: "${diagnostic.message}"`,
        );
      }
      continue;
    }

    parsed.push({
      oldClass: result.oldClass,
      newClass: result.newClass,
      diagnostic,
    });
  }

  logger.info(
    `Scan complete: ${parsed.length} parsed, ${skipped.length} skipped, ` +
      `${allDiagnostics.length} total diagnostics inspected.`,
  );

  return { parsed, skipped };
}
