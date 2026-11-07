# atlassian-mcp

## Commands

- Full test run: `pnpm test` at the root.
- One test file: from `packages/<pkg>/`, run `node --test test/<path>.test.js`.
- Gate: `pnpm -w run check` (biome check and tsc, read only; release runs it too). `pnpm lint` is NOT a gate: it runs `biome migrate --write` and `biome check --write`, so it rewrites files instead of failing.

## Do not touch

- The mirror repos pnam16/jira-mcp and pnam16/confluence-mcp. Edit only here: on release, `scripts/mirror.js` commits `packages/<pkg>` on top of the mirror's main, so a direct edit there is replaced by the next release.

## Gotchas

- npm names differ from folder names: `packages/jira` publishes as `g-jira-mcp`, `packages/confluence` as `conf-mcp`, `packages/atlassian` as `@pnam16/atlassian-mcp`. Install commands in docs use the npm name.
- `@pnam16/atlassian-mcp` bundles the other two packages through `src/register.js` in each. A jira or confluence release reaches its users only after `@pnam16/atlassian-mcp` is released too. Its `workspace:*` versions stay literal under a plain `npm publish` in the package folder; `pnpm publish` and `pnpm pack` replace them.
- The same tool name in both packages (today `add_comment`, `download_attachment`) must get a prefix in `packages/atlassian/src/register.js`; otherwise its server throws "already registered" at startup, which its test catches.
- Release from the root with `pnpm release:<jira|conf|atlassian>` (runs in `packages/<dir>` via `pnpm -C`). It tags `jira-v`, `conf-v` or `atlassian-v<version>` and mirrors jira and confluence; `.release-it.json` sets `npm.publish: false` and `github.release: false`. The pushed tag triggers `.github/workflows/publish.yml`, which publishes to npm through trusted publishing (`pnpm pack`, then `npm publish` of the tarball) and creates the GitHub release. Do not also run `pnpm publish:<pkg>` after a release: it is the fallback for a failed workflow only, and a second publish of the same version fails.
- The packages fake Atlassian differently. Jira tools receive `jiraRequest` as an argument (`registerX(server, jiraRequest)`), and tests pass a fake from `test/helpers/fake-server.js`. Confluence tools import `confluenceRequest` directly, and tests stub `globalThis.fetch`. Follow the package's own style rather than adding a seam.
- `fakeServer` calls the handler directly and skips the zod `inputSchema`. A guard that a test must cover belongs in the handler; a test relying on schema validation passes for the wrong reason.
- Confluence write tools never replace existing data on their own (for example, `upload_attachment` always posts a new attachment and never updates a same-name one). Any overwrite must be an explicit opt-in parameter, agreed with the user first.
