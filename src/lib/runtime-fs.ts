/**
 * Resolve Node's filesystem module at runtime instead of importing it into the
 * server bundle. Deck files are user-managed runtime data, so making the
 * module graph aware of every dynamically constructed path causes Turbopack to
 * create an overly broad filesystem pattern during the build.
 */
const fsPromises = process.getBuiltinModule("node:fs/promises") as typeof import("node:fs/promises");

if (!fsPromises) {
  throw new Error("Node.js fs/promises builtin module is unavailable");
}

export default fsPromises;
