# atlassian-mcp

MCP servers for self-hosted Atlassian products (Jira and Confluence Server/Data Center). They let an AI assistant such as Claude Code read and write your Jira and Confluence directly. A Bitbucket Cloud server is included too.

## Packages

| Package                                    | npm                     | What it serves                                                                        |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| [packages/jira](packages/jira)             | `g-jira-mcp`            | Jira Server/Data Center (REST API v2)                                                 |
| [packages/confluence](packages/confluence) | `conf-mcp`              | Confluence Server/Data Center (REST API)                                              |
| [packages/bitbucket](packages/bitbucket)   | `@pnam16/bitbucket-mcp` | Bitbucket Cloud (REST API 2.0)                                                        |
| [packages/atlassian](packages/atlassian)   | `@pnam16/atlassian-mcp` | Jira and Confluence from one server, plus Bitbucket when `BITBUCKET_API_TOKEN` is set |

Each package README has the install command, environment variables and tool list. Use `@pnam16/atlassian-mcp` when you work with both Jira and Confluence, so your assistant needs one server entry instead of two.

Official setup guides:

- Claude Code: [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) explains `claude mcp add`, the local, project and user scopes, and the shared `.mcp.json` file.
- Claude Desktop: [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) shows, with screenshots, how to open `claude_desktop_config.json` from Settings, Developer, Edit Config, and where to find the logs when a server does not start.

## Development

Requires Node.js 18+ and pnpm.

```bash
pnpm install
pnpm test              # every package
pnpm -w run check      # biome check and tsc, read only
pnpm lint              # same checks, but rewrites files to fix formatting
pnpm build             # every package, each to its own dist/index.js
```

Releases run per package; see [docs/RELEASE.md](docs/RELEASE.md).

## Support

Questions or issues? Email [PNam](mailto:pnamhn16@gmail.com).

If this project helps you, consider buying me a coffee:

<img src="https://raw.githubusercontent.com/pnam16/atlassian-mcp/main/docs/buy-me-a-coffee.jpg" alt="Buy Me A Coffee" width="300">

---

Created by [PNam](mailto:pnamhn16@gmail.com)
