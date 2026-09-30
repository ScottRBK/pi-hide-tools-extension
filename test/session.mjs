import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager,
} from "@earendil-works/pi-coding-agent";

// Real Pi registry, loader, command dispatch and lifecycle. Only the terminal is a recording sink.
export async function openSession(t, initialize, options = {}) {
  const cwd = options.cwd ?? await mkdtemp(join(tmpdir(), "hide-tools-session-"));
  if (!options.cwd) t.after(() => rm(cwd, { recursive: true, force: true }));
  const agentDir = join(cwd, "agent");
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  t.after(() => {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
  });
  const settingsManager = SettingsManager.inMemory(options.settings ?? {});
  const resourceLoader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true,
    noContextFiles: true,
    extensionFactories: options.extensions ?? [initialize],
  });
  await resourceLoader.reload();
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false,
  });
  const { session } = await createAgentSession({
    cwd, agentDir, settingsManager, resourceLoader, modelRuntime,
    sessionManager: options.persist
      ? SessionManager.create(cwd, join(cwd, "sessions")) : SessionManager.inMemory(cwd),
    tools: options.tools,
  });
  t.after(() => session.dispose());
  const notices = [];
  const rows = [];
  const errors = [];
  let expanded = false;
  const ui = {
    notify: (message, type) => notices.push({ message, type }),
    getToolsExpanded: () => expanded,
    setToolsExpanded(value) {
      expanded = value;
      for (const row of rows) row.setExpanded(value);
    },
  };
  const before = session.getAllTools();
  const activeBefore = session.getActiveToolNames();
  const bind = () => session.bindExtensions({
    mode: options.mode ?? "tui", uiContext: ui,
    onError: (error) => errors.push(error),
  });
  await bind();
  t.after(() => {
    if (errors.length) throw new Error(JSON.stringify(errors));
  });
  return { session, cwd, agentDir, ui, rows, notices, before, activeBefore, bind };
}
