# pi-hide-tools-extension

A planned Pi extension for hiding built-in tool calls and results from the terminal transcript.

Status: repository scaffold only. No extension implementation is available yet.

## Initial scope

- Hide the built-in `read`, `bash`, `edit`, `write`, `grep`, `find`, and `ls` tool rows.
- Leave AgentShell, Forgetful, and other extension tools visible and unchanged.
- Leave web search and web fetch unchanged; their integration is out of scope for now.
- Change presentation only, preserving execution, model context, and session history.
- Use Pi's original built-in tool execution rather than reimplementing it.

The rendering approach is based on Firstmate's Calm extension: own the visual shell and return
empty call/result components when hiding is enabled. No Firstmate code has been copied here.

## Features to consider

- A `/hide-tools` command to toggle visibility.
- Remember the visibility choice across sessions.
- Keep failed tool calls visible, even when successful calls are hidden.
- Per-tool selection, such as keeping edit and write diffs visible.
- An optional compact activity indicator without displaying arguments or output.

These are proposals, not implemented features or settled requirements.

## Validation before release

- Confirm hidden tools still execute and return their results to the model.
- Confirm AgentShell, Forgetful, and web tools retain their ordinary rendering.
- Check toggling, session restore, extension reload, and exported transcripts.
- Detect competing built-in overrides and warn rather than silently replace them.
- Verify actual terminal output in an isolated Pi/tmux session.

No dependencies have been added. Audit any new dependencies before installing them.
