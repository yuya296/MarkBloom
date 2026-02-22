import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, "packages");
const DYNAMIC_TRIGGER_PATTERNS = [
  /\brequestMeasure\s*\(/u,
  /\brequestEditorMeasure\s*\(/u,
  /\bResizeObserver\s*\(/u,
];

function listSourceFiles() {
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!absolutePath.endsWith(".ts") && !absolutePath.endsWith(".tsx")) {
        continue;
      }
      files.push(path.relative(ROOT, absolutePath));
    }
  };
  visit(PACKAGES_DIR);
  return files;
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content[i] === "\n") {
      line += 1;
    }
  }
  return line;
}

function resolveMeasureMode(content, classIndex) {
  const lookback = content.slice(Math.max(0, classIndex - 500), classIndex);
  const matches = [...lookback.matchAll(/cm-widget-measure:\s*(dynamic|static)/gu)];
  if (matches.length === 0) {
    return null;
  }
  return matches[matches.length - 1][1];
}

function hasDynamicTrigger(content) {
  return DYNAMIC_TRIGGER_PATTERNS.some((pattern) => pattern.test(content));
}

function classContentSlice(content, classStartIndex) {
  const nextClassPattern = /class\s+[A-Za-z0-9_]+\s+extends\s+WidgetType\b/gu;
  nextClassPattern.lastIndex = classStartIndex + 1;
  const nextMatch = nextClassPattern.exec(content);
  const endIndex = nextMatch?.index ?? content.length;
  return content.slice(classStartIndex, endIndex);
}

function main() {
  const files = listSourceFiles();
  const issues = [];

  for (const file of files) {
    const fullPath = path.join(ROOT, file);
    const content = readFileSync(fullPath, "utf8");
    const classPattern = /class\s+([A-Za-z0-9_]+)\s+extends\s+WidgetType\b/gu;

    for (const match of content.matchAll(classPattern)) {
      const className = match[1];
      const classIndex = match.index ?? 0;
      const line = lineNumberAt(content, classIndex);
      const mode = resolveMeasureMode(content, classIndex);

      if (!mode) {
        issues.push(
          `${file}:${line} ${className} is missing "cm-widget-measure: static|dynamic" declaration`
        );
        continue;
      }

      const classBody = classContentSlice(content, classIndex);
      if (mode === "dynamic" && !hasDynamicTrigger(classBody)) {
        issues.push(
          `${file}:${line} ${className} is declared dynamic but no measure trigger was found (requestMeasure / requestEditorMeasure / ResizeObserver)`
        );
      }
    }
  }

  if (issues.length > 0) {
    console.error("Widget measure contract check failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("Widget measure contract check passed.");
}

main();
