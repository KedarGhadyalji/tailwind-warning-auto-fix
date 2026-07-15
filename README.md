# Tailwind Warning Auto-Fix

Automatically fix every Tailwind CSS optimization warning in the active file with a single command — no more clicking Quick Fix one class at a time.

![Version](https://img.shields.io/badge/version-0.4.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## The Problem

The [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) extension frequently flags optimization opportunities like:

```
The class `max-w-[1600px]` can be written as `max-w-400`
The class `!bg-surface` can be written as `bg-surface!`
```

...and sometimes flags class conflicts, like:

```
'text-left' applies the same CSS properties as 'text-center'.
```

Fixing these one at a time via the lightbulb Quick Fix menu is tedious in any file with more than a handful of warnings.

## The Solution

**Tailwind Warning Auto-Fix** reads every warning already produced by Tailwind CSS IntelliSense in the active file and resolves it — automatically for optimizations, interactively for conflicts — in one command, atomically, with full undo support.

It does **not** reimplement Tailwind's optimization logic — it's a thin, safe automation layer over diagnostics that already exist.

---

## Features

- ✅ **One command** fixes optimization warnings AND walks you through class conflicts — no separate commands to remember
- ✅ Fixes **all** Tailwind optimization warnings in the active file automatically, after one confirmation
- ✅ Interactively resolves **class conflicts** (e.g. `text-left` vs `text-center`) — always asks which class should stay, since these are NOT safe to auto-resolve (see "Optimization vs. Conflicts" below)
- ✅ **Auto Fix on Save** (opt-in) — silently fixes optimization warnings every time you save, folded directly into the save itself
- ✅ Applies everything in a single `WorkspaceEdit` — one Undo (`Cmd/Ctrl+Z`) reverts the entire operation
- ✅ Uses each diagnostic's exact source range — never a document-wide text search, so it's safe even when the same class string appears multiple times in a file
- ✅ Works in any file type supported by Tailwind CSS IntelliSense (JS, TS, JSX, TSX, HTML, Vue, Astro, Svelte, PHP, Blade, MDX, and more) — no hardcoded language list
- ✅ Status bar button and keyboard shortcut available immediately on VS Code startup — no need to run the command once first
- ✅ Gracefully skips and reports any warning it can't safely parse, instead of failing the whole batch

## Optimization vs. Conflicts — why they're handled differently

Tailwind CSS IntelliSense produces two distinct kinds of warnings, and even though **one command** (and, optionally, Auto Fix on Save) handles both, they're resolved very differently internally:

| | Optimization warnings | Conflict warnings |
|---|---|---|
| Example | `` The class `max-w-[1600px]` can be written as `max-w-400` `` | `'text-left' applies the same CSS properties as 'text-center'.` |
| Meaning | Two forms that render **identically** | Two **different**, mutually exclusive values for the same property — only one actually applies |
| Applied how | Automatically | **One decision per conflict**, via Quick Pick — never automatic |
| On save (if enabled) | Fixed silently | **Never touched** — always requires the manual command |
| Why | Safe — no visual change is possible | Removing the wrong side would silently change how the page renders, since Tailwind's effective precedence isn't based on the order classes appear in your markup |

---

## Requirements

- Visual Studio Code `^1.90.0` or later
- The [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) extension installed and active (this extension only reads its diagnostics — it does not analyze Tailwind classes itself)

---

## Installation

### From the Marketplace

1. Open the Extensions view in VS Code (`Cmd/Ctrl+Shift+X`).
2. Search for **Tailwind Warning Auto-Fix**.
3. Click **Install**.

### From a `.vsix` file

```bash
code --install-extension tailwind-warning-auto-fix-0.4.2.vsix
```

---

## Usage

Open a file containing Tailwind classes with active warnings (visible in the Problems panel), then trigger the fix in any of three ways:

- **Command Palette** — `Cmd/Ctrl+Shift+P` → run `Tailwind: Fix All Warnings`
- **Keyboard shortcut** — `Ctrl+Alt+G` (Windows/Linux) or `Cmd+Alt+G` (Mac), while focused in the editor
- **Status bar button** — click **✨ Fix Tailwind Warnings** in the bottom-right status bar — visible immediately on startup, no prior command run needed

All three trigger the identical flow:

1. If any optimization warnings were found, review the confirmation dialog and click **Apply** (skipped automatically if there are none).
2. For each class conflict found, a Quick Pick asks which of the two classes should stay — answer each one, or choose "Skip" to leave it untouched.
3. Everything is applied together in one edit, and a summary notification confirms what changed.

> **Rebinding the shortcut:** if `Ctrl+Alt+G`/`Cmd+Alt+G` conflicts with another shortcut, open **Keyboard Shortcuts** (`Cmd/Ctrl+K Cmd/Ctrl+S`), search for "Tailwind: Fix All Warnings", and rebind it to whatever you prefer.

### What you'll see

| Situation | Message |
|---|---|
| No file open | `Open a file first.` |
| No warnings in the file | `No Tailwind warnings found.` |
| Optimization warnings found | `Found 18 Tailwind optimization warnings. Apply all fixes?` |
| A class conflict found | Quick Pick: `Keep 'text-left', remove 'text-center'` / `Keep 'text-center', remove 'text-left'` / `Skip` |
| Everything applied | `18 optimizations fixed, 2 conflicts resolved.` |
| Some warnings unparsable | `18 optimizations fixed, 2 conflicts resolved. 3 warnings skipped.` |

---

## Commands

| Command | Shortcut | Description |
|---|---|---|
| `Tailwind: Fix All Warnings` | `Ctrl+Alt+G` / `Cmd+Alt+G` | Scans the active file for both optimization warnings and class conflicts. Applies optimizations automatically (after one confirmation) and walks through conflicts one at a time via Quick Pick — all combined into a single, atomic edit. Also available via the **✨ Fix Tailwind Warnings** status bar button. |

---

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `tailwindAutoOptimizer.confirmBeforeApply` | boolean | `true` | Show a confirmation dialog before applying optimization fixes when running the manual command. Has no effect on Auto Fix on Save, which never shows a dialog. |
| `tailwindAutoOptimizer.showSummary` | boolean | `true` | Show a summary notification after `Tailwind: Fix All Warnings` finishes. Has no effect on Auto Fix on Save, which is always silent (see below). |
| `tailwindAutoOptimizer.autoFixOnSave` | boolean | `false` | Automatically fix optimization warnings every time you save a file (see "Auto Fix on Save" below). |
| `tailwindAutoOptimizer.conflictResolutionStrategy` | `"ask"` \| `"keepFirst"` \| `"keepLast"` \| `"skip"` | `"ask"` | How to resolve class conflicts (see "Conflict Resolution Strategy" below). |

---

## Conflict Resolution Strategy

By default (`"ask"`), resolving conflicts still asks — but **only once per unique pair of class names**, not once per occurrence. If `text-left`/`text-center` conflicts on 10 different elements, you'll be asked once, and that answer is reused automatically for all 10. This removes most of the repetition without any safety trade-off — every removal still traces back to an explicit decision you made about that specific pair.

If you want zero prompts at all, two automatic modes are available:

- `"keepFirst"` — keeps whichever class appears earlier in the markup, removes the other, for every conflict, no questions asked.
- `"keepLast"` — same, but keeps whichever appears later.
- `"skip"` — never touches conflicts at all; they stay visible in the Problems panel only.

**Read this before enabling `keepFirst`/`keepLast`:** these are *not* a safe shortcut. Tailwind's actual rendered precedence between two conflicting classes is decided by Tailwind's internal stylesheet generation order — it has nothing to do with which class appears first in your `class="..."` attribute. Choosing an automatic mode can silently keep the class that has no visual effect and delete the one that was actually rendering, changing your page's appearance without any warning. Enable these only if you've reviewed your specific conflicts once already and are confident about the pattern, or you're comfortable checking the result visually afterward.

---

## Auto Fix on Save

Enable `tailwindAutoOptimizer.autoFixOnSave` in Settings to have optimization warnings fixed automatically every time you save — no command, no shortcut, no confirmation dialog needed.

```json
{
  "tailwindAutoOptimizer.autoFixOnSave": true
}
```

**What happens on save:**
- Every optimization warning in the file is fixed, folded directly into the same save operation (via VS Code's `onWillSaveTextDocument`/`waitUntil` API) — not a separate edit afterward, so there's no risk of re-dirtying the file or triggering a redundant second save.
- This is completely **silent** — no popup, no status bar message. Every action is still recorded in the **Output panel → "Tailwind Warning Auto-Fix"** channel if you want to check what happened.
- A save with nothing to fix does nothing at all.

**What does NOT happen on save — by design:**
- **Class conflicts are never auto-resolved on save**, regardless of this setting. Deciding which of two conflicting classes should stay always requires a judgment call (see "Optimization vs. Conflicts" above) — an interactive prompt on every save (especially with VS Code's own Auto Save enabled, which can fire every second or so while typing) would be disruptive, and guessing automatically risks a silent visual regression. Unresolved conflicts remain visible in the Problems panel; run `Tailwind: Fix All Warnings` whenever you're ready to address them.
- No modal dialog ever appears during a save, regardless of `confirmBeforeApply` — that setting only applies to the manual command.

---

## How It Works

This extension never re-implements Tailwind's class-optimization logic, parses JSX, or builds an AST. Instead, for each diagnostic in the active file, it:

1. Reads existing diagnostics via `vscode.languages.getDiagnostics()` — no document scanning.
2. Filters to those matching Tailwind CSS IntelliSense's optimization or conflict warning formats.
3. Extracts the relevant class names from each diagnostic's message text.
4. Builds edits using each diagnostic's own `range` — never a text search — so the correct occurrence is always targeted, even with duplicate class names elsewhere in the file.
5. Batches every edit into one `WorkspaceEdit` (or, for Auto Fix on Save, one `TextEdit[]` folded into the save itself) and applies it atomically.

---

## Known Limitations

- Only processes the **currently active file** (or, for Auto Fix on Save, whichever file was just saved) — workspace-wide or folder-wide fixing is on the roadmap.
- Relies entirely on Tailwind CSS IntelliSense's diagnostics; if that extension is disabled or hasn't finished analyzing the file yet, no warnings will be found.
- If Tailwind CSS IntelliSense changes its warning message wording in a future release, parsing may need an update (tracked in two small, isolated parser files — see Contributing).
- Diagnostics with overlapping source ranges (should not normally occur) are conservatively excluded rather than risking a corrupted edit.
- The extension now activates shortly after VS Code starts (`onStartupFinished`) rather than waiting for the command to be run manually — a small, one-time startup cost needed so the status bar button and Auto Fix on Save are both ready immediately, the same tradeoff most save-hooking formatter/linter extensions make.

---

## Roadmap

Planned for future versions:

- [ ] Workspace-wide "Fix All" command
- [ ] Folder-level fixing
- [ ] Multi-root workspace support
- [ ] `CodeActionProvider` integration (fix warnings via the lightbulb menu directly)
- [ ] Progress notification for large files
- [ ] Marketplace icon and branding polish
- [ ] Optional telemetry
- [ ] Localization
- [ ] Unit and integration test suite
- [ ] CI/CD via GitHub Actions
- [ ] Semantic release automation

---

## Development

### Setup

```bash
git clone https://github.com/your-publisher-name/tailwind-warning-auto-fix.git
cd tailwind-warning-auto-fix
npm install
```

### Build

```bash
npm run compile      # one-time build
npm run watch         # incremental rebuild on file changes
```

### Debug

1. Open the project in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. Open a file with Tailwind classes in the new window and run the command.

### Lint

```bash
npm run lint
```

### Package

```bash
npm run package
```

Produces a `.vsix` file in the project root.

---

## Publishing

```bash
npx vsce login <publisher-name>
npx vsce publish
```

Or publish to [Open VSX](https://open-vsx.org) (no Azure/PAT required, just GitHub + a free Eclipse Foundation account):

```bash
npm run publish:openvsx
```

See [VS Code's official publishing guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for full details on creating a publisher and Personal Access Token.

---

## Contributing

Contributions are welcome. Please:

1. Open an issue describing the bug or feature before submitting a large PR.
2. Keep changes scoped — this project favors small, focused modules (see architecture below).
3. Run `npm run lint` and `npm run compile` before submitting.
4. Match the existing code style (strict TypeScript, no `any`, no unused code).

### Architecture Overview

```
src/
├── commands/       # Orchestrates the user-triggered "Fix All Warnings" flow
├── services/       # Diagnostics reading, replacement building, config access
├── parsers/        # Pure, dependency-free message parsing (optimization + conflict)
├── listeners/       # Background event listeners (Auto Fix on Save)
├── utils/          # Logging, notification, and status bar helpers
├── types/          # Shared interfaces
├── constants/      # Messages, regex patterns, command IDs
└── extension.ts    # Composition root (activate/deactivate)
```

---

## License

MIT — see [LICENSE](https://github.com/KedarGhadyalji/tailwind-warning-auto-fix?tab=MIT-1-ov-file).
