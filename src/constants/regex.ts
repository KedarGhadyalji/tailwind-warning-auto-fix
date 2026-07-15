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
 *    requires a user decision — see fixAllCommand.ts.
 *
 * Note the straight single quotes (') here, distinct from the backticks (`)
 * used in the optimization pattern above — this is exactly how Tailwind CSS
 * IntelliSense formats each message type.
 *
 * Capture group 1: the class this specific diagnostic is attached to
 * Capture group 2: the class it conflicts with
 */
export const TAILWIND_CONFLICT_MESSAGE_PATTERN =
  /^'(.+?)' applies the same CSS properties as '(.+?)'\.?$/;

/**
 * A case-insensitive substring used to identify diagnostics that likely
 * came from Tailwind CSS IntelliSense, checked against `diagnostic.source`.
 *
 * Deliberately a loose substring match rather than an exact string, e.g.
 * "Tailwind CSS IntelliSense" — real-world Problems-panel exports have
 * shown values in different casing/formatting (e.g. an internal
 * diagnostic-collection identifier like "tailwindcss-intellisense") across
 * different contexts, so an exact match risked silently excluding every
 * diagnostic if the exact string ever differed from what was hardcoded.
 * See services/diagnosticsService.ts for how this is used.
 */
export const TAILWIND_DIAGNOSTIC_SOURCE_HINT = 'tailwind';
