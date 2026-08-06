import "./style.css";
import "./scan.css";
import "./v34.css";
import iro from "@jaames/iro";

if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);

type ConnectionState = "idle" | "connecting" | "connected" | "error";

interface WledSegment {
  id?: number; start?: number; stop?: number; grp?: number; spc?: number; on?: boolean;
  col: number[][]; fx: number; sx: number; ix: number; bri?: number;
}
interface WledState {
  on: boolean;
  bri: number;
  seg: WledSegment[];
}
interface SavedDevice { url: string; name: string; }
interface DiscoveredDevice extends SavedDevice { version?: string; }
interface Scene { id: string; name: string; state: WledState; }

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root not found");
const root = app;

let baseUrl = "";
let connectionState: ConnectionState = "idle";
let deviceName = "Aucun appareil connecté";
let state: WledState = { on: false, bri: 128, seg: [{ col: [[255, 98, 50]], fx: 0, sx: 128, ix: 128 }] };
let savedDevices: SavedDevice[] = loadSavedDevices();
let scanResults: DiscoveredDevice[] = [];
let scanning = false;
let scanMessage = "";
let detectedPrefixes: string[] = [];
let scenes: Scene[] = loadScenes();
let groupMessage = "";
const TOTAL_ZONES = 97;
let zoneState = Array.from({ length: TOTAL_ZONES }, () => true);
let zonesOpen = false;
let presetRecordMode = false;
let presetMessage = "";
let effects = [{ id: 0, label: "Solid" }];
let effectSearch = "";
let activeSegmentCount = 0;
let isMatrixMode = false;
let fusionEnabled = false;
let activeChannel: "rgb" | "white" = "rgb";
let currentColors = { r: 255, g: 98, b: 50, wr: 255, wg: 150, wb: 0 };
let whiteBrightness = 128;
let whiteTemperature = 50;
let rgbBrightness = 128;
function loadSavedDevices(): SavedDevice[] { try { const value = JSON.parse(localStorage.getItem("led2.devices") || "[]"); return Array.isArray(value) ? value.filter(item => item && typeof item.url === "string" && typeof item.name === "string") : []; } catch { return []; } }
function loadScenes(): Scene[] { try { const value = JSON.parse(localStorage.getItem("led2.scenes") || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }
function saveScenes() { localStorage.setItem("led2.scenes", JSON.stringify(scenes)); }
function firstColor() { const color = state.seg[0]?.col?.[0] || [255, 98, 50]; return `#${color.map(value => value.toString(16).padStart(2, "0")).join("")}`; }

function render() {
  const statusLabel = connectionState === "connected" ? "Connecté" : connectionState === "connecting" ? "Connexion…" : connectionState === "error" ? "Connexion impossible" : "Prêt à connecter";
  const statusClass = connectionState === "connected" ? "online" : connectionState === "error" ? "error" : "";
  root.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">✦</span><div><strong>WLED</strong><small>V34 MATRIX · LED2 PWA</small></div></div>
        <div class="connection-pill ${statusClass}"><span class="status-dot"></span>${statusLabel}</div>
      </header>
      <section class="master-brightness"><div><span>MASTER LUMINOSITÉ</span><strong>${Math.round(state.bri / 2.55)}%</strong></div><input id="master-brightness" type="range" min="0" max="255" value="${state.bri}" ${connectionState !== "connected" ? "disabled" : ""} /></section>
      <section class="hero">
        <div><p class="eyebrow">NOUVELLE GÉNÉRATION</p><h1>Donnez vie à<br /><em>vos lumières.</em></h1><p class="intro">Une interface claire et réactive pour piloter vos appareils WLED, où que vous soyez.</p></div>
        <div class="glow-orb" aria-hidden="true"></div>
      </section>
      <section class="connect-card">
        <div class="card-heading"><div><p class="eyebrow">PREMIÈRE ÉTAPE</p><h2>Connecter un appareil</h2></div><span class="step">01</span></div>
        <form id="connect-form" class="connect-form"><label for="device-url">Adresse de l'appareil</label><div class="input-row"><input id="device-url" type="text" placeholder="http://wled.local ou 192.168.1.42" value="${baseUrl}" /><button type="submit">${connectionState === "connecting" ? "Connexion…" : "Connecter"}<span>→</span></button></div><p class="hint">L'adresse locale de votre appareil WLED</p></form>
        ${connectionState === "error" ? '<p class="error-message">Impossible de joindre cet appareil. Vérifiez son adresse et votre réseau.</p>' : ""}
      </section>
      <div class="device-tools"><div><p class="eyebrow">DÉCOUVERTE LOCALE</p><h3>Appareils sur le réseau</h3><p class="hint">LED2 tente d’identifier la forme de votre réseau avant de scanner les adresses.</p></div><div class="scan-row"><input id="network-prefix" type="text" value="${detectedPrefixes[0] || "192.168.1"}" aria-label="Préfixe réseau" /><button id="detect-button" class="secondary-button">Détecter</button><button id="scan-button" class="secondary-button">${scanning ? "Scan en cours…" : "Scanner"}</button></div>${scanMessage ? `<p class="hint">${scanMessage}</p>` : ""}${scanResults.length ? `<div class="device-list">${scanResults.map(device => `<button class="device-item" data-device-url="${device.url}"><span class="device-icon">✦</span><span><strong>${device.name}</strong><small>${device.url}</small></span><span>→</span></button>`).join("")}</div>` : ""}</div>
      ${savedDevices.length ? `<div class="saved-devices"><p class="eyebrow">MES APPAREILS</p>${savedDevices.map(device => `<button class="saved-device" data-saved-url="${device.url}"><span>${device.name}</span><small>${device.url}</small></button>`).join("")}</div>` : ""}
      <section class="wled-presets"><div class="section-title"><div><p class="eyebrow">PRESETS WLED</p><h2>Mémoires de l’appareil</h2></div><button id="preset-record" class="secondary-button">${presetRecordMode ? "Annuler" : "Enregistrer"}</button></div>${presetMessage ? `<p class="group-message">${presetMessage}</p>` : ""}<div class="preset-grid">${[1,2,3,4].map(id => `<button class="preset-slot" data-preset="${id}" ${connectionState !== "connected" ? "disabled" : ""}>Mém. ${id}</button>`).join("")}</div></section>
      <section class="zones-panel"><div class="section-title"><div><p class="eyebrow">ZONES · ${isMatrixMode ? "MATRIX HD" : "SEGMENTS"}</p><h2>${TOTAL_ZONES} zones LED</h2></div><button id="zones-toggle" class="secondary-button">${zonesOpen ? "Réduire" : "Afficher"}</button></div>${zonesOpen ? `<div class="zone-actions"><button id="zones-all">Tout</button><button id="zones-none">Rien</button><button id="zones-pattern">1 sur 2</button><span>${zoneState.filter(Boolean).length} sélectionnées</span></div><div class="zone-grid">${zoneState.map((active, index) => `<button class="zone-cell ${active ? "active" : ""}" data-zone="${index}">${index + 1}</button>`).join("")}</div><button id="zones-apply" class="primary-wide" ${connectionState !== "connected" ? "disabled" : ""}>Appliquer la sélection</button>` : ""}</section>
      <section class="white-panel ${activeChannel === "white" || fusionEnabled ? "active-mode" : "inactive-mode"}"><div class="section-title"><div><p class="eyebrow">☀ CANAL BLANC</p><h2>Blanc et température</h2></div><label class="fusion-toggle"><input id="fusion-toggle" type="checkbox" ${fusionEnabled ? "checked" : ""} ${connectionState !== "connected" ? "disabled" : ""} /> Fusion</label></div><div class="temperature-labels"><span>Chaud</span><span>Froid</span></div><div class="white-controls"><label>Température<input id="white-temperature" class="cct-range" type="range" min="0" max="100" value="${whiteTemperature}" ${connectionState !== "connected" ? "disabled" : ""} /></label><label>Intensité<input id="white-level" type="range" min="0" max="255" value="${whiteBrightness}" ${connectionState !== "connected" ? "disabled" : ""} /></label></div></section>
      <section class="dashboard ${connectionState !== "connected" ? "muted" : ""}">
        <div class="section-title"><div><p class="eyebrow">ESPACE DE CONTRÔLE</p><h2>${deviceName}</h2></div><span class="locked">${connectionState === "connected" ? "ACTIF" : "EN ATTENTE"}</span></div>
        <div class="controls"><article class="control-card power-card"><div><span class="control-label">ALIMENTATION</span><h3>${state.on ? "Allumées" : "Éteintes"}</h3></div><button class="power-toggle ${state.on ? "active" : ""}" id="power-toggle" aria-label="Basculer l'alimentation"><span></span></button></article><article class="control-card legacy-brightness"><span class="control-label">LUMINOSITÉ</span><div class="value-row"><h3>${Math.round((state.bri / 255) * 100)}%</h3><span>INTENSITÉ</span></div><input id="brightness" type="range" min="1" max="255" value="${state.bri}" ${connectionState !== "connected" ? "disabled" : ""} /></article><article class="control-card color-card ${activeChannel === "rgb" || fusionEnabled ? "active-mode" : "inactive-mode"}"><span class="control-label">◉ COULEUR RGB</span><div id="rgb-picker" class="rgb-picker" aria-label="Roue de couleur RGB"></div><label class="rgb-level">INTENSITÉ RGB<input id="rgb-level" type="range" min="0" max="255" value="${rgbBrightness}" ${connectionState !== "connected" ? "disabled" : ""} /></label></article></div>
      <div class="effect-panel"><span class="control-label">EFFET WLED ${isMatrixMode ? "· indisponible en Matrix" : ""}</span><input id="effect-search" class="effect-search" type="search" value="${effectSearch}" placeholder="Rechercher un effet" /><select id="effect" ${connectionState !== "connected" || isMatrixMode ? "disabled" : ""}>${effects.filter(effect => effect.label.toLowerCase().includes(effectSearch.toLowerCase())).map(effect => `<option value="${effect.id}" ${state.seg[0]?.fx === effect.id ? "selected" : ""}>${effect.label}</option>`).join("")}</select><label class="mini-control">COULEUR<input id="color-picker" type="color" value="${firstColor()}" ${connectionState !== "connected" ? "disabled" : ""} /></label><label class="mini-control">VITESSE<input id="effect-speed" type="range" min="0" max="255" value="${state.seg[0]?.sx ?? 128}" ${connectionState !== "connected" || isMatrixMode ? "disabled" : ""} /></label><label class="mini-control">INTENSITÉ<input id="effect-intensity" type="range" min="0" max="255" value="${state.seg[0]?.ix ?? 128}" ${connectionState !== "connected" || isMatrixMode ? "disabled" : ""} /></label></div>
      </section>
      <section class="scenes-panel"><div class="section-title"><div><p class="eyebrow">MES SCÈNES</p><h2>Presets lumineux</h2></div><button id="save-scene" class="secondary-button" ${connectionState !== "connected" ? "disabled" : ""}>+ Enregistrer</button></div>${groupMessage ? `<p class="group-message">${groupMessage}</p>` : ""}${scenes.length ? `<div class="scene-list">${scenes.map(scene => `<article class="scene-item"><button class="scene-apply" data-scene-id="${scene.id}"><span class="scene-swatch" style="background:${firstColorFrom(scene.state)}"></span><span><strong>${scene.name}</strong><small>${scene.state.on ? "Allumé" : "Éteint"} · ${Math.round(scene.state.bri / 255 * 100)}%</small></span></button><button class="scene-group" data-group-scene-id="${scene.id}" ${savedDevices.length < 2 ? "disabled" : ""} aria-label="Appliquer ${scene.name} à tous">Tous</button><button class="scene-delete" data-delete-scene="${scene.id}" aria-label="Supprimer ${scene.name}">×</button></article>`).join("")}</div>` : `<p class="hint">Aucune scène enregistrée pour le moment.</p>`}</section>
      <button id="master-power" class="master-power ${state.on ? "active" : ""}" aria-label="Alimentation générale">⏻</button>
    </main>`;

  document.querySelector<HTMLFormElement>("#connect-form")?.addEventListener("submit", connect);
  document.querySelector<HTMLButtonElement>("#power-toggle")?.addEventListener("click", () => updateState({ on: !state.on }));
  document.querySelector<HTMLButtonElement>("#master-power")?.addEventListener("click", () => updateState({ on: !state.on }));
  document.querySelector<HTMLInputElement>("#brightness")?.addEventListener("input", (event) => updateState({ bri: Number((event.target as HTMLInputElement).value) }));
  document.querySelector<HTMLInputElement>("#master-brightness")?.addEventListener("input", event => updateState({ bri: Number((event.target as HTMLInputElement).value) }));
  document.querySelector<HTMLInputElement>("#effect-search")?.addEventListener("input", event => { effectSearch = (event.target as HTMLInputElement).value; render(); });
  document.querySelector<HTMLSelectElement>("#effect")?.addEventListener("change", event => updateEffect("fx", Number((event.target as HTMLSelectElement).value)));
  document.querySelector<HTMLInputElement>("#color-picker")?.addEventListener("input", event => applyRgbColor((event.target as HTMLInputElement).value));
  document.querySelector<HTMLInputElement>("#effect-speed")?.addEventListener("input", event => updateEffect("sx", Number((event.target as HTMLInputElement).value)));
  document.querySelector<HTMLInputElement>("#effect-intensity")?.addEventListener("input", event => updateEffect("ix", Number((event.target as HTMLInputElement).value)));
  document.querySelector<HTMLButtonElement>("#scan-button")?.addEventListener("click", scanNetwork);
  document.querySelector<HTMLButtonElement>("#detect-button")?.addEventListener("click", detectNetwork);
  document.querySelectorAll<HTMLButtonElement>("[data-device-url]").forEach(button => button.addEventListener("click", () => selectDevice(button.dataset.deviceUrl || "")));
  document.querySelectorAll<HTMLButtonElement>("[data-saved-url]").forEach(button => button.addEventListener("click", () => selectDevice(button.dataset.savedUrl || "")));
  document.querySelector<HTMLButtonElement>("#save-scene")?.addEventListener("click", saveCurrentScene);
  document.querySelectorAll<HTMLButtonElement>("[data-scene-id]").forEach(button => button.addEventListener("click", () => applyScene(button.dataset.sceneId || "")));
  document.querySelectorAll<HTMLButtonElement>("[data-delete-scene]").forEach(button => button.addEventListener("click", () => deleteScene(button.dataset.deleteScene || "")));
  document.querySelectorAll<HTMLButtonElement>("[data-group-scene-id]").forEach(button => button.addEventListener("click", () => applySceneToAll(button.dataset.groupSceneId || "")));
  document.querySelector<HTMLButtonElement>("#zones-toggle")?.addEventListener("click", () => { zonesOpen = !zonesOpen; render(); });
  document.querySelectorAll<HTMLButtonElement>("[data-zone]").forEach(button => button.addEventListener("click", () => { const index = Number(button.dataset.zone); zoneState[index] = !zoneState[index]; render(); }));
  document.querySelector<HTMLButtonElement>("#zones-all")?.addEventListener("click", () => { zoneState = zoneState.map(() => true); render(); });
  document.querySelector<HTMLButtonElement>("#zones-none")?.addEventListener("click", () => { zoneState = zoneState.map(() => false); render(); });
  document.querySelector<HTMLButtonElement>("#zones-pattern")?.addEventListener("click", () => { zoneState = zoneState.map((_, index) => index % 2 === 0); render(); });
  document.querySelector<HTMLButtonElement>("#zones-apply")?.addEventListener("click", applyZones);
  document.querySelector<HTMLButtonElement>("#preset-record")?.addEventListener("click", () => { presetRecordMode = !presetRecordMode; presetMessage = presetRecordMode ? "Choisissez une mémoire pour l’enregistrer." : ""; render(); });
  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach(button => button.addEventListener("click", () => useWledPreset(Number(button.dataset.preset))));
  document.querySelector<HTMLInputElement>("#white-level")?.addEventListener("input", event => { whiteBrightness = Number((event.target as HTMLInputElement).value); updateWhite(); });
  document.querySelector<HTMLInputElement>("#white-temperature")?.addEventListener("input", event => { whiteTemperature = Number((event.target as HTMLInputElement).value); updateWhite(); });
  document.querySelector<HTMLInputElement>("#rgb-level")?.addEventListener("input", event => { rgbBrightness = Number((event.target as HTMLInputElement).value); updateRgbBrightness(); });
  document.querySelector<HTMLInputElement>("#fusion-toggle")?.addEventListener("change", event => { fusionEnabled = (event.target as HTMLInputElement).checked; activateChannel(activeChannel); });
  initializeColorWheel();
}

function firstColorFrom(sceneState: WledState) { const color = sceneState.seg[0]?.col?.[0] || [255, 98, 50]; return `rgb(${color.join(",")})`; }
function saveCurrentScene() { const name = window.prompt("Nom de la scène", `Scène ${scenes.length + 1}`)?.trim(); if (!name) return; scenes = [{ id: crypto.randomUUID(), name, state: structuredClone(state) }, ...scenes].slice(0, 20); saveScenes(); render(); }
function applyScene(id: string) { const scene = scenes.find(item => item.id === id); if (!scene) return; state = structuredClone(scene.state); render(); updateState(state); }
function deleteScene(id: string) { scenes = scenes.filter(scene => scene.id !== id); saveScenes(); render(); }
async function applySceneToAll(id: string) { const scene = scenes.find(item => item.id === id); if (!scene || savedDevices.length < 2) return; groupMessage = "Application de la scène sur les appareils…"; render(); const results = await Promise.allSettled(savedDevices.map(device => fetch(`${device.url}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scene.state), signal: AbortSignal.timeout(5000) }))); const success = results.filter(result => result.status === "fulfilled" && result.value.ok).length; groupMessage = `${success} / ${savedDevices.length} appareil(s) mis à jour.`; render(); }
async function sendWledState(payload: unknown) { if (connectionState !== "connected") return false; const response = await fetch(`${baseUrl}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error(`WLED state rejected: ${response.status}`); return true; }
async function applyZones() {
  if (connectionState !== "connected") return;
  const groups: Array<{ s: number; e: number }> = [];
  let start = -1;
  for (let zone = 0; zone < TOTAL_ZONES; zone++) {
    if (zoneState[zone] && start === -1) start = zone;
    else if (!zoneState[zone] && start !== -1) { groups.push({ s: start, e: zone }); start = -1; }
  }
  if (start !== -1) groups.push({ s: start, e: TOTAL_ZONES });
  try {
    if (groups.length <= 15) {
      isMatrixMode = false;
      const segments: Array<Record<string, unknown>> = [];
      let id = 0;
      for (const group of groups) {
        segments.push({ id: id++, start: group.s * 2, stop: group.e * 2, grp: 1, spc: 1, of: 0, on: fusionEnabled || activeChannel === "rgb", fx: 0, n: `Z${group.s}-RGB`, col: [[currentColors.r, currentColors.g, currentColors.b]] });
        segments.push({ id: id++, start: group.s * 2 + 1, stop: group.e * 2 + 1, grp: 1, spc: 1, of: 0, on: fusionEnabled || activeChannel === "white", fx: 0, n: `Z${group.s}-W`, col: [[currentColors.wr, currentColors.wg, currentColors.wb]] });
      }
      for (let clearId = id; clearId < 30; clearId++) segments.push({ id: clearId, stop: 0 });
      activeSegmentCount = id;
      await sendWledState({ seg: segments });
    } else {
      isMatrixMode = true;
      const reset: Array<Record<string, unknown>> = [{ id: 0, start: 0, stop: TOTAL_ZONES * 2, grp: 1, spc: 0, of: 0, on: true, fx: 0, col: [[0, 0, 0]] }];
      for (let id = 1; id < 30; id++) reset.push({ id, stop: 0 });
      await sendWledState({ seg: reset });
      const pixelList: Array<number | string> = [];
      const rgb = rgbToHex(currentColors.r, currentColors.g, currentColors.b);
      const white = rgbToHex(currentColors.wr, currentColors.wg, currentColors.wb);
      for (let zone = 0; zone < TOTAL_ZONES; zone++) {
        const active = zoneState[zone];
        pixelList.push(zone * 2, active && (fusionEnabled || activeChannel === "rgb") ? rgb : "000000");
        pixelList.push(zone * 2 + 1, active && (fusionEnabled || activeChannel === "white") ? white : "000000");
      }
      for (let offset = 0; offset < pixelList.length; offset += 40) {
        await sendWledState({ seg: { id: 0, i: pixelList.slice(offset, offset + 40) } });
        await new Promise(resolve => setTimeout(resolve, 120));
      }
      activeSegmentCount = 1;
    }
    groupMessage = `${zoneState.filter(Boolean).length} zone(s) appliquée(s) en mode ${isMatrixMode ? "Matrix HD" : "Segments"}.`;
  } catch { connectionState = "error"; groupMessage = "Échec de l’application des zones. Vérifiez la connexion WLED."; }
  render();
}
async function useWledPreset(id: number) { if (connectionState !== "connected") return; presetMessage = presetRecordMode ? `Enregistrement de la mémoire ${id}…` : `Chargement de la mémoire ${id}…`; render(); try { const payload = presetRecordMode ? { psave: id } : { ps: id }; const response = await fetch(`${baseUrl}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error(); presetRecordMode = false; presetMessage = `Mémoire ${id} ${payload.psave ? "enregistrée" : "chargée"}.`; } catch { presetMessage = `Impossible de modifier la mémoire ${id}.`; } render(); }
function rgbToHex(r: number, g: number, b: number) { return [r, g, b].map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")).join("").toUpperCase(); }
async function activateChannel(channel: "rgb" | "white") {
  activeChannel = channel;
  if (isMatrixMode) return applyZones();
  const segments = Array.from({ length: activeSegmentCount }, (_, id) => ({ id, on: fusionEnabled || (channel === "white" ? id % 2 === 1 : id % 2 === 0) }));
  if (segments.length) await sendWledState({ seg: segments });
  render();
}
async function applyRgbColor(hex: string) {
  const [r, g, b] = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  currentColors = { ...currentColors, r, g, b };
  activeChannel = "rgb";
  if (isMatrixMode) return applyZones();
  const segments = Array.from({ length: Math.ceil(activeSegmentCount / 2) }, (_, index) => ({ id: index * 2, col: [[r, g, b]], fx: 0 }));
  if (segments.length) await sendWledState({ seg: segments });
}
function initializeColorWheel() {
  const target = document.querySelector<HTMLElement>("#rgb-picker");
  if (!target) return;
  const picker = iro.ColorPicker(target, { width: Math.min(220, Math.max(170, target.clientWidth || 220)), layout: [{ component: iro.ui.Wheel, options: { wheelLightness: false } }], color: firstColor() });
  picker.on("input:change", (color: iro.Color) => { currentColors = { ...currentColors, r: color.rgb.r, g: color.rgb.g, b: color.rgb.b }; activeChannel = "rgb"; });
  picker.on("input:end", (color: iro.Color) => applyRgbColor(color.hexString));
}
async function updateRgbBrightness() {
  activeChannel = "rgb";
  if (isMatrixMode) return applyZones();
  const segments = Array.from({ length: Math.ceil(activeSegmentCount / 2) }, (_, index) => ({ id: index * 2, bri: rgbBrightness }));
  if (segments.length) await sendWledState({ seg: segments });
}
async function updateWhite() {
  const p = whiteTemperature;
  const wr = p <= 50 ? Math.floor((p / 50) * 255) : 255;
  const wg = p <= 50 ? 255 : Math.floor(255 - ((p - 50) / 50) * 255);
  currentColors = { ...currentColors, wr, wg, wb: 0 };
  activeChannel = "white";
  if (isMatrixMode) return applyZones();
  const segments = Array.from({ length: Math.floor(activeSegmentCount / 2) }, (_, index) => ({ id: index * 2 + 1, col: [[wr, wg, 0]], bri: whiteBrightness, fx: 0 }));
  if (segments.length) await sendWledState({ seg: segments });
}
async function updateEffect(parameter: "fx" | "sx" | "ix", value: number) {
  if (isMatrixMode) return;
  const segments = Array.from({ length: activeSegmentCount }, (_, id) => ({ id, [parameter]: value })).filter(segment => fusionEnabled || (activeChannel === "white" ? segment.id % 2 === 1 : segment.id % 2 === 0));
  if (segments.length) await sendWledState({ seg: segments });
}
async function fetchEffectsList() {
  try { const response = await fetch(`${baseUrl}/json/effects`, { signal: AbortSignal.timeout(5000) }); if (!response.ok) return; const names = await response.json() as string[]; effects = names.map((label, id) => ({ id, label })); }
  catch { effects = [{ id: 0, label: "Solid" }]; }
}

function selectDevice(url: string) { baseUrl = url; const input = document.querySelector<HTMLInputElement>("#device-url"); if (input) input.value = url; connect(new Event("submit") as SubmitEvent); }

function rememberDevice(device: SavedDevice) { savedDevices = [device, ...savedDevices.filter(item => item.url !== device.url)].slice(0, 12); localStorage.setItem("led2.devices", JSON.stringify(savedDevices)); }

async function scanNetwork() {
  const typedPrefix = document.querySelector<HTMLInputElement>("#network-prefix")?.value.trim().replace(/\.$/, "") || "";
  if (!/^\d{1,3}(\.\d{1,3}){2}$/.test(typedPrefix)) { scanMessage = "Format attendu : 3 nombres, par exemple 192.168.1"; render(); return; }
  scanning = true; scanResults = []; scanMessage = `Recherche sur ${typedPrefix}.x…`; render();
  const found: DiscoveredDevice[] = [];
  const candidates = Array.from({ length: 254 }, (_, index) => `${typedPrefix}.${index + 1}`);
  for (let index = 0; index < candidates.length; index += 24) {
    await Promise.all(candidates.slice(index, index + 24).map(async host => { try { const response = await fetch(`http://${host}/json/info`, { signal: AbortSignal.timeout(700) }); if (!response.ok) return; const info = await response.json() as { name?: string; ver?: string }; if (info.ver || info.name) found.push({ url: `http://${host}`, name: info.name || `WLED ${host}`, version: info.ver }); } catch { /* absent or inaccessible */ } }));
    scanMessage = `${Math.min(index + 24, 254)} / 254 adresses vérifiées…`; render();
  }
  scanResults = found; scanning = false; scanMessage = found.length ? `${found.length} appareil(s) trouvé(s).` : "Aucun appareil trouvé. Vérifiez le préfixe et les permissions CORS de WLED."; render();
}

async function detectNetwork() {
  scanMessage = "Détection de la forme du réseau…"; render();
  const prefixes = new Set<string>();
  try {
    const connection = new RTCPeerConnection({ iceServers: [] });
    connection.createDataChannel("led2");
    connection.onicecandidate = event => {
      const candidate = event.candidate?.candidate || "";
      const match = candidate.match(/(?:candidate|relay)\s+\d+\s+\w+\s+\d+\s+(\d{1,3}(?:\.\d{1,3}){3})/);
      if (match) { const parts = match[1].split("."); prefixes.add(parts.slice(0, 3).join(".")); }
    };
    await connection.setLocalDescription(await connection.createOffer());
    await new Promise(resolve => setTimeout(resolve, 1200));
    connection.close();
  } catch { /* ICE discovery can be blocked by the browser */ }
  detectedPrefixes = [...prefixes];
  if (!detectedPrefixes.length) {
    scanMessage = "Le navigateur masque l’adresse locale. Renseignez le préfixe de votre routeur, par exemple 192.168.0, 192.168.1 ou 10.0.0.";
  } else {
    scanMessage = `Réseau détecté : ${detectedPrefixes.join(", ")}. Vérifiez le préfixe puis lancez le scan.`;
  }
  render();
}

async function connect(event: SubmitEvent) {
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>("#device-url");
  baseUrl = input?.value.trim().replace(/\/$/, "") ?? "";
  if (!baseUrl) return;
  connectionState = "connecting";
  render();
  try {
    const response = await fetch(`${baseUrl}/json/state`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Device unavailable");
    state = await response.json() as WledState;
    activeSegmentCount = state.seg?.length || 0;
    isMatrixMode = activeSegmentCount === 1 && (state.seg[0]?.stop || 0) > 100;
    const rgb = state.seg?.[0]?.col?.[0];
    if (rgb) currentColors = { ...currentColors, r: rgb[0] || 0, g: rgb[1] || 0, b: rgb[2] || 0 };
    await fetchEffectsList();
    const info = await fetch(`${baseUrl}/json/info`, { signal: AbortSignal.timeout(5000) });
    if (info.ok) deviceName = ((await info.json()) as { name?: string }).name || "Appareil WLED";
    connectionState = "connected";
    rememberDevice({ url: baseUrl, name: deviceName });
  } catch {
    connectionState = "error";
  }
  render();
}

async function updateState(patch: Partial<WledState>) {
  state = { ...state, ...patch };
  render();
  if (connectionState !== "connected") return;
  try { const response = await fetch(`${baseUrl}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch), signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error("WLED rejected state update"); }
  catch { connectionState = "error"; render(); }
}

render();
