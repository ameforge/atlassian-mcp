import assert from "node:assert/strict";
import {mkdir, mkdtemp, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {beforeEach, test} from "node:test";
import {registerUsageReport} from "@ameforge/atlassian-request/src/usage.js";
import {importClaudeHistory} from "../src/import-history.js";

beforeEach(async () => {
  process.env.XDG_CONFIG_HOME = await mkdtemp(join(tmpdir(), "usage-"));
  process.env.CLAUDE_CONFIG_DIR = await mkdtemp(join(tmpdir(), "claude-"));
});

const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const use = (id, name, t) =>
  JSON.stringify({
    message: {content: [{id, input: {}, name, type: "tool_use"}]},
    timestamp: t,
    type: "assistant",
  });
const result = (id, isError) =>
  JSON.stringify({
    message: {
      content: [
        {content: "x", is_error: isError, tool_use_id: id, type: "tool_result"},
      ],
    },
    type: "user",
  });

const report = async () => {
  const tools = new Map();
  registerUsageReport({registerTool: (n, _c, h) => tools.set(n, h)});
  return (await tools.get("usage_report")({days: 90})).content[0].text;
};

test("import-claude-history adds past Atlassian calls older than the log, once", async () => {
  const project = join(process.env.CLAUDE_CONFIG_DIR, "projects", "D--a");
  await mkdir(join(project, "s1", "subagents"), {recursive: true});
  const old = daysAgo(10);
  await writeFile(
    join(project, "s1.jsonl"),
    [
      use("a", "mcp__atlassian-mcp__jira_add_comment", old),
      result("a", false),
      use("b", "mcp__g-jira-mcp__get_ticket", old),
      result("b", true),
      use("c", "mcp__conf-mcp__add_comment", old),
      use("h", "mcp__g-jira-mcp__add_comment", old),
      use("i", "mcp__bitbucket-mcp__renamed_tool", old),
      use("d", "mcp__notion__get_page", old),
      use("e", "Bash", old),
      use("g", "mcp__atlassian-mcp__log_work", daysAgo(1)),
      "not json",
    ].join("\n"),
  );
  // A resumed or forked session repeats earlier calls with the same id.
  await writeFile(
    join(project, "s1", "subagents", "agent-1.jsonl"),
    [
      use("a", "mcp__atlassian-mcp__jira_add_comment", old),
      use("f", "mcp__atlassian-mcp__create_pr", old),
    ].join("\n"),
  );
  const log = join(process.env.XDG_CONFIG_HOME, "atlassian-mcp");
  await mkdir(log);
  await writeFile(
    join(log, "usage.jsonl"),
    `${JSON.stringify({ok: true, pkg: "jira", t: daysAgo(5), tool: "log_work"})}\n`,
  );

  assert.equal((await importClaudeHistory()).added, 6);
  assert.equal((await importClaudeHistory()).added, 0);

  const text = await report();
  assert.match(text, /6 done, 7 calls/);
  assert.match(
    text,
    /jira: 3 done, 4 calls, 1 error\n {2}add_comment \(write\): 2 done, 2 calls\n/,
  );
  assert.match(text, /get_ticket \(read\): 1 call, 1 error/);
  assert.match(text, /log_work \(write\): 1 done, 1 call\n/);
  assert.match(text, /confluence: 1 done, 1 call/);
  assert.match(text, /bitbucket: 2 done, 2 calls/);
});
