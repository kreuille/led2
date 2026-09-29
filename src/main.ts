import "./style.css";
import "./scan.css";
import "./v34.css";
import iro from "@jaames/iro";
import furniturePhoto from "./assets/meuble-led-flat.webp?inline";
import { clampByte, clampMapZoom, escapeHtml, formatUptime, isLed2Backup, normalizeWledUrl, reconstructZones, wifiQuality } from "./lib/safety";

const embeddedWledMode = /^\/led2\.html?$/i.test(window.location.pathname);
if ("serviceWorker" in navigator && !embeddedWledMode) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);

type ConnectionState = "idle" | "connecting" | "connected" | "error";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type LocalRequestInit = RequestInit & { targetAddressSpace?: "local" };

interface WledSegment {
  id?: number; start?: number; stop?: number; grp?: number; spc?: number; on?: boolean;
  col: number[][]; fx: number; sx: number; ix: number; bri?: number; n?: string;
}
interface WledState {
  on: boolean;
  bri: number;
  seg: WledSegment[];
}
interface WledInfo {
  ver?: string; release?: string; arch?: string; core?: string; clock?: number; freeheap?: number; uptime?: number; name?: string; ip?: string;
  leds?: { count?: number; fps?: number; pwr?: number; maxpwr?: number; maxseg?: number };
  wifi?: { rssi?: number; signal?: number; channel?: number; ap?: boolean };
  fs?: { u?: number; t?: number };
}
interface SavedDevice { url: string; name: string; }
interface DiscoveredDevice extends SavedDevice { version?: string; }
interface Scene { id: string; name: string; state: WledState; }
interface FurnitureLayout { bottomEnd: number; middleEnd: number; }
type ShelfId = "bottom" | "middle" | "top";
type ShelfMode = "off" | "rgb" | "white";
interface ShelfAmbience { mode: ShelfMode; color: string; temperature: number; brightness: number; effect: number; }
type ShelfAmbiences = Record<ShelfId, ShelfAmbience>;
interface Led2Backup {
  format: "led2-backup"; version: 1; createdAt: string;
  wled: { cfg?: unknown; state?: unknown; presets?: unknown };
  app: { devices: SavedDevice[]; scenes: Scene[]; furnitureLayout: FurnitureLayout; shelfAmbiences: ShelfAmbiences; liveZoneApply: boolean };
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root not found");
const root = app;

let baseUrl = embeddedWledMode ? window.location.origin : "";
let connectionState: ConnectionState = "idle";
let deviceName = "Aucun appareil connecté";
let state: WledState = { on: false, bri: 128, seg: [{ col: [[255, 98, 50]], fx: 0, sx: 128, ix: 128 }] };
let savedDevices: SavedDevice[] = loadSavedDevices();
let scanResults: DiscoveredDevice[] = [];
let scanning = false;
let scanMessage = "";
let detectedPrefixes: string[] = [...new Set([networkPrefixFrom(localStorage.getItem("led2.networkPrefix") || ""), ...savedDevices.map(device => networkPrefixFrom(device.url))].filter((prefix): prefix is string => Boolean(prefix)))];
let scenes: Scene[] = loadScenes();
let groupMessage = "";
let layoutMessage = "";
const TOTAL_ZONES = 97;
let zoneState = Array.from({ length: TOTAL_ZONES }, () => true);
let furnitureLayout = loadFurnitureLayout();
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
let whiteUpdateTimer: number | undefined;
let zoneApplyTimer: number | undefined;
let liveZoneApply = localStorage.getItem("led2.liveZoneApply") !== "false";
let stateSyncTimer: number | undefined;
let stateSyncInFlight = false;
let stateSyncFailures = 0;
let stateSyncPausedUntil = 0;
let lastStateFingerprint = "";
let deviceInfo: WledInfo | null = null;
let lastSyncAt = 0;
let infoSyncTimer: number | undefined;
let brightnessUpdateTimer: number | undefined;
let rgbBrightnessUpdateTimer: number | undefined;
let deferredInstallPrompt: InstallPrompt | null = null;
let installMessage = "";
let shelfAmbiences = loadShelfAmbiences();
let ambienceMessage = "";
let backupMessage = "";
let pendingRestore: Led2Backup | null = null;
let selectionUndo: boolean[][] = [];
let selectionRedo: boolean[][] = [];
let rangeMode = false;
let rangeAnchor: number | null = null;
let dragActive = false;
let dragValue = true;
let mapZoom = clampMapZoom(localStorage.getItem("led2.mapZoom") || 1);
let mapFocusMode = false;
let mapScrollLeft = 0;
let sectionObserver: IntersectionObserver | null = null;

window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferredInstallPrompt = event as InstallPrompt; render(); });
window.addEventListener("appinstalled", () => { deferredInstallPrompt = null; installMessage = "LED2 est installée."; render(); });
function loadSavedDevices(): SavedDevice[] { try { const value = JSON.parse(localStorage.getItem("led2.devices") || "[]"); return Array.isArray(value) ? value.flatMap(item => { const url = item && typeof item.url === "string" ? normalizeWledUrl(item.url) : null; return url && typeof item.name === "string" ? [{ url, name: item.name.slice(0, 80) }] : []; }) : []; } catch { return []; } }
function loadScenes(): Scene[] { try { return sanitizeScenes(JSON.parse(localStorage.getItem("led2.scenes") || "[]")); } catch { return []; } }
function sanitizeScenes(value: unknown): Scene[] {
  if (!Array.isArray(value)) return [];
  return value.filter(scene => scene && typeof scene.id === "string" && typeof scene.name === "string" && scene.state && typeof scene.state.on === "boolean" && Number.isFinite(scene.state.bri) && Array.isArray(scene.state.seg))
    .slice(0, 20)
    .map(scene => ({ id: scene.id.slice(0, 100), name: scene.name.slice(0, 80), state: scene.state as WledState }));
}
function loadFurnitureLayout(): FurnitureLayout {
  try {
    const value = JSON.parse(localStorage.getItem("led2.furnitureLayout") || "null") as Partial<FurnitureLayout> | null;
    const bottomEnd = Number(value?.bottomEnd);
    const middleEnd = Number(value?.middleEnd);
    if (Number.isInteger(bottomEnd) && Number.isInteger(middleEnd) && bottomEnd > 0 && bottomEnd < middleEnd && middleEnd < TOTAL_ZONES) return { bottomEnd, middleEnd };
  } catch { /* use the estimated layout */ }
  return { bottomEnd: 42, middleEnd: 55 };
}
function defaultShelfAmbiences(): ShelfAmbiences {
  return {
    bottom: { mode: "white", color: "#ff6432", temperature: 34, brightness: 105, effect: 0 },
    middle: { mode: "white", color: "#ff8a45", temperature: 26, brightness: 90, effect: 0 },
    top: { mode: "white", color: "#ffb060", temperature: 38, brightness: 115, effect: 0 },
  };
}
function loadShelfAmbiences(): ShelfAmbiences {
  try {
    const saved = JSON.parse(localStorage.getItem("led2.shelfAmbiences") || "null") as Partial<ShelfAmbiences> | null;
    return sanitizeShelfAmbiences(saved);
  } catch { return defaultShelfAmbiences(); }
}
function sanitizeShelfAmbiences(saved: Partial<ShelfAmbiences> | null | undefined): ShelfAmbiences {
  const defaults = defaultShelfAmbiences();
  const safeNumber = (value: unknown, fallback: number, maximum: number) => { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.min(maximum, parsed)) : fallback; };
  return Object.fromEntries((Object.keys(defaults) as ShelfId[]).map(id => {
    const candidate = saved?.[id];
    const mode = candidate && ["off", "rgb", "white"].includes(candidate.mode) ? candidate.mode : defaults[id].mode;
    const color = candidate && /^#[0-9a-f]{6}$/i.test(candidate.color) ? candidate.color : defaults[id].color;
    const temperature = safeNumber(candidate?.temperature, defaults[id].temperature, 100);
    const brightness = safeNumber(candidate?.brightness, defaults[id].brightness, 255);
    const effect = safeNumber(candidate?.effect, defaults[id].effect, 255);
    return [id, { mode, color, temperature, brightness, effect }];
  })) as ShelfAmbiences;
}
function saveShelfAmbiences() { localStorage.setItem("led2.shelfAmbiences", JSON.stringify(shelfAmbiences)); }
function saveScenes() { localStorage.setItem("led2.scenes", JSON.stringify(scenes)); }
function firstColor() { const color = state.seg[0]?.col?.[0] || [255, 98, 50]; return `#${color.slice(0, 3).map(value => Math.round(Math.max(0, Math.min(255, Number(value) || 0))).toString(16).padStart(2, "0")).join("")}`; }
function fetchLocal(input: string, init: RequestInit = {}) { return fetch(input, { ...init, targetAddressSpace: "local" } as LocalRequestInit); }
function networkPrefixFrom(value: string) {
  const match = value.trim().match(/(?:^|\/\/)(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3}))?(?::\d+)?(?:\/|$)/) || value.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const octets = match.slice(1, 5).filter(valuePart => valuePart !== undefined).map(Number);
  if (octets.some(octet => octet < 0 || octet > 255)) return null;
  const [a, b, c] = octets;
  const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  return isPrivate ? `${a}.${b}.${c}` : null;
}
function hostFrom(value: string) {
  try { return new URL(value.includes("://") ? value : `http://${value}`).hostname; }
  catch { return ""; }
}

function stateFingerprint(value: WledState) {
  return JSON.stringify({ on: value.on, bri: value.bri, seg: value.seg?.map(segment => ({ start: segment.start, stop: segment.stop, grp: segment.grp, spc: segment.spc, on: segment.on, bri: segment.bri, col: segment.col, fx: segment.fx, sx: segment.sx, ix: segment.ix, n: segment.n })) });
}

function formatMemory(bytes = 0) { return `${Math.round(bytes / 1024)} Ko`; }
function syncTimeLabel() { return lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString("fr-FR") : "Jamais"; }

function zonesFromSegments(value: WledState) {
  return reconstructZones(value, TOTAL_ZONES);
}

function applyRemoteState(next: WledState) {
  const fingerprint = stateFingerprint(next);
  const changed = fingerprint !== lastStateFingerprint;
  lastStateFingerprint = fingerprint;
  state = next;
  lastSyncAt = Date.now();
  activeSegmentCount = next.seg?.length || 0;
  isMatrixMode = activeSegmentCount === 1 && (next.seg[0]?.stop || 0) > 100 && (next.seg[0]?.spc || 0) === 0;
  const reconstructed = zonesFromSegments(next);
  if (reconstructed) zoneState = reconstructed;
  const rgbSegment = next.seg?.find(segment => (segment.start || 0) % 2 === 0 && segment.col?.[0]);
  const whiteSegment = next.seg?.find(segment => (segment.start || 0) % 2 === 1 && segment.col?.[0]);
  if (rgbSegment?.col?.[0]) {
    const [r = 0, g = 0, b = 0] = rgbSegment.col[0];
    currentColors = { ...currentColors, r, g, b };
    if (rgbSegment.bri !== undefined) rgbBrightness = rgbSegment.bri;
  }
  if (whiteSegment?.col?.[0]) {
    const [wr = 0, wg = 0, wb = 0] = whiteSegment.col[0];
    currentColors = { ...currentColors, wr, wg, wb };
    if (whiteSegment.bri !== undefined) whiteBrightness = whiteSegment.bri;
  }
  const rgbOn = next.seg?.some(segment => Boolean(segment.on) && (segment.start || 0) % 2 === 0);
  const whiteOn = next.seg?.some(segment => Boolean(segment.on) && (segment.start || 0) % 2 === 1);
  fusionEnabled = Boolean(rgbOn && whiteOn);
  if (whiteOn && !rgbOn) activeChannel = "white";
  if (rgbOn && !whiteOn) activeChannel = "rgb";
  return changed;
}

function refreshDiagnostics() {
  const values: Record<string, string> = {
    sync: syncTimeLabel(), signal: deviceInfo?.wifi?.signal !== undefined ? `${deviceInfo.wifi.signal}% · ${wifiQuality(deviceInfo.wifi.signal)}` : "—",
    rssi: deviceInfo?.wifi?.rssi !== undefined ? `${deviceInfo.wifi.rssi} dBm · canal ${deviceInfo.wifi.channel ?? "—"}` : "—", uptime: formatUptime(deviceInfo?.uptime),
    heap: formatMemory(deviceInfo?.freeheap), fps: deviceInfo?.leds?.fps !== undefined ? `${deviceInfo.leds.fps} fps` : "—",
  };
  Object.entries(values).forEach(([key, value]) => { const target = document.querySelector<HTMLElement>(`[data-diagnostic="${key}"]`); if (target) target.textContent = value; });
}

async function fetchDeviceInfo() {
  if (!baseUrl) return;
  try {
    const response = await fetchLocal(`${baseUrl}/json/info`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return;
    deviceInfo = await response.json() as WledInfo;
    refreshDiagnostics();
  } catch { /* state polling owns connection status */ }
}

function startInfoSync() {
  if (infoSyncTimer !== undefined) window.clearInterval(infoSyncTimer);
  infoSyncTimer = window.setInterval(() => { void fetchDeviceInfo(); }, 15000);
}

async function pollState() {
  if (!baseUrl || stateSyncInFlight || Date.now() < stateSyncPausedUntil || document.hidden) return;
  stateSyncInFlight = true;
  try {
    const response = await fetchLocal(`${baseUrl}/json/state`, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error("sync failed");
    const changed = applyRemoteState(await response.json() as WledState);
    stateSyncFailures = 0;
    const recovered = connectionState !== "connected";
    connectionState = "connected";
    if (changed || recovered) render();
    else refreshDiagnostics();
  } catch {
    stateSyncFailures += 1;
    if (stateSyncFailures >= 3 && connectionState !== "error") { connectionState = "error"; render(); }
  } finally { stateSyncInFlight = false; }
}

function startStateSync() {
  if (stateSyncTimer !== undefined) window.clearInterval(stateSyncTimer);
  stateSyncTimer = window.setInterval(() => { void pollState(); }, 2500);
}

document.addEventListener("visibilitychange", () => { if (!document.hidden && connectionState !== "idle") void pollState(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && mapFocusMode) { mapFocusMode = false; render(); } });

function furnitureShelves() {
  return [
    { id: "bottom" as ShelfId, name: "Étagère basse", start: 0, end: furnitureLayout.bottomEnd, direction: "droite → gauche" },
    { id: "middle" as ShelfId, name: "Petite étagère", start: furnitureLayout.bottomEnd, end: furnitureLayout.middleEnd, direction: "gauche → droite" },
    { id: "top" as ShelfId, name: "Étagère haute", start: furnitureLayout.middleEnd, end: TOTAL_ZONES, direction: "droite → gauche" },
  ];
}

function shelfSelectionClass(start: number, end: number) {
  const selected = zoneState.slice(start, end).filter(Boolean).length;
  return selected === end - start ? "selected" : selected ? "partial" : "";
}

function furnitureLedMarkers() {
  const paths = [
    { start: 0, count: 42, from: [89, 68], to: [11, 68] },
    { start: 42, count: 13, from: [11, 38.2], to: [37.5, 38.2] },
    { start: 55, count: 42, from: [89, 12.8], to: [11, 12.8] },
  ];
  return paths.flatMap(path => Array.from({ length: path.count }, (_, offset) => {
    const progress = path.count === 1 ? 0 : offset / (path.count - 1);
    return {
      zone: path.start + offset,
      x: path.from[0] + (path.to[0] - path.from[0]) * progress,
      y: path.from[1] + (path.to[1] - path.from[1]) * progress,
    };
  }));
}

function renderFurnitureSelector() {
  const shelves = furnitureShelves();
  const markers = furnitureLedMarkers();
  return `<div class="furniture-selector">
    <div class="map-view-controls"><button id="map-zoom-out" aria-label="Réduire le plan" ${mapZoom <= 1 ? "disabled" : ""}>−</button><span>${Math.round(mapZoom * 100)}%</span><button id="map-zoom-in" aria-label="Agrandir le plan" ${mapZoom >= 3 ? "disabled" : ""}>+</button><button id="map-focus-toggle" class="secondary-button">${mapFocusMode ? "Fermer le plein écran" : "Plein écran"}</button></div>
    <div class="furniture-map-scroll" aria-label="Plan zoomable du meuble">
    <div class="furniture-map" style="width:${mapZoom * 100}%">
      <img src="${furniturePhoto}" alt="Vue frontale plane du meuble avec les trois étagères éclairées" />
      ${markers.map(marker => `<button class="led-marker ${zoneState[marker.zone] ? "active" : ""}" style="left:${marker.x.toFixed(3)}%;top:${marker.y.toFixed(3)}%" data-zone="${marker.zone}" aria-label="Zone ${marker.zone + 1}" title="Zone ${marker.zone + 1}"><span>${marker.zone + 1}</span></button>`).join("")}
      <span class="shelf-map-label map-bottom">1 → 42</span><span class="shelf-map-label map-middle">43 → 55</span><span class="shelf-map-label map-top">56 → 97</span>
      <span class="path-start">1 · DÉPART</span><span class="path-end">97 · FIN</span>
    </div></div>
    <div class="shelf-buttons">${shelves.map(shelf => {
      const selected = zoneState.slice(shelf.start, shelf.end).filter(Boolean).length;
      return `<button class="shelf-button ${shelfSelectionClass(shelf.start, shelf.end)}" data-shelf="${shelf.id}"><span><strong>${shelf.name}</strong><small>${shelf.direction} · zones ${shelf.start + 1}–${shelf.end}</small></span><b>${selected}/${shelf.end - shelf.start}</b></button>`;
    }).join("")}</div>
  </div>`;
}

function renderQuickNavigation() {
  return `<nav class="quick-navigation" aria-label="Navigation dans LED2"><button data-scroll-target="zones-panel">Plan</button><button data-scroll-target="ambience-panel">Ambiances</button><button data-scroll-target="white-panel">Blanc</button><button data-scroll-target="dashboard">Couleurs</button><button data-scroll-target="scenes-panel">Scènes</button><button data-scroll-target="diagnostics-panel">Santé</button></nav>`;
}

function updateMapZoom(nextValue: number) {
  const next = clampMapZoom(nextValue);
  const mapScroll = document.querySelector<HTMLElement>(".furniture-map-scroll");
  if (mapScroll) mapScrollLeft = mapScroll.scrollLeft * (next / mapZoom);
  mapZoom = next;
  localStorage.setItem("led2.mapZoom", String(mapZoom));
  render();
}

function bindSectionNavigation() {
  sectionObserver?.disconnect();
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-scroll-target]")];
  const targets = buttons.flatMap(button => { const target = document.querySelector<HTMLElement>(`.${button.dataset.scrollTarget}`); return target ? [target] : []; });
  buttons.forEach(button => button.addEventListener("click", () => {
    document.querySelector<HTMLElement>(`.${button.dataset.scrollTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  sectionObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    buttons.forEach(button => button.classList.toggle("active", visible.target.classList.contains(button.dataset.scrollTarget || "")));
  }, { rootMargin: "-115px 0px -55% 0px", threshold: [0, .15, .4] });
  targets.forEach(target => sectionObserver?.observe(target));
}

function renderShelfAmbiences() {
  return `<section id="ambience-panel" class="ambience-panel"><div class="section-title"><div><p class="eyebrow">AMBIANCES PAR ÉTAGÈRE</p><h2>Trois zones, trois atmosphères</h2></div><button id="apply-ambiences" class="secondary-button" ${connectionState !== "connected" ? "disabled" : ""}>Appliquer</button></div>
    ${ambienceMessage ? `<p class="group-message">${escapeHtml(ambienceMessage)}</p>` : ""}
    <div class="ambience-grid">${furnitureShelves().map(shelf => {
      const value = shelfAmbiences[shelf.id];
      return `<article class="ambience-card" data-ambience-card="${shelf.id}"><div><strong>${shelf.name}</strong><small>Zones ${shelf.start + 1}–${shelf.end}</small></div>
        <label>Mode<select data-ambience-mode="${shelf.id}"><option value="off" ${value.mode === "off" ? "selected" : ""}>Éteint</option><option value="rgb" ${value.mode === "rgb" ? "selected" : ""}>Couleur RGB</option><option value="white" ${value.mode === "white" ? "selected" : ""}>Blanc</option></select></label>
        <label class="ambience-color ${value.mode === "rgb" ? "" : "is-hidden"}">Couleur<input type="color" data-ambience-color="${shelf.id}" value="${escapeHtml(value.color)}" /></label>
        <label class="ambience-temperature ${value.mode === "white" ? "" : "is-hidden"}">Température <span>${value.temperature}%</span><input type="range" min="0" max="100" data-ambience-temperature="${shelf.id}" value="${value.temperature}" /></label>
        <label>Intensité <span>${Math.round(value.brightness / 2.55)}%</span><input type="range" min="0" max="255" data-ambience-brightness="${shelf.id}" value="${value.brightness}" /></label>
      </article>`;
    }).join("")}</div>
    <div class="quick-scenes"><button data-quick-scene="tv" ${connectionState !== "connected" ? "disabled" : ""}>📺 TV</button><button data-quick-scene="evening" ${connectionState !== "connected" ? "disabled" : ""}>🌆 Soirée</button><button data-quick-scene="night" ${connectionState !== "connected" ? "disabled" : ""}>🌙 Veilleuse</button><button data-quick-scene="white" ${connectionState !== "connected" ? "disabled" : ""}>☀ Blanc total</button><button data-quick-scene="colors" ${connectionState !== "connected" ? "disabled" : ""}>🌈 Couleurs</button></div>
  </section>`;
}

function renderBackupPanel() {
  return `<section id="backup-panel" class="backup-panel"><div class="section-title"><div><p class="eyebrow">SAUVEGARDE COMPLÈTE</p><h2>Protéger la configuration</h2></div></div><p class="hint">Exporte la configuration WLED, les presets et les réglages LED2 dans un seul fichier.</p>${backupMessage ? `<p class="group-message">${escapeHtml(backupMessage)}</p>` : ""}<div class="backup-actions"><button id="backup-export" class="secondary-button" ${connectionState !== "connected" ? "disabled" : ""}>Télécharger la sauvegarde</button><label class="secondary-button file-button">Choisir une sauvegarde<input id="backup-file" type="file" accept="application/json,.json" /></label>${pendingRestore ? `<button id="backup-restore" class="primary-confirm">Restaurer maintenant</button><button id="backup-cancel" class="secondary-button">Annuler</button>` : ""}</div></section>`;
}

function renderDiagnostics() {
  if (!deviceInfo) return "";
  const signal = deviceInfo.wifi?.signal ?? 0;
  return `<section id="diagnostics-panel" class="diagnostics-panel"><div class="section-title"><div><p class="eyebrow">SANTÉ DU CONTRÔLEUR</p><h2>Diagnostic WLED</h2></div><button id="refresh-diagnostics" class="secondary-button">Actualiser</button></div>
    <div class="diagnostic-hero"><div><span class="health-dot ${signal >= 50 ? "healthy" : signal >= 25 ? "warning" : "critical"}"></span><strong>${escapeHtml(deviceInfo.name || deviceName)}</strong><small>${escapeHtml(deviceInfo.ip || hostFrom(baseUrl))}</small></div><b>WLED ${escapeHtml(deviceInfo.ver || "—")}</b></div>
    <div class="diagnostic-grid">
      <div><span>Synchronisé</span><strong data-diagnostic="sync">${syncTimeLabel()}</strong></div>
      <div><span>Signal Wi‑Fi</span><strong data-diagnostic="signal">${signal}% · ${wifiQuality(signal)}</strong><small data-diagnostic="rssi">${deviceInfo.wifi?.rssi ?? "—"} dBm · canal ${deviceInfo.wifi?.channel ?? "—"}</small></div>
      <div><span>Matériel</span><strong>${escapeHtml((deviceInfo.arch || deviceInfo.release || "ESP32").toUpperCase())}</strong><small>${deviceInfo.clock || "—"} MHz</small></div>
      <div><span>Ruban</span><strong>${deviceInfo.leds?.count ?? TOTAL_ZONES * 2} LED</strong><small data-diagnostic="fps">${deviceInfo.leds?.fps ?? "—"} fps · ${deviceInfo.leds?.pwr ?? "—"} mA</small></div>
      <div><span>Mémoire libre</span><strong data-diagnostic="heap">${formatMemory(deviceInfo.freeheap)}</strong><small>${deviceInfo.fs ? `${deviceInfo.fs.u ?? 0}/${deviceInfo.fs.t ?? 0} Ko fichiers` : "Stockage —"}</small></div>
      <div><span>Fonctionnement</span><strong data-diagnostic="uptime">${formatUptime(deviceInfo.uptime)}</strong><small>${escapeHtml(deviceInfo.core || "Cœur WLED")}</small></div>
    </div>
  </section>`;
}

function render() {
  const existingMapScroll = document.querySelector<HTMLElement>(".furniture-map-scroll");
  if (existingMapScroll) mapScrollLeft = existingMapScroll.scrollLeft;
  const statusLabel = connectionState === "connected" ? "Connecté · synchronisé" : connectionState === "connecting" ? "Connexion…" : connectionState === "error" ? "Connexion interrompue" : "Prêt à connecter";
  const statusClass = connectionState === "connected" ? "online" : connectionState === "error" ? "error" : "";
  root.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">✦</span><div><strong>WLED</strong><small>V34 MATRIX · LED2 PWA</small></div></div>
        <div class="connection-pill ${statusClass}"><span class="status-dot"></span>${statusLabel}</div>
      </header>
      ${renderQuickNavigation()}
      <section class="install-banner"><div><strong>LED2 PWA</strong><span>${installMessage || (deferredInstallPrompt ? "Installation disponible sur cet appareil" : "Installer comme une application")}</span></div><button id="install-app" class="secondary-button">Installer</button></section>
      <section class="master-brightness"><div><span>MASTER LUMINOSITÉ</span><strong data-brightness-value>${Math.round(state.bri / 2.55)}%</strong></div><input id="master-brightness" type="range" min="0" max="255" value="${state.bri}" ${connectionState !== "connected" ? "disabled" : ""} /></section>
      <section class="hero">
        <div><p class="eyebrow">NOUVELLE GÉNÉRATION</p><h1>Donnez vie à<br /><em>vos lumières.</em></h1><p class="intro">Une interface claire et réactive pour piloter vos appareils WLED, où que vous soyez.</p></div>
        <div class="glow-orb" aria-hidden="true"></div>
      </section>
      <section class="connect-card">
        <div class="card-heading"><div><p class="eyebrow">PREMIÈRE ÉTAPE</p><h2>Connecter un appareil</h2></div><span class="step">01</span></div>
        <form id="connect-form" class="connect-form"><label for="device-url">Adresse de l'appareil</label><div class="input-row"><input id="device-url" type="text" placeholder="http://wled.local ou 192.168.1.42" value="${escapeHtml(baseUrl)}" /><button type="submit">${connectionState === "connecting" ? "Connexion…" : "Connecter"}<span>→</span></button></div><p class="hint">L'adresse locale de votre appareil WLED</p></form>
        ${connectionState === "error" ? '<div class="error-message"><span>Impossible de joindre cet appareil. Vérifiez son adresse et votre réseau.</span><button id="retry-connection">Réessayer</button></div>' : ""}
      </section>
      <div class="device-tools"><div><p class="eyebrow">DÉCOUVERTE LOCALE</p><h3>Appareils sur le réseau</h3><p class="hint">LED2 tente d’identifier la forme de votre réseau avant de scanner les adresses.</p></div><div class="scan-row"><input id="network-prefix" type="text" value="${escapeHtml(detectedPrefixes[0] || "192.168.1")}" aria-label="Préfixe réseau" /><button id="detect-button" class="secondary-button">Détecter</button><button id="scan-button" class="secondary-button">${scanning ? "Scan en cours…" : "Scanner"}</button></div>${scanMessage ? `<p class="hint">${escapeHtml(scanMessage)}</p>` : ""}${scanResults.length ? `<div class="device-list">${scanResults.map(device => `<button class="device-item" data-device-url="${escapeHtml(device.url)}"><span class="device-icon">✦</span><span><strong>${escapeHtml(device.name)}</strong><small>${escapeHtml(device.url)}</small></span><span>→</span></button>`).join("")}</div>` : ""}</div>
      ${savedDevices.length ? `<div class="saved-devices"><p class="eyebrow">MES APPAREILS</p>${savedDevices.map(device => `<button class="saved-device" data-saved-url="${escapeHtml(device.url)}"><span>${escapeHtml(device.name)}</span><small>${escapeHtml(device.url)}</small></button>`).join("")}</div>` : ""}
      ${renderDiagnostics()}
      <section class="wled-presets"><div class="section-title"><div><p class="eyebrow">PRESETS WLED</p><h2>Mémoires de l’appareil</h2></div><button id="preset-record" class="secondary-button">${presetRecordMode ? "Annuler" : "Enregistrer"}</button></div>${presetMessage ? `<p class="group-message">${presetMessage}</p>` : ""}<div class="preset-grid">${[1,2,3,4].map(id => `<button class="preset-slot" data-preset="${id}" ${connectionState !== "connected" ? "disabled" : ""}>Mém. ${id}</button>`).join("")}</div></section>
      <section class="zones-panel"><div class="section-title"><div><p class="eyebrow">PLAN DU MEUBLE · ${isMatrixMode ? "MATRIX HD" : "SEGMENTS"}</p><h2>Choisir les LED sur la photo</h2></div><button id="zones-toggle" class="secondary-button">${zonesOpen ? "Masquer les numéros" : "LED par LED"}</button></div>${renderFurnitureSelector()}<div class="map-actions"><div><button id="zones-all">Tout</button><button id="zones-none">Rien</button><button id="zones-pattern">1 sur 2</button><button id="zones-range" class="${rangeMode ? "active" : ""}">${rangeAnchor === null ? "Plage" : `De ${rangeAnchor + 1} à…`}</button><button id="zones-undo" ${selectionUndo.length ? "" : "disabled"}>↶</button><button id="zones-redo" ${selectionRedo.length ? "" : "disabled"}>↷</button></div><label><input id="live-zone-apply" type="checkbox" ${liveZoneApply ? "checked" : ""} ${connectionState !== "connected" ? "disabled" : ""} /> Application directe</label><span>${zoneState.filter(Boolean).length} sélectionnées</span></div><p class="selection-help">Touchez une LED, faites glisser sur la photo, ou utilisez « Plage » pour sélectionner deux extrémités.</p>${layoutMessage ? `<p class="layout-message">${layoutMessage}</p>` : ""}${zonesOpen ? `<div class="layout-calibration"><p>Limites mesurées des étagères — modifiables si le ruban est déplacé.</p><label>Fin étagère basse<input id="bottom-end" type="number" min="1" max="95" value="${furnitureLayout.bottomEnd}" /></label><label>Fin petite étagère<input id="middle-end" type="number" min="2" max="96" value="${furnitureLayout.middleEnd}" /></label><button id="save-layout">Mémoriser</button></div><div class="zone-grid">${zoneState.map((active, index) => `<button class="zone-cell ${active ? "active" : ""}" data-zone="${index}">${index + 1}</button>`).join("")}</div>` : ""}<button id="zones-apply" class="primary-wide" ${connectionState !== "connected" ? "disabled" : ""}>Allumer la sélection (${zoneState.filter(Boolean).length})</button></section>
      ${renderShelfAmbiences()}
      <section class="white-panel ${activeChannel === "white" || fusionEnabled ? "active-mode" : "inactive-mode"}"><div class="section-title"><div><p class="eyebrow">☀ CANAL BLANC</p><h2>Blanc et température</h2></div><label class="fusion-toggle"><input id="fusion-toggle" type="checkbox" ${fusionEnabled ? "checked" : ""} ${connectionState !== "connected" ? "disabled" : ""} /> Fusion</label></div><div class="temperature-labels"><span>Chaud</span><span>Froid</span></div><div class="white-controls"><label>Température<input id="white-temperature" class="cct-range" type="range" min="0" max="100" value="${whiteTemperature}" ${connectionState !== "connected" ? "disabled" : ""} /></label><label>Intensité<input id="white-level" type="range" min="0" max="255" value="${whiteBrightness}" ${connectionState !== "connected" ? "disabled" : ""} /></label></div></section>
      <section class="dashboard ${connectionState !== "connected" ? "muted" : ""}">
        <div class="section-title"><div><p class="eyebrow">ESPACE DE CONTRÔLE</p><h2>${escapeHtml(deviceName)}</h2></div><span class="locked">${connectionState === "connected" ? "ACTIF" : "EN ATTENTE"}</span></div>
        <div class="controls"><article class="control-card power-card"><div><span class="control-label">ALIMENTATION</span><h3>${state.on ? "Allumées" : "Éteintes"}</h3></div><button class="power-toggle ${state.on ? "active" : ""}" id="power-toggle" aria-label="Basculer l'alimentation"><span></span></button></article><article class="control-card legacy-brightness"><span class="control-label">LUMINOSITÉ</span><div class="value-row"><h3 data-brightness-value>${Math.round((state.bri / 255) * 100)}%</h3><span>INTENSITÉ</span></div><input id="brightness" type="range" min="1" max="255" value="${state.bri}" ${connectionState !== "connected" ? "disabled" : ""} /></article><article class="control-card color-card ${activeChannel === "rgb" || fusionEnabled ? "active-mode" : "inactive-mode"}"><span class="control-label">◉ COULEUR RGB</span><div id="rgb-picker" class="rgb-picker" aria-label="Roue de couleur RGB"></div><label class="rgb-level">INTENSITÉ RGB<input id="rgb-level" type="range" min="0" max="255" value="${rgbBrightness}" ${connectionState !== "connected" ? "disabled" : ""} /></label></article></div>
      <div class="effect-panel"><span class="control-label">EFFET WLED ${isMatrixMode ? "· indisponible en Matrix" : ""}</span><input id="effect-search" class="effect-search" type="search" value="${escapeHtml(effectSearch)}" placeholder="Rechercher un effet" /><select id="effect" ${connectionState !== "connected" || isMatrixMode ? "disabled" : ""}>${effects.filter(effect => effect.label.toLowerCase().includes(effectSearch.toLowerCase())).map(effect => `<option value="${effect.id}" ${state.seg[0]?.fx === effect.id ? "selected" : ""}>${escapeHtml(effect.label)}</option>`).join("")}</select><label class="mini-control">COULEUR<input id="color-picker" type="color" value="${firstColor()}" ${connectionState !== "connected" ? "disabled" : ""} /></label><label class="mini-control">VITESSE<input id="effect-speed" type="range" min="0" max="255" value="${state.seg[0]?.sx ?? 128}" ${connectionState !== "connected" || isMatrixMode ? "disabled" : ""} /></label><label class="mini-control">INTENSITÉ<input id="effect-intensity" type="range" min="0" max="255" value="${state.seg[0]?.ix ?? 128}" ${connectionState !== "connected" || isMatrixMode ? "disabled" : ""} /></label></div>
      </section>
      <section class="scenes-panel"><div class="section-title"><div><p class="eyebrow">MES SCÈNES</p><h2>Presets lumineux</h2></div><button id="save-scene" class="secondary-button" ${connectionState !== "connected" ? "disabled" : ""}>+ Enregistrer</button></div>${groupMessage ? `<p class="group-message">${escapeHtml(groupMessage)}</p>` : ""}${scenes.length ? `<div class="scene-list">${scenes.map(scene => `<article class="scene-item"><button class="scene-apply" data-scene-id="${escapeHtml(scene.id)}"><span class="scene-swatch" style="background:${firstColorFrom(scene.state)}"></span><span><strong>${escapeHtml(scene.name)}</strong><small>${scene.state.on ? "Allumé" : "Éteint"} · ${Math.round(scene.state.bri / 255 * 100)}%</small></span></button><button class="scene-group" data-group-scene-id="${escapeHtml(scene.id)}" ${savedDevices.length < 2 ? "disabled" : ""} aria-label="Appliquer ${escapeHtml(scene.name)} à tous">Tous</button><button class="scene-delete" data-delete-scene="${escapeHtml(scene.id)}" aria-label="Supprimer ${escapeHtml(scene.name)}">×</button></article>`).join("")}</div>` : `<p class="hint">Aucune scène enregistrée pour le moment.</p>`}</section>
      ${renderBackupPanel()}
      <button id="master-power" class="master-power ${state.on ? "active" : ""}" aria-label="Alimentation générale">⏻</button>
    </main>`;

  document.querySelector<HTMLFormElement>("#connect-form")?.addEventListener("submit", connect);
  document.querySelector<HTMLButtonElement>("#retry-connection")?.addEventListener("click", () => void connect(new Event("submit") as SubmitEvent));
  document.querySelector<HTMLButtonElement>("#power-toggle")?.addEventListener("click", () => updateState({ on: !state.on }));
  document.querySelector<HTMLButtonElement>("#master-power")?.addEventListener("click", () => updateState({ on: !state.on }));
  document.querySelector<HTMLButtonElement>("#install-app")?.addEventListener("click", installApp);
  document.querySelector<HTMLInputElement>("#brightness")?.addEventListener("input", event => scheduleBrightnessUpdate(Number((event.target as HTMLInputElement).value)));
  document.querySelector<HTMLInputElement>("#master-brightness")?.addEventListener("input", event => scheduleBrightnessUpdate(Number((event.target as HTMLInputElement).value)));
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
  document.querySelector<HTMLButtonElement>("#map-zoom-out")?.addEventListener("click", () => updateMapZoom(mapZoom - .5));
  document.querySelector<HTMLButtonElement>("#map-zoom-in")?.addEventListener("click", () => updateMapZoom(mapZoom + .5));
  document.querySelector<HTMLButtonElement>("#map-focus-toggle")?.addEventListener("click", () => { mapFocusMode = !mapFocusMode; render(); });
  document.querySelectorAll<HTMLButtonElement>("[data-shelf]").forEach(button => button.addEventListener("click", () => toggleShelf(button.dataset.shelf as ShelfId)));
  document.querySelectorAll<HTMLButtonElement>(".zone-cell").forEach(button => button.addEventListener("click", () => selectZone(Number(button.dataset.zone))));
  bindFurnitureGestures();
  document.querySelector<HTMLButtonElement>("#zones-all")?.addEventListener("click", () => replaceZoneSelection(zoneState.map(() => true)));
  document.querySelector<HTMLButtonElement>("#zones-none")?.addEventListener("click", () => replaceZoneSelection(zoneState.map(() => false)));
  document.querySelector<HTMLButtonElement>("#zones-pattern")?.addEventListener("click", () => replaceZoneSelection(zoneState.map((_, index) => index % 2 === 0)));
  document.querySelector<HTMLButtonElement>("#zones-range")?.addEventListener("click", () => { rangeMode = !rangeMode; rangeAnchor = null; render(); });
  document.querySelector<HTMLButtonElement>("#zones-undo")?.addEventListener("click", undoZoneSelection);
  document.querySelector<HTMLButtonElement>("#zones-redo")?.addEventListener("click", redoZoneSelection);
  document.querySelector<HTMLInputElement>("#live-zone-apply")?.addEventListener("change", event => { liveZoneApply = (event.target as HTMLInputElement).checked; localStorage.setItem("led2.liveZoneApply", String(liveZoneApply)); if (liveZoneApply) scheduleZoneApply(); render(); });
  document.querySelector<HTMLButtonElement>("#save-layout")?.addEventListener("click", saveFurnitureLayout);
  document.querySelector<HTMLButtonElement>("#zones-apply")?.addEventListener("click", applyZones);
  document.querySelector<HTMLButtonElement>("#preset-record")?.addEventListener("click", () => { presetRecordMode = !presetRecordMode; presetMessage = presetRecordMode ? "Choisissez une mémoire pour l’enregistrer." : ""; render(); });
  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach(button => button.addEventListener("click", () => useWledPreset(Number(button.dataset.preset))));
  document.querySelector<HTMLInputElement>("#white-level")?.addEventListener("input", event => { whiteBrightness = Number((event.target as HTMLInputElement).value); scheduleWhiteUpdate(); });
  document.querySelector<HTMLInputElement>("#white-temperature")?.addEventListener("input", event => { whiteTemperature = Number((event.target as HTMLInputElement).value); scheduleWhiteUpdate(); });
  document.querySelector<HTMLInputElement>("#rgb-level")?.addEventListener("input", event => scheduleRgbBrightnessUpdate(Number((event.target as HTMLInputElement).value)));
  document.querySelector<HTMLInputElement>("#fusion-toggle")?.addEventListener("change", event => { fusionEnabled = (event.target as HTMLInputElement).checked; activateChannel(activeChannel); });
  bindAmbienceControls();
  document.querySelector<HTMLButtonElement>("#backup-export")?.addEventListener("click", exportBackup);
  document.querySelector<HTMLInputElement>("#backup-file")?.addEventListener("change", importBackup);
  document.querySelector<HTMLButtonElement>("#backup-restore")?.addEventListener("click", () => void restoreBackup());
  document.querySelector<HTMLButtonElement>("#backup-cancel")?.addEventListener("click", () => { pendingRestore = null; backupMessage = "Restauration annulée."; render(); });
  document.querySelector<HTMLButtonElement>("#refresh-diagnostics")?.addEventListener("click", () => void fetchDeviceInfo());
  initializeColorWheel();
  refreshDiagnostics();
  bindSectionNavigation();
  const zonesPanel = document.querySelector<HTMLElement>(".zones-panel");
  zonesPanel?.classList.toggle("map-focus", mapFocusMode);
  document.body.classList.toggle("map-focus-open", mapFocusMode);
  requestAnimationFrame(() => { const mapScroll = document.querySelector<HTMLElement>(".furniture-map-scroll"); if (mapScroll) mapScroll.scrollLeft = mapScrollLeft; });
}

async function installApp() {
  if (!deferredInstallPrompt) { installMessage = "Utilisez le menu du navigateur puis « Installer l’application » ou « Ajouter à l’écran d’accueil »."; render(); return; }
  await deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  installMessage = choice.outcome === "accepted" ? "Installation lancée." : "Installation annulée.";
  deferredInstallPrompt = null;
  render();
}

function firstColorFrom(sceneState: WledState) { const color = sceneState.seg[0]?.col?.[0] || [255, 98, 50]; return `rgb(${color.slice(0, 3).map(value => Math.round(Math.max(0, Math.min(255, Number(value) || 0)))).join(",")})`; }
function saveCurrentScene() { const name = window.prompt("Nom de la scène", `Scène ${scenes.length + 1}`)?.trim(); if (!name) return; scenes = [{ id: crypto.randomUUID(), name, state: structuredClone(state) }, ...scenes].slice(0, 20); saveScenes(); render(); }
function applyScene(id: string) { const scene = scenes.find(item => item.id === id); if (!scene) return; state = structuredClone(scene.state); render(); updateState(state); }
function deleteScene(id: string) { scenes = scenes.filter(scene => scene.id !== id); saveScenes(); render(); }
async function applySceneToAll(id: string) { const scene = scenes.find(item => item.id === id); if (!scene || savedDevices.length < 2) return; groupMessage = "Application de la scène sur les appareils…"; render(); const results = await Promise.allSettled(savedDevices.map(device => fetchLocal(`${device.url}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(scene.state), signal: AbortSignal.timeout(5000) }))); const success = results.filter(result => result.status === "fulfilled" && result.value.ok).length; groupMessage = `${success} / ${savedDevices.length} appareil(s) mis à jour.`; render(); }
async function sendWledState(payload: unknown) {
  if (connectionState !== "connected") return false;
  stateSyncPausedUntil = Date.now() + 900;
  const response = await fetchLocal(`${baseUrl}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`WLED state rejected: ${response.status}`);
  try {
    const result = await response.json() as Partial<WledState>;
    if (typeof result.on === "boolean" && Array.isArray(result.seg)) applyRemoteState(result as WledState);
  } catch { /* some WLED builds return an empty success response */ }
  return true;
}
function scheduleBrightnessUpdate(value: number) {
  const next = clampByte(value);
  state = { ...state, bri: next };
  document.querySelectorAll<HTMLInputElement>("#brightness, #master-brightness").forEach(input => { input.value = String(next); });
  document.querySelectorAll<HTMLElement>("[data-brightness-value]").forEach(label => { label.textContent = `${Math.round(next / 2.55)}%`; });
  if (brightnessUpdateTimer !== undefined) window.clearTimeout(brightnessUpdateTimer);
  brightnessUpdateTimer = window.setTimeout(async () => {
    brightnessUpdateTimer = undefined;
    try { await sendWledState({ bri: state.bri }); }
    catch { connectionState = "error"; render(); }
  }, 120);
}
function rememberZoneSelection() {
  selectionUndo.push([...zoneState]);
  if (selectionUndo.length > 30) selectionUndo.shift();
  selectionRedo = [];
}
function replaceZoneSelection(next: boolean[]) {
  rememberZoneSelection();
  zoneState = [...next];
  zoneSelectionChanged();
}
function selectZone(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= TOTAL_ZONES) return;
  if (rangeMode) {
    if (rangeAnchor === null) { rangeAnchor = index; layoutMessage = `Début de plage : LED ${index + 1}. Touchez la dernière LED.`; render(); return; }
    rememberZoneSelection();
    const first = Math.min(rangeAnchor, index);
    const last = Math.max(rangeAnchor, index);
    const shouldSelect = !zoneState.slice(first, last + 1).every(Boolean);
    zoneState = zoneState.map((active, zone) => zone >= first && zone <= last ? shouldSelect : active);
    layoutMessage = `Plage ${first + 1}–${last + 1} ${shouldSelect ? "sélectionnée" : "désélectionnée"}.`;
    rangeAnchor = null;
    rangeMode = false;
    zoneSelectionChanged();
    return;
  }
  rememberZoneSelection();
  zoneState[index] = !zoneState[index];
  zoneSelectionChanged();
}
function undoZoneSelection() {
  const previous = selectionUndo.pop();
  if (!previous) return;
  selectionRedo.push([...zoneState]);
  zoneState = previous;
  zoneSelectionChanged();
}
function redoZoneSelection() {
  const next = selectionRedo.pop();
  if (!next) return;
  selectionUndo.push([...zoneState]);
  zoneState = next;
  zoneSelectionChanged();
}
function bindFurnitureGestures() {
  const map = document.querySelector<HTMLElement>(".furniture-map");
  if (!map) return;
  const zoneAt = (clientX: number, clientY: number) => {
    let nearest = -1;
    let distance = Number.POSITIVE_INFINITY;
    map.querySelectorAll<HTMLElement>(".led-marker").forEach(marker => {
      const rect = marker.getBoundingClientRect();
      const nextDistance = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
      if (nextDistance < distance) { distance = nextDistance; nearest = Number(marker.dataset.zone); }
    });
    return distance < 32 ? nearest : -1;
  };
  const paint = (index: number) => {
    if (index < 0 || zoneState[index] === dragValue) return;
    zoneState[index] = dragValue;
    map.querySelector<HTMLElement>(`.led-marker[data-zone="${index}"]`)?.classList.toggle("active", dragValue);
  };
  map.addEventListener("pointerdown", event => {
    const index = zoneAt(event.clientX, event.clientY);
    if (index < 0) return;
    event.preventDefault();
    if (rangeMode) { selectZone(index); return; }
    rememberZoneSelection();
    dragActive = true;
    dragValue = !zoneState[index];
    paint(index);
    map.setPointerCapture(event.pointerId);
  });
  map.addEventListener("pointermove", event => { if (dragActive) paint(zoneAt(event.clientX, event.clientY)); });
  const finish = () => { if (!dragActive) return; dragActive = false; zoneSelectionChanged(); };
  map.addEventListener("pointerup", finish);
  map.addEventListener("pointercancel", finish);
  map.querySelectorAll<HTMLButtonElement>(".led-marker").forEach(button => button.addEventListener("click", event => { if (event.detail === 0) selectZone(Number(button.dataset.zone)); }));
}
function toggleShelf(id: ShelfId) {
  const shelf = furnitureShelves().find(item => item.id === id);
  if (!shelf) return;
  const shouldSelect = !zoneState.slice(shelf.start, shelf.end).every(Boolean);
  replaceZoneSelection(zoneState.map((active, index) => index >= shelf.start && index < shelf.end ? shouldSelect : active));
}
function zoneSelectionChanged() { render(); if (liveZoneApply) scheduleZoneApply(); }
function scheduleZoneApply() {
  if (connectionState !== "connected") return;
  if (zoneApplyTimer !== undefined) window.clearTimeout(zoneApplyTimer);
  zoneApplyTimer = window.setTimeout(() => { zoneApplyTimer = undefined; void applyZones(); }, 300);
}
function saveFurnitureLayout() {
  const bottomEnd = Number(document.querySelector<HTMLInputElement>("#bottom-end")?.value);
  const middleEnd = Number(document.querySelector<HTMLInputElement>("#middle-end")?.value);
  if (!Number.isInteger(bottomEnd) || !Number.isInteger(middleEnd) || bottomEnd < 1 || bottomEnd >= middleEnd || middleEnd >= TOTAL_ZONES) {
    layoutMessage = "Les limites doivent être croissantes et comprises entre les zones 1 et 96.";
    render();
    return;
  }
  furnitureLayout = { bottomEnd, middleEnd };
  localStorage.setItem("led2.furnitureLayout", JSON.stringify(furnitureLayout));
  layoutMessage = `Plan mémorisé : basse 1–${bottomEnd}, petite ${bottomEnd + 1}–${middleEnd}, haute ${middleEnd + 1}–${TOTAL_ZONES}.`;
  render();
}
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
    if (groups.length === 0) {
      isMatrixMode = true;
      const reset: Array<Record<string, unknown>> = [{ id: 0, start: 0, stop: TOTAL_ZONES * 2, grp: 1, spc: 0, of: 0, on: true, fx: 0, col: [[0, 0, 0]] }];
      for (let id = 1; id < 30; id++) reset.push({ id, stop: 0 });
      await sendWledState({ seg: reset });
      activeSegmentCount = 1;
    } else if (groups.length <= 15) {
      isMatrixMode = false;
      const segments: Array<Record<string, unknown>> = [];
      let id = 0;
      for (const group of groups) {
        segments.push({ id: id++, start: group.s * 2, stop: group.e * 2, grp: 1, spc: 1, of: 0, on: fusionEnabled || activeChannel === "rgb", bri: rgbBrightness, fx: 0, n: `Z${group.s}-RGB`, col: [[currentColors.r, currentColors.g, currentColors.b]] });
        segments.push({ id: id++, start: group.s * 2 + 1, stop: group.e * 2 + 1, grp: 1, spc: 1, of: 0, on: fusionEnabled || activeChannel === "white", bri: whiteBrightness, fx: 0, n: `Z${group.s}-W`, col: [[currentColors.wr, currentColors.wg, currentColors.wb]] });
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
      const rgb = rgbToHex(currentColors.r * rgbBrightness / 255, currentColors.g * rgbBrightness / 255, currentColors.b * rgbBrightness / 255);
      const white = rgbToHex(currentColors.wr * whiteBrightness / 255, currentColors.wg * whiteBrightness / 255, currentColors.wb * whiteBrightness / 255);
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
    layoutMessage = `${zoneState.filter(Boolean).length} zone(s) appliquée(s) en mode ${isMatrixMode ? "Matrix HD" : "Segments"}.`;
  } catch { connectionState = "error"; layoutMessage = "Échec de l’application des zones. Vérifiez la connexion WLED."; }
  render();
}
function colorFromTemperature(temperature: number) {
  const value = Math.max(0, Math.min(100, temperature));
  return value <= 50
    ? [Math.floor((value / 50) * 255), 255, 0]
    : [255, Math.floor(255 - ((value - 50) / 50) * 255), 0];
}
function hexToRgb(hex: string) { return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)); }
async function applyShelfAmbiences() {
  if (connectionState !== "connected") return;
  ambienceMessage = "Application des trois étagères…";
  render();
  const segments: Array<Record<string, unknown>> = [];
  furnitureShelves().forEach((shelf, shelfIndex) => {
    const ambience = shelfAmbiences[shelf.id];
    const rgb = hexToRgb(ambience.color);
    const white = colorFromTemperature(ambience.temperature);
    segments.push({ id: shelfIndex * 2, start: shelf.start * 2, stop: shelf.end * 2, grp: 1, spc: 1, of: 0, on: ambience.mode === "rgb", bri: ambience.brightness, fx: ambience.mode === "rgb" ? ambience.effect : 0, sx: 128, ix: 128, n: `${shelf.name} RGB`, col: [rgb] });
    segments.push({ id: shelfIndex * 2 + 1, start: shelf.start * 2 + 1, stop: shelf.end * 2 + 1, grp: 1, spc: 1, of: 0, on: ambience.mode === "white", bri: ambience.brightness, fx: 0, n: `${shelf.name} blanc`, col: [white] });
  });
  for (let id = 6; id < 30; id++) segments.push({ id, stop: 0 });
  try {
    await sendWledState({ on: true, seg: segments });
    zoneState = zoneState.map(() => true);
    activeSegmentCount = 6;
    isMatrixMode = false;
    ambienceMessage = "Ambiances appliquées aux trois étagères.";
  } catch {
    connectionState = "error";
    ambienceMessage = "WLED n’a pas accepté les ambiances.";
  }
  render();
}
function setQuickScene(scene: string) {
  const solid = 0;
  const dynamic = effects.find(effect => /rainbow|colorloop|flow/i.test(effect.label))?.id ?? 9;
  if (scene === "tv") shelfAmbiences = {
    bottom: { mode: "white", color: "#ff7038", temperature: 30, brightness: 55, effect: solid },
    middle: { mode: "off", color: "#ff7038", temperature: 30, brightness: 0, effect: solid },
    top: { mode: "white", color: "#ff7038", temperature: 34, brightness: 42, effect: solid },
  };
  if (scene === "evening") shelfAmbiences = {
    bottom: { mode: "white", color: "#ff8a45", temperature: 18, brightness: 95, effect: solid },
    middle: { mode: "rgb", color: "#ff5a24", temperature: 20, brightness: 62, effect: solid },
    top: { mode: "white", color: "#ff8a45", temperature: 24, brightness: 82, effect: solid },
  };
  if (scene === "night") shelfAmbiences = {
    bottom: { mode: "rgb", color: "#ff2408", temperature: 10, brightness: 18, effect: solid },
    middle: { mode: "off", color: "#ff2408", temperature: 10, brightness: 0, effect: solid },
    top: { mode: "off", color: "#ff2408", temperature: 10, brightness: 0, effect: solid },
  };
  if (scene === "white") shelfAmbiences = {
    bottom: { mode: "white", color: "#ffffff", temperature: 45, brightness: 180, effect: solid },
    middle: { mode: "white", color: "#ffffff", temperature: 45, brightness: 180, effect: solid },
    top: { mode: "white", color: "#ffffff", temperature: 45, brightness: 180, effect: solid },
  };
  if (scene === "colors") shelfAmbiences = {
    bottom: { mode: "rgb", color: "#ff1744", temperature: 50, brightness: 145, effect: dynamic },
    middle: { mode: "rgb", color: "#7c4dff", temperature: 50, brightness: 125, effect: dynamic },
    top: { mode: "rgb", color: "#00b0ff", temperature: 50, brightness: 145, effect: dynamic },
  };
  saveShelfAmbiences();
  void applyShelfAmbiences();
}
function bindAmbienceControls() {
  document.querySelector<HTMLButtonElement>("#apply-ambiences")?.addEventListener("click", () => void applyShelfAmbiences());
  document.querySelectorAll<HTMLSelectElement>("[data-ambience-mode]").forEach(input => input.addEventListener("change", () => {
    const id = input.dataset.ambienceMode as ShelfId;
    shelfAmbiences[id].mode = input.value as ShelfMode;
    saveShelfAmbiences(); render();
  }));
  document.querySelectorAll<HTMLInputElement>("[data-ambience-color]").forEach(input => input.addEventListener("input", () => { shelfAmbiences[input.dataset.ambienceColor as ShelfId].color = input.value; saveShelfAmbiences(); }));
  document.querySelectorAll<HTMLInputElement>("[data-ambience-temperature]").forEach(input => input.addEventListener("change", () => { shelfAmbiences[input.dataset.ambienceTemperature as ShelfId].temperature = Number(input.value); saveShelfAmbiences(); render(); }));
  document.querySelectorAll<HTMLInputElement>("[data-ambience-brightness]").forEach(input => input.addEventListener("change", () => { shelfAmbiences[input.dataset.ambienceBrightness as ShelfId].brightness = Number(input.value); saveShelfAmbiences(); render(); }));
  document.querySelectorAll<HTMLButtonElement>("[data-quick-scene]").forEach(button => button.addEventListener("click", () => setQuickScene(button.dataset.quickScene || "")));
}
async function fetchJsonOptional(path: string) {
  try { const response = await fetchLocal(`${baseUrl}${path}`, { signal: AbortSignal.timeout(6000) }); return response.ok ? await response.json() : undefined; }
  catch { return undefined; }
}
async function exportBackup() {
  backupMessage = "Lecture de la configuration WLED…"; render();
  const [cfg, currentState, presets] = await Promise.all([fetchJsonOptional("/json/cfg"), fetchJsonOptional("/json/state"), fetchJsonOptional("/presets.json")]);
  const backup: Led2Backup = { format: "led2-backup", version: 1, createdAt: new Date().toISOString(), wled: { cfg, state: currentState, presets }, app: { devices: savedDevices, scenes, furnitureLayout, shelfAmbiences, liveZoneApply } };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  link.download = `led2-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  backupMessage = cfg && presets ? "Sauvegarde complète téléchargée." : "Sauvegarde téléchargée, mais certains éléments WLED n’étaient pas accessibles.";
  render();
}
async function importBackup(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text()) as unknown;
    if (!isLed2Backup(parsed)) throw new Error("format");
    pendingRestore = parsed as Led2Backup;
    const created = new Date(pendingRestore.createdAt);
    backupMessage = `Sauvegarde valide${Number.isNaN(created.getTime()) ? "" : ` du ${created.toLocaleString("fr-FR")}`}. Confirmez pour remplacer la configuration actuelle.`;
  } catch { pendingRestore = null; backupMessage = "Ce fichier n’est pas une sauvegarde LED2 valide."; }
  render();
}
async function restoreBackup() {
  const backup = pendingRestore;
  if (!backup) return;
  backupMessage = "Restauration en cours…"; render();
  try {
    if (Array.isArray(backup.app.devices)) savedDevices = backup.app.devices.flatMap(device => {
      const url = device && typeof device.url === "string" ? normalizeWledUrl(device.url) : null;
      return url && typeof device.name === "string" ? [{ url, name: device.name.slice(0, 80) }] : [];
    });
    if (Array.isArray(backup.app.scenes)) scenes = sanitizeScenes(backup.app.scenes);
    const restoredLayout = backup.app.furnitureLayout;
    if (restoredLayout && Number.isInteger(restoredLayout.bottomEnd) && Number.isInteger(restoredLayout.middleEnd) && restoredLayout.bottomEnd > 0 && restoredLayout.bottomEnd < restoredLayout.middleEnd && restoredLayout.middleEnd < TOTAL_ZONES) furnitureLayout = restoredLayout;
    shelfAmbiences = sanitizeShelfAmbiences(backup.app.shelfAmbiences);
    liveZoneApply = backup.app.liveZoneApply !== false;
    localStorage.setItem("led2.devices", JSON.stringify(savedDevices)); saveScenes();
    localStorage.setItem("led2.furnitureLayout", JSON.stringify(furnitureLayout)); saveShelfAmbiences();
    localStorage.setItem("led2.liveZoneApply", String(liveZoneApply));
    if (connectionState === "connected" && backup.wled.cfg) {
      const cfgResponse = await fetchLocal(`${baseUrl}/json/cfg`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(backup.wled.cfg), signal: AbortSignal.timeout(10000) });
      if (!cfgResponse.ok) throw new Error("cfg");
    }
    if (connectionState === "connected" && backup.wled.presets) {
      const form = new FormData();
      form.append("data", new Blob([JSON.stringify(backup.wled.presets)], { type: "application/json" }), "/presets.json");
      const presetResponse = await fetchLocal(`${baseUrl}/edit`, { method: "POST", body: form, signal: AbortSignal.timeout(10000) });
      if (!presetResponse.ok) throw new Error("presets");
    }
    if (connectionState === "connected" && backup.wled.state) await sendWledState(backup.wled.state);
    backupMessage = connectionState === "connected" ? "Configuration WLED et réglages LED2 restaurés." : "Réglages LED2 restaurés. Connectez WLED pour restaurer aussi l’appareil.";
    pendingRestore = null;
  } catch { backupMessage = "WLED a refusé la restauration. La sauvegarde reste prête pour une nouvelle tentative."; }
  render();
}
async function useWledPreset(id: number) { if (connectionState !== "connected") return; presetMessage = presetRecordMode ? `Enregistrement de la mémoire ${id}…` : `Chargement de la mémoire ${id}…`; render(); try { const payload = presetRecordMode ? { psave: id } : { ps: id }; const response = await fetchLocal(`${baseUrl}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error(); presetRecordMode = false; presetMessage = `Mémoire ${id} ${payload.psave ? "enregistrée" : "chargée"}.`; } catch { presetMessage = `Impossible de modifier la mémoire ${id}.`; } render(); }
function rgbToHex(r: number, g: number, b: number) { return [r, g, b].map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0")).join("").toUpperCase(); }
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
function scheduleRgbBrightnessUpdate(value: number) {
  rgbBrightness = clampByte(value);
  if (rgbBrightnessUpdateTimer !== undefined) window.clearTimeout(rgbBrightnessUpdateTimer);
  rgbBrightnessUpdateTimer = window.setTimeout(() => { rgbBrightnessUpdateTimer = undefined; void updateRgbBrightness(); }, 120);
}
function scheduleWhiteUpdate() {
  if (whiteUpdateTimer !== undefined) window.clearTimeout(whiteUpdateTimer);
  whiteUpdateTimer = window.setTimeout(() => { whiteUpdateTimer = undefined; void updateWhite(); }, 50);
}
async function updateWhite() {
  const p = whiteTemperature;
  const wr = p <= 50 ? Math.floor((p / 50) * 255) : 255;
  const wg = p <= 50 ? 255 : Math.floor(255 - ((p - 50) / 50) * 255);
  currentColors = { ...currentColors, wr, wg, wb: 0 };
  activeChannel = "white";
  if (isMatrixMode) return applyZones();
  const segments = Array.from({ length: activeSegmentCount }, (_, id) => id % 2 === 1
    ? { id, on: true, col: [[wr, wg, 0]], bri: whiteBrightness, fx: 0 }
    : { id, on: fusionEnabled });
  if (segments.length) {
    try { await sendWledState({ seg: segments }); }
    catch { connectionState = "error"; render(); }
  }
}
async function updateEffect(parameter: "fx" | "sx" | "ix", value: number) {
  if (isMatrixMode) return;
  const segments = Array.from({ length: activeSegmentCount }, (_, id) => ({ id, [parameter]: value })).filter(segment => fusionEnabled || (activeChannel === "white" ? segment.id % 2 === 1 : segment.id % 2 === 0));
  if (segments.length) await sendWledState({ seg: segments });
}
async function fetchEffectsList() {
  try { const response = await fetchLocal(`${baseUrl}/json/effects`, { signal: AbortSignal.timeout(5000) }); if (!response.ok) return; const names = await response.json() as string[]; effects = names.map((label, id) => ({ id, label })); }
  catch { effects = [{ id: 0, label: "Solid" }]; }
}

function selectDevice(url: string) { baseUrl = url; const input = document.querySelector<HTMLInputElement>("#device-url"); if (input) input.value = url; connect(new Event("submit") as SubmitEvent); }

function rememberDevice(device: SavedDevice) { savedDevices = [device, ...savedDevices.filter(item => item.url !== device.url)].slice(0, 12); localStorage.setItem("led2.devices", JSON.stringify(savedDevices)); }

async function scanNetwork() {
  const typedValue = document.querySelector<HTMLInputElement>("#network-prefix")?.value.trim().replace(/\.$/, "") || "";
  const typedPrefix = networkPrefixFrom(typedValue);
  if (!typedPrefix) { scanMessage = "Format réseau privé attendu, par exemple 192.168.68"; render(); return; }
  detectedPrefixes = [typedPrefix, ...detectedPrefixes.filter(prefix => prefix !== typedPrefix)];
  localStorage.setItem("led2.networkPrefix", typedPrefix);
  scanning = true; scanResults = []; scanMessage = `Autorisez l’accès au réseau local si le navigateur le demande. Recherche sur ${typedPrefix}.x…`; render();
  const found = new Map<string, DiscoveredDevice>();
  const knownHosts = [baseUrl, ...savedDevices.map(device => device.url)].map(hostFrom).filter(host => host.startsWith(`${typedPrefix}.`));
  const candidates = [...new Set([...knownHosts, ...Array.from({ length: 254 }, (_, index) => `${typedPrefix}.${index + 1}`)])];
  for (let index = 0; index < candidates.length; index += 24) {
    await Promise.all(candidates.slice(index, index + 24).map(async host => {
      try {
        const response = await fetchLocal(`http://${host}/json/info`, { signal: AbortSignal.timeout(900) });
        if (!response.ok) return;
        const info = await response.json() as { name?: string; ver?: string; brand?: string };
        if (info.ver || info.name || info.brand === "WLED") found.set(host, { url: `http://${host}`, name: info.name || `WLED ${host}`, version: info.ver });
      } catch { /* absent, permission refused or inaccessible */ }
    }));
    scanResults = [...found.values()];
    scanMessage = `${Math.min(index + 24, candidates.length)} / ${candidates.length} adresses vérifiées…${found.size ? ` ${found.size} WLED trouvé(s).` : ""}`;
    render();
  }
  scanResults = [...found.values()];
  scanning = false;
  scanMessage = found.size ? `${found.size} appareil(s) WLED trouvé(s).` : "Aucun WLED détecté. Vérifiez l’autorisation d’accès au réseau local et le préfixe Wi-Fi.";
  render();
}

async function detectNetwork() {
  scanMessage = "Détection de la forme du réseau…"; render();
  const prefixes = new Set<string>();
  const typedPrefix = networkPrefixFrom(document.querySelector<HTMLInputElement>("#network-prefix")?.value || "");
  if (typedPrefix) prefixes.add(typedPrefix);
  const currentPrefix = networkPrefixFrom(baseUrl);
  if (currentPrefix) prefixes.add(currentPrefix);
  savedDevices.forEach(device => { const prefix = networkPrefixFrom(device.url); if (prefix) prefixes.add(prefix); });
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
  if (detectedPrefixes[0]) localStorage.setItem("led2.networkPrefix", detectedPrefixes[0]);
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
  const normalizedUrl = normalizeWledUrl(input?.value || "");
  if (!normalizedUrl) { connectionState = "error"; scanMessage = "Adresse invalide : utilisez uniquement http:// ou https:// avec le nom ou l’adresse IP de WLED."; render(); return; }
  baseUrl = normalizedUrl;
  deviceInfo = null;
  connectionState = "connecting";
  render();
  try {
    const response = await fetchLocal(`${baseUrl}/json/state`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Device unavailable");
    applyRemoteState(await response.json() as WledState);
    await fetchEffectsList();
    const info = await fetchLocal(`${baseUrl}/json/info`, { signal: AbortSignal.timeout(5000) });
    if (info.ok) { deviceInfo = await info.json() as WledInfo; deviceName = deviceInfo.name || "Appareil WLED"; }
    connectionState = "connected";
    rememberDevice({ url: baseUrl, name: deviceName });
    const connectedPrefix = networkPrefixFrom(baseUrl);
    if (connectedPrefix) {
      detectedPrefixes = [connectedPrefix, ...detectedPrefixes.filter(prefix => prefix !== connectedPrefix)];
      localStorage.setItem("led2.networkPrefix", connectedPrefix);
    }
    stateSyncFailures = 0;
    startStateSync();
    startInfoSync();
  } catch {
    connectionState = "error";
  }
  render();
}

async function updateState(patch: Partial<WledState>) {
  state = { ...state, ...patch };
  render();
  if (connectionState !== "connected") return;
  try { await sendWledState(patch); }
  catch { connectionState = "error"; render(); }
}

render();
if (embeddedWledMode) void connect(new Event("submit") as SubmitEvent);
