import { TAILWIND_CONFLICT_MESSAGE_PATTERN } from "../constants/regex";

/**
 * Result of successfully parsing a class-conflict warning message.
 */
export interface ParsedConflict {
  /** The class this specific diagnostic is attached to. */
  readonly flaggedClass: string;
  /** The other class it conflicts with. */
  readonly conflictsWith: string;
}

/**
 * Attempts to parse a raw diagnostic message string into a conflict pair.
 *
 * Pure function — no vscode imports, no side effects — for the same
 * testability reasons as parseTailwindOptimizationMessage.
 *
 * @param message The raw `diagnostic.message` string.
 * @returns The parsed conflict, or `null` if the message doesn't match the
 *          expected conflict-warning format.
 */
export function parseTailwindConflictMessage(
  message: string,
): ParsedConflict | null {
  const match = TAILWIND_CONFLICT_MESSAGE_PATTERN.exec(message.trim());

  if (!match) {
    return null;
  }

  const [, flaggedClass, conflictsWith] = match;

  if (!flaggedClass || !conflictsWith) {
    return null;
  }

  return { flaggedClass, conflictsWith };
}
