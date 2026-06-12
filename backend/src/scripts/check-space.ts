// ??$$$ non-important
import fs from "fs";
import path from "path";

function getDirSize(dirPath: string): number {
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

function run() {
  console.log("Scanning C:\\Users\\User directories...");
  const baseDir = "C:\\Users\\User";
  try {
    const items = fs.readdirSync(baseDir);
    const results: { name: string; sizeGB: number }[] = [];
    for (const item of items) {
      const fullPath = path.join(baseDir, item);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          const sizeBytes = getDirSize(fullPath);
          results.push({ name: item, sizeGB: Math.round((sizeBytes / (1024 * 1024 * 1024)) * 100) / 100 });
        }
      } catch (e) {}
    }
    results.sort((a, b) => b.sizeGB - a.sizeGB);
    console.table(results);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

run();
