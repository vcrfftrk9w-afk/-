// Собирает game/index.html: страница + Three.js + код игры + модели в одном файле.
// Запуск: cd game && npm install && node build.mjs
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const here = new URL(".", import.meta.url).pathname;
const result = await build({
  entryPoints: [here + "src/main.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
  write: false,
  legalComments: "none",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const assets = ["knight", "goblin", "arena", "potion"].map((name) => {
  const json = readFileSync(here + `assets/${name}.json`, "utf8").replace(/<\//g, "<\\/");
  return `<script type="application/json" id="asset-${name}">${json}</script>`;
}).join("\n");

const page = readFileSync(here + "src/page.html", "utf8")
  .replace("<!--ASSETS-->", () => assets)
  .replace("<!--BUNDLE-->", () => js);
writeFileSync(here + "index.html", page);
console.log(`index.html: ${(page.length / 1024 / 1024).toFixed(2)} MB`);
