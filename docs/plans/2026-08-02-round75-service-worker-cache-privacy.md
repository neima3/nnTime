# Round 75 — Service-worker cache privacy

## Production finding

The production service worker claims every navigation and writes its full
request and response into one shared `kairo-v5-boundaries` cache. A synthetic
visit to `/reset-password?token=synthetic-sw-cache-probe` remained in Cache
Storage by full URL, and its cached no-store HTML contained the token. The same
cache preloads `/app/today`, which can be fetched while an account cookie is
present. This violates ADR-002's binding requirements that auth responses are
never stored and caches are user-scoped. Ignored evidence lives under
`browser-qa/round75-dogfood/`.

## Contract

- Never place navigation HTML, auth/reset/callback URLs, Next RSC responses, or
  any other route response in Cache Storage.
- Remove authenticated `/app/today` HTML from the install-time app shell.
- Cache only an explicit allowlist of public immutable shell assets.
- Keep navigation network-first with a public landing fallback, and keep API
  requests network-only with `cache: "no-store"`.
- Bump the cache version so activation deletes every prior shared cache,
  including already-persisted reset tokens and account HTML.
- Pin the executable service-worker behavior, not only source strings, then
  prove the cache contents in a production-mode browser and in production.

## Checklist

- [x] Reproduce token-bearing auth HTML persistence in production.
- [x] Confirm the cached body ignores its private no-store response contract.
- [x] Add failing executable service-worker cache-policy tests.
- [x] Implement the explicit public-asset allowlist and privacy cache bump.
- [x] Obtain independent Critical/Important review.
- [x] Pass browser, repository, parity, and iOS release gates.
- [ ] Commit, push, pass exact-SHA CI, deploy exact SHA, and verify live cache eviction.
