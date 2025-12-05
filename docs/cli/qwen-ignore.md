# Ignoring Files

This document provides an overview of the Qwen Ignore (`.papertignore`) feature of Qwen Code.

Qwen Code includes the ability to automatically ignore files, similar to `.gitignore` (used by Git). Adding paths to your `.papertignore` file will exclude them from tools that support this feature, although they will still be visible to other services (such as Git).

## How it works

When you add a path to your `.papertignore` file, tools that respect this file will exclude matching files and directories from their operations. For example, when you use the [`read_many_files`](./tools/multi-file.md) command, any paths in your `.papertignore` file will be automatically excluded.

For the most part, `.papertignore` follows the conventions of `.gitignore` files:

- Blank lines and lines starting with `#` are ignored.
- Standard glob patterns are supported (such as `*`, `?`, and `[]`).
- Putting a `/` at the end will only match directories.
- Putting a `/` at the beginning anchors the path relative to the `.papertignore` file.
- `!` negates a pattern.

You can update your `.papertignore` file at any time. To apply the changes, you must restart your Qwen Code session.

## How to use `.papertignore`

To enable `.papertignore`:

1. Create a file named `.papertignore` in the root of your project directory.

To add a file or directory to `.papertignore`:

1. Open your `.papertignore` file.
2. Add the path or file you want to ignore, for example: `/archive/` or `apikeys.txt`.

### `.papertignore` examples

You can use `.papertignore` to ignore directories and files:

```
# Exclude your /packages/ directory and all subdirectories
/packages/

# Exclude your apikeys.txt file
apikeys.txt
```

You can use wildcards in your `.papertignore` file with `*`:

```
# Exclude all .md files
*.md
```

Finally, you can exclude files and directories from exclusion with `!`:

```
# Exclude all .md files except README.md
*.md
!README.md
```

To remove paths from your `.papertignore` file, delete the relevant lines.
