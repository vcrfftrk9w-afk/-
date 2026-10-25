// Собирает игру: game.js (Three.js + код игры) и index.html со ссылкой на него.
// Модели лежат в assets/*.json и грузятся с сервера рядом со страницей.
// Запуск: cd game && npm install && node build.mjs
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const here = new URL(".", import.meta.url).pathname;
const BUILD = process.env.BUILD || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");

await build({
  entryPoints: [here + "src/main.js"],
  outfile: here + "game.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  legalComments: "none",
});
const page = readFileSync(here + "src/page.html", "utf8").replaceAll("<!--BUILD-->", BUILD);
writeFileSync(here + "index.html", page);
console.log(`build ${BUILD}: index.html ${(page.length / 1024).toFixed(1)} KB, game.js ${(readFileSync(here + "game.js").length / 1024).toFixed(0)} KB`);
