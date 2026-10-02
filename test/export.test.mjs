import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { initTheme } from "@earendil-works/pi-coding-agent";
import initialize from "../index.ts";
import { openSession } from "./session.mjs";
import { seed } from "./seed.mjs";

initTheme("dark", false);

test("history and exports retain successes and failures under both hiding policies", async (t) => {
  // Arrange
  const h = await openSession(t, initialize, {
    persist: true, tools: ["read", "bash", "write", "edit", "grep", "find", "ls"],
  });
  await seed(h);
  const entries = structuredClone(h.session.sessionManager.getEntries());
  const results = entries.filter((entry) => entry.message?.role === "toolResult");
  assert.ok(results.some((entry) => entry.message.isError), "fixture includes a failure");

  for (const command of ["/hide-tools", "/hide-tools failures"]) {
    // Act
    await h.session.prompt(command);
    const path = await h.session.exportToHtml(join(h.cwd, "session.html"));
    const html = await readFile(path, "utf8");

    // Assert: session data is embedded losslessly, even when TUI renderers return no text.
    const encoded = html.match(/id="session-data" type="application\/json">([^<]+)</)?.[1];
    assert.ok(encoded, "Pi's exported session data is present");
    const data = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    for (const original of results) {
      const exported = data.entries.find((entry) => entry.id === original.id);
      assert.ok(exported, original.message.toolName);
      assert.deepEqual(exported.message, JSON.parse(JSON.stringify(original.message)));
    }
    assert.deepEqual(h.session.sessionManager.getEntries(), entries);
  }
});
