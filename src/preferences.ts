import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type Preferences = { hidden: boolean; hideFailures: boolean };

export function load(path: string): Preferences {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { hidden: false, hideFailures: true };
    }
    throw error;
  }
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object" || !("hidden" in data)
    || typeof data.hidden !== "boolean") {
    throw new Error("Expected a JSON object with a boolean 'hidden' value");
  }
  const hideFailures = "hideFailures" in data ? data.hideFailures : true;
  if (typeof hideFailures !== "boolean") {
    throw new Error("Expected a boolean 'hideFailures' value");
  }
  return { hidden: data.hidden, hideFailures };
}

export function save(path: string, preferences: Preferences): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(preferences)}\n`, { flag: "wx", mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
