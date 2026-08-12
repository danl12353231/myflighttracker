// Rebuilds the self-contained WebView globe bundle (map-globe/index.html)
// from the readable source map-globe/globe-app.jsx. The globe app runs
// React-Three-Fiber inside the browser engine, so React, three, fiber and
// drei are all bundled into one file. Run `bun run build:globe` (or
// `node ./scripts/build-globe.mjs`) after editing map-globe/globe-app.jsx.
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const result = await build({
  entryPoints: [path.join(root, "map-globe/globe-app.jsx")],
  bundle: true,
  format: "iife",
  jsx: "automatic",
  minify: true,
  write: false,
});

const code = result.outputFiles[0].text;
const template = await readFile(path.join(root, "map-globe/template.html"), "utf8");
const html = template.replace("__APP_CODE__", () => code);
await writeFile(path.join(root, "map-globe/index.html"), html);
console.log(`built map-globe/index.html (${(html.length / 1024).toFixed(0)} KB)`);
