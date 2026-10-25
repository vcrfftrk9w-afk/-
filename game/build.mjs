// Собирает game/index.html: страница + Three.js + код игры + модели в одном обычном <script>.
// Запуск: cd game && npm install && node build.mjs
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const here = new URL(".", import.meta.url).pathname;

// модели из Blender (glTF JSON) превращаются в строковые константы модуля
const names = ["knight", "goblin", "arena", "potion"];
const gen = "export default {\n" + names.map((n) =>
  `  ${n}: ${JSON.stringify(readFileSync(here + `assets/${n}.json`, "utf8"))},`).join("\n") + "\n};\n";
writeFileSync(here + "src/assets.gen.js", gen);

const result = await build({
  entryPoints: [here + "src/main.js"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2019",
  write: false,
  legalComments: "none",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const page = readFileSync(here + "src/page.html", "utf8").replace("<!--BUNDLE-->", () => js);
writeFileSync(here + "index.html", page);
console.log(`index.html: ${(page.length / 1024 / 1024).toFixed(2)} MB`);
