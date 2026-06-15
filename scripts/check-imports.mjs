import fs from "node:fs";
import path from "node:path";

const root = path.resolve("frontend/src/core");
const forbidden = ["document", "window", "localStorage", "sessionStorage", "fetch(", "XMLHttpRequest"];

function listJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(fullPath);
    return entry.name.endsWith(".js") ? [fullPath] : [];
  });
}

const violations = [];

for (const file of listJsFiles(root)) {
  const content = fs.readFileSync(file, "utf8");
  for (const token of forbidden) {
    if (content.includes(token)) {
      violations.push(`${path.relative(process.cwd(), file)} contains ${token}`);
    }
  }
}

if (violations.length > 0) {
  console.error("核心純函式層不可依賴瀏覽器或網路 API：");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("核心純函式層檢查通過。");
