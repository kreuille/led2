import "./style.css";

type ConnectionState = "idle" | "connecting" | "connected" | "error";

interface WledState {
  on: boolean;
  bri: number;
  seg: Array<{ col: number[][]; fx: number; sx: number; ix: number }>;
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root not found");
const root = app;

let baseUrl = "";
let connectionState: ConnectionState = "idle";
let deviceName = "Aucun appareil connecté";
let state: WledState = { on: false, bri: 128, seg: [{ col: [[255, 98, 50]], fx: 0, sx: 128, ix: 128 }] };

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
      <section class="dashboard ${connectionState !== "connected" ? "muted" : ""}">
        <div class="section-title"><div><p class="eyebrow">ESPACE DE CONTRÔLE</p><h2>${deviceName}</h2></div><span class="locked">${connectionState === "connected" ? "ACTIF" : "EN ATTENTE"}</span></div>
        <div class="controls"><article class="control-card power-card"><div><span class="control-label">ALIMENTATION</span><h3>${state.on ? "Allumées" : "Éteintes"}</h3></div><button class="power-toggle ${state.on ? "active" : ""}" id="power-toggle" aria-label="Basculer l'alimentation"><span></span></button></article><article class="control-card"><span class="control-label">LUMINOSITÉ</span><div class="value-row"><h3>${Math.round((state.bri / 255) * 100)}%</h3><span>INTENSITÉ</span></div><input id="brightness" type="range" min="1" max="255" value="${state.bri}" ${connectionState !== "connected" ? "disabled" : ""} /></article><article class="control-card color-card"><span class="control-label">COULEUR ACTUELLE</span><div class="color-preview"><span></span><strong>Orange solaire</strong></div></article></div>
      </section>
    </main>`;

  document.querySelector<HTMLFormElement>("#connect-form")?.addEventListener("submit", connect);
  document.querySelector<HTMLButtonElement>("#power-toggle")?.addEventListener("click", () => updateState({ on: !state.on }));
  document.querySelector<HTMLInputElement>("#brightness")?.addEventListener("input", (event) => updateState({ bri: Number((event.target as HTMLInputElement).value) }));
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
  } catch {
    connectionState = "error";
  }
  render();
}

async function updateState(patch: Partial<WledState>) {
  state = { ...state, ...patch };
  render();
  if (connectionState !== "connected") return;
  try { await fetch(`${baseUrl}/json/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); }
  catch { connectionState = "error"; render(); }
}

render();
