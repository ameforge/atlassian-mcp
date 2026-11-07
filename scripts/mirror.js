// Publishes packages/<dir> at HEAD to its mirror repo <pkg> as one commit on top of
// the mirror's main, tagged v<version>. The mirrors exist only to keep their
// GitHub stars; all development happens in this monorepo.
// commit-tree instead of `git subtree split`: split loses history across the
// conf-mcp -> confluence-mcp folder rename.
import {execFileSync} from "node:child_process";

// mirror repo name -> folder under packages/
const MIRRORS = new Map([
  ["confluence-mcp", "confluence"],
  ["jira-mcp", "jira"],
]);
const [pkg, version] = process.argv.slice(2);
const dir = MIRRORS.get(pkg);
if (!dir || !version) {
  console.error(
    "usage: node scripts/mirror.js <jira-mcp|confluence-mcp> <version>",
  );
  process.exit(1);
}

const url = `git@github.com:pnam16/${pkg}.git`;
const git = (...args) => execFileSync("git", args, {encoding: "utf8"}).trim();

git("fetch", url, "main");
const parent = git("rev-parse", "FETCH_HEAD");
const tree = git("rev-parse", `HEAD:packages/${dir}`);
const commit = git(
  "commit-tree",
  tree,
  "-p",
  parent,
  "-m",
  `chore: release v${version}`,
);
git(
  "push",
  // atomic: a rejected tag (re-run after a half-failed release) must not leave main moved.
  "--atomic",
  url,
  `${commit}:refs/heads/main`,
  `${commit}:refs/tags/v${version}`,
);
console.log(`Mirrored packages/${dir} to ${url} as v${version}`);
