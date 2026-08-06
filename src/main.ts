import "./style.css";
import "./scan.css";

if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);

type ConnectionState = "idle" | "connecting" | "connected" | "error";

interface WledState {
  on: boolean;
  bri: number;
  seg: Array<{ col: number[][]; fx: number; sx: number; ix: number }>;
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
const effects = [{ id: 0, label: "Couleur fixe" }, { id: 1, label: "Blink" }, { id: 9, label: "Fire flicker" }, { id: 12, label: "Rainbow" }, { id: 45, label: "Plasma" }];
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
        <div class="brand"><span class="brand-mark">✦</span><div><strong>LED2</strong><small>WLED control studio</small></div></div>
        <div class="connection-pill ${statusClass}"><span class="status-dot"></span>${statusLabel}</div>
      </header>
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
      <section class="zones-panel"><div class="section-title"><div><p class="eyebrow">ZONES</p><h2>${TOTAL_ZONES} zones LED</h2></div><button id="zones-toggle" class="secondary-button">${zonesOpen ? "Réduire" : "Afficher"}</button></div>${zonesOpen ? `<div class="zone-actions"><button id="zones-all">Tout</button><button id="zones-none">Rien</button><button id="zones-pattern">1 sur 2</button><span>${zoneState.filter(Boolean).length} sélectionnées</span></div><div class="zone-grid">${zoneState.map((active, index) => `<button class="zone-cell ${active ? "active" : ""}" data-zone="${index}">${index + 1}</button>`).join("")}</div><button id="zones-apply" class="primary-wide" ${connectionState !== "connected" ? "disabled" : ""}>Appliquer la sélection</button>` : ""}</section>
      <section class="white-panel"><div class="section-title"><div><p class="eyebrow">CANAL BLANC</p><h2>Blanc et température</h2></div><label class="fusion-toggle"><input id="fusion-toggle" type="checkbox" ${connectionState !== "connected" ? "disabled" : ""} /> Fusion</label></div><div class="white-controls"><label>Température<input id="white-temperature" type="range" min="0" max="100" value="50" ${connectionState !== "connected" ? "disabled" : ""} /></label><label>Intensité<input id="white-level" type="range" min="0" max="255" value="128" ${connectionState !== "connected" ? "disabled" : ""} /></label></div></section>
      <section class="dashboard ${connectionState !== "connected" ? "muted" : ""}">
        <div class="section-title"><div><p class="eyebrow">ESPACE DE CONTRÔLE</p><h2>${deviceName}</h2></div><span class="locked">${connectionState === "connected" ? "ACTIF" : "EN ATTENTE"}</span></div>
        <div class="controls"><article class="control-card power-card"><div><span class="control-label">ALIMENTATION</span><h3>${state.on ? "Allumées" : "Éteintes"}</h3></div><button class="power-toggle ${state.on ? "active" : ""}" id="power-toggle" aria-label="Basculer l'alimentation"><span></span></button></article><article class="control-card"><span class="control-label">LUMINOSITÉ</span><div class="value-row"><h3>${Math.round((state.bri / 255) * 100)}%</h3><span>INTENSITÉ</span></div><input id="brightness" type="range" min="1" max="255" value="${state.bri}" ${connectionState !== "connected" ? "disabled" : ""} /></article><article class="control-card color-card"><span class="control-label">COULEUR ACTUELLE</span><div class="color-preview"><span></span><strong>Orange solaire</strong></div></article></div>
      <div class="effect-panel"><span class="control-label">EFFET WLED</span><select id="effect" ${connectionState !== "connected" ? "disabled" : ""}>${effects.map(effect => `<option value="${effect.id}" ${state.seg[0]?.fx === effect.id ? "selected" : ""}>${effect.label}</option>`).join("")}</select><label class="mini-control">COULEUR<input id="color-picker" type="color" value="${firstColor()}" ${connectionState !== "connected" ? "disabled" : ""} /></label><label class="mini-control">VITESSE<input id="effect-speed" type="range" min="0" max="255" value="${state.seg[0]?.sx ?? 128}" ${connectionState !== "connected" ? "disabled" : ""} /></label><label class="mini-control">INTENSITÉ<input id="effect-intensity" type="range" min="0" max="255" value="${state.seg[0]?.ix ?? 128}" ${connectionState !== "connected" ? "disabled" : ""} /></label></div>
      </section>
      <section class="scenes-panel"><div class="section-title"><div><p class="eyebrow">MES SCÈNES</p><h2>Presets lumineux</h2></div><button id="save-scene" class="secondary-button" ${connectionState !== "connected" ? "disabled" : ""}>+ Enregistrer</button></div>${groupMessage ? `<p class="group-message">${groupMessage}</p>` : ""}${scenes.length ? `<div class="scene-list">${scenes.map(scene => `<article class="scene-item"><button class="scene-apply" data-scene-id="${scene.id}"><span class="scene-swatch" style="background:${firstColorFrom(scene.state)}"></span><span><strong>${scene.name}</strong><small>${scene.state.on ? "Allumé" : "Éteint"} · ${Math.round(scene.state.bri / 255 * 100)}%</small></span></button><button class="scene-group" data-group-scene-id="${scene.id}" ${savedDevices.length < 2 ? "disabled" : ""} aria-label="Appliquer ${scene.name} à tous">Tous</button><button class="scene-delete" data-delete-scene="${scene.id}" aria-label="Supprimer ${scene.name}">×</button></article>`).join("")}</div>` : `<p class="hint">Aucune scène enregistrée pour le moment.</p>`}</section>
    </main>`;

  document.querySelector<HTMLFormElement>("#connect-form")?.addEventListener("submit", connect);
  document.querySelector<HTMLButtonElement>("#power-toggle")?.addEventListener("click", () => updateState({ on: !state.on }));
  document.querySelector<HTMLInputElement>("#brightness")?.addEventListener("input", (event) => updateState({ bri: Number((event.target as HTMLInputElement).value) }));
  document.querySelector<HTMLSelectElement>("#effect")?.addEventListener("change", (event) => { const fx = Number((event.target as HTMLSelectElement).value); state = { ...state, seg: [{ ...state.seg[0], fx }] }; updateState({ seg: state.seg }); });
  document.querySelector<HTMLInputElement>("#color-picker")?.addEventListener("input", (event) => { const hex = (event.target as HTMLInputElement).value; const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)); state = { ...state, seg: [{ ...state.seg[0], col: [rgb] }] }; updateState({ seg: state.seg }); });
  document.querySelector<HTMLInputElement>("#effect-speed")?.addEventListener("input", (event) => { const sx = Number((event.target as HTMLInputElement).value); state = { ...state, seg: [{ ...state.seg[0], sx }] }; updateState({ seg: state.seg }); });
  document.querySelector<HTMLInputElement>("#effect-intensity")?.addEventListener("input", (event) => { const ix = Number((event.target as HTMLInputElement).value); state = { ...state, seg: [{ ...state.seg[0], ix }] }; updateState({ seg: state.seg }); });
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
  document.querySelector<HTMLInputElement>("#white-level")?.addEventListener("input", event => updateWhite(Number((event.target as HTMLInputElement).value), 50));
  document.querySelector<HTMLInputElement>("#white-temperature")?.addEventListener("input", event => updateWhite(128, Number((event.target as HTMLInputElement).value)));
  document.querySelector<HTMLInputElement>("#fusion-toggle")?.addEventListener("change", event => { const enabled = (event.target as HTMLInputElement).checked; updateState({ seg: state.seg.map(segment => ({ ...segment, col: enabled ? [segment.col[0], [128, 128, 128]] : [segment.col[0]] })) }); });
}

function firstColorFrom(sceneState: WledState) { const color = sceneState.seg[0]?.col?.[0] || [255, 98, 50]; return `rgb(${color.join(",")})`; }
function saveCurrentScene() { const name = window.prompt("Nom de la scène", `Scène ${scenes.length + 1}`)?.trim(); if (!name) return; scenes = [{ id: crypto.randomUUID(), name, state: structuredClone(state) }, ...scenes].slice(0, 20); saveScenes(); render(); }
function applyScene(id: string) { const scene = scenes.find(item => item.id === id); if (!scene) return; state = structuredClone(scene.state); render(); updateState(state); }
function deleteScene(id: string) { scenes = scenes.filter(scene => scene.id !== id); saveScenes(); render(); }
async function applySceneToAll(id: string) { const scene = scenes.find(item => item.id === id); if (!scene || savedDevices.length < 2) return; groupMessage = "Application de la scène sur les appareils…"; render(); const results = await Promise.allSettled(savedDevices.map(device => fetch(`${device.url}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scene.state), signal: AbortSignal.timeout(5000) }))); const success = results.filter(result => result.status === "fulfilled" && result.value.ok).length; groupMessage = `${success} / ${savedDevices.length} appareil(s) mis à jour.`; render(); }
async function sendWledState(payload: unknown) { if (connectionState !== "connected") return false; const response = await fetch(`${baseUrl}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error(`WLED state rejected: ${response.status}`); return true; }
async function applyZones() {
  if (connectionState !== "connected") return;
  const totalLeds = TOTAL_ZONES * 2;
  const groups: Array<{ start: number; stop: number }> = [];
  let start = -1;
  for (let zone = 0; zone <= TOTAL_ZONES; zone++) {
    if (zone < TOTAL_ZONES && zoneState[zone] && start < 0) start = zone;
    if ((zone === TOTAL_ZONES || !zoneState[zone]) && start >= 0) { groups.push({ start: start * 2, stop: zone * 2 }); start = -1; }
  }
  try {
    if (groups.length <= 14) {
      const segments = groups.flatMap((group, index) => [
        { id: index * 2, start: group.start, stop: group.stop, on: true, fx: 0, col: [[255, 98, 50]] },
        { id: index * 2 + 1, start: group.start + 1, stop: group.stop + 1, on: true, fx: 0, col: [[128, 128, 128]] },
      ]);
      for (let id = segments.length; id < 30; id++) await sendWledState({ seg: [{ id, stop: 0 }] });
      await sendWledState({ seg: segments });
    } else {
      const masked: Array<number | number[]> = [];
      for (let zone = 0; zone < TOTAL_ZONES; zone++) if (!zoneState[zone]) { masked.push(zone * 2, [0, 0, 0]); masked.push(zone * 2 + 1, [0, 0, 0]); }
      await sendWledState({ seg: [{ id: 0, start: 0, stop: totalLeds, on: true, fx: 0, col: [[255, 98, 50]], i: masked }, { id: 1, start: 1, stop: totalLeds, on: true, fx: 0, col: [[128, 128, 128]], i: masked }] });
    }
    groupMessage = `${zoneState.filter(Boolean).length} zone(s) appliquée(s) individuellement.`;
  } catch { connectionState = "error"; groupMessage = "Échec de l’application des zones. Vérifiez la connexion WLED."; }
  render();
}
async function useWledPreset(id: number) { if (connectionState !== "connected") return; presetMessage = presetRecordMode ? `Enregistrement de la mémoire ${id}…` : `Chargement de la mémoire ${id}…`; render(); try { const payload = presetRecordMode ? { psave: id } : { ps: id }; const response = await fetch(`${baseUrl}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error(); presetRecordMode = false; presetMessage = `Mémoire ${id} ${payload.psave ? "enregistrée" : "chargée"}.`; } catch { presetMessage = `Impossible de modifier la mémoire ${id}.`; } render(); }
function updateWhite(level: number, temperature: number) { const warm = Math.round(255 * Math.max(0, 1 - temperature / 100)); const cool = Math.round(255 * Math.min(1, temperature / 100)); state = { ...state, seg: state.seg.map(segment => ({ ...segment, col: [segment.col[0], [warm, cool, level]] })) }; updateState({ seg: state.seg }); }

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
