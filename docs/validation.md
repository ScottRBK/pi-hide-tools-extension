# Validation

## Run locally

```bash
npm test
npm run test:tui
```

Use Node 22.19+ and a globally installed Pi. `test/register.mjs` resolves the host's packages
without downloading another copy. Set `PI_PACKAGE_DIR` if Pi is installed elsewhere. Set
`PI_BIN` for a different terminal executable; ensure it matches the package used by tests.
The grep/find integration cases also require Pi's usual `rg` and `fd` executables.

Tests run at the agreed tool/rendering, extension behaviour, and terminal/export boundaries.
`npm test` uses real Pi definitions, registry, loader, command dispatch, and temporary files.
No model calls are made. No fake extension registry is used.

`npm run test:tui` starts its own isolated tmux server/session, loads this checkout explicitly,
and replays a temporary session populated by real local built-in executions. Peer-tool results
are fixtures, not actual AgentShell jobs, memory requests, or searches. Captures and an HTML
export remain in the printed temporary directory. The tmux session is removed even on failure.

To check installed peer renderers, pass their entrypoints separated by the platform path delimiter:

```bash
PI_HIDE_TOOLS_PEER_EXTENSIONS=/path/agentshell/index.ts:/path/forgetful/index.ts \
  npm run test:tui
```

The smoke test disables Forgetful traffic in its temporary agent directory. Do not use an
extension that automatically installs dependencies or performs unrelated startup work in this
check without reviewing it first.

## Checked behaviour

- Hidden calls still return original results and perform actual file changes.
- All seven tools have zero-height hidden text/shells and stock visible rendering.
- Failed calls show their arguments and errors; renderer retries discard incompatible caches.
- Repeated toggles preserve the global Ctrl+O setting.
- Bash shell/prefix settings and read image-resize settings remain effective, including
  home-relative and file-URL shell paths normalized by Pi.
- Bash output streams and cancellation is forwarded. Hiding during streaming does not keep
  the stock renderer's elapsed timer alive after completion (checked in a child process).
- Preference persistence, invalid data, failed atomic save, and temporary-file cleanup.
- Tool availability, schemas, and prompt metadata; RPC/JSON/print mode left alone.
- Existing overrides in both load orders and detection of a later winning override.
- Non-target definitions/rendering survive toggles and reload.
- Original tool results remain in HTML exports; session entries are not rewritten.

Red/green slices started with one hidden read, then showing it through the command, failure
visibility, the remaining tools, override safety, non-TUI modes, settings, and persistence.
A rendering parity regression exposed stale component reuse after a write renderer threw;
clearing that cached component fixed it and the regression test now covers the retry.

Claude Code Opus found two further bugs: raw shell paths bypassed Pi's path normalization, and
skipping a hidden bash completion leaked the renderer's elapsed timer. Both were reproduced
with failing tests before fixing them. Earlier tests used absolute shell paths and had not
marked streaming rows as execution-started, so they did not exercise those behaviours.
Opus's follow-up confirmed both fixes, 30/30 tests, and no new bugs. It also ran the timer
regression against the old renderer and confirmed that the child process failed to exit.

## Terminal and browser evidence

Offline tmux validation on Pi 0.99.2 confirmed initial resume, show/hide toggling, Ctrl+O,
visible failures, HTML export, and real installed AgentShell/Forgetful/web renderers.
No models or peer tools were invoked. The recorded peer results remained visible.

Known limitation reproduced: restored rows can stay visible after `/reload` and session
switching because Pi captures their definitions before our ownership-safe registration.
The smoke check reports this separately; it does not claim those rows can be hidden. Initial
startup with the saved preference hides the same session's rows correctly.

The exported HTML was opened with existing Playwright/Chromium. All seven tools' output and
the three peer markers were readable while the extension was hiding terminal rows. The only
browser console error was the temporary server's missing `favicon.ico`.

Production TypeScript was checked with the existing TypeScript 5.9.3 compiler using strict
NodeNext/no-emit settings. No compiler dependency was installed. The Mermaid diagram was
rendered and visually checked with the existing Mermaid CLI.

## Dependency audit

No packages were installed or upgraded for this project. Optional peer declarations identify
Pi's host-supplied `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui`, versions 0.99.1
or 0.99.2. The host changed versions during development; tests were rerun on 0.99.2.

Before declaring the peers, npm metadata was checked for the official `earendil-works/pi`
repository, version, integrity, provenance-attestation links, and scripts. Neither peer lists
an install/postinstall lifecycle script. Pi's installed shrinkwrap was checked with `npm audit`
without modifying it, for both host versions.

**Existing host issue:** npm reported one high-severity vulnerable package, `brace-expansion`,
with denial-of-service advisories including [GHSA-qhr7-859c-m2p7][advisory]. This is in Pi's
existing dependency tree, not a dependency added here. The host needs a separate audited
update; no `npm audit fix`, installation, or host modification was performed.

[advisory]: https://github.com/advisories/GHSA-qhr7-859c-m2p7
