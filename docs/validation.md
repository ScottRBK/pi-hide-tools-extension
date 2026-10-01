# Testing

## Requirements

- Node.js 22.19 or newer
- Pi 0.99.1 or 0.99.2 installed globally, with `pi` available on `PATH`
- `rg` and `fd` for the grep and find tests
- tmux for the terminal check, on Linux, macOS, or WSL2

No package installation is needed in this checkout. The test loader uses Pi's installed packages.
For a non-global installation, set `PI_PACKAGE_DIR` to the directory containing Pi's
`package.json`. Set `PI_BIN` to use a different Pi executable for the terminal check; it must
match the package version used by the tests.

## Integration tests

From the repository root:

```bash
npm test
```

The suite uses Node's built-in test runner, Pi's tool definitions and extension loader, and
files in temporary directories. It executes tools without making model requests.

Coverage includes:

- Execution and results for all seven built-in tools while their rows are hidden.
- Visible failures, repeated toggles, Ctrl+O state, and recovery from renderer errors.
- Bash streaming, cancellation, shell settings, and path normalization for `~/` and file URLs.
- Bash timer cleanup when a running row is hidden before completion.
- Read's image-resizing setting.
- Preference persistence, invalid files, failed saves, and temporary-file cleanup.
- Tool availability, schemas, prompt metadata, and unchanged RPC, JSON, and print modes.
- Competing overrides in both load orders and detection of a later winning override.
- Unchanged definitions and rendering for other extensions' tools through toggles and reload.
- Original tool results preserved in HTML exports.

## Terminal check

```bash
npm run test:tui
```

This starts Pi with the local extension in an isolated tmux server and session. It loads a
saved session populated by real built-in tool executions. Results from other extensions' tools
are recorded fixtures; those tools are not executed.

The check exercises saved preferences, show/hide toggling, Ctrl+O, visible errors, HTML export,
reload, and session switching. It prints the directory containing terminal captures and the
exported HTML, then removes its tmux session, including on failure. Existing tmux sessions
are left alone.

The reload and session-switch checks report whether restored rows are hidden. Those rows can
stay visible because Pi creates them before the extension registers its wrappers. The check
reports this [known limitation](../README.md#limitations) without failing the test.

### Other extensions

To check the renderers from installed extensions, pass their entrypoints as a colon-separated
list on Linux, macOS, or WSL2:

```bash
PI_HIDE_TOOLS_PEER_EXTENSIONS=/path/extension-a/index.ts:/path/extension-b/index.ts \
  npm run test:tui
```

Review extensions before including them: their startup code can install dependencies or make
network requests. The check does not block these actions for arbitrary extensions.

## Manual export check

Open the terminal check's `session.html` in a browser. Confirm that results from all seven
built-in tools are readable, even though their terminal rows were hidden. The recorded
results from other extensions' tools should also remain visible.
