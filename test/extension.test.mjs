import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { initTheme, ToolExecutionComponent } from "@earendil-works/pi-coding-agent";
import { ProcessTerminal, TuiMainScreen } from "@earendil-works/pi-tui";
import initialize from "../index.ts";
import { openSession } from "./session.mjs";

initTheme("dark", false);
const tui = new TuiMainScreen(new ProcessTerminal());

function readRow(harness, isError = false) {
  const row = new ToolExecutionComponent("read", "test-call", { path: "example.txt" }, {},
    harness.session.getToolDefinition("read"), tui, harness.cwd);
  row.updateResult({
    content: [{ type: "text", text: "UNCHANGED_RESULT" }], isError,
  });
  harness.rows.push(row);
  return row;
}

for (const isError of [false, true]) {
  const outcome = isError ? "failed" : "successful";
  test(`/hide-tools hides and restores ${outcome} rows without changing Ctrl+O`, async (t) => {
    // Arrange
    const harness = await openSession(t, initialize);
    const row = readRow(harness, isError);
    harness.ui.setToolsExpanded(true);
    const visible = row.render(100);
    assert.match(visible.join("\n"), /UNCHANGED_RESULT/);

    // Act / Assert
    await harness.session.prompt("/hide-tools");
    assert.deepEqual(row.render(100), []);
    assert.equal(harness.ui.getToolsExpanded(), true);
    assert.equal(harness.notices.at(-1).message,
      "Built-in tools hidden (including failures). Preference saved.");
    await harness.session.prompt("/hide-tools");
    assert.deepEqual(row.render(100), visible);
    assert.equal(harness.ui.getToolsExpanded(), true);
  });
}

test("/hide-tools failures toggles only failed rows and saves the choice", async (t) => {
  // Arrange
  const h = await openSession(t, initialize);
  const successful = readRow(h);
  const failed = readRow(h, true);
  const visibleFailure = failed.render(100);
  await h.session.prompt("/hide-tools");
  assert.deepEqual(successful.render(100), []);
  assert.deepEqual(failed.render(100), []);

  // Act / Assert: opting out reveals only failures, including after restarting.
  await h.session.prompt("/hide-tools failures");
  assert.deepEqual(successful.render(100), []);
  assert.deepEqual(failed.render(100), visibleFailure);
  assert.equal(h.notices.at(-1).message,
    "Failed calls stay visible when tools are hidden. Preference saved.");
  const resumed = await openSession(t, initialize, { cwd: h.cwd });
  assert.deepEqual(readRow(resumed).render(100), []);
  const resumedFailure = readRow(resumed, true);
  assert.deepEqual(resumedFailure.render(100), visibleFailure);

  // Act / Assert: opting back in hides failures without showing successful rows.
  await resumed.session.prompt("/hide-tools failures");
  assert.deepEqual(resumedFailure.render(100), []);
  assert.equal(resumed.notices.at(-1).message,
    "Failed calls are included when tools are hidden. Preference saved.");
  const restarted = await openSession(t, initialize, { cwd: h.cwd });
  assert.deepEqual(readRow(restarted).render(100), []);
  assert.deepEqual(readRow(restarted, true).render(100), []);
});

test("the failures option changes policy without hiding currently visible rows", async (t) => {
  // Arrange
  const h = await openSession(t, initialize);
  const successful = readRow(h);
  const failed = readRow(h, true);
  const visibleSuccess = successful.render(100);
  const visibleFailure = failed.render(100);

  // Act / Assert
  await h.session.prompt("/hide-tools failures");
  assert.deepEqual(successful.render(100), visibleSuccess);
  assert.deepEqual(failed.render(100), visibleFailure);
  await h.session.prompt("/hide-tools");
  assert.deepEqual(successful.render(100), []);
  assert.deepEqual(failed.render(100), visibleFailure);
  assert.equal(h.notices.at(-1).message,
    "Built-in tools hidden (failures stay visible). Preference saved.");
  await h.session.prompt("/hide-tools");
  assert.deepEqual(successful.render(100), visibleSuccess);
  assert.deepEqual(failed.render(100), visibleFailure);
  const restarted = await openSession(t, initialize, { cwd: h.cwd });
  assert.deepEqual(readRow(restarted).render(100), visibleSuccess);
  assert.deepEqual(readRow(restarted, true).render(100), visibleFailure);
  await restarted.session.prompt("/hide-tools");
  assert.deepEqual(readRow(restarted).render(100), []);
  assert.deepEqual(readRow(restarted, true).render(100), visibleFailure);
});

test("unsupported arguments leave visibility and saved preferences unchanged", async (t) => {
  // Arrange
  const h = await openSession(t, initialize);
  const successful = readRow(h);
  const failed = readRow(h, true);
  await h.session.prompt("/hide-tools");
  const path = join(h.agentDir, "pi-hide-tools.json");
  const saved = await readFile(path, "utf8");

  // Act / Assert
  for (const args of ["all", "failure", "failures extra"]) {
    await h.session.prompt(`/hide-tools ${args}`);
    assert.deepEqual(successful.render(100), []);
    assert.deepEqual(failed.render(100), []);
    assert.equal(await readFile(path, "utf8"), saved);
    assert.deepEqual(h.notices.at(-1), {
      message: "Usage: /hide-tools [failures]", type: "warning",
    });
  }
});

const selected = ["read", "bash", "edit", "write", "grep", "find", "ls"];

test("all seven tools execute normally while their terminal rows are hidden", async (t) => {
  // Arrange
  const h = await openSession(t, initialize, { tools: selected });
  await writeFile(join(h.cwd, "source.txt"), "ORIGINAL_MARKER\n");
  const calls = [
    ["write", { path: "created.txt", content: "CREATED_MARKER\n" }, /Successfully wrote/],
    ["edit", { path: "source.txt",
      edits: [{ oldText: "ORIGINAL", newText: "EDITED" }] }, /Successfully/],
    ["read", { path: "source.txt" }, /EDITED_MARKER/],
    ["grep", { pattern: "EDITED_MARKER", path: "." }, /source.txt.*EDITED_MARKER/],
    ["find", { pattern: "source.txt", path: "." }, /source.txt/],
    ["ls", { path: "." }, /created.txt/],
    ["bash", { command: "printf SHELL_MARKER" }, /SHELL_MARKER/],
  ];
  await h.session.prompt("/hide-tools");

  // Act / Assert
  for (const [name, args, expected] of calls) {
    const definition = h.session.getToolDefinition(name);
    const tool = h.session.agent.state.tools.find((tool) => tool.name === name);
    const result = await tool.execute("test-call", args);
    assert.match(result.content.map((part) => part.text).join("\n"), expected);
    const row = new ToolExecutionComponent(name, "test-call", args, {}, definition, tui, h.cwd);
    row.updateResult({ ...result, isError: false });
    assert.deepEqual(row.render(100), [], name);
  }
  assert.equal(await readFile(join(h.cwd, "created.txt"), "utf8"), "CREATED_MARKER\n");
  assert.equal(await readFile(join(h.cwd, "source.txt"), "utf8"), "EDITED_MARKER\n");
});

for (const order of ["before", "after"]) {
  test(`a competing read override loaded ${order} us is left intact`, async (t) => {
    // Arrange: a real extension with deliberately different execution and rendering.
    const { createReadToolDefinition } = await import("@earendil-works/pi-coding-agent");
    const { Text } = await import("@earendil-works/pi-tui");
    const foreign = {
      ...createReadToolDefinition(process.cwd()),
      execute: async () => ({ content: [{ type: "text", text: "FOREIGN_RESULT" }] }),
      renderCall: () => new Text("FOREIGN_CALL", 0, 0),
      renderResult: () => new Text("FOREIGN_RENDER", 0, 0),
    };
    const competitor = (pi) => pi.registerTool(foreign);
    const extensions = order === "before"
      ? [competitor, initialize] : [initialize, competitor];
    const h = await openSession(t, initialize, { extensions });

    // Act
    await h.session.prompt("/hide-tools");
    const definition = h.session.getToolDefinition("read");
    const result = await h.session.agent.state.tools.find((x) => x.name === "read")
      .execute("foreign", { path: "anything" });
    const row = readRow(h);

    // Assert
    assert.equal(definition, foreign);
    assert.equal(result.content[0].text, "FOREIGN_RESULT");
    assert.match(row.render(100).join("\n"), /FOREIGN_RENDER/);
    assert.ok(h.notices.some((x) => x.type === "warning" && /read/.test(x.message)));
  });
}

for (const mode of ["rpc", "json", "print"]) {
  test(`${mode} mode does not replace tools or toggle presentation`, async (t) => {
    // Arrange
    const h = await openSession(t, initialize, { mode });
    // Act
    await h.session.prompt("/hide-tools");
    await h.session.prompt("/hide-tools failures");
    // Assert
    assert.deepEqual(h.session.getAllTools(), h.before);
    assert.deepEqual(h.session.getActiveToolNames(), h.activeBefore);
    assert.ok(h.notices.some((x) => /terminal/i.test(x.message)));
  });
}

test("bash keeps Pi's configured shell and command prefix", async (t) => {
  // Arrange
  const { chmod, mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const cwd = await mkdtemp(join(tmpdir(), "hide-tools-shell-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const shellPath = join(cwd, "custom-shell");
  await writeFile(shellPath, '#!/bin/sh\nexport CUSTOM_SHELL=used\nexec /bin/bash "$@"\n');
  await chmod(shellPath, 0o700);
  const h = await openSession(t, initialize, {
    cwd, settings: { shellPath, shellCommandPrefix: "export PREFIX=preserved" },
  });

  // Act
  const bash = h.session.agent.state.tools.find((x) => x.name === "bash");
  const result = await bash.execute("configured", { command: 'printf "$PREFIX-$CUSTOM_SHELL"' });

  // Assert
  assert.equal(result.content[0].text, "preserved-used");
});

test("registration preserves tool availability, schemas and prompt metadata", async (t) => {
  // Arrange
  const h = await openSession(t, initialize, { tools: ["read"] });
  const withoutSource = ({ sourceInfo, ...tool }) => tool;
  // Act
  await h.session.prompt("/hide-tools");
  await h.bind();
  // Assert
  assert.deepEqual(h.session.getActiveToolNames(), h.activeBefore);
  assert.deepEqual(h.session.getAllTools().map(withoutSource), h.before.map(withoutSource));
});

test("the visibility choice survives a fresh Pi session", async (t) => {
  // Arrange
  const first = await openSession(t, initialize);
  // Act
  await first.session.prompt("/hide-tools");
  const second = await openSession(t, initialize, { cwd: first.cwd });
  // Assert
  assert.deepEqual(readRow(second).render(100), []);
  assert.ok(first.notices.some((x) => /hidden/i.test(x.message)));
  await second.session.prompt("/hide-tools");
  const third = await openSession(t, initialize, { cwd: first.cwd });
  assert.notDeepEqual(readRow(third).render(100), []);
});

test("old preferences include failures without rewriting the file on startup", async (t) => {
  // Arrange
  const h = await openSession(t, initialize);
  const path = join(h.agentDir, "pi-hide-tools.json");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(h.agentDir, { recursive: true });
  for (const hidden of [true, false]) {
    const text = JSON.stringify({ hidden });
    await writeFile(path, text);
    // Act
    const resumed = await openSession(t, initialize, { cwd: h.cwd });
    // Assert
    for (const isError of [false, true]) {
      const rendered = readRow(resumed, isError).render(100);
      if (hidden) assert.deepEqual(rendered, []);
      else assert.notDeepEqual(rendered, []);
    }
    assert.equal(await readFile(path, "utf8"), text);
  }
});

test("invalid preferences warn, start visible, and are not rewritten on startup", async (t) => {
  // Arrange
  const h = await openSession(t, initialize);
  const path = join(h.agentDir, "pi-hide-tools.json");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(h.agentDir, { recursive: true });
  const invalid = [
    '{"hidden":"yes"}', '{broken', 'null',
    '{"hidden":true,"hideFailures":"no"}', '{"hidden":true,"hideFailures":null}',
  ];
  for (const text of invalid) {
    await writeFile(path, text);
    // Act
    await h.bind();
    // Assert
    assert.notDeepEqual(readRow(h).render(100), []);
    assert.equal(await readFile(path, "utf8"), text);
  }
  assert.equal(h.notices.filter((x) => /cannot read preference/.test(x.message)).length,
    invalid.length);
});

test("a failed save still toggles this session and reports that it was not saved", async (t) => {
  // Arrange: a directory at the destination makes the atomic rename fail.
  const h = await openSession(t, initialize);
  const { mkdir, readdir } = await import("node:fs/promises");
  await mkdir(join(h.agentDir, "pi-hide-tools.json"), { recursive: true });
  const row = readRow(h);
  const failed = readRow(h, true);
  const visibleFailure = failed.render(100);
  // Act
  await h.session.prompt("/hide-tools");
  // Assert
  assert.deepEqual(row.render(100), []);
  assert.deepEqual(failed.render(100), []);
  assert.match(h.notices.at(-1).message, /session only/);
  assert.equal(h.notices.at(-1).type, "warning");
  // Act / Assert: the failure policy also stays active if it cannot be saved.
  await h.session.prompt("/hide-tools failures");
  assert.deepEqual(row.render(100), []);
  assert.deepEqual(failed.render(100), visibleFailure);
  assert.match(h.notices.at(-1).message, /session only/);
  assert.equal(h.notices.at(-1).type, "warning");
  assert.deepEqual((await readdir(h.agentDir)).filter((name) => name.startsWith("pi-hide-tools")),
    ["pi-hide-tools.json"]);
});

test("other tools keep their definitions and rendering through toggles and reload", async (t) => {
  // Arrange: these are real registered extensions, not a mocked Pi registry.
  const { createReadToolDefinition } = await import("@earendil-works/pi-coding-agent");
  const { Text } = await import("@earendil-works/pi-tui");
  const definitions = ["subagent", "forgetful_knowledge_read", "web_search", "web_fetch"]
    .map((name) => ({
      ...createReadToolDefinition(process.cwd()), name,
      renderCall: () => new Text(`${name}_CALL`, 0, 0),
      renderResult: () => new Text(`${name}_RESULT`, 0, 0),
    }));
  const otherExtension = (pi) => definitions.forEach((definition) => pi.registerTool(definition));
  const h = await openSession(t, initialize, { extensions: [initialize, otherExtension] });
  const rows = definitions.map((definition) => {
    const row = new ToolExecutionComponent(definition.name, definition.name, {}, {},
      h.session.getToolDefinition(definition.name), tui, h.cwd);
    row.updateResult({ content: [], isError: false });
    h.rows.push(row);
    return row;
  });
  const before = rows.map((row) => row.render(100));

  // Act / Assert
  for (let i = 0; i < 3; i++) {
    await h.session.prompt("/hide-tools");
    assert.deepEqual(rows.map((row) => row.render(100)), before);
  }
  await h.session.reload();
  for (const definition of definitions) {
    assert.equal(h.session.getToolDefinition(definition.name), definition);
  }
  assert.deepEqual(readRow(h).render(100), []);
});

test("bash streaming and cancellation are forwarded while hidden", async (t) => {
  // Arrange
  const h = await openSession(t, initialize);
  await h.session.prompt("/hide-tools");
  const controller = new AbortController();
  const updates = [];
  const bash = h.session.agent.state.tools.find((x) => x.name === "bash");
  const args = { command: "printf STREAMED_MARKER; sleep 10" };
  const row = new ToolExecutionComponent("bash", "stream", args, {},
    h.session.getToolDefinition("bash"), tui, h.cwd);
  const timeout = setTimeout(() => controller.abort(), 2000);
  t.after(() => clearTimeout(timeout));

  // Act
  await assert.rejects(bash.execute("stream", args, controller.signal, (result) => {
    updates.push(result);
    row.updateResult({ ...result, isError: false }, true);
    if (result.content.some((part) => part.text?.includes("STREAMED_MARKER"))) controller.abort();
  }), /abort/i);

  // Assert
  assert.ok(updates.some((result) => result.content[0]?.text.includes("STREAMED_MARKER")));
  assert.deepEqual(row.render(100), []);
});

test("a later winning override is detected without taking ownership back", async (t) => {
  // Arrange
  const { createReadToolDefinition } = await import("@earendil-works/pi-coding-agent");
  const foreign = createReadToolDefinition(process.cwd());
  const competitor = (pi) => pi.registerCommand("late-read", {
    handler: async () => pi.registerTool(foreign),
  });
  const h = await openSession(t, initialize, { extensions: [competitor, initialize] });
  // Act
  await h.session.prompt("/late-read");
  await h.session.prompt("/hide-tools");
  // Assert
  assert.equal(h.session.getToolDefinition("read"), foreign);
  assert.ok(h.notices.some((x) => x.type === "warning" && /read/.test(x.message)));
});

test("read preserves Pi's image auto-resize setting", async (t) => {
  // Arrange: a generated 3000x1 red PNG exceeds Pi's default image width limit.
  const image = await readFile(new URL("./fixtures/wide.png", import.meta.url));
  for (const autoResize of [false, true]) {
    const h = await openSession(t, initialize, { settings: { images: { autoResize } } });
    await writeFile(join(h.cwd, "wide.png"), image);
    const read = h.session.agent.state.tools.find((tool) => tool.name === "read");
    // Act
    const result = await read.execute("image", { path: "wide.png" });
    const returned = result.content.find((part) => part.type === "image");
    // Assert
    assert.ok(returned);
    if (autoResize) assert.notEqual(returned.data, image.toString("base64"));
    else assert.equal(returned.data, image.toString("base64"));
  }
});

for (const format of ["home-relative", "file URL"]) {
  test(`bash preserves Pi's ${format} shell-path normalization`, async (t) => {
    // Arrange
    const { chmod, mkdtemp, rm } = await import("node:fs/promises");
    const { homedir, tmpdir } = await import("node:os");
    const { relative } = await import("node:path");
    const { pathToFileURL } = await import("node:url");
    const cwd = await mkdtemp(join(tmpdir(), "hide-tools-path-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    const path = join(cwd, "shell");
    await writeFile(path, '#!/bin/sh\nexport SHELL_PATH_OK=yes\nexec /bin/bash "$@"\n');
    await chmod(path, 0o700);
    const shellPath = format === "file URL" ? pathToFileURL(path).href
      : `~/${relative(homedir(), path)}`;
    const h = await openSession(t, initialize, { cwd, settings: { shellPath } });

    // Act
    const bash = h.session.agent.state.tools.find((tool) => tool.name === "bash");
    const result = await bash.execute("path", { command: 'printf "$SHELL_PATH_OK"' });

    // Assert
    assert.equal(result.content[0].text, "yes");
  });
}
