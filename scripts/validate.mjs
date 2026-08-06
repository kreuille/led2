import { existsSync, readFileSync } from "node:fs";

const requiredFiles = ["index.html", "src/main.ts", "src/style.css", "src/scan.css", "vite.config.ts", ".github/workflows/deploy-pages.yml", "public/manifest.webmanifest", "public/sw.js", "public/icon.svg"];
const missing = requiredFiles.filter(file => !existsSync(file));
if (missing.length) throw new Error(`Fichiers manquants : ${missing.join(", ")}`);

const html = readFileSync("dist/index.html", "utf8");
if (!html.includes("LED2") || !html.includes("assets/")) throw new Error("Le build ne contient pas l'application attendue");
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
if (manifest.display !== "standalone" || manifest.start_url !== "/led2/") throw new Error("Le manifeste PWA est invalide");
const source = readFileSync("src/main.ts", "utf8");
for (const feature of ["applyZones", "isMatrixMode", "fetchEffectsList", "useWledPreset", "fusionEnabled"]) {
  if (!source.includes(feature)) throw new Error(`Fonction WLED manquante : ${feature}`);
}
if (/HA_TOKEN|eyJ[a-zA-Z0-9_-]+\./.test(source)) throw new Error("Un secret Home Assistant semble présent dans le code public");
console.log("Validation LED2 OK : fichiers, build et artefact présents.");
