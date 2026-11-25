import assert from "node:assert/strict";
import {mkdir, mkdtemp, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {beforeEach, test} from "node:test";
import {registerUsageReport, withUsage} from "../src/usage.js";

// Each test gets its own config dir, so no test reads another's log or the
// real one.
beforeEach(async () => {
  process.env.XDG_CONFIG_HOME = await mkdtemp(join(tmpdir(), "usage-"));
  delete process.env.ATLASSIAN_MCP_USAGE;
  delete process.env.ATLASSIAN_MCP_TOOLS;
});

const ok = {content: [{text: "done", type: "text"}]};
const failed = {content: [{text: "boom", type: "text"}], isError: true};

// A fake McpServer that keeps each registered handler so a test can call it.
const fakeServer = () => {
  const tools = new Map();
  return {
    registerTool: (name, _config, handler) => tools.set(name, handler),
    tools,
  };
};

const report = async (args = {}, open = () => {}) => {
  const server = fakeServer();
  registerUsageReport(server, open);
  return (await server.tools.get("usage_report")(args)).content[0].text;
};

test("usage_report counts done, read, write and errors per package", async () => {
  const server = fakeServer();
  const answers = {create_page: ok, get_ticket: ok, log_work: ok};
  for (const [pkg, name] of [
    ["jira", "log_work"],
    ["jira", "get_ticket"],
    ["confluence", "create_page"],
  ]) {
    withUsage(server, pkg).registerTool(name, {}, async () => answers[name]);
  }
  const call = (name) => server.tools.get(name)({});
  await call("log_work");
  await call("log_work");
  await call("get_ticket");
  await call("create_page");
  answers.log_work = failed;
  await call("log_work");

  const text = await report();
  assert.match(text, /3 done, 5 calls \(1 read, 4 write\), 1 error/);
  assert.match(text, /jira: 2 done, 4 calls, 1 error/);
  assert.match(text, /log_work \(write\): 2 done, 3 calls, 1 error/);
  assert.match(text, /get_ticket \(read\): 1 call/);
  assert.match(text, /confluence: 1 done, 1 call/);
});

test("ATLASSIAN_MCP_USAGE=off logs nothing", async () => {
  process.env.ATLASSIAN_MCP_USAGE = "off";
  const server = fakeServer();
  withUsage(server, "jira").registerTool("log_work", {}, async () => ok);
  await server.tools.get("log_work")({});
  delete process.env.ATLASSIAN_MCP_USAGE;

  assert.match(await report(), /0 done, 0 calls/);
});

test("usage_report counts only the last days and skips unreadable lines", async () => {
  const dir = join(process.env.XDG_CONFIG_HOME, "atlassian-mcp");
  await mkdir(dir);
  const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
  await writeFile(
    join(dir, "usage.jsonl"),
    [
      {ok: true, pkg: "jira", t: day(2), tool: "log_work"},
      {ok: true, pkg: "jira", t: day(40), tool: "log_work"},
    ]
      .map((e) => JSON.stringify(e))
      .concat("not json", "")
      .join("\n"),
  );

  assert.match(await report(), /1 done, 1 call /);
  assert.match(await report({days: 90}), /2 done, 2 calls /);
});

test("usage_report days are calendar days that include today", async () => {
  const dir = join(process.env.XDG_CONFIG_HOME, "atlassian-mcp");
  await mkdir(dir);
  const midnight = new Date().setHours(0, 0, 0, 0);
  await writeFile(
    join(dir, "usage.jsonl"),
    [midnight - 1, midnight]
      .map((t) =>
        JSON.stringify({
          ok: true,
          pkg: "jira",
          t: new Date(t).toISOString(),
          tool: "log_work",
        }),
      )
      .join("\n"),
  );

  assert.match(await report({days: 1}), /1 done, 1 call /);
  assert.match(await report({days: 2}), /2 done, 2 calls /);
});

test("usage_report html writes a board with the counts and opens it", async () => {
  const server = fakeServer();
  withUsage(server, "jira").registerTool("log_work", {}, async () => ok);
  await server.tools.get("log_work")({});
  const opened = [];

  const text = await report({format: "html"}, (file) => opened.push(file));

  const board = join(
    process.env.XDG_CONFIG_HOME,
    "atlassian-mcp",
    "board.html",
  );
  assert.deepEqual(opened, [board]);
  assert.ok(text.includes(board));
  const html = await readFile(board, "utf8");
  assert.match(html, /"tool":"log_work"/);
});

const registered = (pkg, names) => {
  const server = fakeServer();
  for (const name of names)
    withUsage(server, pkg).registerTool(name, {}, async () => ok);
  return [...server.tools.keys()];
};

test("ATLASSIAN_MCP_TOOLS unset or empty registers every tool", () => {
  assert.deepEqual(registered("jira", ["get_ticket", "log_work"]), [
    "get_ticket",
    "log_work",
  ]);
  process.env.ATLASSIAN_MCP_TOOLS = " , ";
  assert.deepEqual(registered("jira", ["get_ticket", "log_work"]), [
    "get_ticket",
    "log_work",
  ]);
});

test("ATLASSIAN_MCP_TOOLS allows a package or a tool, trimmed and in any case", () => {
  process.env.ATLASSIAN_MCP_TOOLS = " JIRA , Get_Page ";
  assert.deepEqual(registered("jira", ["get_ticket", "log_work"]), [
    "get_ticket",
    "log_work",
  ]);
  assert.deepEqual(registered("confluence", ["get_page", "create_page"]), [
    "get_page",
  ]);
});

test("ATLASSIAN_MCP_TOOLS prefixed entry allows only that product's copy", () => {
  process.env.ATLASSIAN_MCP_TOOLS = "jira_add_comment";
  assert.deepEqual(registered("jira", ["add_comment", "get_ticket"]), [
    "add_comment",
  ]);
  assert.deepEqual(registered("confluence", ["add_comment"]), []);
});

test("ATLASSIAN_MCP_TOOLS never hides usage_report", async () => {
  process.env.ATLASSIAN_MCP_TOOLS = "jira";
  assert.match(await report(), /0 done, 0 calls/);
});
