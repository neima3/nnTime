# Round 19 executor prompt — native session and offline integrity

Execute
`docs/plans/2026-07-29-round19-native-session-integrity.md` task-by-task.

Binding inputs:

1. `AGENTS.md`
2. `docs/adr/ADR-002-api-and-offline-sync.md`
3. `docs/adr/ADR-003-auth.md`
4. `docs/plans/2026-07-29-round19-native-session-integrity-design.md`
5. `docs/plans/2026-07-29-round19-native-session-integrity.md`
6. `docs/design/design-spec.md`
7. `docs/DEPLOYMENT.md`

Use strict red/green TDD in the shipping Xcode target. Only a structured 401 is
evidence that the current session is invalid; offline, timeout, cancellation,
429, 5xx, and decoding errors must not become signed-out. Persist only the
configured Kairo Better Auth cookie envelope in Keychain with
`kSecAttrAccessibleAfterFirstUnlock`, and partition all local account data with
an opaque scope. Never put credentials in the day cache.

Cached Today is read-only. Do not invent or imply an offline mutation queue.
Logout, account switch, and 401 must converge on one unconditional local purge
even when server revocation fails.

Finish with app-hosted and generated Swift tests, unsigned shipping build,
fresh-simulator offline/relaunch/logout evidence, adversarial review, truthful
roadmap/parity/progress updates, full repository gates, commit/push, exact-SHA
CI, exact-SHA Coolify deployment, and read-only live health verification.
Do not claim magic-link completion, Sign in with Apple, widget credential
sharing, physical-device proof, or complete 7B/7C parity in this round.
