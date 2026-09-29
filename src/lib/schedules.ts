export interface LedSchedule {
  id: string;
  name: string;
  time: string;
  days: number[];
  presetId: number;
  enabled: boolean;
}

const safePreset = (value: unknown) => Math.max(1, Math.min(250, Math.round(Number(value) || 1)));

export function sanitizeSchedules(value: unknown): LedSchedule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<LedSchedule>;
    const time = typeof candidate.time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(candidate.time) ? candidate.time : "20:00";
    const days = Array.isArray(candidate.days) ? [...new Set(candidate.days.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))].sort() : [];
    if (!days.length) return [];
    return [{
      id: typeof candidate.id === "string" && candidate.id ? candidate.id.slice(0, 100) : crypto.randomUUID(),
      name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim().slice(0, 60) : `Programme ${index + 1}`,
      time, days, presetId: safePreset(candidate.presetId), enabled: candidate.enabled !== false,
    }];
  }).slice(0, 8);
}

export function scheduleToWled(schedule: LedSchedule) {
  const [hour, min] = schedule.time.split(":").map(Number);
  const dow = schedule.days.reduce((mask, day) => mask | (1 << day), 0);
  return { en: schedule.enabled ? 1 : 0, hour, min, macro: safePreset(schedule.presetId), dow };
}

export function schedulesToWled(value: LedSchedule[]) {
  return value.slice(0, 8).map(scheduleToWled);
}
