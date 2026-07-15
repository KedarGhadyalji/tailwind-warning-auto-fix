import * as vscode from 'vscode';

/**
 * The configuration section namespace declared in package.json's
 * `contributes.configuration`. Centralized here so it's never retyped
 * elsewhere.
 */
const CONFIG_SECTION = 'tailwindAutoOptimizer';

/** Valid values for `tailwindAutoOptimizer.conflictResolutionStrategy`. */
export type ConflictResolutionStrategy = 'ask' | 'keepFirst' | 'keepLast' | 'skip';

/**
 * Thin, typed wrapper around vscode.workspace.getConfiguration for this
 * extension's settings.
 */
export class ConfigService {
  private getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(CONFIG_SECTION);
  }

  public shouldConfirmBeforeApply(): boolean {
    return this.getConfig().get<boolean>('confirmBeforeApply', true);
  }

  public shouldShowSummary(): boolean {
    return this.getConfig().get<boolean>('showSummary', true);
  }

  /**
   * Whether optimization warnings should be fixed automatically whenever a
   * file is saved. Class conflicts are NEVER auto-resolved on save,
   * regardless of this setting — see listeners/autoFixOnSaveListener.ts for
   * the full reasoning.
   */
  public shouldAutoFixOnSave(): boolean {
    return this.getConfig().get<boolean>('autoFixOnSave', false);
  }

  /**
   * How class conflicts should be resolved when running "Fix All Warnings".
   *
   * 'ask' (default): interactive Quick Pick per UNIQUE conflicting pair —
   * see fixAllCommand.ts's grouping logic for why repeats of the same pair
   * don't re-prompt.
   *
   * 'keepFirst' / 'keepLast': resolves every conflict automatically, no
   * prompt at all, by keeping whichever of the two classes appears
   * earlier/later in the document. IMPORTANT: this is a real accuracy
   * trade-off, not a safe shortcut — Tailwind's actual rendered precedence
   * between two conflicting classes is decided by its internal stylesheet
   * generation order, NOT by which class appears first in markup. Choosing
   * either automatic mode can silently keep the visually-losing class and
   * delete the one actually taking effect. Users who enable this are
   * explicitly accepting that risk in exchange for zero manual review.
   *
   * 'skip': never touches conflicts at all; they remain visible in the
   * Problems panel only.
   */
  public getConflictResolutionStrategy(): ConflictResolutionStrategy {
    return this.getConfig().get<ConflictResolutionStrategy>(
      'conflictResolutionStrategy',
      'ask'
    );
  }
}
