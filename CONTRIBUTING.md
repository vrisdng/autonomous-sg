# Building Bojio? with Codex

Keep each request small enough to test. A good vibe-coding prompt has four parts:

1. **Outcome:** what the user should be able to do.
2. **Screen/state:** where it belongs and what already exists.
3. **Rules:** Singapore-specific behaviour, edge cases, and constraints.
4. **Done when:** a visible or testable acceptance condition.

Example:

> In the Meet tab, let me add, edit, and remove participants. Each participant needs a name and Singapore MRT station. Keep the current visual style. Done when I can add four people and their entries remain after switching tabs.

Before merging a feature:

- Run `npm run typecheck`.
- Test the changed flow on a narrow phone viewport.
- Replace mock claims with live data only when the source and timestamp are visible.
- Update `docs/PRODUCT.md` when product scope changes.
