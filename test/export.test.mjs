import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { initTheme } from "@earendil-works/pi-coding-agent";
import initialize from "../index.ts";
import { openSession } from "./session.mjs";
import { seed } from "./seed.mjs";

initTheme("dark", false);

test("HTML export retains the recorded results for every hidden built-in tool", async (t) => {
  // Arrange
  const h = await openSession(t, initialize, {
    persist: true, tools: ["read", "bash", "write", "edit", "grep", "find", "ls"],
  });
  const calls = await seed(h);
  const entries = structuredClone(h.session.sessionManager.getEntries());
  await h.session.prompt("/hide-tools");

  // Act
  const path = await h.session.exportToHtml(join(h.cwd, "session.html"));
  const html = await readFile(path, "utf8");

  // Assert: session data is embedded losslessly, even when TUI renderers return no text.
  const encoded = html.match(/id="session-data" type="application\/json">([^<]+)</)?.[1];
  assert.ok(encoded, "Pi's exported session data is present");
  const data = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  for (const [name] of calls) {
    const original = entries.find((entry) => entry.message?.toolName === name);
    assert.ok(original, name);
    const exported = data.entries.find((entry) => entry.id === original.id);
    assert.deepEqual(exported.message, JSON.parse(JSON.stringify(original.message)));
  }
  assert.deepEqual(h.session.sessionManager.getEntries(), entries);
});
