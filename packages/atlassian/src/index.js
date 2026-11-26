import {openBoard} from "@ameforge/atlassian-request/src/usage.js";
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import pkg from "../package.json" with {type: "json"};
import {importClaudeHistory} from "./import-history.js";
import {registerTools} from "./register.js";

if (process.argv[2] === "import-claude-history") {
  const {added, file} = await importClaudeHistory(
    process.argv.length > 3 ? process.argv.slice(3) : undefined,
  );
  console.log(
    `Imported ${added} past tool calls from Claude Code into ${file}.`,
  );
} else if (process.argv[2] === "board") {
  console.log(`Board: ${await openBoard()}`);
} else {
  const server = new McpServer({
    name: "atlassian-mcp",
    version: pkg.version,
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Atlassian MCP server v${pkg.version} running on stdio`);
}
