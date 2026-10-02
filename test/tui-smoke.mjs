// Offline black-box checks. No model or peer-tool calls, credentials, or package installation.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { initTheme } from "@earendil-works/pi-coding-agent";
import initialize from "../index.ts";
import { openSession } from "./session.mjs";
import { seed } from "./seed.mjs";

initTheme("dark", false);
const directory = await mkdtemp(join(tmpdir(), "pi-hide-tools-smoke-"));
const cleanups = [];
const h = await openSession({ after: (fn) => cleanups.push(fn) }, initialize, {
  cwd: directory, persist: true, tools: ["read", "bash", "write", "edit", "grep", "find", "ls"],
});
const name = `pi-smoke-hide-tools-${process.pid}`;
const tmux = (...args) => execFileSync("tmux", ["-L", name, "-f", "/dev/null", ...args], {
  encoding: "utf8",
});
const capture = () => tmux("capture-pane", "-p", "-t", name);
const allHidden = (text) => !text.includes("HIDDEN_")
  && !text.includes("FAILURE_PAYLOAD") && !text.includes("MISSING_FILE");
const input = (text) => {
  tmux("send-keys", "-t", name, "-l", text);
  tmux("send-keys", "-t", name, "Enter");
};
async function until(predicate, label) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const text = capture();
    if (predicate(text)) return text;
    await delay(100);
  }
  throw new Error(`Timed out: ${label}\n${capture()}`);
}
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
let started = false;
try {
  // Disable memory traffic if the optional real Forgetful extension is loaded.
  await mkdir(join(h.agentDir, "forgetful"), { recursive: true });
  await writeFile(join(h.agentDir, "forgetful/settings.json"), '{"enabled":false}\n');
  await seed(h);
  await h.session.prompt("/hide-tools");
  const peers = (process.env.PI_HIDE_TOOLS_PEER_EXTENSIONS ?? "")
    .split(delimiter).filter(Boolean);
  const args = [
    process.env.PI_BIN ?? "pi", "--offline", "--no-extensions", "--no-skills",
    "--no-prompt-templates", "--no-themes", "--no-context-files", "--tui-mode", "regular",
    "--extension", resolve("index.ts"), "--extension", resolve("test/fixtures/navigation.ts"),
    "--session", h.session.sessionManager.getSessionFile(),
    ...peers.flatMap((path) => ["--extension", path]),
  ];
  tmux("new-session", "-d", "-s", name, "-x", "140", "-y", "180", "-c", directory,
    "-e", `PI_CODING_AGENT_DIR=${h.agentDir}`, "-e", "PI_OFFLINE=1",
    args.map(quote).join(" "));
  started = true;
  const initial = await until((text) => text.includes("SMOKE_READY"), "startup");
  await writeFile(join(directory, "01-hidden.txt"), initial);
  const markers = ["VISIBLE_AGENTSHELL", "VISIBLE_FORGETFUL", "VISIBLE_WEB"];
  for (const marker of markers) {
    assert.ok(initial.includes(marker), marker);
  }
  assert.ok(allHidden(initial), "successful and failed rows are hidden on resume");

  input("/hide-tools failures");
  const failures = await until((text) => text.includes("FAILURE_PAYLOAD"), "show only failures");
  assert.ok(failures.includes("MISSING_FILE"), "failed call arguments are restored");
  assert.ok(!failures.includes("HIDDEN_"), "successful rows remain hidden");
  await writeFile(join(directory, "02-failures-visible.txt"), failures);
  input("/hide-tools failures");
  const failuresHidden = await until(allHidden, "hide failures again");
  await writeFile(join(directory, "03-failures-hidden.txt"), failuresHidden);

  input("/hide-tools");
  await until((text) => text.includes("HIDDEN_BASH_PAYLOAD"), "show tools");
  tmux("send-keys", "-t", name, "C-o");
  const expanded = await until((text) => text.includes("HIDDEN_READ_PAYLOAD"), "expand tools");
  assert.ok(expanded.includes("FAILURE_PAYLOAD"), "showing tools also restores failures");
  await writeFile(join(directory, "04-expanded.txt"), expanded);
  input("/hide-tools");
  const hidden = await until(allHidden, "hide expanded tools");
  await writeFile(join(directory, "05-hidden-again.txt"), hidden);
  input("/hide-tools");
  await until((text) => text.includes("HIDDEN_READ_PAYLOAD"), "restore expanded state");
  input("/hide-tools");
  await until(allHidden, "hide before export");

  const exportPath = join(directory, "session.html");
  input(`/export ${exportPath}`);
  await until((text) => text.includes("Session exported"), "export");
  assert.ok((await readFile(exportPath, "utf8")).includes("session-data"));
  input("/reload");
  const reloaded = await until((text) => text.includes("Reloaded"), "reload");
  await writeFile(join(directory, "06-reloaded.txt"), reloaded);
  // Some Pi lifecycle paths construct restored rows before session_start; record that boundary.
  console.log(`Reloaded history hidden: ${allHidden(reloaded)}`);
  input("/smoke-new");
  await until((text) => !text.includes("SMOKE_READY"), "new session");
  input(`/smoke-switch ${h.session.sessionManager.getSessionFile()}`);
  const switched = await until((text) => text.includes("SMOKE_READY"), "switch session");
  await writeFile(join(directory, "07-switched.txt"), switched);
  console.log(`Switched history hidden: ${allHidden(switched)}`);
  console.log(`PASS: offline TUI checks. Evidence: ${directory}`);
} finally {
  if (started) {
    try {
      await writeFile(join(directory, "last-pane.txt"), capture());
    } catch { /* Pi may already have exited; still clean up the isolated session. */ }
    try { tmux("kill-session", "-t", name); } catch { /* Already exited. */ }
  }
  for (const cleanup of cleanups.reverse()) await cleanup();
}
