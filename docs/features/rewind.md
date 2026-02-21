# Rewind

The `/rewind` command provides a safer restore flow on top of checkpointing.

It lets you:

- inspect available rewind points
- preview the target checkpoint context
- confirm before state is restored

## Prerequisites

`/rewind` requires checkpointing to be enabled for restore operations.

If checkpointing is disabled, running `/rewind` shows a guidance message:

- `Checkpointing is disabled. Enable general.checkpointing.enabled in settings, then restart the CLI.`

Enable checkpointing via settings or CLI flags documented in:

- `docs/features/checkpointing.md`

## Quick usage

List available rewind points:

```bash
/rewind
```

Preview + confirm a specific rewind point:

```bash
/rewind <checkpoint_id>
```

## What gets restored

After confirmation, `/rewind` restores the same payload as `/restore`:

- conversation UI history (if available in checkpoint)
- model client history (if available)
- git checkpoint snapshot (if `commitHash` exists in checkpoint)

## Safety model

`/rewind` always asks for explicit confirmation before restore execution.

This reduces accidental rollbacks compared with direct restore usage and is intended as the default user-facing rollback command.

`/rewind` also performs checkpoint integrity verification before confirmation and restore. Corrupted or tampered checkpoints are rejected.

## Choosing between `/rewind` and `/restore`

Use `/rewind` when:

- you want a confirmation gate before rollback
- you are exploring multiple candidate checkpoints

Use `/restore` when:

- you already know exact checkpoint id and want direct restore execution
- you are automating restore behavior in tightly controlled workflows

## Troubleshooting

### No rewind points found

Cause:

- no prior tool-call checkpoints exist yet

Action:

- run a command that triggers checkpointable tool activity, then run `/rewind` again

### Rewind point not found

Cause:

- wrong checkpoint ID

Action:

- run `/rewind` without args to list valid IDs

### Checkpoint integrity check failed

Cause:

- checkpoint contents were corrupted or modified after creation

Action:

- choose a different rewind point
- if needed, recreate the checkpoint by rerunning the relevant tool call

### Files did not roll back

Cause:

- selected checkpoint did not contain a git `commitHash`

Action:

- pick a checkpoint that indicates file restore capability (generated from tool calls that captured git snapshot data)
