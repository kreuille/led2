import { existsSync, readFileSync } from "node:fs";

const requiredFiles = ["index.html", "src/main.ts", "src/style.css", "src/scan.css", "vite.config.ts", ".github/workflows/deploy-pages.yml"];
const missing = requiredFiles.filter(file => !existsSync(file));
if (missing.length) throw new Error(`Fichiers manquants : ${missing.join(", ")}`);

const html = readFileSync("dist/index.html", "utf8");
if (!html.includes("LED2") || !html.includes("assets/")) throw new Error("Le build ne contient pas l'application attendue");
console.log("Validation LED2 OK : fichiers, build et artefact présents.");
