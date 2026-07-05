/**
 * Command IDs must match exactly between here and package.json's
 * `contributes.commands`. Centralizing avoids drift between the two.
 */
export const Commands = {
  autoFixOptimizationWarnings:
    "tailwindAutoOptimizer.autoFixOptimizationWarnings",
} as const;
