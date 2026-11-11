# Atlassian self-hosted mcp

MCP server for self-hosted Jira and Confluence (Server/Data Center) in one process. It serves every tool of [g-jira-mcp](https://github.com/ameforge/atlassian-mcp/tree/main/packages/jira) and [conf-mcp](https://github.com/ameforge/atlassian-mcp/tree/main/packages/confluence), so an AI assistant needs one server entry instead of two. With a Bitbucket Cloud API token it also serves the tools of [@ameforge/bitbucket-mcp](https://github.com/ameforge/atlassian-mcp/tree/main/packages/bitbucket).

## Requirements

- A Jira Server/Data Center account and a Confluence Server/Data Center account.
- Node.js 18+.
- Optional: a Bitbucket Cloud API token, for the Bitbucket tools.

## Quick start

Use Claude Code CLI. Run the command in a regular terminal, not inside a Claude Code session. Pick the block for your shell, since each one continues lines differently.

bash / zsh (macOS, Linux, Git Bash or WSL on Windows):

```bash
claude mcp add atlassian-mcp \
  -e ATLASSIAN_PASSWORD="your_password" \
  -e ATLASSIAN_USERNAME="your_username" \
  -e CONFLUENCE_HOST="https://conf.company.com" \
  -e JIRA_HOST="https://jira.company.com" \
  -- npx -y @ameforge/atlassian-mcp@latest
```

PowerShell (Windows):

```powershell
claude mcp add atlassian-mcp `
  -e ATLASSIAN_PASSWORD="your_password" `
  -e ATLASSIAN_USERNAME="your_username" `
  -e CONFLUENCE_HOST="https://conf.company.com" `
  -e JIRA_HOST="https://jira.company.com" `
  -- npx -y @ameforge/atlassian-mcp@latest
```

Command Prompt (cmd.exe): put the whole command on one line, or end each line with `^` instead of `\`.

Or manually add to `.claude/settings.json` (or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "atlassian-mcp": {
      "command": "npx",
      "args": ["-y", "@ameforge/atlassian-mcp@latest"],
      "env": {
        "ATLASSIAN_PASSWORD": "your_password",
        "ATLASSIAN_USERNAME": "your_username",
        "CONFLUENCE_HOST": "https://conf.company.com",
        "JIRA_HOST": "https://jira.company.com"
      }
    }
  }
}
```

`ATLASSIAN_USERNAME` and `ATLASSIAN_PASSWORD` sign in to both Jira and Confluence. If the two use different accounts, set `JIRA_USERNAME`, `JIRA_PASSWORD`, `CONFLUENCE_USERNAME` and `CONFLUENCE_PASSWORD` instead.

To add the Bitbucket tools, add these three to the command, or the same keys to `env`:

```bash
  -e BITBUCKET_API_TOKEN="your_api_token" \
  -e BITBUCKET_EMAIL="you@company.com" \
  -e BITBUCKET_WORKSPACE="your-workspace" \
```

Restart Claude Code/Desktop after editing the config.

To check that it connected, run `/mcp` inside Claude Code, or `claude mcp list` in a terminal.

Official setup guides:

- Claude Code: [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) explains `claude mcp add`, the local, project and user scopes, and the shared `.mcp.json` file.
- Claude Desktop: [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) shows, with screenshots, how to open `claude_desktop_config.json` from Settings, Developer, Edit Config, and where to find the logs when a server does not start.

## Environment variables

| Variable                | Required   | Description                                                                      |
| ----------------------- | ---------- | -------------------------------------------------------------------------------- |
| `ATLASSIAN_PASSWORD`    | yes*       | Password for Jira and Confluence                                                 |
| `ATLASSIAN_USERNAME`    | yes*       | Username for Jira and Confluence                                                 |
| `BITBUCKET_API_TOKEN`   | no         | Bitbucket Cloud API token; the Bitbucket tools appear only when it is set        |
| `BITBUCKET_EMAIL`       | with token | Atlassian account email of the token; `ATLASSIAN_EMAIL` is read when it is unset |
| `BITBUCKET_WORKSPACE`   | no         | Default workspace slug; without it every Bitbucket tool needs `workspace`        |
| `CONFLUENCE_HOST`       | yes        | Base URL, e.g. `https://conf.company.com`                                        |
| `CONFLUENCE_PASSWORD`   | no         | Confluence password; overrides `ATLASSIAN_PASSWORD`                              |
| `CONFLUENCE_TOKEN`      | no         | Personal Access Token; when set, replaces username/password (*)                  |
| `CONFLUENCE_USERNAME`   | no         | Confluence username; overrides `ATLASSIAN_USERNAME`                              |
| `JIRA_EPIC_LINK_FIELD`  | no         | Custom field ID for "Epic Link" (default `customfield_10001`)                    |
| `JIRA_HOST`             | yes        | Base URL, e.g. `https://jira.company.com`                                        |
| `JIRA_PASSWORD`         | no         | Jira password; overrides `ATLASSIAN_PASSWORD`                                    |
| `JIRA_START_DATE_FIELD` | no         | Custom field ID for "Start date" (default `customfield_11300`)                   |
| `JIRA_TIMEZONE`         | no         | Timezone for WorklogPRO form (default `Asia/Ho_Chi_Minh`)                        |
| `JIRA_TOKEN`            | no         | Personal Access Token; when set, replaces username/password (*)                  |
| `JIRA_USERNAME`         | no         | Jira username; overrides `ATLASSIAN_USERNAME`                                    |

`ATLASSIAN_API_TOKEN` alone does not turn on the Bitbucket tools here; set `BITBUCKET_API_TOKEN`.

## Tools

All 38 Jira and Confluence tools keep the names and parameters documented in the [g-jira-mcp](https://github.com/ameforge/atlassian-mcp/tree/main/packages/jira#tools) and [conf-mcp](https://github.com/ameforge/atlassian-mcp/tree/main/packages/confluence#tools) READMEs, except the two names both servers use, which carry a product prefix here:

| In g-jira-mcp / conf-mcp | In @ameforge/atlassian-mcp                                   |
| ------------------------ | ------------------------------------------------------------ |
| `add_comment`            | `jira_add_comment`, `confluence_add_comment`                 |
| `download_attachment`    | `jira_download_attachment`, `confluence_download_attachment` |

When `BITBUCKET_API_TOKEN` is set, the 22 Bitbucket tools are added with the names and parameters in the [@ameforge/bitbucket-mcp README](https://github.com/ameforge/atlassian-mcp/tree/main/packages/bitbucket#tools).

All logs go to stderr; stdout is reserved for the MCP protocol.

## Development

```bash
pnpm install
pnpm build             # bundle to dist/index.js via rsbuild
pnpm test
```

Release from the repo root with `pnpm release:atlassian`; see [docs/RELEASE.md](https://github.com/ameforge/atlassian-mcp/blob/main/docs/RELEASE.md). A release of g-jira-mcp, conf-mcp or @ameforge/bitbucket-mcp reaches this package only after it is released too.

## Support

Questions or issues? Email [PNam](mailto:pnamhn16@gmail.com).

If this project helps you, consider buying me a coffee:

<img src="https://raw.githubusercontent.com/ameforge/atlassian-mcp/main/docs/buy-me-a-coffee.jpg" alt="Buy Me A Coffee" width="300">

---

Created by [PNam](mailto:pnamhn16@gmail.com)
