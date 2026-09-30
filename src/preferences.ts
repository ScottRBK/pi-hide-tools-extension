import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function load(path: string): boolean {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== "object" || !("hidden" in data)
    || typeof data.hidden !== "boolean") {
    throw new Error("Expected a JSON object with a boolean 'hidden' value");
  }
  return data.hidden;
}

export function save(path: string, hidden: boolean): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify({ hidden })}\n`, { flag: "wx", mode: 0o600 });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
