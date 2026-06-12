const fs = require("fs");
const file = "e:\\wireup.ai - new\\frontend\\src\\components\\DiscoveryModal.tsx";
const content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");
lines.forEach((line, index) => {
  if (line.includes("virtualPlaygroundUrl")) {
    console.log(`${index + 1}: ${line}`);
  }
});
