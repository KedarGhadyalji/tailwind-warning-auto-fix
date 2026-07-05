import * as vscode from "vscode";

/**
 * The configuration section namespace declared in package.json's
 * `contributes.configuration`. Centralized here so it's never retyped
 * elsewhere.
 */
const CONFIG_SECTION = "tailwindAutoOptimizer";

/**
 * Thin, typed wrapper around vscode.workspace.getConfiguration for this
 * extension's settings.
 *
 * Only `confirmBeforeApply` and `showSummary` are consumed in Version 1.
 * `autoFixOnSave` is intentionally read here too (even though nothing
 * calls it yet) so that when the save-listener feature is added later,
 * it's purely additive — no changes needed to this file's public shape.
 */
export class ConfigService {
  private getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(CONFIG_SECTION);
  }

  public shouldConfirmBeforeApply(): boolean {
    return this.getConfig().get<boolean>("confirmBeforeApply", true);
  }

  public shouldShowSummary(): boolean {
    return this.getConfig().get<boolean>("showSummary", true);
  }

  /** Reserved for a future version — see README roadmap. Not yet wired to any listener. */
  public isAutoFixOnSaveEnabled(): boolean {
    return this.getConfig().get<boolean>("autoFixOnSave", false);
  }
}
