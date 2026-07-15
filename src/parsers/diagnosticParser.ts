import { TAILWIND_OPTIMIZATION_MESSAGE_PATTERN } from '../constants/regex';

/**
 * Result of successfully parsing a Tailwind optimization warning message.
 */
export interface ParsedClassPair {
  readonly oldClass: string;
  readonly newClass: string;
}

/**
 * Attempts to parse a raw diagnostic message string into an old/new class
 * pair.
 *
 * This function is intentionally pure:
 *  - No vscode imports.
 *  - No side effects.
 *  - Deterministic: same input always produces same output.
 *
 * This is what lets us honor the "never build an AST, never parse JSX"
 * rule — we only ever look at a single-line diagnostic message, never at
 * document/source content.
 *
 * @param message The raw `diagnostic.message` string.
 * @returns The parsed class pair, or `null` if the message doesn't match
 *          the expected Tailwind optimization warning format.
 */
export function parseTailwindOptimizationMessage(
  message: string
): ParsedClassPair | null {
  const match = TAILWIND_OPTIMIZATION_MESSAGE_PATTERN.exec(message.trim());

  if (!match) {
    return null;
  }

  const [, oldClass, newClass] = match;

  // Defensive guard: a technically-matching but empty capture group should
  // never be treated as a valid fix (protects against malformed messages).
  if (!oldClass || !newClass) {
    return null;
  }

  return { oldClass, newClass };
}
