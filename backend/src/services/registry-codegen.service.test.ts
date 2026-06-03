// ??$$$ non-important
// @ts-nocheck
import test from "node:test";
import assert from "node:assert/strict";

// Old imports:
// import { getRegistry } from "./registry.service";
// ??$$$ newer code
import { getRegistry } from "./registry.services";
import { validatePlan, generateArtifactsFromRegistry } from "./registry-codegen.service";

test("validatePlan: rejects invalid pin for a variant", () => {
  const registry = getRegistry();

  const plan = {
    board: { type: "ARDUINO_MEGA", id: "board", top: 270, left: 185, attrs: {} },
    components: [{ type: "SEVEN_SEGMENT_4", id: "seg", attrs: {} }],
    connections: [
      {
        from: { type: "SEVEN_SEGMENT_4", id: "seg", pin: "COM.1" }, // invalid for _4
        to: { type: "ARDUINO_MEGA", id: "board", pin: "GND.1" },
        color: "black",
        route: []
      }
    ],
    notes: []
  };

  const result = validatePlan(registry, plan);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('Invalid pin "COM.1"')));
});

test("validatePlan: accepts valid pins for SEVEN_SEGMENT_4", () => {
  const registry = getRegistry();

  const requiredPins = ["DIG1", "DIG2", "DIG3", "DIG4", "A", "B", "C", "D", "E", "F", "G", "COM"];
  const connections = requiredPins.map((pin, idx) => ({
    from: { type: "ARDUINO_MEGA", id: "board", pin: String(22 + idx) },
    to: { type: "SEVEN_SEGMENT_4", id: "seg", pin },
    color: pin === "COM" ? "red" : "green",
    route: []
  }));

  const plan = {
    board: { type: "ARDUINO_MEGA", id: "board", top: 270, left: 185, attrs: {} },
    components: [{ type: "SEVEN_SEGMENT_4", id: "seg", attrs: { colon: false } }],
    connections,
    notes: []
  };

  const result = validatePlan(registry, plan);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

// ... rest of tests preserved as-is
