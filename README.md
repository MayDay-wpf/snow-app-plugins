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
