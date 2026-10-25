# snow-app-plugins

My Snow App Plugin Collection.

## 目录结构

```text
plugins/<plugin>/...        # 插件源码（脚本插件为单文件 .user.js）
scripts/check-userscripts.mjs  # 用户脚本元数据 / 语法校验（CI 使用）
scripts/print-market-entry.mjs # 生成插件市场条目 JSON
.github/workflows/ci.yml       # push / PR 校验
.github/workflows/release.yml  # 推送 tag 时自动发布 Release
```

## 插件

| 插件 | 形态 | 说明 |
| --- | --- | --- |
| [护眼操 · 跟随光球](plugins/eye-care-ball/) | 客户端脚本 | 90 秒眼球运动：平滑追踪、快速扫视、远近调焦；提醒文字跟随光球，只动眼球不转脖子 |
| [界面指引 · 框架高亮](plugins/ui-guide/) | 客户端脚本 | 首次加载自动对界面框架做一次框形高亮巡览，说明卡上给出各区域的锚点 / 插槽名；顶栏「指引」按钮可重播 |

## 在插件市场里找到它

本仓库带了 GitHub 主题 [`snow-plugins`](https://github.com/topics/snow-plugins)，所以不用提交官方索引也能被客户端检索到：

- **插件市场 → 社区插件**：打开即列出主题下的全部仓库（含本仓库）；在搜索框输入关键词可进一步收窄，例如 `界面指引`、`护眼操`、`ui-guide`、`snow-app-plugins`（关键词匹配仓库名 / 描述 / README）。
- 社区通道的「安装」只认仓库根目录（或唯一顶层子目录）里的 `plugin.json`，装出来的是**面板插件**；本仓库是脚本合集，没有根目录 `plugin.json`，因此脚本请按下面的方式安装：
  - 插件 → 插件列表 → 脚本插件 → **导入文件**（选 `plugins/<plugin>/<plugin>.user.js`），或把 `.user.js` 的 https 直链粘进「从链接安装」；
  - 或从对应 tag 的 GitHub Release 附件下载后导入。
- [护眼操 · 跟随光球](plugins/eye-care-ball/) 另有官方索引条目（`kind: "script"`），可在 **插件市场 → 脚本插件** 一键安装与更新。

## 本地校验

```bash
node scripts/check-userscripts.mjs
```

校验内容：`// ==UserScript==` 元数据头、`@name` / `@version`、`@snow-target` 取值，以及每个脚本的 JavaScript 语法。

## 发布流程

1. 更新脚本头部的 `@version`；
2. 提交并推送 `main`；
3. 打 tag 并推送（tag 格式 `<plugin>/v<version>`，版本必须与 `@version` 一致）：

   ```bash
   git tag eye-care-ball/v1.0.0
   git push origin main --tags
   ```

4. `.github/workflows/release.yml` 会自动：
   - 校验脚本；
   - 创建 GitHub Release，把 `eye-care-ball.user.js` 作为资产上传；
   - 在 Actions 的 job summary 里输出带 SHA-256 的市场条目 JSON。

5. 把条目提交到 [snow-plugin-store](https://github.com/MayDay-wpf/snow-plugin-store) 的 `app/plugins/snow.eye-care-ball.json`，合并后客户端刷新插件市场即可安装。

也可以本地生成条目：

```bash
node scripts/print-market-entry.mjs 1.0.0 <sha256>
```

## 安装（本地）

插件 → 插件列表 → 脚本插件 → 导入文件，选择对应的 `.user.js`。
