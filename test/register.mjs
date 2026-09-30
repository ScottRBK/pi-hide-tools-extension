// Test against the installed Pi host; do not download a second copy or its dependency tree.
import { execFileSync } from "node:child_process";
import { registerHooks } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.env.PI_PACKAGE_DIR ?? join(
  execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(),
  "@earendil-works/pi-coding-agent",
);
const hostURL = pathToFileURL(join(root, "package.json")).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@earendil-works/")) {
      return nextResolve(specifier, { ...context, parentURL: hostURL });
    }
    return nextResolve(specifier, context);
  },
});
