// ==UserScript==
// @name         界面指引 · 框架高亮
// @namespace    snow-app-plugins
// @version      1.0.0
// @description  首次加载时对界面框架做一次高亮巡览：用框形描边 + 说明卡依次指出应用外壳、顶栏、侧栏、主内容区、聊天输入区与右栏的位置与作用，并在卡片上给出对应的 data-snow-anchor 锚点与 data-snow-slot 插槽名。看过一次不再打扰，可从顶栏「指引」按钮或脚本菜单命令重播。
// @author       Snow
// @icon         lucide:SquareDashedMousePointer
// @snow-target  client
// @snow-view    *
// @snow-scope   global
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  "use strict";

  /* =========================================================================
   * 0. 常量
   * ========================================================================= */

  var STORE_SEEN = "uig.seen.v1";
  var MAX_WAIT_TRIES = 40; // 等待界面就绪：40 × 250ms ≈ 10s
  var AUTO_START_DELAY = 900;
  var GUARD_INTERVAL = 2500;
  var BOX_PAD = 6;

  var GUIDE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8"/><path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8"/>' +
    '<path d="M21 16v2.5A2.5 2.5 0 0 1 18.5 21H16"/><path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16"/>' +
    '<path d="M9.6 9.6h4.8v4.8H9.6z"/></svg>';

  // 巡览顺序：只依赖稳定的 data-snow-anchor 钩子；缺失或不可见的区域自动跳过
  var STEPS = [
    {
      anchor: "app.root",
      title: "stepRootTitle",
      desc: "stepRootDesc",
      tags: ['data-snow-anchor="app.root"'],
    },
    {
      anchor: "topbar",
      title: "stepTopbarTitle",
      desc: "stepTopbarDesc",
      tags: ['data-snow-anchor="topbar"', 'data-snow-slot="topbar.actions"'],
    },
    {
      anchor: "sidebar",
      title: "stepSidebarTitle",
      desc: "stepSidebarDesc",
      tags: ['data-snow-anchor="sidebar.nav"', 'data-snow-anchor="sidebar.footer"'],
    },
    {
      anchor: "main.view",
      title: "stepMainTitle",
      desc: "stepMainDesc",
      tags: ['data-snow-anchor="main.view"', 'data-snow-view="<view>"'],
    },
    {
      anchor: "chat.input",
      title: "stepInputTitle",
      desc: "stepInputDesc",
      tags: ['data-snow-anchor="chat.input"', 'data-snow-slot="chat.input.actions"'],
    },
    {
      anchor: "rightPanel",
      title: "stepRightTitle",
      desc: "stepRightDesc",
      tags: ['data-snow-anchor="rightPanel"', 'data-snow-anchor="rightPanel.content"'],
    },
  ];

  /* =========================================================================
   * 1. 文案（跟随界面语言）
   * ========================================================================= */

  var CURRENT_LOCALE = (function () {
    try {
      if (typeof snow !== "undefined" && snow.context && snow.context.locale) {
        return String(snow.context.locale);
      }
    } catch (_) {}
    try {
      return String(navigator.language || "zh-CN");
    } catch (_) {
      return "zh-CN";
    }
  })();

  var COPY = {
    "zh-CN": {
      stepRootTitle: "应用框架",
      stepRootDesc:
        "这是 Snow 的整个窗口外壳：顶栏、侧栏、主内容区与右栏都装在里面。下面用框形描边依次指出每个区域的位置与作用。",
      stepTopbarTitle: "顶栏 Topbar",
      stepTopbarDesc:
        "窗口顶部：项目 / 工作区切换、全局搜索、主题与窗口控制都在这里。插件按钮挂到右侧的 topbar.actions 插槽。",
      stepSidebarTitle: "侧栏 Sidebar",
      stepSidebarDesc:
        "左侧导航：上半部分 sidebar.nav 是功能入口（聊天、团队、备忘、插件、设置…），底部 sidebar.footer 放设置与账户入口。",
      stepMainTitle: "主内容区 Main",
      stepMainDesc:
        "当前视图「{{view}}」的主体内容。脚本的 @snow-view 就是按这里的视图 id 匹配的。",
      stepInputTitle: "聊天输入区",
      stepInputDesc:
        "输入消息、切换模型、添加附件的地方；插件可以往 chat.input.actions 插槽追加按钮。",
      stepRightTitle: "右栏 Right panel",
      stepRightDesc:
        "右侧面板：文件、终端、变更等标签页（rightPanel.tabs）与内容区（rightPanel.content），可拖动宽度或收起。",
      cardStep: "第 {{index}} / {{total}} 步",
      cardHint: "Enter 下一步 · ← → 切换 · Esc 退出",
      cardNext: "下一步",
      cardPrev: "上一步",
      cardDone: "完成",
      cardSkip: "跳过指引",
      copyHint: "点击复制",
      copied: "已复制",
      launcherTitle: "界面指引：重新巡览界面框架",
      launcherLabel: "指引",
      menuStart: "重新播放界面指引",
    },
    en: {
      stepRootTitle: "App shell",
      stepRootDesc:
        "The whole Snow window: top bar, sidebar, main content and right panel all live inside. The next boxes point out each region and what it does.",
      stepTopbarTitle: "Top bar",
      stepTopbarDesc:
        "Top of the window: project / workspace switch, global search, theme and window controls. Plugins mount buttons into the topbar.actions slot.",
      stepSidebarTitle: "Sidebar",
      stepSidebarDesc:
        "Left navigation: sidebar.nav holds the feature entries (chat, team, memo, plugins, settings…), sidebar.footer holds settings and account.",
      stepMainTitle: "Main content",
      stepMainDesc:
        "Body of the current view “{{view}}”. A script's @snow-view matches this view id.",
      stepInputTitle: "Chat input",
      stepInputDesc:
        "Where messages are typed, the model is switched and files attached; plugins append buttons to chat.input.actions.",
      stepRightTitle: "Right panel",
      stepRightDesc:
        "Right side: tabs for files, terminal and changes (rightPanel.tabs) plus their content (rightPanel.content); drag to resize or collapse.",
      cardStep: "Step {{index}} / {{total}}",
      cardHint: "Enter next · ← → move · Esc exit",
      cardNext: "Next",
      cardPrev: "Back",
      cardDone: "Done",
      cardSkip: "Skip guide",
      copyHint: "Click to copy",
      copied: "Copied",
      launcherTitle: "UI guide: replay the interface tour",
      launcherLabel: "Guide",
      menuStart: "Replay UI guide",
    },
  };

  var DICT = /^zh/i.test(CURRENT_LOCALE) ? COPY["zh-CN"] : COPY.en;

  function t(key, values) {
    var raw = DICT[key];
    var text = typeof raw === "string" ? raw : key;
    return text.replace(/\{\{(\w+)\}\}/g, function (_m, name) {
      return values && Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : "";
    });
  }

  /* =========================================================================
   * 2. 基础工具
   * ========================================================================= */

  function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function addStyle(css) {
    try {
      if (typeof GM_addStyle === "function") {
        GM_addStyle(css);
        return;
      }
    } catch (_) {}
    var style = document.createElement("style");
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function gmGet(key, fallback) {
    try {
      if (typeof GM_getValue === "function") {
        var value = GM_getValue(key);
        return value === undefined || value === null ? fallback : value;
      }
    } catch (_) {}
    try {
      var raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (_) {
      return fallback;
    }
  }

  function gmSet(key, value) {
    try {
      if (typeof GM_setValue === "function") {
        GM_setValue(key, value);
        return;
      }
    } catch (_) {}
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {}
  }

  function copyText(text) {
    try {
      if (typeof GM_setClipboard === "function") {
        GM_setClipboard(text);
        return true;
      }
    } catch (_) {}
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      (document.body || document.documentElement).appendChild(area);
      area.select();
      var ok = document.execCommand("copy");
      if (area.parentNode) area.parentNode.removeChild(area);
      return ok;
    } catch (_) {
      return false;
    }
  }

  function resolveAnchor(name) {
    try {
      return document.querySelector('[data-snow-anchor="' + name + '"]');
    } catch (_) {
      return null;
    }
  }

  function viewLabel() {
    try {
      if (typeof snow !== "undefined" && snow.context && snow.context.view) {
        return String(snow.context.view);
      }
    } catch (_) {}
    var view = resolveAnchor("main.view");
    var attr = view ? view.getAttribute("data-snow-view") : "";
    return attr || "chat";
  }

  /* =========================================================================
   * 3. 运行时状态
   * ========================================================================= */

  var state = {
    active: false,
    index: 0,
    steps: [],
    rafId: 0,
    layer: null,
    box: null,
    chip: null,
    card: null,
    fill: null,
    counterEl: null,
    titleEl: null,
    descEl: null,
    tagsEl: null,
    prevBtn: null,
    nextBtn: null,
    skipBtn: null,
    keyBound: false,
  };

  var launcher = null;
  var guardTimer = 0;

  /* =========================================================================
   * 4. 巡览流程
   * ========================================================================= */

  function resolveStepEl(step) {
    if (step.el && step.el.isConnected) return step.el;
    var found = resolveAnchor(step.anchor);
    step.el = found || null;
    return step.el;
  }

  function collectSteps() {
    var list = [];
    STEPS.forEach(function (step) {
      var node = resolveAnchor(step.anchor);
      if (!node) return;
      var rect = node.getBoundingClientRect();
      if (rect.width < 24 || rect.height < 16) return;
      list.push({
        anchor: step.anchor,
        title: step.title,
        desc: step.desc,
        tags: step.tags,
        el: node,
      });
    });
    return list;
  }

  function startTour() {
    if (state.active) return false;
    var steps = collectSteps();
    if (!steps.length) return false;
    state.steps = steps;
    state.index = 0;
    state.active = true;
    buildLayer();
    if (!state.keyBound) {
      window.addEventListener("keydown", onKeyDown, true);
      state.keyBound = true;
    }
    render();
    startLoop();
    return true;
  }

  function finishTour() {
    gmSet(STORE_SEEN, "1");
    endTour();
  }

  function endTour() {
    state.active = false;
    stopLoop();
    if (state.keyBound) {
      window.removeEventListener("keydown", onKeyDown, true);
      state.keyBound = false;
    }
    if (state.layer && state.layer.parentNode) state.layer.parentNode.removeChild(state.layer);
    state.layer = null;
    state.box = null;
    state.chip = null;
    state.card = null;
    state.fill = null;
    state.counterEl = null;
    state.titleEl = null;
    state.descEl = null;
    state.tagsEl = null;
    state.prevBtn = null;
    state.nextBtn = null;
    state.skipBtn = null;
    state.steps = [];
    state.index = 0;
  }

  function go(delta) {
    if (!state.active) return;
    var target = state.index + delta;
    if (target < 0) target = 0;
    if (target >= state.steps.length) {
      finishTour();
      return;
    }
    state.index = target;
    render();
  }

  // 当前区域消失（视图切换、面板收起）时跳到下一个仍然存在的区域
  function advance() {
    var i = state.index + 1;
    while (i < state.steps.length) {
      if (resolveStepEl(state.steps[i])) {
        state.index = i;
        render();
        return;
      }
      i += 1;
    }
    finishTour();
  }

  function onKeyDown(event) {
    if (!state.active) return;
    var key = event.key;
    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishTour();
      return;
    }
    if (key === "Enter" || key === "ArrowRight" || key === " ") {
      event.preventDefault();
      event.stopPropagation();
      go(1);
      return;
    }
    if (key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      go(-1);
    }
  }

  /* =========================================================================
   * 5. 覆盖层
   * ========================================================================= */

  function buildLayer() {
    var layer = el("div", "uig-layer");
    var box = el("div", "uig-box");
    var chip = el("div", "uig-chip");

    var card = el("div", "uig-card");

    var bar = el("div", "uig-bar");
    var fill = el("div", "uig-bar-fill");
    bar.append(fill);

    var meta = el("div", "uig-meta");
    var counterEl = el("span", "uig-counter", "");
    meta.append(counterEl, el("span", "uig-hint", t("cardHint")));

    var titleEl = el("div", "uig-title", "");
    var descEl = el("div", "uig-desc", "");
    var tagsEl = el("div", "uig-tags");

    var actions = el("div", "uig-actions");
    var prevBtn = el("button", "uig-btn uig-btn-ghost", t("cardPrev"));
    prevBtn.type = "button";
    var nextBtn = el("button", "uig-btn uig-btn-primary", t("cardNext"));
    nextBtn.type = "button";
    var skipBtn = el("button", "uig-skip", t("cardSkip"));
    skipBtn.type = "button";
    actions.append(prevBtn, nextBtn, skipBtn);

    card.append(bar, meta, titleEl, descEl, tagsEl, actions);

    prevBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      go(-1);
    });
    nextBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      go(1);
    });
    skipBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      finishTour();
    });
    card.addEventListener("click", function (event) {
      event.stopPropagation();
    });
    // 点暗区任意位置 = 下一步
    layer.addEventListener("click", function () {
      go(1);
    });

    layer.append(box, chip, card);
    (document.body || document.documentElement).appendChild(layer);

    state.layer = layer;
    state.box = box;
    state.chip = chip;
    state.card = card;
    state.fill = fill;
    state.counterEl = counterEl;
    state.titleEl = titleEl;
    state.descEl = descEl;
    state.tagsEl = tagsEl;
    state.prevBtn = prevBtn;
    state.nextBtn = nextBtn;
    state.skipBtn = skipBtn;
  }

  function renderTags(step) {
    var wrap = state.tagsEl;
    if (!wrap) return;
    wrap.replaceChildren();
    (step.tags || []).forEach(function (tag) {
      var chip = el("button", "uig-tag", tag);
      chip.type = "button";
      chip.title = t("copyHint");
      chip.addEventListener("click", function (event) {
        event.stopPropagation();
        if (!copyText(tag)) return;
        chip.textContent = t("copied");
        chip.classList.add("is-copied");
        window.setTimeout(function () {
          if (!chip.isConnected) return;
          chip.textContent = tag;
          chip.classList.remove("is-copied");
        }, 1200);
      });
      wrap.append(chip);
    });
  }

  function render() {
    if (!state.active) return;
    var step = state.steps[state.index];
    if (!step) {
      finishTour();
      return;
    }
    if (!resolveStepEl(step)) {
      advance();
      return;
    }

    state.chip.textContent = t(step.title);
    state.counterEl.textContent = t("cardStep", {
      index: state.index + 1,
      total: state.steps.length,
    });
    state.titleEl.textContent = t(step.title);
    state.descEl.textContent = t(step.desc, { view: viewLabel() });
    renderTags(step);
    state.fill.style.width = (((state.index + 1) / state.steps.length) * 100).toFixed(2) + "%";
    state.prevBtn.disabled = state.index === 0;
    state.nextBtn.textContent =
      state.index === state.steps.length - 1 ? t("cardDone") : t("cardNext");

    layout();
  }

  /* =========================================================================
   * 6. 跟随布局（每帧对齐当前区域的真实位置）
   * ========================================================================= */

  function layout() {
    if (!state.active) return;
    var step = state.steps[state.index];
    if (!step) return;
    var node = resolveStepEl(step);
    if (!node) {
      advance();
      return;
    }

    var rect = node.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;

    var left = clamp(rect.left - BOX_PAD, 0, vw);
    var top = clamp(rect.top - BOX_PAD, 0, vh);
    var width = clamp(rect.width + BOX_PAD * 2, 0, vw - left);
    var height = clamp(rect.height + BOX_PAD * 2, 0, vh - top);

    // 覆盖整个窗口（应用外壳）时向内收一点，让描边完整可见
    if (width >= vw - 4) {
      left = 8;
      width = Math.max(40, vw - 16);
    }
    if (height >= vh - 4) {
      top = 8;
      height = Math.max(40, vh - 16);
    }

    var box = state.box;
    box.style.left = Math.round(left) + "px";
    box.style.top = Math.round(top) + "px";
    box.style.width = Math.round(width) + "px";
    box.style.height = Math.round(height) + "px";

    var chip = state.chip;
    var chipW = chip.offsetWidth || 96;
    var chipH = chip.offsetHeight || 22;
    var chipTop = top - chipH - 6;
    if (chipTop < 6) chipTop = top + 6;
    chip.style.left = Math.round(clamp(left, 6, Math.max(6, vw - chipW - 6))) + "px";
    chip.style.top = Math.round(clamp(chipTop, 6, Math.max(6, vh - chipH - 6))) + "px";

    placeCard(rect, vw, vh);
  }

  function placeCard(rect, vw, vh) {
    var card = state.card;
    if (!card) return;
    var cw = card.offsetWidth || 330;
    var ch = card.offsetHeight || 190;
    var gap = 14;
    var top;
    if (rect.bottom + gap + ch <= vh - 10) top = rect.bottom + gap;
    else if (rect.top - gap - ch >= 10) top = rect.top - gap - ch;
    else top = clamp(rect.bottom + gap, 10, Math.max(10, vh - ch - 10));

    var left = clamp(rect.left + rect.width / 2 - cw / 2, 10, Math.max(10, vw - cw - 10));
    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";
  }

  function tick() {
    state.rafId = 0;
    if (!state.active) return;
    if (!document.hidden) layout();
    state.rafId = window.requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!state.rafId) state.rafId = window.requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (state.rafId) {
      window.cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  /* =========================================================================
   * 7. 入口（顶栏插槽按钮 + 脚本菜单命令）
   * ========================================================================= */

  function createLauncher() {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "uig-launch";
    button.title = t("launcherTitle");
    button.setAttribute("aria-label", t("launcherTitle"));
    button.innerHTML = GUIDE_SVG;
    button.appendChild(el("span", "uig-launch-text", t("launcherLabel")));
    button.addEventListener("click", function () {
      startTour();
    });
    return button;
  }

  function mountLauncher() {
    if (!document.body) return false;
    var slot = null;
    try {
      if (typeof snow !== "undefined" && typeof snow.slot === "function") {
        slot = snow.slot("topbar.actions");
      }
    } catch (_) {
      slot = null;
    }
    if (!slot) slot = document.querySelector('[data-snow-slot="topbar.actions"]');
    if (!slot) return false;

    if (!launcher) launcher = createLauncher();
    if (launcher.parentNode !== slot) slot.appendChild(launcher);
    return true;
  }

  function registerMenu() {
    try {
      if (typeof GM_registerMenuCommand === "function") {
        GM_registerMenuCommand(t("menuStart"), function () {
          startTour();
        });
      }
    } catch (_) {}
  }

  /* =========================================================================
   * 8. 启动与清理
   * ========================================================================= */

  // 首次加载自动巡览一次：等界面就绪；若这次等不到，下次启动再试
  function autoStart() {
    if (gmGet(STORE_SEEN, "") === "1") return;
    var tries = 0;
    (function wait() {
      tries += 1;
      if (!resolveAnchor("app.root") || !resolveAnchor("topbar")) {
        if (tries < MAX_WAIT_TRIES) window.setTimeout(wait, 250);
        return;
      }
      window.setTimeout(function () {
        if (gmGet(STORE_SEEN, "") === "1") return;
        startTour();
      }, AUTO_START_DELAY);
    })();
  }

  function unmount() {
    endTour();
    if (guardTimer) {
      window.clearInterval(guardTimer);
      guardTimer = 0;
    }
    if (launcher && launcher.parentNode) launcher.parentNode.removeChild(launcher);
    launcher = null;
  }

  function boot() {
    addStyle(CSS);
    mountLauncher();
    guardTimer = window.setInterval(mountLauncher, GUARD_INTERVAL);
    registerMenu();
    try {
      if (typeof snow !== "undefined" && typeof snow.onCleanup === "function") {
        snow.onCleanup(unmount);
      }
    } catch (_) {}
    autoStart();
  }

  /* =========================================================================
   * 9. 样式
   * ========================================================================= */

  var CSS = [
    ".uig-layer{position:fixed;inset:0;z-index:2147483100;overflow:hidden;",
    'font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;',
    "-webkit-font-smoothing:antialiased}",
    ".uig-layer *{box-sizing:border-box}",
    ".uig-box{position:fixed;left:0;top:0;width:0;height:0;border-radius:13px;",
    "border:1.6px solid rgba(127,240,212,.95);pointer-events:none;",
    "transition:left .34s cubic-bezier(.2,.8,.3,1),top .34s cubic-bezier(.2,.8,.3,1),",
    "width .34s cubic-bezier(.2,.8,.3,1),height .34s cubic-bezier(.2,.8,.3,1);",
    "box-shadow:0 0 0 9999px rgba(4,9,12,.62),0 0 0 1px rgba(127,240,212,.3),",
    "0 0 28px rgba(90,220,190,.35),inset 0 0 0 1px rgba(127,240,212,.14);",
    "animation:uig-pulse 2.6s ease-in-out infinite}",
    "@keyframes uig-pulse{0%,100%{border-color:rgba(127,240,212,.95)}50%{border-color:rgba(185,255,233,.5)}}",
    '.uig-box::before,.uig-box::after{content:"";position:absolute;width:20px;height:20px;',
    "border:2.4px solid #c8fff0;pointer-events:none}",
    ".uig-box::before{left:-3px;top:-3px;border-right:0;border-bottom:0;border-top-left-radius:13px}",
    ".uig-box::after{right:-3px;bottom:-3px;border-left:0;border-top:0;border-bottom-right-radius:13px}",
    ".uig-chip{position:fixed;padding:3px 9px;border-radius:7px;font-size:11.5px;font-weight:650;",
    "letter-spacing:.04em;white-space:nowrap;color:#06211d;pointer-events:none;",
    "background:linear-gradient(135deg,#8ff5dc,#4fd0b8);box-shadow:0 6px 18px rgba(0,0,0,.4);",
    "transition:left .34s cubic-bezier(.2,.8,.3,1),top .34s cubic-bezier(.2,.8,.3,1)}",
    ".uig-card{position:fixed;width:min(344px,calc(100vw - 24px));padding:15px 16px 13px;",
    "border-radius:15px;color:#e8faf5;pointer-events:auto;",
    "background:linear-gradient(180deg,rgba(22,42,48,.985) 0%,rgba(10,20,25,.99) 100%);",
    "border:1px solid rgba(120,226,204,.2);",
    "box-shadow:0 24px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05);",
    "animation:uig-card-in .26s cubic-bezier(.2,.8,.3,1) both}",
    "@keyframes uig-card-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}",
    ".uig-bar{height:3px;border-radius:999px;background:rgba(126,220,200,.16);overflow:hidden}",
    ".uig-bar-fill{height:100%;width:0;border-radius:inherit;",
    "background:linear-gradient(90deg,#45c9b0,#a9f7e0);transition:width .3s ease}",
    ".uig-meta{margin-top:9px;display:flex;align-items:center;justify-content:space-between;gap:8px;",
    "font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(150,220,205,.6)}",
    ".uig-counter{font-variant-numeric:tabular-nums;white-space:nowrap}",
    ".uig-hint{white-space:nowrap;opacity:.72}",
    ".uig-title{margin:7px 0 0;font-size:16.5px;font-weight:650;color:#f2fffb;line-height:1.35}",
    ".uig-desc{margin:6px 0 0;font-size:12.8px;line-height:1.62;color:rgba(190,226,219,.78)}",
    ".uig-tags{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}",
    ".uig-tag{padding:2px 8px;border-radius:6px;cursor:pointer;font-size:11px;",
    "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#9df3dc;",
    "background:rgba(90,220,190,.1);border:1px solid rgba(110,230,205,.22);",
    "transition:background .15s ease,color .15s ease}",
    ".uig-tag:hover{background:rgba(90,220,190,.2)}",
    ".uig-tag.is-copied{color:#06211d;background:linear-gradient(135deg,#8ff5dc,#4fd0b8);border-color:transparent}",
    ".uig-actions{margin-top:13px;display:flex;align-items:center;gap:8px}",
    ".uig-btn{height:32px;padding:0 14px;border:0;border-radius:9px;cursor:pointer;",
    "font-family:inherit;font-size:12.5px;font-weight:600;",
    "transition:transform .14s ease,filter .16s ease,background .16s ease}",
    ".uig-btn:active{transform:translateY(1px)}",
    ".uig-btn-primary{color:#06211d;background:linear-gradient(135deg,#7ff0d4,#3fc9b0)}",
    ".uig-btn-primary:hover{filter:brightness(1.06)}",
    ".uig-btn-ghost{color:rgba(220,246,240,.8);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}",
    ".uig-btn-ghost:hover{background:rgba(255,255,255,.09)}",
    ".uig-btn:disabled{opacity:.35;cursor:default;filter:none}",
    ".uig-skip{margin-left:auto;padding:4px 0;border:0;background:none;cursor:pointer;",
    "font-family:inherit;font-size:11.5px;color:rgba(150,200,190,.62);text-decoration:underline;",
    "text-underline-offset:3px}",
    ".uig-skip:hover{color:rgba(190,235,225,.9)}",
    ".uig-launch{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;padding:0 9px;",
    "border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;opacity:.78;",
    "font-family:inherit;transition:opacity .15s ease,background .15s ease}",
    ".uig-launch:hover{opacity:1;background:rgba(127,240,212,.14)}",
    ".uig-launch svg{width:16px;height:16px;flex:none}",
    ".uig-launch-text{font-size:12px;font-weight:500;letter-spacing:.02em;white-space:nowrap}",
  ].join("");

  boot();
})();
