/**
 * A stable, order-independent key for a conflicting pair of class names —
 * e.g. ('text-left', 'text-center') and ('text-center', 'text-left') both
 * produce the same key. Used by conflictResolutionService.ts to group
 * repeats of the identical conflict (whether on multiple elements in one
 * file, or across many files in a workspace-wide run) so the user is asked
 * ONCE per unique pair, not once per occurrence.
 *
 * Deliberately extracted into its own dependency-free module — unlike the
 * rest of conflictResolutionService.ts (which imports notification.ts,
 * which imports the real `vscode` module and so can't run outside the
 * extension host), this function has no such dependency and can be
 * exercised directly by the unit test suite (see test/utils/conflictKey.test.ts).
 */
export function canonicalPairKey(classA: string, classB: string): string {
  return [classA, classB].sort().join("|||");
}
