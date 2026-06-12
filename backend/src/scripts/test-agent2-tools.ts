// ??$$$ non-important
// ??$$$ NEW FLOW
import mongoose from "mongoose";
import "dotenv/config";
import process from "process";
import { connectDB } from "../lib/db";
import Project from "../models/project.model";
import Part from "../models/part.model";
import { executeTool } from "../services/agent2tools.service";

async function runTests() {
  console.log("⚡ Connecting to MongoDB...");
  await connectDB();

  console.log("Creating a fresh dedicated test project...");
  const uniqueId = new mongoose.Types.ObjectId();
  const project = await Project.create({
    _id: uniqueId,
    description: "A prototype verification project",
    owner: new mongoose.Types.ObjectId(),
    bom: [],
    wiring: [],
    milestones: [],
    meta: {
      stage: "ideation",
      isAgentic: true
    }
  } as any);

  const pId = project._id.toString();
  console.log(`Using Project ID: ${pId}`);

  // Find some parts or seed a mock part to test with
  let mockPart = await Part.findOne({ mpn: "ESP32-DEVKITC-32D" });
  if (!mockPart) {
    console.log("Seeding a mock ESP32 part...");
    mockPart = await Part.create({
      mpn: "ESP32-DEVKITC-32D",
      name: "ESP32 DevKit V1",
      manufacturer: "Espressif",
      description: "ESP32 development board",
      specs: {
        Voltage: "3.3V",
        Current: "500mA max",
        Interface: "WiFi"
      },
      interfaces: ["WiFi", "Bluetooth", "I2C", "SPI", "UART", "GPIO"],
      wokwiPartType: "wokwi-esp32-devkit-v1",
      price: 4.5
    });
  }

  let mockGyro = await Part.findOne({ mpn: "MPU6050" });
  if (!mockGyro) {
    console.log("Seeding a mock MPU6050 part...");
    mockGyro = await Part.create({
      mpn: "MPU6050",
      name: "MPU6050 Gyro Sensor",
      manufacturer: "InvenSense",
      description: "6-axis gyroscope and accelerometer",
      specs: {
        Voltage: "3.3V",
        Interface: "I2C"
      },
      interfaces: ["I2C"],
      wokwiPartType: "wokwi-mpu6050",
      price: 2.0
    });
  }

  const results: Record<string, boolean> = {};

  // Tool 1: search_library
  try {
    console.log("\n🧪 Testing Tool 1: search_library...");
    const res = await executeTool("search_library", { query: "ESP32 devkit", limit: 3 }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["search_library"] = res && Array.isArray(res.results) && res.results.length > 0;
  } catch (err) {
    console.error("Tool 1 failed:", err);
    results["search_library"] = false;
  }

  // Tool 2: get_part_details
  try {
    console.log("\n🧪 Testing Tool 2: get_part_details...");
    const res = await executeTool("get_part_details", { partId: mockPart.mpn }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["get_part_details"] = res && res.found === true && res.part.mpn === mockPart.mpn;
  } catch (err) {
    console.error("Tool 2 failed:", err);
    results["get_part_details"] = false;
  }

  // Tool 3: check_compatibility
  try {
    console.log("\n🧪 Testing Tool 3: check_compatibility...");
    const res = await executeTool("check_compatibility", { partIdA: mockPart.mpn, partIdB: mockGyro.mpn }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["check_compatibility"] = res && res.compatible === true;
  } catch (err) {
    console.error("Tool 3 failed:", err);
    results["check_compatibility"] = false;
  }

  // Tool 4: validate_pin_assignment
  try {
    console.log("\n🧪 Testing Tool 4: validate_pin_assignment...");
    const res = await executeTool("validate_pin_assignment", {
      mcu: "ESP32",
      assignments: [
        { pin: "GPIO21", usedBy: "MPU6050.SDA" },
        { pin: "GPIO21", usedBy: "OLED.SDA" }
      ]
    }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["validate_pin_assignment"] = res && res.valid === true;
  } catch (err) {
    console.error("Tool 4 failed:", err);
    results["validate_pin_assignment"] = false;
  }

  // Tool 5: search_datasheet
  try {
    console.log("\n🧪 Testing Tool 5: search_datasheet...");
    const res = await executeTool("search_datasheet", { partId: mockGyro.mpn, query: "I2C address" }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["search_datasheet"] = res && res.result.includes("0x68");
  } catch (err) {
    console.error("Tool 5 failed:", err);
    results["search_datasheet"] = false;
  }

  // Tool 6: estimate_power_budget
  try {
    console.log("\n🧪 Testing Tool 6: estimate_power_budget...");
    const res = await executeTool("estimate_power_budget", {
      parts: [
        { partId: mockPart.mpn, qty: 1 },
        { partId: "SG90", qty: 2 }
      ],
      powerSource: "USB 5V 500mA"
    }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["estimate_power_budget"] = res && res.adequate === false && res.warnings.length > 0;
  } catch (err) {
    console.error("Tool 6 failed:", err);
    results["estimate_power_budget"] = false;
  }

  // Tool 7: get_wokwi_part_type
  try {
    console.log("\n🧪 Testing Tool 7: get_wokwi_part_type...");
    const res = await executeTool("get_wokwi_part_type", { partId: mockGyro.mpn }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["get_wokwi_part_type"] = res && res.wokwiPartType === "wokwi-mpu6050";
  } catch (err) {
    console.error("Tool 7 failed:", err);
    results["get_wokwi_part_type"] = false;
  }

  // Tool 8: check_simulation_support
  try {
    console.log("\n🧪 Testing Tool 8: check_simulation_support...");
    const res = await executeTool("check_simulation_support", {
      parts: [
        { key: "mcu", partId: mockPart.mpn, name: "ESP32" },
        { key: "esc", partId: "HAKRC-ESC", name: "HAKRC Brushless ESC" }
      ]
    }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["check_simulation_support"] = res && res.simulatable.length === 1 && res.physicalOnly.length === 1;
  } catch (err) {
    console.error("Tool 8 failed:", err);
    results["check_simulation_support"] = false;
  }

  // Tool 9: generate_wiring
  try {
    console.log("\n🧪 Testing Tool 9: generate_wiring...");
    const res = await executeTool("generate_wiring", {
      parts: [
        { key: "mcu", partId: mockPart.mpn, name: "ESP32", role: "controller" },
        { key: "gyro", partId: mockGyro.mpn, name: "MPU6050", role: "sensor" }
      ],
      mcu: "ESP32"
    }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["generate_wiring"] = res && Array.isArray(res.connections) && res.connections.length > 0;
  } catch (err) {
    console.error("Tool 9 failed:", err);
    results["generate_wiring"] = false;
  }

  // Tool 10: generate_milestone
  try {
    console.log("\n🧪 Testing Tool 10: generate_milestone...");
    const res = await executeTool("generate_milestone", {
      title: "MCU Blink Test",
      objective: "Verify MCU is programmable",
      subsystem: "MCU",
      partsInvolved: ["mcu"],
      mcu: "ESP32",
      wiringSubset: [],
      isFirstMilestone: true
    }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["generate_milestone"] = res && res.code && res.code.includes("pinMode");
  } catch (err) {
    console.error("Tool 10 failed:", err);
    results["generate_milestone"] = false;
  }

  // Tool 11: generate_diagram_json
  try {
    console.log("\n🧪 Testing Tool 11: generate_diagram_json...");
    const res = await executeTool("generate_diagram_json", {
      parts: [
        { key: "mcu", wokwiPartType: "wokwi-esp32-devkit-v1", id: "esp32" },
        { key: "gyro", wokwiPartType: "wokwi-mpu6050", id: "mpu6050" }
      ],
      connections: [
        { from: "mcu.GPIO21", to: "gyro.SDA", color: "#0066ff", net: "SDA" }
      ]
    }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["generate_diagram_json"] = res && res.diagramJson && Array.isArray(res.diagramJson.parts);
  } catch (err) {
    console.error("Tool 11 failed:", err);
    results["generate_diagram_json"] = false;
  }

  // Tool 12: save_progress
  try {
    console.log("\n🧪 Testing Tool 12: save_progress...");
    const res = await executeTool("save_progress", {
      sessionId: pId,
      type: "milestone",
      data: {
        id: "milestone_test_12",
        order: 1,
        title: "Agent Verification Blink",
        objective: "Test code loading",
        componentsInvolved: ["mcu"],
        wiringInstructions: "None",
        code: "void setup() {} void loop() {}",
        explanation: "Simple test",
        test: {
          expectedSerialOutput: "Blink",
          passCondition: "LED blinks",
          commonProblems: []
        },
        status: "locked",
        userConfirmed: false,
        userNotes: "",
        compiledHex: "",
        compilationErrors: [],
        serialOutput: "",
        completedAt: null,
        simulatable: true,
        dependsOn: []
      }
    }, pId);
    console.log("Response:", JSON.stringify(res, null, 2));
    results["save_progress"] = res && res.saved === true;
  } catch (err) {
    console.error("Tool 12 failed:", err);
    results["save_progress"] = false;
  }

  console.log("\n🧹 Cleaning up test project...");
  await Project.deleteOne({ _id: uniqueId });

  console.log("\n📊 Verification Summary:");
  let allPass = true;
  for (const [name, passed] of Object.entries(results)) {
    console.log(`${passed ? "✅" : "❌"} ${name}: ${passed ? "PASSED" : "FAILED"}`);
    if (!passed) allPass = false;
  }

  if (allPass) {
    console.log("\n🎉 ALL 12 TOOLS PASSED VERIFICATION!");
    process.exit(0);
  } else {
    console.log("\n❌ SOME TOOLS FAILED VERIFICATION. Check outputs above.");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Global runner failure:", err);
  process.exit(1);
});
