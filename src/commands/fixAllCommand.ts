import * as vscode from 'vscode';
import { scanTailwindDiagnostics, scanTailwindConflicts } from '../services/diagnosticsService';
import { applyCombinedFixes } from '../services/replacementService';
import { ConfigService, ConflictResolutionStrategy } from '../services/configService';
import { Messages } from '../constants/messages';
import {
  showInfo,
  showWarning,
  showError,
  showConfirmApplyDialog,
  showConflictResolutionPick,
  showSingleConflictPick,
} from '../utils/notification';
import { Logger } from '../utils/logger';
import {
  ConflictPair,
  ParsedConflictDiagnostic,
} from '../types/diagnosticTypes';

/**
 * A stable, order-independent key for a conflicting pair of class names —
 * e.g. ('text-left', 'text-center') and ('text-center', 'text-left') both
 * produce the same key. Used to group repeats of the identical conflict
 * appearing on multiple elements so the user is asked ONCE per unique
 * pair, not once per occurrence.
 */
function canonicalPairKey(classA: string, classB: string): string {
  return [classA, classB].sort().join('|||');
}

/**
 * Resolves every conflict pair by grouping identical (class, class) pairs
 * together and asking a single Quick Pick per unique group — the answer is
 * then applied to every occurrence of that exact pair in the file.
 *
 * This is a pure UX improvement with NO safety trade-off: every removal
 * still traces back to an explicit decision about that specific pair of
 * class names, it's just not re-asked redundantly for repeats.
 */
async function resolvePairsInteractively(
  pairs: readonly ConflictPair[],
  removalRanges: vscode.Range[]
): Promise<number> {
  let skippedCount = 0;

  const groups = new Map<string, ConflictPair[]>();
  for (const pair of pairs) {
    const key = canonicalPairKey(pair.a.flaggedClass, pair.b.flaggedClass);
    const group = groups.get(key) ?? [];
    group.push(pair);
    groups.set(key, group);
  }

  for (const [key, groupPairs] of groups) {
    const [classX, classY] = key.split('|||');
    const decision = await showConflictResolutionPick(classX, classY);

    for (const pair of groupPairs) {
      if (decision === 'skip') {
        skippedCount++;
        continue;
      }

      // decision === 'keepA' means "keep classX, remove classY"; 'keepB'
      // means the reverse. Map that back onto whichever of pair.a/pair.b
      // actually IS classY (or classX), since which one got labeled 'a'
      // vs 'b' during pairing isn't guaranteed to align with X/Y order.
      const classToRemove = decision === 'keepA' ? classY : classX;
      const sideToRemove = pair.a.flaggedClass === classToRemove ? pair.a : pair.b;
      removalRanges.push(sideToRemove.diagnostic.range);
    }
  }

  return skippedCount;
}

/** Same grouping/dedup idea as resolvePairsInteractively, for the rarer
 *  unpaired-conflict case. */
async function resolveUnpairedInteractively(
  unpaired: readonly ParsedConflictDiagnostic[],
  removalRanges: vscode.Range[]
): Promise<number> {
  let skippedCount = 0;

  const groups = new Map<string, ParsedConflictDiagnostic[]>();
  for (const single of unpaired) {
    const key = `${single.flaggedClass}|||${single.conflictsWith}`;
    const group = groups.get(key) ?? [];
    group.push(single);
    groups.set(key, group);
  }

  for (const [key, groupSingles] of groups) {
    const [flaggedClass, conflictsWith] = key.split('|||');
    const decision = await showSingleConflictPick(flaggedClass, conflictsWith);

    for (const single of groupSingles) {
      if (decision === 'remove') {
        removalRanges.push(single.diagnostic.range);
      } else {
        skippedCount++;
      }
    }
  }

  return skippedCount;
}

/**
 * Resolves every conflict pair AUTOMATICALLY, with no prompt at all, by
 * keeping whichever class appears earlier ('keepFirst') or later
 * ('keepLast') in the document.
 *
 * IMPORTANT: this is an accuracy trade-off the user has explicitly opted
 * into via settings, not a safe default — see ConfigService
 * .getConflictResolutionStrategy() for the full reasoning on why markup
 * order does not reliably predict Tailwind's actual rendered precedence.
 *
 * Unpaired conflicts are always skipped under automatic strategies (never
 * removed) — there's no second range to compare against, so "first" or
 * "last" can't even be computed, and guessing without that comparison
 * would be even less justified than the already-risky paired case.
 */
function resolvePairsAutomatically(
  pairs: readonly ConflictPair[],
  unpaired: readonly ParsedConflictDiagnostic[],
  strategy: 'keepFirst' | 'keepLast',
  removalRanges: vscode.Range[],
  logger: Logger
): number {
  for (const pair of pairs) {
    const aIsFirst = pair.a.diagnostic.range.start.isBefore(
      pair.b.diagnostic.range.start
    );
    const first = aIsFirst ? pair.a : pair.b;
    const last = aIsFirst ? pair.b : pair.a;
    const toRemove = strategy === 'keepFirst' ? last : first;
    removalRanges.push(toRemove.diagnostic.range);
  }

  if (unpaired.length > 0) {
    logger.info(
      `${unpaired.length} unpaired conflict(s) skipped under automatic strategy ` +
        `"${strategy}" — no reciprocal range available to compare.`
    );
  }

  return unpaired.length;
}

/**
 * Full orchestration for the single "Tailwind: Fix All Warnings" command.
 *
 * Sequence:
 *  1. Scan BOTH optimization diagnostics and conflict diagnostics up front,
 *     against the untouched document.
 *  2. If any optimization warnings exist, show ONE confirmation dialog
 *     covering all of them (respecting confirmBeforeApply).
 *  3. Resolve conflicts according to tailwindAutoOptimizer
 *     .conflictResolutionStrategy:
 *       - 'ask' (default): one Quick Pick per UNIQUE conflicting pair,
 *         reused automatically for repeats of that same pair.
 *       - 'keepFirst' / 'keepLast': fully automatic, no prompts — an
 *         explicit accuracy trade-off the user opted into.
 *       - 'skip': conflicts are left untouched entirely.
 *  4. Build and apply ONE combined WorkspaceEdit for everything decided,
 *     atomically — one Undo reverts the entire operation.
 *  5. Show one combined summary.
 */
export async function runFixAllCommand(
  logger: Logger,
  configService: ConfigService
): Promise<void> {
  try {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      showWarning(Messages.noActiveEditor);
      return;
    }

    const document = editor.document;

    showInfo(Messages.scanning);
    logger.info(`Scanning document: ${document.uri.fsPath}`);

    const { parsed: optimizationDiagnostics, skipped } = scanTailwindDiagnostics(
      document,
      logger
    );
    const { pairs, unpaired } = scanTailwindConflicts(document, logger);

    const totalWarningsFound =
      optimizationDiagnostics.length + pairs.length + unpaired.length;

    if (totalWarningsFound === 0) {
      showInfo(Messages.noWarningsFound);
      return;
    }

    if (optimizationDiagnostics.length > 0 && configService.shouldConfirmBeforeApply()) {
      const confirmed = await showConfirmApplyDialog(optimizationDiagnostics.length);

      if (!confirmed) {
        logger.info('User cancelled the fix-all confirmation dialog.');
        showInfo(Messages.applyCancelled);
        return;
      }
    }

    const conflictRemovalRanges: vscode.Range[] = [];
    let conflictsSkipped = 0;

    const strategy: ConflictResolutionStrategy = configService.getConflictResolutionStrategy();

    if (strategy === 'ask') {
      conflictsSkipped += await resolvePairsInteractively(pairs, conflictRemovalRanges);
      conflictsSkipped += await resolveUnpairedInteractively(unpaired, conflictRemovalRanges);
    } else if (strategy === 'keepFirst' || strategy === 'keepLast') {
      conflictsSkipped += resolvePairsAutomatically(
        pairs,
        unpaired,
        strategy,
        conflictRemovalRanges,
        logger
      );
    } else {
      // 'skip' — leave every conflict untouched.
      conflictsSkipped += pairs.length + unpaired.length;
    }

    const nothingChosen =
      optimizationDiagnostics.length === 0 && conflictRemovalRanges.length === 0;

    if (nothingChosen) {
      showInfo(Messages.applyCancelled);
      return;
    }

    const result = await applyCombinedFixes(
      document,
      optimizationDiagnostics,
      conflictRemovalRanges,
      logger
    );

    if (!result.editApplied) {
      showError(Messages.editFailed);
      return;
    }

    if (!configService.shouldShowSummary()) {
      return;
    }

    const totalSkipped = skipped.length + conflictsSkipped + result.excludedCount;

    showInfo(
      Messages.fixAllSummary(
        result.optimizationAppliedCount,
        result.conflictRemovedCount,
        totalSkipped
      )
    );
  } catch (error) {
    logger.error('Unexpected error while fixing Tailwind warnings.', error);
    showError(Messages.unexpectedError);
  }
}
