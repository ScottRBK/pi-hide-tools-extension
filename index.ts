import { join } from "node:path";
import {
  createBashToolDefinition, createEditToolDefinition, createFindToolDefinition,
  createGrepToolDefinition, createLsToolDefinition, createReadToolDefinition,
  createWriteToolDefinition, getAgentDir, SettingsManager, type ExtensionAPI,
  type ExtensionUIContext, type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { load, save } from "./src/preferences.ts";
import { wrap } from "./src/tool-rendering.ts";

function redraw(ui: ExtensionUIContext): void {
  const expanded = ui.getToolsExpanded();
  ui.setToolsExpanded(!expanded);
  ui.setToolsExpanded(expanded);
}

export default function initialize(pi: ExtensionAPI): void {
  const state = { hidden: false };
  const preferencePath = join(getAgentDir(), "pi-hide-tools.json");
  const owned = new Map<string, string>();

  pi.on("session_start", function onSessionStart(_event, ctx) {
    if (ctx.mode !== "tui") return;
    try {
      state.hidden = load(preferencePath);
    } catch (error) {
      state.hidden = false;
      ctx.ui.notify(`Hide tools: showing tools; cannot read preference: ${error}`, "warning");
    }
    // Heterogeneous schemas: each wrap() call keeps its concrete types before array erasure.
    const definitions: ToolDefinition<any, any, any>[] = [
      wrap((cwd) => createReadToolDefinition(cwd, {
        autoResizeImages: pi.getSettings().images?.autoResize,
      }), state),
      wrap((cwd) => {
        // The raw snapshot is not normalized: Pi also expands ~/ and file: shell paths.
        const settings = SettingsManager.inMemory(pi.getSettings());
        return createBashToolDefinition(cwd, {
          shellPath: settings.getShellPath(),
          commandPrefix: settings.getShellCommandPrefix(),
        });
      }, state),
      wrap(createEditToolDefinition, state),
      wrap(createWriteToolDefinition, state),
      wrap(createGrepToolDefinition, state),
      wrap(createFindToolDefinition, state),
      wrap(createLsToolDefinition, state),
    ];
    const tools = new Map(pi.getAllTools().map((tool) => [tool.name, tool]));
    const contested: string[] = [];
    for (const definition of definitions) {
      const source = tools.get(definition.name)?.sourceInfo;
      if (!source || source.path === owned.get(definition.name)) continue;
      if (source.source !== "builtin") {
        contested.push(definition.name);
        continue;
      }
      pi.registerTool(definition);
      const registered = pi.getAllTools().find((tool) => tool.name === definition.name)!;
      owned.set(definition.name, registered.sourceInfo.path);
    }
    if (contested.length) {
      ctx.ui.notify(`Hide tools: left other overrides unchanged: ${contested.join(", ")}`,
        "warning");
    }
  });

  pi.registerCommand("hide-tools", {
    description: "Hide or show built-in tool rows (failures stay visible)",
    handler: async function toggle(_args, ctx) {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("Hide tools is only available in Pi's terminal UI.", "warning");
        return;
      }
      const lost = pi.getAllTools().filter((tool) => owned.has(tool.name)
        && tool.sourceInfo.path !== owned.get(tool.name));
      if (lost.length) {
        const names = lost.map((tool) => tool.name).join(", ");
        ctx.ui.notify(`Hide tools: override ownership changed: ${names}`, "warning");
      }
      state.hidden = !state.hidden;
      redraw(ctx.ui);
      const visibility = state.hidden ? "hidden (failures stay visible)" : "visible";
      try {
        save(preferencePath, state.hidden);
        ctx.ui.notify(`Built-in tools ${visibility}. Preference saved.`, "info");
      } catch (error) {
        ctx.ui.notify(`Built-in tools ${visibility} for this session only; cannot save: ${error}`,
          "warning");
      }
    },
  });
}
