// ??$$$ temporary script
const mongoose = require("mongoose");
require("dotenv/config");

const MONGO_URI = process.env.MONGO_URI;

const partSchema = new mongoose.Schema({}, { strict: false });
const Part = mongoose.model("Part", partSchema);

const projectSchema = new mongoose.Schema({
  bom: Array
}, { strict: false });
const Project = mongoose.model("Project", projectSchema);

const sessionSchema = new mongoose.Schema({
  bom: Array
}, { strict: false });
const NewFlowSession = mongoose.model("NewFlowSession", sessionSchema);

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for backfilling...");

  // 1. Backfill Projects
  const projects = await Project.find({});
  console.log(`Found ${projects.length} projects.`);
  for (const proj of projects) {
    if (proj.bom && Array.isArray(proj.bom)) {
      let updated = false;
      const newBom = await Promise.all(proj.bom.map(async (item) => {
        if (!item.type || item.type === "module") {
          const partDoc = await Part.findOne({ mpn: item.mpn }).lean();
          let componentType = item.type || "module";
          if (partDoc && partDoc.componentType) {
            componentType = partDoc.componentType;
          } else {
            // Apply safety net
            const wokwiType = String(item.wokwiPartType || "").toLowerCase();
            const displayName = String(item.displayName || "").toLowerCase();
            if (wokwiType === "wokwi-servo" || displayName.includes("servo") || displayName.includes("motor")) {
              componentType = "motor";
            } else if (wokwiType.includes("led") || wokwiType.includes("neopixel") || displayName.includes("led") || displayName.includes("neopixel")) {
              componentType = "led";
            } else if (wokwiType.includes("button") || wokwiType.includes("pushbutton") || displayName.includes("button") || displayName.includes("switch")) {
              componentType = "button";
            } else if (wokwiType.includes("lcd") || wokwiType.includes("ssd1306") || displayName.includes("lcd") || displayName.includes("display") || displayName.includes("oled")) {
              componentType = "display";
            } else if (wokwiType.includes("dht") || wokwiType.includes("hc-sr04") || displayName.includes("sensor")) {
              componentType = "sensor";
            } else if (wokwiType.includes("arduino") || wokwiType.includes("esp32") || displayName.includes("arduino") || displayName.includes("mcu")) {
              componentType = "microcontroller";
            }
          }
          if (item.type !== componentType) {
            item.type = componentType;
            updated = true;
          }
        }
        return item;
      }));

      if (updated) {
        proj.bom = newBom;
        proj.markModified("bom");
        await proj.save();
        console.log(`Updated project ${proj._id}`);
      }
    }
  }

  // 2. Backfill Sessions
  const sessions = await NewFlowSession.find({});
  console.log(`Found ${sessions.length} sessions.`);
  for (const sess of sessions) {
    if (sess.bom && Array.isArray(sess.bom)) {
      let updated = false;
      const newBom = await Promise.all(sess.bom.map(async (item) => {
        if (!item.type || item.type === "module") {
          const partDoc = await Part.findOne({ mpn: item.mpn }).lean();
          let componentType = item.type || "module";
          if (partDoc && partDoc.componentType) {
            componentType = partDoc.componentType;
          } else {
            // Apply safety net
            const wokwiType = String(item.partId || item.wokwiPartType || "").toLowerCase();
            const displayName = String(item.displayName || "").toLowerCase();
            if (wokwiType === "wokwi-servo" || displayName.includes("servo") || displayName.includes("motor")) {
              componentType = "motor";
            } else if (wokwiType.includes("led") || wokwiType.includes("neopixel") || displayName.includes("led") || displayName.includes("neopixel")) {
              componentType = "led";
            } else if (wokwiType.includes("button") || wokwiType.includes("pushbutton") || displayName.includes("button") || displayName.includes("switch")) {
              componentType = "button";
            } else if (wokwiType.includes("lcd") || wokwiType.includes("ssd1306") || displayName.includes("lcd") || displayName.includes("display") || displayName.includes("oled")) {
              componentType = "display";
            } else if (wokwiType.includes("dht") || wokwiType.includes("hc-sr04") || displayName.includes("sensor")) {
              componentType = "sensor";
            } else if (wokwiType.includes("arduino") || wokwiType.includes("esp32") || displayName.includes("arduino") || displayName.includes("mcu")) {
              componentType = "microcontroller";
            }
          }
          if (item.type !== componentType) {
            item.type = componentType;
            updated = true;
          }
        }
        return item;
      }));

      if (updated) {
        sess.bom = newBom;
        sess.markModified("bom");
        await sess.save();
        console.log(`Updated session ${sess._id}`);
      }
    }
  }

  console.log("Backfill complete!");
  await mongoose.disconnect();
}

run().catch(console.error);
