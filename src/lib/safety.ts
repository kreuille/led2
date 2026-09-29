export interface SegmentShape {
  start?: number;
  stop?: number;
  spc?: number;
  on?: boolean;
}

export interface StateShape {
  on: boolean;
  seg?: SegmentShape[];
}

export function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}

export function normalizeWledUrl(value: string) {
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate.includes("://") ? candidate : `http://${candidate}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.origin;
  } catch { return null; }
}

export function reconstructZones(value: StateShape, totalZones: number) {
  if (!value.on) return Array.from({ length: totalZones }, () => false);
  const segments = value.seg || [];
  if (!segments.length || segments.some(segment => (segment.stop || 0) > totalZones * 2 || ((segment.spc || 0) !== 1 && (segment.stop || 0) > 0))) return null;
  const next = Array.from({ length: totalZones }, () => false);
  for (const segment of segments) {
    if (!segment.on || !segment.stop) continue;
    const start = Math.max(0, segment.start || 0);
    const stop = Math.min(totalZones * 2, segment.stop);
    for (let pixel = start; pixel < stop; pixel += 2) next[Math.floor(pixel / 2)] = true;
  }
  return next;
}

export function isLed2Backup(value: unknown): value is { format: "led2-backup"; version: 1; app: object; wled: object } {
  if (!value || typeof value !== "object") return false;
  const backup = value as Record<string, unknown>;
  return backup.format === "led2-backup" && backup.version === 1 && Boolean(backup.app) && typeof backup.app === "object" && Boolean(backup.wled) && typeof backup.wled === "object";
}

export function clampByte(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(255, parsed)) : 0;
}

export function formatUptime(seconds = 0) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return days ? `${days} j ${hours} h` : hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function wifiQuality(signal = 0) {
  return signal >= 75 ? "Excellent" : signal >= 50 ? "Bon" : signal >= 25 ? "Faible" : "Critique";
}

export function clampMapZoom(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(3, Math.round(parsed * 2) / 2));
}
