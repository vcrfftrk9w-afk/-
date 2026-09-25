// Сборка веб-версии в один HTML-файл: node web/build.mjs → dist-web/index.html
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist-web");
fs.mkdirSync(out, { recursive: true });

const js = await build({
  entryPoints: [path.join(root, "web/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  alias: { "next/navigation": path.join(root, "web/shims/next-navigation.ts") },
  define: { "process.env.NODE_ENV": '"production"' },
  logOverride: { "unsupported-directive": "silent" },
  tsconfig: path.join(root, "tsconfig.json"),
});
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

const cssSrc = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const css = (await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(cssSrc, { from: path.join(root, "src/app/globals.css") })).css;

const html = `<title>ViralPilot</title>
<meta name="description" content="AI-продюсер для TikTok: анализ аккаунта, тренды, идеи, сценарии и план роста">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Unbounded:wght@500;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${code}</script>
`;
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(`dist-web/index.html  ${(html.length / 1024).toFixed(0)} KB  (js ${(code.length / 1024).toFixed(0)} KB, css ${(css.length / 1024).toFixed(0)} KB)`);
