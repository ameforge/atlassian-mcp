---
description: Sync README.md and docs/*.md with source for one package or all three (runs on Haiku via the update-docs agent)
argument-hint: "[jira|confluence|bitbucket]"
allowed-tools: Agent
---

Launch the `update-docs` agent (subagent_type: update-docs) for package: $ARGUMENTS. Empty means all three packages. Relay its report.
