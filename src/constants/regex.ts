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
 * The `source` field VS Code attaches to diagnostics emitted by the
 * Tailwind CSS IntelliSense extension. Used to filter out unrelated
 * diagnostics (ESLint, TypeScript, etc.) before even attempting to parse.
 */
export const TAILWIND_DIAGNOSTIC_SOURCE = "Tailwind CSS IntelliSense";
