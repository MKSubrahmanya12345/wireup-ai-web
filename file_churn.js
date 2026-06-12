// generate-codebase-md.js
// Usage:
// node generate-codebase-md.js "E:/wireup.ai - new"

const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || process.cwd();
const OUTPUT = path.join(ROOT, "codebase.md");

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".github",
  ".claude",
  ".gemini",
  ".vscode",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "coverage",
  ".idea",
  ".vs"
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".py",
  ".cpp",
  ".c",
  ".h",
  ".hpp",
  ".xml",
  ".yml",
  ".yaml",
  ".txt",
  ".sql",
  ".sh",
  ".bat",
  ".ps1"
]);

function shouldIgnore(filePath) {
  const parts = filePath.split(path.sep);
  const basename = path.basename(filePath).toLowerCase();

  for (const part of parts) {
    if (IGNORE_DIRS.has(part)) {
      return true;
    }
  }

  // Skip all env files
  if (basename.startsWith(".env")) {
    return true;
  }

  // Skip anything with "tree" in filename
  if (basename.includes("tree")) {
    return true;
  }

  return false;
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (TEXT_EXTENSIONS.has(ext)) {
    return true;
  }

  const base = path.basename(filePath).toLowerCase();

  return [
    ".gitignore",
    "dockerfile",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.node.json",
    "vite.config.ts",
    "vite.config.js",
    "eslint.config.js",
    "eslint.config.ts",
    "postcss.config.js",
    "tailwind.config.js",
    "tailwind.config.ts",
    "nodemon.json"
  ].includes(base);
}

function walk(dir, files = []) {
  let entries;

  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (shouldIgnore(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else {
      if (isTextFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function getLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  const map = {
    ".ts": "ts",
    ".tsx": "tsx",
    ".js": "js",
    ".jsx": "jsx",
    ".json": "json",
    ".md": "md",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".py": "python",
    ".cpp": "cpp",
    ".c": "c",
    ".xml": "xml",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".sql": "sql",
    ".sh": "bash"
  };

  return map[ext] || "";
}

const files = walk(ROOT).sort((a, b) => a.localeCompare(b));

console.log(`Found ${files.length} files...`);

let output = "";

for (const file of files) {
  try {
    const relativePath = path
      .relative(ROOT, file)
      .replace(/\\/g, "/");

    const content = fs.readFileSync(file, "utf8");

    output += `\n\n============================================================\n`;
    output += `FILE: ${relativePath}\n`;
    output += `============================================================\n\n`;
    output += "```" + getLanguage(file) + "\n";
    output += content;
    output += "\n```\n";
  } catch (err) {
    console.log(`Skipped: ${file}`);
  }
}

fs.writeFileSync(OUTPUT, output, "utf8");

console.log("");
console.log("========================================");
console.log(`Files dumped : ${files.length}`);
console.log(`Output file  : ${OUTPUT}`);
console.log("========================================");