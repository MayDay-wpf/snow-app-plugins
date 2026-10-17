#!/usr/bin/env node
// 校验 plugins/ 下的全部用户脚本：元数据头、必填字段与 JavaScript 语法。
// 本地：node scripts/check-userscripts.mjs
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginsDir = join(repoRoot, "plugins");

const VALID_TARGETS = new Set(["client", "browser", "all"]);

/** 递归收集 .user.js，跳过 node_modules 与隐藏目录。 */
function collectScripts(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectScripts(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".user.js")) {
      files.push(fullPath);
    }
  }
  return files;
}

function readField(header, name) {
  const match = header.match(new RegExp(`^//\\s*@${name}\\s+(.+)$`, "m"));
  return match ? match[1].trim() : "";
}

const files = collectScripts(pluginsDir).sort();
const errors = [];

if (files.length === 0) {
  errors.push("plugins/: no .user.js files found");
}

for (const file of files) {
  const label = relative(repoRoot, file).split("\\").join("/");
  const source = readFileSync(file, "utf8");

  const start = source.indexOf("// ==UserScript==");
  const end = source.indexOf("// ==/UserScript==");
  if (start === -1 || end === -1 || end <= start) {
    errors.push(`${label}: missing // ==UserScript== ... // ==/UserScript== header`);
    continue;
  }

  const header = source.slice(start, end);
  const name = readField(header, "name");
  const version = readField(header, "version");
  const target = readField(header, "snow-target");

  if (!name) errors.push(`${label}: missing @name`);
  if (!version) errors.push(`${label}: missing @version`);
  if (target && !VALID_TARGETS.has(target)) {
    errors.push(`${label}: @snow-target must be one of client | browser | all (got "${target}")`);
  }

  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    const detail = (error.stderr || error.stdout || "").toString().trim();
    errors.push(`${label}: JavaScript syntax error${detail ? `\n${detail}` : ""}`);
  }

  const tags = [name, version && `v${version}`, target && `[${target}]`].filter(Boolean).join("  ");
  console.log(`✓ ${label}  ${tags}`);
}

if (errors.length > 0) {
  console.error("\nUserscript checks failed:");
  for (const message of errors) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`\nAll ${files.length} userscript(s) OK.`);
