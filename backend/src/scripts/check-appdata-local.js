// ??$$$ non-important
const fs = require("fs");
const path = require("path");

function getDirSize(dirPath) {
  let size = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          size += getDirSize(filePath);
        } else {
          size += stats.size;
        }
      } catch (e) {}
    }
  } catch (e) {}
  return size;
}

function scanDir(baseDir) {
  console.log(`Scanning ${baseDir}...`);
  try {
    const items = fs.readdirSync(baseDir);
    const results = [];
    for (const item of items) {
      const fullPath = path.join(baseDir, item);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          const sizeBytes = getDirSize(fullPath);
          const sizeGB = Math.round((sizeBytes / (1024 * 1024 * 1024)) * 100) / 100;
          if (sizeGB > 0.1) {
            results.push({ name: item, sizeGB });
          }
        }
      } catch (e) {}
    }
    results.sort((a, b) => b.sizeGB - a.sizeGB);
    console.table(results);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

console.log("=== AppData\\Local (Large folders only) ===");
scanDir("C:\\Users\\User\\AppData\\Local");
