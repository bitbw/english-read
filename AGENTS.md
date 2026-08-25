# AGENTS.md

> Codex project instruction entry point.

## Source of truth

The project rules, architecture, command list, development workflow, validation requirements, and user-specific working habits are defined in the `CLAUDE.md` file in this directory.

Before starting work, read the complete file:

```text
CLAUDE.md
```

This file does not copy or maintain a separate set of project rules, so it cannot drift from `CLAUDE.md`.

## Execution requirements

- Follow the project architecture, coding conventions, development workflow, and validation requirements in `CLAUDE.md`.
- Use the commands listed in `CLAUDE.md` when running project tasks.
- If this file conflicts with `CLAUDE.md`, follow `CLAUDE.md`.
- When project rules change, update `CLAUDE.md` according to the user's latest instructions.
- Do not modify `CLAUDE.md` unless the user explicitly asks for it.
- Do not rewrite, weaken, or override the rules in `CLAUDE.md` merely because Codex is being used.

## File relationship

```text
CLAUDE.md  = canonical project rules, user preferences, and development conventions
AGENTS.md  = Codex entry point and rule reference
```