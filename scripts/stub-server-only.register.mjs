import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const loader = pathToFileURL(path.join(dir, "stub-server-only-loader.mjs")).href;

register(loader, pathToFileURL(path.join(dir, "stub-server-only.register.mjs")).href);
