# Changelog

All notable changes to the "Tailwind Warning Auto-Fix" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Auto Fix on Save
- Workspace-wide Fix All command
- CodeActionProvider / lightbulb integration
- Unit and integration test suite

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
