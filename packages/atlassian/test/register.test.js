import assert from "node:assert/strict";
import {test} from "node:test";
import {registerTools as registerBitbucket} from "@ameforge/bitbucket-mcp/src/register.js";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {registerTools as registerConfluence} from "conf-mcp/src/register.js";
import {registerTools as registerJira} from "g-jira-mcp/src/register.js";
import {registerTools} from "../src/register.js";

// How many tools a package registers on its own, so the expected totals follow
// the packages instead of being edited by hand on every new tool.
const count = (register) => {
  let n = 0;
  register({registerTool: () => n++});
  return n;
};
const JIRA_AND_CONFLUENCE = count(registerJira) + count(registerConfluence);

// The real McpServer throws on a duplicate tool name, which would stop the
// combined server at startup. Returns the names registered with the given
// BITBUCKET_API_TOKEN (undefined: unset).
const registeredNames = (bitbucketToken) => {
  const saved = process.env.BITBUCKET_API_TOKEN;
  if (bitbucketToken === undefined) delete process.env.BITBUCKET_API_TOKEN;
  else process.env.BITBUCKET_API_TOKEN = bitbucketToken;
  try {
    const server = new McpServer({name: "t", version: "0"});
    const names = [];
    const {registerTool} = server;
    server.registerTool = (name, ...rest) => {
      names.push(name);
      return registerTool.call(server, name, ...rest);
    };
    registerTools(server);
    return names;
  } finally {
    if (saved === undefined) delete process.env.BITBUCKET_API_TOKEN;
    else process.env.BITBUCKET_API_TOKEN = saved;
  }
};

test("registers every Jira and Confluence tool on one server", () => {
  const names = registeredNames(undefined);
  assert.equal(names.length, JIRA_AND_CONFLUENCE);
  for (const name of [
    "jira_add_comment",
    "confluence_add_comment",
    "jira_download_attachment",
    "confluence_download_attachment",
    "get_ticket",
    "get_page",
  ]) {
    assert.ok(names.includes(name), name);
  }
  assert.ok(!names.includes("get_pr"));
});

test("adds the Bitbucket tools only when BITBUCKET_API_TOKEN is set", () => {
  const names = registeredNames("token");
  assert.equal(names.length, JIRA_AND_CONFLUENCE + count(registerBitbucket));
  for (const name of ["get_pr", "create_pr", "merge_pr", "get_ticket"]) {
    assert.ok(names.includes(name), name);
  }
});
