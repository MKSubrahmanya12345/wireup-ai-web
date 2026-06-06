const fs = require("fs");
const file = "e:\\wireup.ai - new\\backend\\src\\models\\project.model.ts";
const content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");
lines.forEach((line, index) => {
  if (line.includes("interface I") || line.includes("Schema") || line.includes("bom") || line.includes("Bom")) {
    console.log(`${index + 1}: ${line}`);
  }
});
