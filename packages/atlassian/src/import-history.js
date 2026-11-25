import {createReadStream} from "node:fs";
import {readdir} from "node:fs/promises";
import {homedir} from "node:os";
import {join} from "node:path";
import {createInterface} from "node:readline";
import {importEntries} from "@ameforge/atlassian-request/src/usage.js";
import {registerTools as registerBitbucket} from "@ameforge/bitbucket-mcp/src/register.js";
import {registerTools as registerConfluence} from "conf-mcp/src/register.js";
import {registerTools as registerJira} from "g-jira-mcp/src/register.js";

const toolNames = (register) => {
  const names = new Set();
  register({registerTool: (name) => names.add(name)});
  return names;
};

const NAMES = {
  bitbucket: toolNames(registerBitbucket),
  confluence: toolNames(registerConfluence),
  jira: toolNames(registerJira),
};

// Claude Code names a call mcp__<server>__<tool>; the bundle prefixes the
// shared names with jira_ or confluence_.
const classify = (server, raw) => {
  const [, prefix, rest] = raw.match(/^(jira|confluence)_(.+)$/) ?? [];
  if (prefix && NAMES[prefix].has(rest)) return {pkg: prefix, tool: rest};
  const owners = Object.keys(NAMES).filter((pkg) => NAMES[pkg].has(raw));
  const hint = Object.keys(NAMES).find((p) =>
    server.toLowerCase().includes(p.slice(0, 4)),
  );
  // A tool renamed since still counts when the server name tells its package.
  const pkg = owners.includes(hint) || !owners.length ? hint : owners[0];
  return pkg && {pkg, tool: raw};
};

/**
 * Adds the Atlassian tool calls in past Claude Code transcripts to the usage
 * log. Only the tool name, time and success are read from each call.
 * @param {string[]} [claudeDirs] all at once: a later import adds only calls
 * older than the log's first entry
 */
export const importClaudeHistory = async (
  claudeDirs = [process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude")],
) => {
  const files = [];
  for (const dir of claudeDirs) {
    const projects = join(dir, "projects");
    for (const f of await readdir(projects, {recursive: true}).catch(() => []))
      if (f.endsWith(".jsonl")) files.push(join(projects, f));
  }
  const calls = new Map();
  const failed = new Set();
  for (const file of files) {
    // Line by line: one transcript can be larger than a string may hold.
    for await (const line of createInterface({input: createReadStream(file)})) {
      if (!line.includes('"name":"mcp__') && !line.includes('"is_error":true'))
        continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      const content = record?.message?.content;
      for (const c of Array.isArray(content) ? content : []) {
        if (c?.type === "tool_result" && c.is_error) failed.add(c.tool_use_id);
        if (c?.type !== "tool_use" || typeof record.timestamp !== "string")
          continue;
        const [, server, raw] =
          String(c.name).match(/^mcp__(.+?)__(.+)$/) ?? [];
        const call =
          server && /jira|conf|atlassian|bitbucket/i.test(server)
            ? classify(server, raw)
            : undefined;
        if (call) calls.set(c.id, {...call, t: record.timestamp});
      }
    }
  }
  return importEntries(
    [...calls].map(([id, c]) => ({ok: !failed.has(id), ...c})),
  );
};
