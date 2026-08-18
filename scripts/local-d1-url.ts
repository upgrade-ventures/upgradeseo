import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Absolute path to the local D1 sqlite file, for drizzle-kit.
 *
 * Inlined from a dependency rather than imported: it is thirty lines of
 * readdir, and the package it came from belongs to the project this one was
 * forked from. A fork that ships publicly should not carry a supply-chain tie
 * back to its upstream for something this small.
 *
 * Returns null when .wrangler does not exist, which is the normal state in CI
 * and any environment that has never run the dev server.
 */
export function getLocalD1Url(): string | null {
  const basePath = path.resolve(".wrangler");
  if (!fs.existsSync(basePath)) return null;

  const find = () =>
    fs
      .readdirSync(basePath, { encoding: "utf-8", recursive: true })
      .find((file) => file.endsWith(".sqlite"));

  let dbFile = find();
  if (!dbFile) {
    // Nothing has created the database yet. Wrangler makes it on first query,
    // and it needs the binding's database_name.
    //
    // The name is read with a regex rather than a JSONC parser: wrangler.jsonc
    // carries comments, JSON.parse rejects it, and pulling in a parser purely
    // to read one string would trade the dependency this file exists to remove
    // for another one.
    const raw = fs.readFileSync("wrangler.jsonc", "utf-8");
    const name = /"database_name"\s*:\s*"([^"]+)"/.exec(raw)?.[1] ?? null;
    if (!name) {
      throw new Error("No d1_databases[].database_name in wrangler.jsonc");
    }
    execSync(`npx wrangler d1 execute ${name} --local --command "SELECT 1;"`, {
      stdio: "pipe",
    });
    dbFile = find();
    if (!dbFile) throw new Error("Local D1 sqlite file was not created.");
  }
  return path.resolve(basePath, dbFile);
}
