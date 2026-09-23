# Repository guidance

Before discussing or changing Linksaw, inspect the current repository and read `README.md` plus `docs/LINKSAW_HANDOFF.md` for product context. Never guess code paths or behavior.

`nathanpuls/linksaw` is the current product. `nathanpuls/trigger-search` and `nathanpuls/linksaw-old` are preserved history, not implementation sources. Do not modify or merge them into this repository unless the user explicitly asks.

Preserve the focused private-snippet model, established terminology and keyboard behavior, and the removed/deferred scope recorded in the handoff. Treat verified code as implementation truth and flag any conflict with the documentation.

Never commit secrets, `.dev.vars`, session tokens, signing material, logs, build outputs, or generated credential-helper binaries. Preserve the existing local macOS session helper across routine builds; replacing it requires an explicit credential-migration plan.

Do not claim that authentication, native paste behavior, signing, or a platform works end to end without direct verification.

