# Pi Hide Tools Extension

Hide built-in tool calls and results in [Pi][pi], while leaving all other extensions' tools
unchanged. Failed calls stay visible.

## Requirements

- Pi 0.99.1 or 0.99.2
- Node.js 22.19 or newer
- Git for installation from GitHub

Pi supplies the runtime packages this extension uses.

## Installation

```bash
pi install git:github.com/ScottRBK/pi-hide-tools-extension
```

Start a new Pi session after installing. To install only for the current project, use:

```bash
pi install -l git:github.com/ScottRBK/pi-hide-tools-extension
```

Project-local packages load after you grant Pi trust for that project.
See [Pi's package guide][packages] for more installation options.

## Usage

In Pi, run:

```text
/hide-tools
```

Run it again to show the tools. The command hides calls and results for `read`, `bash`,
`edit`, `write`, `grep`, `find`, and `ls`, including while they are running. If a call fails,
its arguments and error become visible.

Tools continue to run normally. The model receives the same results, and session files and
HTML exports keep the full content. Hiding tools does not remove sensitive data.

The extension only changes Pi's terminal UI. RPC, JSON, and print mode are unaffected.
If another extension replaces a built-in tool, this extension leaves it alone and warns you.

### Saved preference

Tools start visible. Each toggle saves your choice to `~/.pi/agent/pi-hide-tools.json`, or
under `PI_CODING_AGENT_DIR` if set. New sessions use the saved choice.

If the preference cannot be read, tools start visible and Pi shows a warning. If saving
fails, the toggle still works for the current session. Keep the preference as a regular file:
saving replaces a symlink rather than following it.

## Limitations

- After `/reload` or switching sessions, restored tool rows can stay visible and ignore the
  toggle. Restart Pi and resume the saved session to hide them. New rows use the current setting.
- Inline images can remain visible because Pi renders them separately from tool text.
- Toggling preserves the global Ctrl+O setting but resets individually expanded rows to it.
- There are no per-tool settings. The command controls all seven built-in tools together.

See the [architecture notes][architecture] for tool-override ordering and SDK compatibility.

## Updating

```bash
pi update git:github.com/ScottRBK/pi-hide-tools-extension
```

Restart Pi after updating.

## Removal

```bash
pi remove git:github.com/ScottRBK/pi-hide-tools-extension
```

Use `-l` if you installed it for the current project. Restart Pi to unload the extension.

## Development

From a local checkout, load the extension without enabling other installed extensions:

```bash
pi --no-extensions --extension ./index.ts
```

Run the tests:

```bash
npm test
npm run test:tui
```

The tests use the installed Pi packages. The terminal check requires tmux and makes no model
requests. See the [testing guide][testing] for setup, coverage, and optional peer-extension checks.
Contributor instructions are in [AGENTS.md](AGENTS.md).

## Acknowledgements

The rendering approach was inspired by [Firstmate's Calm extension][firstmate].

[pi]: https://github.com/earendil-works/pi
[packages]: https://github.com/earendil-works/pi/blob/v0.99.2/packages/coding-agent/docs/packages.md
[architecture]: docs/architecture/class_diagram/README.md
[testing]: docs/validation.md
[firstmate]: https://github.com/kunchenguid/firstmate
