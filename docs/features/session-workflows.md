# Session Workflows

Papert Code supports two connected session surfaces:

- `/resume` for browser-first session continuation
- `/chat` for checkpoint and export operations

This page documents their unified behavior.

## Unified UX rules

### Browser-first resume

The following commands now open the same session browser dialog:

- `/resume`
- `/chat list`
- `/chat resume` (without tag)

### Tag-based resume remains supported

You can still resume explicitly by tag:

```bash
/chat resume <tag>
```

## `/chat` command map

- `/chat list`: open session browser
- `/chat save <tag>`: save checkpoint
- `/chat resume [tag]`: browser (no tag) or tag-based resume
- `/chat delete <tag>`: delete checkpoint
- `/chat share [filename]`: export current conversation

## Recommended usage

Use `/resume` when:

- you want to browse sessions interactively
- you do not have a checkpoint tag in mind

Use `/chat resume <tag>` when:

- you are scripting or documenting exact checkpoint restore operations
- you already know the target tag

Use `/chat save <tag>` when:

- you need stable handoff points for teammates or future sessions

## Migration notes

If you previously ran `/chat resume` and got a missing-tag error, the command now opens session browser instead.

No config migration is required.
