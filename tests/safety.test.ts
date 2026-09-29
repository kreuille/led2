import assert from "node:assert/strict";
import test from "node:test";
import { clampByte, clampMapZoom, escapeHtml, formatUptime, isLed2Backup, normalizeWledUrl, reconstructZones, wifiQuality } from "../src/lib/safety.ts";

test("escapeHtml neutralise le HTML provenant de WLED", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("normalizeWledUrl accepte les hôtes WLED et refuse les protocoles actifs", () => {
  assert.equal(normalizeWledUrl("192.168.68.106/led2.htm"), "http://192.168.68.106");
  assert.equal(normalizeWledUrl("http://wled.local/json/state"), "http://wled.local");
  assert.equal(normalizeWledUrl("javascript:alert(1)"), null);
  assert.equal(normalizeWledUrl("http://user:secret@wled.local"), null);
});

test("reconstructZones suit les segments RGB/blanc entrelacés", () => {
  const zones = reconstructZones({ on: true, seg: [
    { start: 0, stop: 4, spc: 1, on: false },
    { start: 1, stop: 5, spc: 1, on: true },
    { start: 7, stop: 9, spc: 1, on: true },
  ] }, 5);
  assert.deepEqual(zones, [true, true, false, true, false]);
  assert.deepEqual(reconstructZones({ on: false, seg: [] }, 3), [false, false, false]);
  assert.equal(reconstructZones({ on: true, seg: [{ start: 0, stop: 6, spc: 0, on: true }] }, 3), null);
});

test("isLed2Backup exige la signature et la version attendues", () => {
  assert.equal(isLed2Backup({ format: "led2-backup", version: 1, app: {}, wled: {} }), true);
  assert.equal(isLed2Backup({ format: "led2-backup", version: 1, app: {} }), false);
  assert.equal(isLed2Backup({ format: "led2-backup", version: 2, app: {} }), false);
  assert.equal(isLed2Backup({ format: "autre", version: 1, app: {} }), false);
});

test("les indicateurs de diagnostic restent lisibles aux valeurs limites", () => {
  assert.equal(clampByte(-4), 0);
  assert.equal(clampByte(300), 255);
  assert.equal(clampByte(128), 128);
  assert.equal(formatUptime(6998), "1 h 56 min");
  assert.equal(formatUptime(90000), "1 j 1 h");
  assert.equal(wifiQuality(88), "Excellent");
  assert.equal(wifiQuality(20), "Critique");
  assert.equal(clampMapZoom(0), 1);
  assert.equal(clampMapZoom(1.7), 1.5);
  assert.equal(clampMapZoom(4), 3);
});
