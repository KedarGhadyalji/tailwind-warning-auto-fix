/**
 * Matches diagnostic messages produced by the Tailwind CSS IntelliSense
 * extension in the exact format:
 *
 *   The class `OLD` can be written as `NEW`
 *
 * Capture group 1: OLD class
 * Capture group 2: NEW class
 *
 * This is the ONLY place this pattern is defined. If Tailwind CSS
 * IntelliSense ever changes its message wording, this is the single
 * line that needs updating.
 */
export const TAILWIND_OPTIMIZATION_MESSAGE_PATTERN =
  /^The class `(.+?)` can be written as `(.+?)`$/;

/**
 * Matches CLASS-CONFLICT diagnostics produced by Tailwind CSS IntelliSense,
 * in the exact format:
 *
 *   'CLASS_A' applies the same CSS properties as 'CLASS_B'.
 *
 * This is a DIFFERENT category of warning from the optimization pattern
 * above, and is intentionally never handled the same way:
 *
 *  - Optimization warnings (`can be written as`) describe two forms that
 *    are GUARANTEED to render identically — safe to auto-replace.
 *  - Conflict warnings (`applies the same CSS properties as`) describe two
 *    DIFFERENT, mutually exclusive values for the same CSS property. Only
 *    one of them actually takes effect (per Tailwind's internal stylesheet
 *    order, not the order classes appear in markup), so blindly removing
 *    one risks silently changing the rendered page. Resolution always
 *    requires a user decision — see conflictsCommand.ts.
 *
 * Note the straight single quotes (') here, distinct from the backticks (`)
 * used in the optimization pattern — this is exactly how Tailwind CSS
 * IntelliSense formats each message type, and is itself a reliable signal
 * for telling the two categories apart before even inspecting content.
 *
 * Capture group 1: the class this specific diagnostic is attached to
 * Capture group 2: the class it conflicts with
 */
export const TAILWIND_CONFLICT_MESSAGE_PATTERN =
  /^'(.+?)' applies the same CSS properties as '(.+?)'\.?$/;

/**
 * The `source` field VS Code attaches to diagnostics emitted by the
 * Tailwind CSS IntelliSense extension. Used to filter out unrelated
 * diagnostics (ESLint, TypeScript, etc.) before even attempting to parse.
 */
export const TAILWIND_DIAGNOSTIC_SOURCE = "Tailwind CSS IntelliSense";
