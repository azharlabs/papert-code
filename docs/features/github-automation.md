# GitHub Automation

Papert Code provides built-in workflow automation commands for GitHub repositories.

## Commands

### `/github install`

Installs supported workflow templates into:

- `.github/workflows/`

This command is the recommended entry point for setting up GitHub automation.

### `/github status`

Checks installed workflow files and reports:

- `OK <file>` for installed workflows
- `MISSING <file>` for missing workflows

Use this command after cloning a repo or changing workflow files.

### `/github run <alias> [--ref <branch>] [--input key=value]`

Triggers a workflow via GitHub CLI:

```bash
/github run review
/github run dispatch --ref main --input env=prod --input dryRun=true
```

Alias mapping:

- `dispatch` -> `gemini-dispatch.yml`
- `assistant` -> `gemini-invoke.yml`
- `triage` -> `gemini-triage.yml`
- `scheduled-triage` -> `gemini-scheduled-triage.yml`
- `review` -> `gemini-review.yml`

Requirements:

- `gh` CLI installed and authenticated
- repository has the target workflow file

### `/github runs [alias]`

Fetches recent workflow runs from GitHub:

```bash
/github runs
/github runs triage
```

This uses `gh run list --limit 10` and, when alias is provided, applies a workflow filter.

## Legacy command

`/setup-github` remains available as a compatibility installer.

For new usage, prefer `/github install` + `/github status`.

## Typical workflow

1. Run `/github install`.
2. Run `/github status` and ensure all expected files are `OK`.
3. Trigger workflows with `/github run <alias>` as needed.
4. Check recent execution status with `/github runs [alias]`.

## Troubleshooting

### "Unable to determine the GitHub repository"

Cause:

- command executed outside a git repository

Fix:

- run Papert Code from the repository root (or any directory inside the repo)

### Workflow alias not recognized

Cause:

- unsupported alias passed to `/github run` or `/github runs`

Fix:

- use one of: `dispatch`, `assistant`, `triage`, `scheduled-triage`, `review`

### `gh workflow run` fails

Common causes:

- `gh` not authenticated
- missing workflow file
- insufficient repository permissions

Fix:

- run `gh auth status`
- verify `/github status`
- verify repository access and workflow permissions
