import {
  createBashToolDefinition, initTheme, ToolExecutionComponent,
} from "@earendil-works/pi-coding-agent";
import { ProcessTerminal, TuiMainScreen } from "@earendil-works/pi-tui";
import { wrap } from "../../src/tool-rendering.ts";

initTheme("dark", false);
const state = { hidden: false };
const ui = new TuiMainScreen(new ProcessTerminal());
const component = new ToolExecutionComponent("bash", "timer", { command: "printf result" }, {},
  wrap(createBashToolDefinition, state), ui, process.cwd());
component.markExecutionStarted();
component.updateResult({ content: [{ type: "text", text: "partial" }], isError: false }, true);
state.hidden = true;
component.invalidate();
component.updateResult({ content: [{ type: "text", text: "final" }], isError: false });
console.log("FINISHED");
// Must exit naturally. A hidden completion must still stop the stock renderer's elapsed timer.
