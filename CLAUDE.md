# atlassian-mcp

## Commands

- Full test run: `pnpm test` at the root.
- One test file: from `packages/<pkg>/`, run `node --test test/<path>.test.js`.
- Gate: `pnpm -w run check` (biome check and tsc, read only; release runs it too). `pnpm lint` is NOT a gate: it runs `biome migrate --write` and `biome check --write`, so it rewrites files instead of failing.
- There is no CI workflow. `git push` to origin runs `.githooks/pre-push` (check, then test; enabled by the root `prepare` script on `pnpm install`), so a push that fails the hook is fixed, not retried with `--no-verify`.

## Do not touch

- The mirror repos ameforge/jira-mcp, ameforge/confluence-mcp and ameforge/bitbucket-mcp. Edit only here: on release, `scripts/mirror.js` commits `packages/<pkg>` on top of the mirror's main, so a direct edit there is replaced by the next release.

## Gotchas

- npm names differ from folder names: `packages/jira` publishes as `g-jira-mcp`, `packages/confluence` as `conf-mcp`, `packages/bitbucket` as `@ameforge/bitbucket-mcp`, `packages/atlassian` as `@ameforge/atlassian-mcp`. Install commands in docs use the npm name.
- `@ameforge/atlassian-mcp` bundles the other three packages through `src/register.js` in each; Bitbucket tools register only when `BITBUCKET_API_TOKEN` is set. A jira, confluence or bitbucket release reaches atlassian users only after `@ameforge/atlassian-mcp` is released too, so the root `release:jira`, `release:conf` and `release:bitbucket` scripts end with `pnpm release:atlassian`, whose bump also counts commits under those three folders. Its `workspace:*` versions stay literal under a plain `npm publish` in the package folder; `pnpm publish` and `pnpm pack` replace them.
- The same tool name in two bundled packages (today `add_comment` and `download_attachment`, in jira and confluence) must get a prefix in `packages/atlassian/src/register.js`; otherwise its server throws "already registered" at startup, which its test catches.
- Release from the root with `pnpm release:<jira|conf|bitbucket|atlassian|all>` (runs in `packages/<dir>` via `pnpm -C`). There is no prompt: `@release-it/conventional-changelog` picks the bump from the Conventional Commits under the package folder since its last tag (`feat` minor, `fix`/`perf`/`revert` patch, breaking major; `chore`, `ci`, `refactor`, `docs` alone release nothing and the run ends with "No new version to release"), and `only-version` skips the commit, tag and push prompts. Preview with `pnpm -C packages/<dir> exec release-it --release-version`. Force a level with `pnpm -C packages/<dir> release <patch|minor|major>`; `pnpm release:jira minor` would pass `minor` to the atlassian step instead. Each release tags `jira-v`, `conf-v`, `bitbucket-v` or `atlassian-v<version>` and mirrors jira, confluence and bitbucket; `.release-it.json` sets `npm.publish: false` and `github.release: false`. Only the `atlassian-v*` tag, pushed last by every root release script, triggers `.github/workflows/publish.yml`; that one run publishes every package whose version is not on npm yet, through trusted publishing (`pnpm pack`, then `npm publish` of the tarball), and creates its GitHub release. Do not also run `pnpm publish:<pkg>` after a release: it is the fallback for a failed workflow only, and a second publish of the same version fails.
- The packages fake Atlassian differently. Jira tools receive `jiraRequest` as an argument (`registerX(server, jiraRequest)`), and tests pass a fake from `test/helpers/fake-server.js`. Bitbucket follows the Jira style with `bbRequest` and its own `test/helpers/fake-server.js`. Confluence tools import `confluenceRequest` directly, and tests stub `globalThis.fetch`. Follow the package's own style rather than adding a seam.
- `fakeServer` calls the handler directly and skips the zod `inputSchema`. A guard that a test must cover belongs in the handler; a test relying on schema validation passes for the wrong reason.
- Confluence write tools never replace existing data on their own (for example, `upload_attachment` always posts a new attachment and never updates a same-name one). Any overwrite must be an explicit opt-in parameter, agreed with the user first.
