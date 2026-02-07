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

### `/github run <alias>`

Triggers a workflow via GitHub CLI:

```bash
/github run review
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

## Legacy command

`/setup-github` remains available as a compatibility installer.

For new usage, prefer `/github install` + `/github status`.

## Typical workflow

1. Run `/github install`.
2. Run `/github status` and ensure all expected files are `OK`.
3. Trigger workflows with `/github run <alias>` as needed.

## Troubleshooting

### "Unable to determine the GitHub repository"

Cause:

- command executed outside a git repository

Fix:

- run Papert Code from the repository root (or any directory inside the repo)

### Workflow alias not recognized

Cause:

- unsupported alias passed to `/github run`

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
