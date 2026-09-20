import {
  LocatedConflictPair,
  LocatedConflictSingle,
  LocatedRemoval,
} from "../types/diagnosticTypes";
import {
  showConflictResolutionPick,
  showSingleConflictPick,
} from "../utils/notification";
import { Logger } from "../utils/logger";

/**
 * A stable, order-independent key for a conflicting pair of class names —
 * e.g. ('text-left', 'text-center') and ('text-center', 'text-left') both
 * produce the same key. Used to group repeats of the identical conflict
 * (whether on multiple elements in one file, or across many files in a
 * workspace-wide run) so the user is asked ONCE per unique pair, not once
 * per occurrence.
 */
function canonicalPairKey(classA: string, classB: string): string {
  return [classA, classB].sort().join("|||");
}

/**
 * Resolves every conflict pair by grouping identical (class, class) pairs
 * together — REGARDLESS of which file each one came from — and asking a
 * single Quick Pick per unique group. The answer is then applied to every
 * occurrence of that exact pair, in whichever file(s) it appears.
 *
 * This is a pure UX improvement with NO safety trade-off: every removal
 * still traces back to an explicit decision about that specific pair of
 * class names, it's just not re-asked redundantly for repeats — including
 * repeats across multiple files, which matters a great deal for the
 * workspace-wide command (without this, fixing a workspace with the same
 * conflicting pair in 50 files would mean 50 identical prompts).
 */
export async function resolveConflictPairsInteractively(
  locatedPairs: readonly LocatedConflictPair[],
): Promise<{ removals: LocatedRemoval[]; skippedCount: number }> {
  const removals: LocatedRemoval[] = [];
  let skippedCount = 0;

  const groups = new Map<string, LocatedConflictPair[]>();
  for (const located of locatedPairs) {
    const key = canonicalPairKey(
      located.pair.a.flaggedClass,
      located.pair.b.flaggedClass,
    );
    const group = groups.get(key) ?? [];
    group.push(located);
    groups.set(key, group);
  }

  for (const [key, group] of groups) {
    const [classX, classY] = key.split("|||");
    const decision = await showConflictResolutionPick(classX, classY);

    for (const { uri, pair } of group) {
      if (decision === "skip") {
        skippedCount++;
        continue;
      }

      // decision === 'keepA' means "keep classX, remove classY"; 'keepB'
      // means the reverse. Map that back onto whichever of pair.a/pair.b
      // actually IS classY (or classX), since which one got labeled 'a'
      // vs 'b' during pairing isn't guaranteed to align with X/Y order.
      const classToRemove = decision === "keepA" ? classY : classX;
      const sideToRemove =
        pair.a.flaggedClass === classToRemove ? pair.a : pair.b;
      removals.push({ uri, range: sideToRemove.diagnostic.range });
    }
  }

  return { removals, skippedCount };
}

/** Same grouping/dedup idea as resolveConflictPairsInteractively, for the
 *  rarer unpaired-conflict case. */
export async function resolveUnpairedConflictsInteractively(
  locatedSingles: readonly LocatedConflictSingle[],
): Promise<{ removals: LocatedRemoval[]; skippedCount: number }> {
  const removals: LocatedRemoval[] = [];
  let skippedCount = 0;

  const groups = new Map<string, LocatedConflictSingle[]>();
  for (const located of locatedSingles) {
    const key = `${located.single.flaggedClass}|||${located.single.conflictsWith}`;
    const group = groups.get(key) ?? [];
    group.push(located);
    groups.set(key, group);
  }

  for (const [key, group] of groups) {
    const [flaggedClass, conflictsWith] = key.split("|||");
    const decision = await showSingleConflictPick(flaggedClass, conflictsWith);

    for (const { uri, single } of group) {
      if (decision === "remove") {
        removals.push({ uri, range: single.diagnostic.range });
      } else {
        skippedCount++;
      }
    }
  }

  return { removals, skippedCount };
}

/**
 * Resolves every conflict pair AUTOMATICALLY, with no prompt at all, by
 * keeping whichever class appears earlier ('keepFirst') or later
 * ('keepLast') within its OWN document.
 *
 * IMPORTANT: this is an accuracy trade-off the user has explicitly opted
 * into via settings, not a safe default — see ConfigService
 * .getConflictResolutionStrategy() for the full reasoning on why markup
 * order does not reliably predict Tailwind's actual rendered precedence.
 * This applies identically whether resolving one file or an entire
 * workspace — "first"/"last" is always evaluated within each pair's own
 * document, never compared across different files.
 *
 * Unpaired conflicts are always skipped under automatic strategies (never
 * removed) — there's no second range to compare against, so "first" or
 * "last" can't even be computed, and guessing without that comparison
 * would be even less justified than the already-risky paired case.
 */
export function resolveConflictPairsAutomatically(
  locatedPairs: readonly LocatedConflictPair[],
  locatedSingles: readonly LocatedConflictSingle[],
  strategy: "keepFirst" | "keepLast",
  logger: Logger,
): { removals: LocatedRemoval[]; skippedCount: number } {
  const removals: LocatedRemoval[] = [];

  for (const { uri, pair } of locatedPairs) {
    const aIsFirst = pair.a.diagnostic.range.start.isBefore(
      pair.b.diagnostic.range.start,
    );
    const first = aIsFirst ? pair.a : pair.b;
    const last = aIsFirst ? pair.b : pair.a;
    const toRemove = strategy === "keepFirst" ? last : first;
    removals.push({ uri, range: toRemove.diagnostic.range });
  }

  if (locatedSingles.length > 0) {
    logger.info(
      `${locatedSingles.length} unpaired conflict(s) skipped under automatic strategy ` +
        `"${strategy}" — no reciprocal range available to compare.`,
    );
  }

  return { removals, skippedCount: locatedSingles.length };
}
