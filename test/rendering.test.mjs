import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  createReadToolDefinition, initTheme, ToolExecutionComponent,
} from "@earendil-works/pi-coding-agent";
import { ProcessTerminal, TuiMainScreen } from "@earendil-works/pi-tui";
import { wrap } from "../src/tool-rendering.ts";

initTheme("dark", false);
const ui = new TuiMainScreen(new ProcessTerminal());

function row(definition, args, cwd) {
  return new ToolExecutionComponent(definition.name, "test-call", args, {}, definition, ui, cwd);
}

test("a hidden read still returns file contents, with no terminal text or shell", async (t) => {
  // Arrange
  const cwd = await mkdtemp(join(tmpdir(), "hide-tools-read-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(join(cwd, "note.txt"), "KEEP_THIS_RESULT\n");
  const definition = wrap(createReadToolDefinition, { hidden: true });
  const args = { path: "note.txt" };
  const component = row(definition, args, cwd);

  // Act
  const pending = component.render(100);
  const result = await definition.execute("test-call", args, undefined, undefined, { cwd });
  component.updateResult({ ...result, isError: false });

  // Assert
  assert.deepEqual(result.content, [{ type: "text", text: "KEEP_THIS_RESULT\n" }]);
  assert.deepEqual(pending, []);
  assert.deepEqual(component.render(100), []);
});

test("repeated toggles restore the original read rendering", async (t) => {
  // Arrange
  const cwd = await mkdtemp(join(tmpdir(), "hide-tools-toggle-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(join(cwd, "note.txt"), "RESTORED_READ\n");
  const state = { hidden: false };
  const original = createReadToolDefinition(cwd);
  const definition = wrap(createReadToolDefinition, state);
  const args = { path: "note.txt" };
  const result = await definition.execute("test-call", args, undefined, undefined, { cwd });
  const expected = row(original, args, cwd);
  expected.updateResult({ ...result, isError: false });
  const actual = row(definition, args, cwd);
  actual.updateResult({ ...result, isError: false });
  expected.setExpanded(true);
  actual.setExpanded(true);

  // Act / Assert: the same row can hide and show without losing its renderer state.
  for (const hidden of [false, true, false, true, false]) {
    state.hidden = hidden;
    actual.invalidate();
    assert.deepEqual(actual.render(100), hidden ? [] : expected.render(100));
  }
  assert.match(actual.render(100).join("\n"), /RESTORED_READ/);
});

test("a failed read reveals both call and error while hiding is enabled", async (t) => {
  // Arrange
  const cwd = await mkdtemp(join(tmpdir(), "hide-tools-error-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const definition = wrap(createReadToolDefinition, { hidden: true });
  const args = { path: "missing.txt" };
  const component = row(definition, args, cwd);

  // Act
  let error;
  try {
    await definition.execute("test-call", args, undefined, undefined, { cwd });
  } catch (caught) {
    error = caught;
  }
  assert.equal(error?.code, "ENOENT");
  component.updateResult({ content: [{ type: "text", text: error.message }], isError: true });

  // Assert
  const text = component.render(100).join("\n");
  assert.match(text, /missing.txt/);
  assert.match(text, /ENOENT/);
});

const pi = await import("@earendil-works/pi-coding-agent");
for (const name of ["Read", "Bash", "Edit", "Write", "Grep", "Find", "Ls"]) {
  test(`${name} keeps stock rendering across errors, expansion and repeated toggles`, () => {
    // Arrange
    const factory = pi[`create${name}ToolDefinition`];
    const cwd = process.cwd();
    const state = { hidden: false };
    const args = {
      path: "example.txt", pattern: "example", command: "echo example", content: "example",
      edits: [{ oldText: "before", newText: "after" }],
    };
    const expected = row(factory(cwd), args, cwd);
    const actual = row(wrap(factory, state), args, cwd);
    // Act / Assert
    for (const isError of [false, true]) {
      const result = { content: [{ type: "text", text: "RENDERED_RESULT" }], isError };
      expected.updateResult(result);
      actual.updateResult(result);
      for (const expanded of [false, true]) {
        expected.setExpanded(expanded);
        actual.setExpanded(expanded);
        for (const hidden of [true, false, true, false]) {
          state.hidden = hidden;
          actual.invalidate();
          assert.deepEqual(actual.render(100), hidden && !isError ? [] : expected.render(100));
        }
      }
    }
  });
}

test("hiding a running bash row still stops its timer on completion", async () => {
  // Arrange: a child process observes real timer cleanup without reading Pi's private state.
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  // Act
  const { stdout } = await run(process.execPath, [
    "--import", "./test/register.mjs", "test/fixtures/bash-timer.mjs",
  ], { timeout: 5000 });
  // Assert
  assert.match(stdout, /FINISHED/);
});
