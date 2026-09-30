# pi-hide-tools-extension

Hide Pi's built-in tool calls and results from the terminal transcript.
AgentShell, Forgetful, web search, and other extension tools stay unchanged.

## Use

Try the local checkout without installing it:

```bash
pi --extension /absolute/path/to/pi-hide-tools-extension/index.ts
```

Run `/hide-tools` to toggle. Tools start visible; the choice is saved to
`~/.pi/agent/pi-hide-tools.json` (or the directory set by `PI_CODING_AGENT_DIR`).
Keep that file regular: saving replaces a symlink rather than following it.

- Hides `read`, `bash`, `edit`, `write`, `grep`, `find`, and `ls`.
- Shows failed calls and their errors, even while hiding is enabled.
- Keeps execution, model context, saved results, and tool availability unchanged.
- Preserves Pi's shell settings and image-resizing setting.
- Leaves another extension's built-in override alone and warns about it.
- Only operates in the terminal UI, not RPC, JSON, or print mode.

Tested with Pi 0.99.1 and 0.99.2. No extra runtime packages need installing.

## Limitations

- **After `/reload` or switching sessions**, restored rows can remain visible and ignore the
  toggle. Pi constructs those rows before the ownership check. Restart Pi with the saved
  session to hide them. New tool rows use the current setting.
- Inline images can remain visible: Pi renders them separately from tool text.
- Hiding is not redaction. Session files and HTML exports retain tool content.
- Overrides registered later by other extensions are subject to Pi's first-wins ordering.
  A changed winner is reported on the next toggle or session start; a losing registration is
  not visible through Pi's public API.
- Toggling preserves the global Ctrl+O setting, but resets individual mouse-expanded rows to it.

Web-tool hiding, per-tool settings, and activity indicators are deliberately out of scope.

## Development

```bash
npm test
npm run test:tui
```

Tests use the installed Pi host and Node's built-in test runner. The TUI check uses tmux,
temporary sessions, and recorded tool results; it makes no model requests.

See the [class diagram](docs/architecture/class_diagram/README.md),
[validation notes](docs/validation.md), and lean contributor guide in [AGENTS.md](AGENTS.md).
The renderer idea came from [Firstmate's Calm extension][firstmate]; no code was copied.

[firstmate]: https://github.com/kunchenguid/firstmate
