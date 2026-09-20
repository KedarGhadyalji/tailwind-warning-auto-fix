# Changelog

All notable changes to the "Tailwind Warning Auto-Fix" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

This completes every item from the original planned roadmap. Future work is open-ended from here.

### Flagged, not yet done

- `eslint` is still on v8; v9/v10 exist with a breaking flat-config migration. Deliberately not touched in the 0.10.1 dependency audit — it's a much bigger, riskier change than the others and deserves its own pass.
- `@typescript-eslint` (pinned `^7.16.0`) officially supports TypeScript `<5.6.0`; a fresh `npm install` resolves `typescript` to `5.9.x` under the current `^5.5.0` range, which triggers an unsupported-version warning from `@typescript-eslint/typescript-estree` on every lint run. Not currently breaking anything (lint still passes clean), but worth a version bump at some point.

## [0.10.2]

### Fixed

- Added an explicit `"types": ["node"]` to the root `tsconfig.json`'s `compilerOptions` — the same defensive fix already applied to `test/tsconfig.json` earlier, for the same class of symptom: VS Code's live TypeScript language service occasionally shows false-positive "Cannot find name 'setTimeout'/'clearTimeout'" errors for `src/services/workspaceScanService.ts` even though the real build (`npm run compile`) has always succeeded. If this still occurs after applying this fix, it's stale editor state, not a real issue — reload the window / restart the TS server.

## [0.10.1]

### Fixed

- **Dependency security audit**: resolved all 8 `npm audit` findings (2 moderate, 6 high), all in transitive devDependencies (`eslint`, `@vscode/vsce`, `ovsx`) — none in runtime code, since this extension still has zero runtime dependencies. `@vscode/vsce` bumped 2.x → 4.0.0 to fully clear the remainder (removes `fast-uri` and `js-yaml` from the tree entirely); verified the full pipeline (compile, lint, test, package) still behaves identically afterward.
- **Workspace-wide scan truncation is no longer silent**: a workspace with more than 500 matching files was previously scanning only the first 500 with zero indication anything was cut off. Now shows a warning naming the limit and suggesting re-running to continue.

### Changed

- Extracted `canonicalPairKey` out of `conflictResolutionService.ts` into a new, genuinely dependency-free `src/utils/conflictKey.ts` — the rest of that file transitively imports the real `vscode` module (via `notification.ts`) and so can't run under the unit test suite, but this one pure piece of logic now can. 4 new tests.

## [0.10.0]

### Added

- The status bar button now only appears when the **currently active file** actually has Tailwind warnings in it, layered on top of the existing project-level detection (v0.5.0). Updates live: switching editors or fixing/introducing warnings while typing shows or hides the button immediately, without needing to switch files or reload.

### Changed

- `extension.ts` now also listens to `onDidChangeActiveTextEditor` and `onDidChangeDiagnostics` (the latter filtered to the active document's URI, since it fires globally across the whole workspace) to keep visibility current. The more expensive project-level check remains cached and is only re-run on startup or workspace folder changes, as before.

## [0.9.0]

### Added

- **`Tailwind: Fix All Warnings in Workspace`** — scans every candidate file across the workspace (not just the active one) and fixes them all. Command Palette only, deliberately with no keybinding or status bar button, since it's a bigger-consequence action than the single-file command. Shows one confirmation with the accurate total count across all files, including an explicit reminder to commit to version control first (since it saves files automatically). Conflict-pair deduplication now works globally: the same conflicting pair appearing across many files is asked about once, not once per file.
- File discovery excludes `node_modules`, `dist`, `out`, `build`, `.git`, `.next`, `.nuxt`, and caps at 500 candidate files, to keep worst-case scan time bounded on large repositories. The scan is cancellable via a progress notification.
- New `src/services/conflictResolutionService.ts`, extracted from what was previously duplicated logic inside `fixAllCommand.ts` — now the single shared implementation used by both the single-file and workspace-wide commands.
- New `src/services/workspaceScanService.ts` for candidate file discovery and best-effort diagnostic waiting.

### Known limitation

- There's no public VS Code API for "the language server has finished analyzing this file", so waiting for a freshly-opened file's diagnostics is a timeout-based heuristic (500ms), not a guarantee. A very large file or an unusually slow language server startup could mean a file's warnings aren't all caught on a given run — re-running the command is always safe and will pick up anything missed.

## [0.8.0]

### Added

- **CI via GitHub Actions** (`.github/workflows/ci.yml`): runs `npm run compile`, `npm run lint`, and `npm test` on every push and pull request to `main`, across **Ubuntu, Windows, and macOS**. The cross-platform matrix is a deliberate choice, not boilerplate — this project has already hit two real Windows-only bugs (a `Buffer`/`@types/node` resolution issue, and a `tsconfig.json` `extends` relative-path miscalculation in VS Code's TypeScript language service) that single-platform local testing didn't catch.
- A second job packages the extension (`vsce package`) after the test matrix passes and uploads the resulting `.vsix` as a downloadable build artifact on every run.
- CI status badge added to the README.

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
