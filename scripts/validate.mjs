import { existsSync, readFileSync } from "node:fs";

const requiredFiles = ["index.html", "src/main.ts", "src/lib/safety.ts", "src/lib/composer.ts", "src/lib/schedules.ts", "tests/safety.test.ts", "tests/composer.test.ts", "src/style.css", "src/scan.css", "vite.config.ts", ".github/workflows/deploy-pages.yml", "public/manifest.webmanifest", "public/sw.js", "public/icon.svg"];
const missing = requiredFiles.filter(file => !existsSync(file));
if (missing.length) throw new Error(`Fichiers manquants : ${missing.join(", ")}`);

const html = readFileSync("dist/index.html", "utf8");
if (!html.includes("LED2") || !html.includes("assets/")) throw new Error("Le build ne contient pas l'application attendue");
const wledHtml = readFileSync("dist/led2.htm", "utf8");
if (!wledHtml.includes("LED2") || !wledHtml.includes("/json/state") || wledHtml.includes("/led2/assets/")) throw new Error("La version Wi-Fi autonome WLED est invalide");
const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
if (manifest.display !== "standalone" || !manifest.start_url.startsWith("/led2/") || !manifest.icons.some(icon => icon.sizes === "192x192") || !manifest.icons.some(icon => icon.sizes === "512x512")) throw new Error("Le manifeste PWA est invalide");
const source = readFileSync("src/main.ts", "utf8");
for (const feature of ["applyZones", "isMatrixMode", "fetchEffectsList", "useWledPreset", "fusionEnabled", "pollState", "applyShelfAmbiences", "bindFurnitureGestures", "exportBackup", "importBackup", "restoreBackup", "escapeHtml", "normalizeWledUrl", "renderDiagnostics", "scheduleBrightnessUpdate", "scheduleRgbBrightnessUpdate", "renderQuickNavigation", "updateMapZoom", "mapFocusMode", "applyZoneTemplate", "saveCurrentZoneFavorite", "normalizeZoneIndexes", "zoneFavorites", "renderVisualComposer", "applyVisualScene", "playSequence", "syncSchedulesWithWled", "renderSetupWizard"]) {
  if (!source.includes(feature)) throw new Error(`Fonction WLED manquante : ${feature}`);
}
if (/HA_TOKEN|eyJ[a-zA-Z0-9_-]+\./.test(source)) throw new Error("Un secret Home Assistant semble présent dans le code public");
console.log("Validation LED2 OK : fichiers, build et artefact présents.");
