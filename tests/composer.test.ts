import assert from "node:assert/strict";
import test from "node:test";
import { buildVisualScenePayload, sanitizeSequences, sanitizeVisualScenes, type VisualScene } from "../src/lib/composer.ts";
import { sanitizeSchedules, schedulesToWled } from "../src/lib/schedules.ts";

test("les scènes visuelles sont normalisées avant stockage", () => {
  const scenes = sanitizeVisualScenes([{ id: "x", name: "  Salon  ", transitionMs: 900, layers: [{ id: "l", name: "Bas", zones: [2, 1, 2, 99], mode: "rgb", color: "#AABBCC", temperature: 40, brightness: 999, effect: 2 }] }], 97);
  assert.equal(scenes[0].name, "Salon");
  assert.deepEqual(scenes[0].layers[0].zones, [1, 2]);
  assert.equal(scenes[0].layers[0].brightness, 255);
  assert.equal(scenes[0].layers[0].color, "#aabbcc");
});

test("une scène spatiale produit les segments RGB et blanc entrelacés", () => {
  const scene: VisualScene = { id: "s", name: "Test", transitionMs: 1200, layers: [
    { id: "a", name: "Bas", zones: [0, 1], mode: "rgb", color: "#ff0000", temperature: 30, brightness: 100, effect: 0 },
    { id: "b", name: "Petite", zones: [42, 43], mode: "white", color: "#000000", temperature: 25, brightness: 80, effect: 0 },
  ] };
  const result = buildVisualScenePayload(scene, 97, 8);
  assert.equal(result.error, "");
  assert.equal(result.payload?.tt, 12);
  assert.deepEqual(result.payload?.seg.slice(0, 4).map(segment => [segment.start, segment.stop, segment.on]), [[0, 4, true], [1, 5, false], [84, 88, false], [85, 89, true]]);
});

test("le nombre de segments est protégé", () => {
  const layers = Array.from({ length: 5 }, (_, index) => ({ id: String(index), name: String(index), zones: [index * 2], mode: "rgb" as const, color: "#ff0000", temperature: 30, brightness: 100, effect: 0 }));
  const result = buildVisualScenePayload({ id: "s", name: "Trop", transitionMs: 0, layers }, 97, 8);
  assert.match(result.error, /10 segments/);
  assert.equal(result.payload, null);
});

test("les animations ignorent les scènes absentes", () => {
  const sequences = sanitizeSequences([{ name: "Soir", repeat: 2, steps: [{ sceneId: "ok", durationSeconds: 5 }, { sceneId: "absente", durationSeconds: 1 }] }], new Set(["ok"]));
  assert.deepEqual(sequences[0].steps, [{ sceneId: "ok", durationSeconds: 5 }]);
});

test("les programmations produisent le masque WLED attendu", () => {
  const schedules = sanitizeSchedules([{ name: "Soir", time: "20:30", days: [0, 2, 6, 9], presetId: 999, enabled: true }]);
  assert.deepEqual(schedulesToWled(schedules), [{ en: 1, hour: 20, min: 30, macro: 250, dow: 69 }]);
});
