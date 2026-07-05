# Changelog

All notable changes to the "Tailwind Warning Auto-Fix" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Auto Fix on Save
- Workspace-wide Fix All command
- CodeActionProvider / lightbulb integration
- Status bar button
- Unit and integration test suite

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
