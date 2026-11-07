# Atlassian self-hosted mcp

MCP server for self-hosted Jira and Confluence (Server/Data Center) in one process. It serves every tool of [g-jira-mcp](https://github.com/pnam16/atlassian-mcp/tree/main/packages/jira) and [conf-mcp](https://github.com/pnam16/atlassian-mcp/tree/main/packages/confluence), so an AI assistant needs one server entry instead of two.

## Requirements

- A Jira Server/Data Center account and a Confluence Server/Data Center account.
- Node.js 18+.

## Quick start

Use Claude Code CLI. Run the command in a regular terminal, not inside a Claude Code session. Pick the block for your shell, since each one continues lines differently.

bash / zsh (macOS, Linux, Git Bash or WSL on Windows):

```bash
claude mcp add atlassian-mcp \
  -e JIRA_HOST="https://jira.company.com" \
  -e JIRA_USERNAME="your_username" \
  -e JIRA_PASSWORD="your_password" \
  -e CONFLUENCE_HOST="https://conf.company.com" \
  -e CONFLUENCE_USERNAME="your_username" \
  -e CONFLUENCE_PASSWORD="your_password" \
  -- npx -y @pnam16/atlassian-mcp@latest
```

PowerShell (Windows):

```powershell
claude mcp add atlassian-mcp `
  -e JIRA_HOST="https://jira.company.com" `
  -e JIRA_USERNAME="your_username" `
  -e JIRA_PASSWORD="your_password" `
  -e CONFLUENCE_HOST="https://conf.company.com" `
  -e CONFLUENCE_USERNAME="your_username" `
  -e CONFLUENCE_PASSWORD="your_password" `
  -- npx -y @pnam16/atlassian-mcp@latest
```

Command Prompt (cmd.exe): put the whole command on one line, or end each line with `^` instead of `\`.

Or manually add to `.claude/settings.json` (or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "atlassian-mcp": {
      "command": "npx",
      "args": ["-y", "@pnam16/atlassian-mcp@latest"],
      "env": {
        "JIRA_HOST": "https://jira.company.com",
        "JIRA_USERNAME": "your_username",
        "JIRA_PASSWORD": "your_password",
        "CONFLUENCE_HOST": "https://conf.company.com",
        "CONFLUENCE_USERNAME": "your_username",
        "CONFLUENCE_PASSWORD": "your_password"
      }
    }
  }
}
```

Restart Claude Code/Desktop after editing the config.

To check that it connected, run `/mcp` inside Claude Code, or `claude mcp list` in a terminal.

Official setup guides:

- Claude Code: [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) explains `claude mcp add`, the local, project and user scopes, and the shared `.mcp.json` file.
- Claude Desktop: [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers) shows, with screenshots, how to open `claude_desktop_config.json` from Settings, Developer, Edit Config, and where to find the logs when a server does not start.

## Environment variables

| Variable                | Required | Description                                                     |
| ----------------------- | -------- | --------------------------------------------------------------- |
| `JIRA_HOST`             | yes      | Base URL, e.g. `https://jira.company.com`                       |
| `JIRA_USERNAME`         | yes*     | Jira username                                                   |
| `JIRA_PASSWORD`         | yes*     | Jira password                                                   |
| `JIRA_TOKEN`            | no       | Personal Access Token; when set, replaces username/password (*) |
| `JIRA_START_DATE_FIELD` | no       | Custom field ID for "Start date" (default `customfield_11300`)  |
| `JIRA_EPIC_LINK_FIELD`  | no       | Custom field ID for "Epic Link" (default `customfield_10001`)   |
| `JIRA_TIMEZONE`         | no       | Timezone for WorklogPRO form (default `Asia/Ho_Chi_Minh`)       |
| `CONFLUENCE_HOST`       | yes      | Base URL, e.g. `https://conf.company.com`                       |
| `CONFLUENCE_USERNAME`   | yes*     | Confluence username                                             |
| `CONFLUENCE_PASSWORD`   | yes*     | Confluence password                                             |
| `CONFLUENCE_TOKEN`      | no       | Personal Access Token; when set, replaces username/password (*) |

## Tools

All 36 tools keep the names and parameters documented in the [g-jira-mcp](https://github.com/pnam16/atlassian-mcp/tree/main/packages/jira#tools) and [conf-mcp](https://github.com/pnam16/atlassian-mcp/tree/main/packages/confluence#tools) READMEs, except the two names both servers use, which carry a product prefix here:

| In g-jira-mcp / conf-mcp | In @pnam16/atlassian-mcp                                     |
| ------------------------ | ------------------------------------------------------------ |
| `add_comment`            | `jira_add_comment`, `confluence_add_comment`                 |
| `download_attachment`    | `jira_download_attachment`, `confluence_download_attachment` |

All logs go to stderr; stdout is reserved for the MCP protocol.

## Development

```bash
pnpm install
pnpm build             # bundle to dist/index.js via rsbuild
pnpm test
pnpm release           # release-it: runs check, test and build, then bumps version, commits, tags, pushes (commit your changes first; pnpm publish is a separate step)
```

A release of g-jira-mcp or conf-mcp reaches this package only after it is released too.

## Support

Questions or issues? Email [PNam](mailto:pnamhn16@gmail.com).

If this project helps you, consider buying me a coffee:

<img src="https://raw.githubusercontent.com/pnam16/atlassian-mcp/main/docs/buy-me-a-coffee.jpg" alt="Buy Me A Coffee" width="300">

---

Created by [PNam](mailto:pnamhn16@gmail.com)
