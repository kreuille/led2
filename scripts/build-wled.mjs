import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
let html = readFileSync(join(dist, "index.html"), "utf8");

const stylesheet = html.match(/<link rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/);
const moduleScript = html.match(/<script type="module"[^>]+src="([^"]+)"[^>]*><\/script>/);
if (!stylesheet || !moduleScript) throw new Error("Impossible de trouver les ressources du build LED2");

const localPath = value => join(dist, value.replace(/^\/led2\//, ""));
const css = readFileSync(localPath(stylesheet[1]), "utf8");
const javascript = readFileSync(localPath(moduleScript[1]), "utf8").replace(/<\/script/gi, "<\\/script");

html = html
  .replace(stylesheet[0], () => `<style>${css}</style>`)
  .replace(moduleScript[0], () => `<script type="module">${javascript}</script>`)
  .replace(/\s*<link rel="manifest"[^>]*>/, "")
  .replace(/\s*<link rel="icon"[^>]*>/, "")
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, "")
  .replace("</head>", '<meta name="apple-mobile-web-app-title" content="LED2"></head>');

writeFileSync(join(dist, "led2.htm"), html);
console.log("Version Wi-Fi WLED créée : dist/led2.htm");
