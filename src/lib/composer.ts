import { clampByte, normalizeZoneIndexes } from "./safety";

export type LayerMode = "off" | "rgb" | "white";

export interface VisualLayer {
  id: string;
  name: string;
  zones: number[];
  mode: LayerMode;
  color: string;
  temperature: number;
  brightness: number;
  effect: number;
}

export interface VisualScene {
  id: string;
  name: string;
  layers: VisualLayer[];
  transitionMs: number;
}

export interface SequenceStep { sceneId: string; durationSeconds: number; }
export interface LightSequence { id: string; name: string; steps: SequenceStep[]; repeat: number; }

const safeId = (value: unknown) => typeof value === "string" && value ? value.slice(0, 100) : crypto.randomUUID();
const safeName = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim().slice(0, 60) : fallback;
const safeColor = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#ff6432";
const safeNumber = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
};

export function sanitizeVisualLayers(value: unknown, totalZones: number): VisualLayer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<VisualLayer>;
    const zones = normalizeZoneIndexes(candidate.zones, totalZones);
    const mode: LayerMode = candidate.mode === "rgb" || candidate.mode === "white" || candidate.mode === "off" ? candidate.mode : "rgb";
    if (!zones.length) return [];
    return [{
      id: safeId(candidate.id), name: safeName(candidate.name, `Couche ${index + 1}`), zones, mode,
      color: safeColor(candidate.color), temperature: safeNumber(candidate.temperature, 0, 100, 35),
      brightness: safeNumber(candidate.brightness, 0, 255, 128), effect: safeNumber(candidate.effect, 0, 255, 0),
    }];
  }).slice(0, 12);
}

export function sanitizeVisualScenes(value: unknown, totalZones: number): VisualScene[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<VisualScene>;
    const layers = sanitizeVisualLayers(candidate.layers, totalZones);
    if (!layers.length) return [];
    return [{ id: safeId(candidate.id), name: safeName(candidate.name, `Scène ${index + 1}`), layers, transitionMs: safeNumber(candidate.transitionMs, 0, 65000, 700) }];
  }).slice(0, 20);
}

export function sanitizeSequences(value: unknown, sceneIds: Set<string>): LightSequence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<LightSequence>;
    const steps = Array.isArray(candidate.steps) ? candidate.steps.flatMap(step => {
      if (!step || typeof step.sceneId !== "string" || !sceneIds.has(step.sceneId)) return [];
      return [{ sceneId: step.sceneId, durationSeconds: safeNumber(step.durationSeconds, 1, 3600, 10) }];
    }).slice(0, 20) : [];
    if (!steps.length) return [];
    return [{ id: safeId(candidate.id), name: safeName(candidate.name, `Animation ${index + 1}`), steps, repeat: safeNumber(candidate.repeat, 0, 99, 1) }];
  }).slice(0, 12);
}

const temperatureColor = (temperature: number) => temperature <= 50
  ? [Math.floor((temperature / 50) * 255), 255, 0]
  : [255, Math.floor(255 - ((temperature - 50) / 50) * 255), 0];
const colorArray = (color: string) => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));

export function buildVisualScenePayload(scene: VisualScene, totalZones: number, maxSegments = 32) {
  const assignments: Array<VisualLayer | null> = Array.from({ length: totalZones }, () => null);
  scene.layers.forEach(layer => layer.zones.forEach(zone => { if (zone >= 0 && zone < totalZones) assignments[zone] = layer; }));
  const runs: Array<{ start: number; stop: number; layer: VisualLayer }> = [];
  let start = 0;
  while (start < totalZones) {
    const layer = assignments[start];
    if (!layer || layer.mode === "off") { start++; continue; }
    const signature = `${layer.mode}|${layer.color}|${layer.temperature}|${layer.brightness}|${layer.effect}`;
    let stop = start + 1;
    while (stop < totalZones) {
      const next = assignments[stop];
      if (!next || `${next.mode}|${next.color}|${next.temperature}|${next.brightness}|${next.effect}` !== signature) break;
      stop++;
    }
    runs.push({ start, stop, layer });
    start = stop;
  }
  if (runs.length * 2 > maxSegments) return { error: `Cette scène demande ${runs.length * 2} segments, mais WLED en accepte ${maxSegments}. Regroupez les LED voisines.`, payload: null };
  const seg: Array<Record<string, unknown>> = [];
  runs.forEach((run, index) => {
    const rgb = colorArray(run.layer.color);
    const white = temperatureColor(run.layer.temperature);
    seg.push({ id: index * 2, start: run.start * 2, stop: run.stop * 2, grp: 1, spc: 1, of: 0, on: run.layer.mode === "rgb", bri: run.layer.brightness, fx: run.layer.mode === "rgb" ? run.layer.effect : 0, sx: 128, ix: 128, n: `${run.layer.name} RGB`, col: [rgb] });
    seg.push({ id: index * 2 + 1, start: run.start * 2 + 1, stop: run.stop * 2 + 1, grp: 1, spc: 1, of: 0, on: run.layer.mode === "white", bri: run.layer.brightness, fx: 0, n: `${run.layer.name} blanc`, col: [white] });
  });
  for (let id = seg.length; id < maxSegments; id++) seg.push({ id, stop: 0 });
  return { error: "", payload: { on: true, tt: Math.round(scene.transitionMs / 100), seg } };
}

