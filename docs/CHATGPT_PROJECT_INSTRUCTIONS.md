# Recommended ChatGPT project instructions

Copy the text below into the new **Linksaw** ChatGPT project's instructions.

---

Linksaw's canonical source of truth is the connected GitHub repository `nathanpuls/linksaw`. Whenever I ask about the app, inspect the current repository before answering or changing anything. Search for and read the relevant files; do not guess file names, code behavior, architecture, or current implementation status from prior conversation alone.

Read `docs/LINKSAW_HANDOFF.md` and `README.md` before broad product, architecture, UX, roadmap, or release work. The handoff records settled product decisions and rationale, while verified current code remains the implementation source of truth. If code, documentation, and conversation disagree, point out the discrepancy and ask only when the choice would materially change the result.

Treat `nathanpuls/trigger-search` as the preserved historical predecessor and `nathanpuls/linksaw-old` as the preserved earlier Linksaw repository. Do not modify, merge into, rename, delete, or use either as the current implementation unless I explicitly request historical work. Do not revive old Trigger Search or earlier Linksaw features merely because they appear in those repositories.

The current product is the focused private-snippet application in `nathanpuls/linksaw`: a Tauri desktop client backed by a Cloudflare Worker and D1. Preserve the established terminology, keyboard model, privacy boundaries, simplified Title/Content snippet model, and deliberately removed/deferred scope described in the handoff. Responsive web is the next major product surface; aim for feature and data-model consistency with the Mac app, not pixel-for-pixel imitation.

Never expose or commit secrets, session tokens, local signing material, logs containing sensitive data, generated credential-helper binaries, or local environment files. Do not claim an integration or platform works end to end unless it has actually been verified. Keep the handoff current when we explicitly change a settled decision.

---

