import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const roots = ["src", "server", "functions", "scripts", "tests"];

async function javascriptFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const nested = await Promise.all(entries.map((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return javascriptFiles(path);
    return /\.(?:js|mjs)$/u.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

function check(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", file], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Syntax check failed: ${file}`)));
  });
}

const files = (await Promise.all(roots.map(javascriptFiles))).flat().sort();
for (const file of files) await check(file);
console.log(`Syntax checked ${files.length} JavaScript files.`);
