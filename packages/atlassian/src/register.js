import {registerTools as registerBitbucket} from "@pnam16/bitbucket-mcp/src/register.js";
import {registerTools as registerConfluence} from "conf-mcp/src/register.js";
import {registerTools as registerJira} from "g-jira-mcp/src/register.js";

// Both packages register these names, and one server cannot hold two tools of
// one name, so here they carry their product as a prefix.
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
  registerJira(prefixShared(server, "jira"));
  registerConfluence(prefixShared(server, "confluence"));
  // Bitbucket is Cloud while the others are self-hosted; its tools appear only
  // for users who configure it, so existing setups see no new tools.
  if (process.env.BITBUCKET_API_TOKEN) registerBitbucket(server);
};
