# Contributing to Tailwind Warning Auto-Fix

Thanks for considering a contribution. This project favors small, focused, well-tested changes over large sweeping ones — see the architecture rationale below before diving in.

## Getting Started

```bash
git clone https://github.com/your-publisher-name/tailwind-warning-auto-fix.git
cd tailwind-warning-auto-fix
npm install
```

Press `F5` in VS Code to launch the Extension Development Host and try your changes live.

## Before Submitting a PR

1. **Open an issue first** for anything beyond a trivial fix, so design direction can be discussed before code is written.
2. **Run the checks:**
   ```bash
   npm run compile
   npm run lint
   ```
   Both must pass cleanly with zero errors.
3. **Match the existing architecture.** Specifically:
   - Business logic belongs in `services/`, never in `commands/`.
   - Anything touching diagnostic message parsing belongs in `parsers/` and must remain free of `vscode` imports (pure functions only).
   - No new npm dependencies without discussion first — this project intentionally keeps its dependency footprint minimal (`vscode` + `typescript` only).
   - No `any` types. No global mutable state. No document-wide text search or `string.replace()` across document content — all edits must go through `Diagnostic.range`.
4. **Keep PRs scoped.** One logical change per PR is easier to review and easier to revert if needed.

## Reporting Bugs

Please include:

- VS Code version
- Tailwind CSS IntelliSense version
- A minimal code snippet that reproduces the issue
- The exact diagnostic message text, if related to parsing

## Code of Conduct

Be respectful and constructive. Disagreements about implementation approach are welcome and expected — personal attacks are not.
