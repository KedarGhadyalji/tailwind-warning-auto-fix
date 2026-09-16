# Changelog

All notable changes to the "Tailwind Warning Auto-Fix" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned (in priority order)

- CI via GitHub Actions
- Workspace-wide "Fix All" command
- Status bar item that only appears when warnings exist in the active file

## [0.7.0]

### Added

- **CodeActionProvider (lightbulb / Quick Fix integration)**: individual Tailwind warnings can now be fixed inline via VS Code's native Quick Fix menu (the lightbulb icon, or `Ctrl+.` / `Cmd+.`), without running the batch command. Optimization warnings offer a "Replace with `X`" action (marked as the preferred fix, since it's unambiguously safe); conflict warnings offer a "Remove `X` (conflicts with `Y`)" action that only removes the specific class you clicked on, never guessing the other side. A "Fix all Tailwind warnings in this file" action is also offered, bridging back to the full `Tailwind: Fix All Warnings` command.
- New `src/providers/` folder, alongside the existing `commands/`, `services/`, etc.

### Changed

- `computeDeletionRange` (in `replacementService.ts`) and `isLikelyTailwindDiagnostic` (in `diagnosticsService.ts`) are now exported, so the new CodeActionProvider reuses the exact same whitespace-safe deletion and source-filtering logic as the batch command — no duplicated logic between the two entry points.

## [0.6.2]

### Fixed

- `test/tsconfig.json` no longer uses `"extends": "../tsconfig.json"` — on Windows, VS Code's TypeScript language service was mis-resolving that relative path one directory level too high (reported as `Cannot read file 'c:/MyProjects/tsconfig.json'` when the actual project lived at `c:/MyProjects/tailwind-warning-auto-fix/`), causing an editor-only error on the root `tsconfig.json` itself. `test/tsconfig.json` is now fully self-contained, duplicating the handful of relevant compiler options directly instead of extending the root config.

## [0.6.1]

### Fixed

- Moved the test TypeScript config from a root-level `tsconfig.test.json` to `test/tsconfig.json`. The actual `npm test` build was always correct, but VS Code's built-in TypeScript language service only auto-discovers config files named exactly `tsconfig.json` by walking up from the open file — it never found the non-standard root-level name, so it fell back to checking `test/*.ts` files with no project context at all, showing false-positive "Cannot find name 'node:test'" editor errors despite the real build succeeding.

## [0.6.0]

### Added

- Unit test suite (`npm test`) using Node's built-in test runner (`node:test`) — zero new dependencies, consistent with the project's minimal-dependency philosophy. Covers `diagnosticParser.ts` and `conflictParser.ts` (the pure, dependency-free message parsers — the single most likely place to silently break if Tailwind CSS IntelliSense ever changes its wording) and the pluralization/formatting logic in `constants/messages.ts`. 30 tests total.
- New `tsconfig.test.json`, compiling `src/` and `test/` together into a separate `out-test/` directory so the production build (`npm run compile`, `out/`) stays completely unaffected.

### Fixed

- The production `tsconfig.json` had no explicit `include`, so adding `test/*.ts` files broke `npm run compile` (files outside `rootDir`). Added an explicit `"include": ["src/**/*.ts"]` so the production build only ever sees `src/`, regardless of what else exists in the project root.

## [0.5.1]

### Fixed

- `projectDetectionService.ts` no longer uses Node's `Buffer` global (which caused a `Cannot find name 'Buffer'` compile error on setups where `@types/node`'s ambient types weren't resolving, despite it being a listed devDependency). Reads `package.json` files via `vscode.workspace.openTextDocument(...).getText()` instead — pure VS Code API, no dependency on Node's global type declarations at all.

## [0.5.0]

### Added

- The status bar button (**✨ Fix Tailwind Warnings**) now only appears when the current workspace actually looks like a Tailwind project — detected via a `tailwind.config.{js,cjs,mjs,ts}` file, or failing that, a `tailwindcss` dependency in any `package.json` (covers Tailwind v4's CSS-first setup with no config file). Re-checked automatically whenever workspace folders change, so switching projects without reloading the window updates visibility correctly. A single loose file with no workspace folder open always shows the button, since there's no "project" to detect either way.

## [0.4.2]

### Fixed

- Removed a broken screenshot placeholder image reference in the README (`./images/screenshot-before-after.png`, which was never a real file) — this is what was actually failing to render on the Marketplace listing page. Removed the GIF placeholder line for the same reason.
- Updated stale version references in the README (badge and install command).

## [0.4.1]

### Fixed

- Replaced `images/icon.png` with a freshly generated, technically-verified PNG (RGB, 128×128, no ICC color profile, no alpha channel) as a precaution against common Marketplace icon-rendering causes — turned out not to be the actual issue (see 0.4.2); the real problem was the broken README image above.
- Fixed the LICENSE link in the README to point to the real published repository instead of a relative `./LICENSE` path (which doesn't resolve correctly everywhere the README is rendered, e.g. the Marketplace listing page).

## [0.4.0]

### Added

- **Conflict resolution grouping**: when resolving class conflicts, the same pair of class names is now asked about only ONCE, no matter how many elements it appears on — the answer is reused for every occurrence automatically. Pure UX improvement, no safety trade-off (every removal still traces back to an explicit decision about that pair).
- New setting `tailwindAutoOptimizer.conflictResolutionStrategy` (`"ask"` default, plus `"keepFirst"`, `"keepLast"`, `"skip"`) for users who want zero prompts. `keepFirst`/`keepLast` are explicitly documented as an accuracy trade-off, not a safe default — see README's "Conflict Resolution Strategy" section for why markup order doesn't reliably predict Tailwind's actual rendered precedence.

## [0.3.0]

### Added

- **Auto Fix on Save** (`tailwindAutoOptimizer.autoFixOnSave`, default `false`): optimization warnings are now fixed automatically as part of the save operation itself, via `onWillSaveTextDocument`/`waitUntil` — folded into the same disk write, no separate edit and no risk of re-dirtying the file. No confirmation dialog and no notification; this is intentionally silent, matching how comparable "fix on save" tooling (ESLint `--fix`, Prettier format-on-save) behaves. Every action is still logged to the "Tailwind Warning Auto-Fix" Output channel.
- Class conflicts are **never** auto-resolved on save, regardless of this setting — this remains a deliberate, always-interactive decision (see 0.1.0's notes). Unresolved conflicts stay visible in the Problems panel; run `Tailwind: Fix All Warnings` manually to address them.

### Changed

- The extension now activates via `onStartupFinished` instead of waiting for the command to be invoked once — fixes the status bar button and keyboard shortcut not being available until after a manual first run, and ensures the Auto Fix on Save listener is registered before your first save.

## [0.2.0]

### Changed

- **Consolidated into a single command**, `Tailwind: Fix All Warnings` (`Ctrl+Alt+G` / `Cmd+Alt+G`), replacing the two separate commands from 0.1.0. It now scans for optimization warnings and class conflicts together, applies optimizations automatically after one confirmation, walks through conflicts one at a time via Quick Pick, and combines everything into a single atomic `WorkspaceEdit` — one Undo reverts the whole operation.
- Consolidated the two status bar buttons into one: **✨ Fix Tailwind Warnings**.

## [0.1.0]

### Added

- `Tailwind: Resolve Class Conflicts` command that walks through every class-conflict warning (e.g. `'text-left' applies the same CSS properties as 'text-center'`) one at a time, asking which class to keep via Quick Pick.
- Keyboard shortcut (`Ctrl+Alt+C` / `Cmd+Alt+C`) and status bar button (**⚠️ Resolve Conflicts**) for the new command.

### Fixed

- The optimization scan no longer mislabels class-conflict diagnostics as "skipped because they couldn't be parsed" — they're now recognized as a distinct, valid category handled by the new command instead.

## [0.0.1] - Initial Development

### Added

- `Tailwind: Auto Fix Optimization Warnings` command that scans the active file's diagnostics and applies all Tailwind CSS IntelliSense optimization suggestions in a single atomic `WorkspaceEdit`.
- Confirmation dialog before applying fixes (`tailwindAutoOptimizer.confirmBeforeApply` setting).
- Post-fix summary notification (`tailwindAutoOptimizer.showSummary` setting).
- Graceful handling of unparsable or overlapping diagnostics, with accurate skipped-count reporting.
- Support for any file type recognized by Tailwind CSS IntelliSense, without hardcoded language IDs.
- Keyboard shortcut (`Ctrl+Alt+T` / `Cmd+Alt+T`) for one-key access to the command.
- Status bar button (**✨ Tailwind Fix**) for one-click access to the command.

### Fixed

- Command Palette entry showing a duplicated "Tailwind: Tailwind: ..." label, caused by the command's `title` redundantly repeating the `category` prefix VS Code already applies.
