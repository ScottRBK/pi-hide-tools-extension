import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Box, Container, type Component } from "@earendil-works/pi-tui";

export type VisibilityState = { hidden: boolean };

type BuiltInFactory<P extends ToolDefinition["parameters"], D, S> =
  (cwd: string) => ToolDefinition<P, D, S>;

type Row = { call?: Component; result?: Component; shell?: Box };

export function wrap<P extends ToolDefinition["parameters"], D, S>(
  factory: BuiltInFactory<P, D, S>,
  state: VisibilityState,
): ToolDefinition<P, D, S> {
  const original = factory(process.cwd());
  const renderCall = original.renderCall!;
  const renderResult = original.renderResult!;
  const rows = new WeakMap<object, Row>();
  const rowFor = (key: object): Row => {
    let row = rows.get(key);
    if (!row) {
      row = {};
      rows.set(key, row);
    }
    return row;
  };

  return {
    ...original,
    renderShell: "self",
    execute(id, args, signal, onUpdate, ctx) {
      return factory(ctx.cwd).execute(id, args, signal, onUpdate, ctx);
    },
    renderCall(args, theme, context) {
      const hidden = state.hidden && !context.isError;
      const row = rowFor(context.state as object);
      try {
        row.call = renderCall(args, theme, { ...context, lastComponent: row.call });
      } catch (error) {
        row.call = undefined;
        if (hidden) return new Container();
        throw error; // Let Pi display its fallback and retry with a fresh component.
      }
      // Keep stock renderer lifecycle/state work running; suppress only its output.
      if (hidden) return new Container();
      if (original.renderShell === "self") return row.call;

      // Pi no longer supplies its default shell when renderShell is "self".
      const background = context.isPartial ? "toolPendingBg"
        : context.isError ? "toolErrorBg" : "toolSuccessBg";
      row.shell ??= new Box(1, 1);
      row.shell.setBgFn((text) => theme.bg(background, text));
      row.shell.clear();
      row.shell.addChild(row.call);
      if (row.result) row.shell.addChild(row.result);
      return row.shell;
    },
    renderResult(result, options, theme, context) {
      const hidden = state.hidden && !context.isError;
      const row = rowFor(context.state as object);
      try {
        row.result = renderResult(result, options, theme, {
          ...context, lastComponent: row.result,
        });
      } catch (error) {
        row.result = undefined;
        if (hidden) return new Container();
        throw error;
      }
      // In particular, bash's final render stops the timer started during streaming.
      if (hidden) return new Container();
      if (original.renderShell === "self") return row.result;
      row.shell!.clear();
      if (row.call) row.shell!.addChild(row.call);
      row.shell!.addChild(row.result);
      return new Container();
    },
  };
}
