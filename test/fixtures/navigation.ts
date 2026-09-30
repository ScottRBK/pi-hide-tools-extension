import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Test-only commands exercise Pi's real lifecycle without making a model request.
export default function navigation(pi: ExtensionAPI): void {
  pi.registerCommand("smoke-switch", {
    handler: async (path, ctx) => { await ctx.switchSession(path); },
  });
  pi.registerCommand("smoke-new", {
    handler: async (_args, ctx) => { await ctx.newSession(); },
  });
}
