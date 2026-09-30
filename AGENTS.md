# Pi Hide Tools Extension

A small Pi extension for hiding built-in tool rows without changing tool execution.

## Architecture

See the [class diagram](docs/architecture/class_diagram/README.md) for module boundaries,
Pi API constraints, and known limitations. Update it when the design changes.

## Scope

- Target only `read`, `bash`, `edit`, `write`, `grep`, `find`, and `ls`.
- Leave AgentShell, Forgetful, web tools, and other extension tools untouched.
- Preserve execution, model context, session history, and tool availability.
- Use supported Pi APIs. Do not silently replace another extension's built-in override.

## Development

- Use TDD for rendering, extension behaviour, and terminal/export changes.
- Work in vertical slices: failing behaviour test, minimal implementation, refactor.
- Run `npm test`; run `npm run test:tui` for isolated, offline terminal validation.
- Tests use Node 22.19+ and the installed Pi host. No package installation is required.
- See the [testing guide](docs/validation.md) for setup and peer-extension checks.
- Audit dependencies before adding, installing, or upgrading them. Keep lines within 100 columns.
- Write docs for users and contributors. Keep personal paths, session logs, agent review reports,
  and tool-service limits out of repository documentation.
