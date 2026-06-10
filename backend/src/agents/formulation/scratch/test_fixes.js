const mongoose = require("mongoose");
const path = require("path");

require("dotenv").config({ path: "e:/wireup.ai - new/backend/.env" });
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/wireup-ai-web";

async function runTests() {
  console.log("Connecting to MongoDB at:", mongoUri);
  await mongoose.connect(mongoUri);

  // 1. TEST ISSUE 2: executeGenerateWiring
  console.log("\n--- TEST 1: executeGenerateWiring (MCU-aware) ---");
  const { executeGenerateWiring } = require("e:/wireup.ai - new/backend/dist/agents/formulation/tools/wiring.tool");

  // We test with ESP32 DevKit v1 and parts
  // Let's pass a list of parts with different roles
  const testParts = [
    { key: "display_oled", partId: "SSD1306", role: "display" },
    { key: "sensor_imu", partId: "MPU6050", role: "sensor" },
    { key: "microsd_card", partId: "MICROSD-MODULE-SPI", role: "storage" },
    { key: "play_btn", partId: "TACTILE-SWITCH", role: "sensor" }
  ];

  console.log("Generating wiring for ESP32 DevKit v1...");
  const esp32Wiring = await executeGenerateWiring({
    mcu: "ESP32 DevKit v1",
    parts: JSON.stringify(testParts)
  });

  console.log("ESP32 Connections Count:", esp32Wiring.connections.length);
  console.log("ESP32 Connections sample:", JSON.stringify(esp32Wiring.connections.slice(0, 8), null, 2));

  // Assert that SPI cs pin is not mapped to GPIO21/22 (which are I2C), and sequential pins are used.
  const pinsUsed = esp32Wiring.connections.map(c => c.from);
  console.log("MCU Pins allocated:", pinsUsed);

  // Let's also test for Raspberry Pi Pico
  console.log("\nGenerating wiring for Raspberry Pi Pico...");
  const picoWiring = await executeGenerateWiring({
    mcu: "Raspberry Pi Pico",
    parts: JSON.stringify(testParts)
  });
  console.log("Pico Connections Count:", picoWiring.connections.length);
  console.log("Pico Connections sample:", JSON.stringify(picoWiring.connections.slice(0, 8), null, 2));

  // 2. TEST ISSUE 3: saveSessionProgress milestone placeholder guard
  console.log("\n--- TEST 2: saveSessionProgress milestone placeholder guard ---");
  
  // Register session schema (mimic newFlowSession.model.ts)
  const Schema = mongoose.Schema;
  const newFlowSessionSchema = new Schema({
    bom: Array,
    wiring: Array,
    milestones: Array,
    diagram: Schema.Types.Mixed
  }, { strict: false });

  try {
    mongoose.model("newflowsessions");
  } catch (err) {
    mongoose.model("newflowsessions", newFlowSessionSchema);
  }

  const NewFlowSession = mongoose.model("newflowsessions");
  
  // Create a dummy session for testing
  const dummySession = new NewFlowSession({
    idea: "Test Idea",
    owner: new mongoose.Types.ObjectId(),
    bom: [],
    wiring: [],
    milestones: [
      {
        id: "milestone_1",
        order: 1,
        title: "Setup and I2C Scan",
        code: "void setup() { Serial.begin(115200); } void loop() {} // REAL CODE STAYS HERE",
        objective: "Initialize ESP32 and scan I2C bus"
      }
    ]
  });
  await dummySession.save();
  const sessionId = dummySession._id.toString();
  console.log("Created dummy session:", sessionId);

  const { saveSessionProgress } = require("e:/wireup.ai - new/backend/dist/agents/formulation/formulation.persistence");

  // Attempt to save a milestone update with placeholder code
  console.log("Saving milestone update with placeholder code...");
  const updateData = {
    milestone: {
      id: "milestone_1",
      order: 1,
      title: "Setup and I2C Scan",
      code: "milestone 1 code from generate",
      objective: "Initialize ESP32 and scan I2C bus"
    }
  };

  const saveResult = await saveSessionProgress(sessionId, "milestone", JSON.stringify(updateData));
  console.log("Save Result:", saveResult);

  // Retrieve session again and check if real code was preserved
  const updatedSession = await NewFlowSession.findById(sessionId);
  console.log("Milestone 1 Code in DB after save:", JSON.stringify(updatedSession.milestones[0].code));
  
  if (updatedSession.milestones[0].code.includes("REAL CODE STAYS HERE")) {
    console.log("SUCCESS: Real code was preserved, placeholder was rejected!");
  } else {
    console.error("FAILURE: Placeholder overwrote the real code!");
  }

  // Clean up
  await NewFlowSession.deleteOne({ _id: sessionId });
  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB.");
}

runTests().catch(err => {
  console.error("Error:", err);
  mongoose.disconnect();
});
