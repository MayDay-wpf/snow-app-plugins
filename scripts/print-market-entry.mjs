#!/usr/bin/env node
// 生成插件市场条目（snow-plugin-store: app/plugins/snow.eye-care-ball.json 的内容）。
// 用法：node scripts/print-market-entry.mjs [version] [sha256]
// 也支持环境变量 VERSION / SHA256（CI 使用）。
const version = (process.env.VERSION || process.argv[2] || "0.0.0").trim();
const sha256 = (process.env.SHA256 || process.argv[3] || "0".repeat(64)).trim().toLowerCase();

if (!/^\d+\.\d+\.\d+([-.+][0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Invalid version: ${version}`);
  process.exit(1);
}
if (!/^[0-9a-f]{64}$/.test(sha256)) {
  console.error(`Invalid sha256: ${sha256}`);
  process.exit(1);
}

const entry = {
  kind: "script",
  id: "snow.eye-care-ball",
  name: {
    default: "Eye Care Ball · Follow the Light",
    "zh-CN": "护眼操 · 跟随光球",
    "zh-TW": "護眼操 · 跟隨光球",
  },
  description: {
    default:
      "90-second eye workout: follow a glowing ball for smooth pursuit, saccades and near–far focus to relax the ciliary muscle. Reminder text travels with the ball — move your eyes, not your neck. Entry: the “Eye care” button on the right of the top bar.",
    "zh-CN":
      "90 秒护眼操：眼球跟随光球做平滑追踪、快速扫视与远近调焦，锻炼并放松睫状肌。提醒文字贴着光球移动 —— 只动眼球，不转脖子。入口：顶栏右侧的「护眼操」按钮。",
    "zh-TW":
      "90 秒護眼操：眼球跟隨光球做平滑追蹤、快速掃視與遠近調焦，鍛鍊並放鬆睫狀肌。提醒文字貼著光球移動 —— 只動眼球，不轉脖子。入口：頂欄右側的「護眼操」按鈕。",
  },
  author: "MayDay-wpf",
  repo: "https://github.com/MayDay-wpf/snow-app-plugins",
  version,
  tag: `eye-care-ball/v${version}`,
  asset: "eye-care-ball.user.js",
  sha256,
  tags: ["client-script", "eye-care", "health", "focus"],
  icon: "lucide:Eye",
};

process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
