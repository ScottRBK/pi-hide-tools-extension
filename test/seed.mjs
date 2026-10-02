import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const usage = {
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

export function appendAssistant(manager, content, stopReason = "toolUse") {
  manager.appendMessage({
    role: "assistant", content, stopReason, usage,
    api: "anthropic-messages", provider: "fixture", model: "offline",
    timestamp: Date.now(),
  });
}

export function appendCall(manager, name, args, result, isError = false) {
  const id = `fixture-${name}-${manager.getEntries().length}`;
  appendAssistant(manager, [{ type: "toolCall", id, name, arguments: args }]);
  manager.appendMessage({
    role: "toolResult", toolCallId: id, toolName: name, ...result, isError, timestamp: Date.now(),
  });
}

// Real built-ins execute in the temporary cwd. Recorded peer rows never execute a peer tool.
export async function seed(h) {
  // Keep the read marker out of the edit diff so the terminal expansion check is unambiguous.
  await writeFile(join(h.cwd, "read.txt"), "HIDDEN_READ_PAYLOAD\n");
  await writeFile(join(h.cwd, "source.txt"), "ORIGINAL_EDIT_PAYLOAD\n");
  const calls = [
    ["read", { path: "read.txt" }],
    ["bash", { command: "printf HIDDEN_BASH_PAYLOAD" }],
    ["write", { path: "written.txt", content: "HIDDEN_WRITE_PAYLOAD\n" }],
    ["edit", { path: "source.txt", edits: [{
      oldText: "ORIGINAL_EDIT_PAYLOAD", newText: "HIDDEN_EDIT_PAYLOAD",
    }] }],
    ["grep", { path: "source.txt", pattern: "HIDDEN_EDIT" }],
    ["find", { path: ".", pattern: "written.txt" }],
    ["ls", { path: "." }],
  ];
  const manager = h.session.sessionManager;
  manager.appendMessage({
    role: "user", content: "Offline renderer fixture", timestamp: Date.now(),
  });
  for (const [name, args] of calls) {
    const tool = h.session.agent.state.tools.find((tool) => tool.name === name);
    const result = await tool.execute(`fixture-${name}`, args);
    appendCall(manager, name, args, result);
  }
  // A recorded failure exercises both the default hiding and the opt-out preference.
  appendCall(manager, "read", { path: "MISSING_FILE" }, {
    content: [{ type: "text", text: "FAILURE_PAYLOAD" }],
  }, true);
  appendCall(manager, "subagent", { agent_type: "claude_code" }, {
    content: [{ type: "text", text: "VISIBLE_AGENTSHELL" }],
  });
  appendCall(manager, "forgetful_knowledge_read", { operation: "list_projects" }, {
    content: [{ type: "text", text: "VISIBLE_FORGETFUL" }],
  });
  appendCall(manager, "web_search", { query: "offline fixture" }, {
    content: [{ type: "text", text: "VISIBLE_WEB" }],
  });
  appendAssistant(manager, [{ type: "text", text: "SMOKE_READY" }], "stop");
  return calls;
}
