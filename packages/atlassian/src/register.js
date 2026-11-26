import {
  registerUsageReport,
  withUsage,
} from "@ameforge/atlassian-request/src/usage.js";
import {registerTools as registerBitbucket} from "@ameforge/bitbucket-mcp/src/register.js";
import {registerTools as registerConfluence} from "conf-mcp/src/register.js";
import {registerTools as registerJira} from "g-jira-mcp/src/register.js";

// Both packages register these names, and one server cannot hold two tools of one name.
const SHARED = new Set(["add_comment", "download_attachment"]);

const prefixShared = (server, prefix) => ({
  registerTool: (name, config, handler) =>
    server.registerTool(
      SHARED.has(name) ? `${prefix}_${name}` : name,
      config,
      handler,
    ),
});

/** @param {any} server */
export const registerTools = (server) => {
  // withUsage sits inside prefixShared, so the log keeps each tool's own name.
  registerJira(withUsage(prefixShared(server, "jira"), "jira"));
  registerConfluence(
    withUsage(prefixShared(server, "confluence"), "confluence"),
  );
  // Bitbucket tools appear only when configured, so existing setups see no new tools.
  if (process.env.BITBUCKET_API_TOKEN) {
    registerBitbucket(withUsage(server, "bitbucket"));
  }
  registerUsageReport(server);
};
