// ==UserScript==
// @name         护眼操 · 跟随光球
// @namespace    snow-app-plugins
// @version      1.0.0
// @description  跟随光球做平滑追踪、快速扫视与远近调焦，锻炼并放松睫状肌；只动眼球，不转脖子。入口：顶栏右侧「护眼操」按钮（找不到时看右下角浮动按钮）。
// @author       Snow
// @icon         lucide:Eye
// @snow-target  client
// @snow-view    *
// @snow-scope   global
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  "use strict";

  /* =========================================================================
   * 0. 常量与时序
   * ========================================================================= */

  var TAU = Math.PI * 2;
  var STORE_STATS = "ecb.stats.v1";
  var STORE_ENTRY_HINT = "ecb.entryHint.v1";

  // 一套 90 秒的课程：准备 → 平滑追踪 → 快速扫视 → 远近调焦 → 远眺放松
  var TIMING = {
    prepare: 3200,
    pursuit: 24000,
    saccade: 14000,
    focusNear: 2400,
    focusFar: 2400,
    focusCycles: 6,
    rest: 20000,
  };
  var FOCUS_CYCLE = TIMING.focusNear + TIMING.focusFar;

  var STAGES = (function () {
    var list = [];
    var cursor = 0;
    function push(id, duration) {
      list.push({ id: id, start: cursor, end: cursor + duration, duration: duration });
      cursor += duration;
    }
    push("prepare", TIMING.prepare);
    push("pursuit", TIMING.pursuit);
    push("saccade", TIMING.saccade);
    push("focus", TIMING.focusCycles * FOCUS_CYCLE);
    push("rest", TIMING.rest);
    return list;
  })();
  var TOTAL_MS = STAGES[STAGES.length - 1].end;

  var STAGE_KEYS = {
    prepare: ["stagePrepare", "hintPrepare"],
    pursuit: ["stagePursuit", "hintPursuit"],
    saccade: ["stageSaccade", "hintSaccade"],
    focus: ["stageFocus", "hintFocusNear"],
    rest: ["stageRest", "hintRest"],
  };

  var EYE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2.3 12s3.6-6.6 9.7-6.6S21.7 12 21.7 12s-3.6 6.6-9.7 6.6S2.3 12 2.3 12Z"/>' +
    '<circle cx="12" cy="12" r="3.1"/></svg>';

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
      badge: "90 秒",
      startTitle: "护眼操 · 跟随光球",
      startSubtitle: "让眼球跟着光球走，锻炼并放松睫状肌。",
      b1Title: "只动眼球",
      b1Desc: "脖子、肩膀和头保持不动，只用视线去追光球。",
      b2Title: "平滑追踪",
      b2Desc: "视线黏住光球，慢慢地跟着它移动，不要跳跃。",
      b3Title: "远近调焦",
      b3Desc: "光球变大时看近处，变小时抬头越过屏幕看向远处。",
      b4Title: "随时可停",
      b4Desc: "按 Esc 暂停或退出；眼睛不适请立刻停止。",
      statsLine: "今日 {{today}} 次 · 连续 {{streak}} 天 · 累计 {{total}} 次",
      startBtn: "开始护眼操",
      laterBtn: "稍后",
      footnote: "佩戴眼镜或隐形眼镜时保持正常佩戴即可。有眼部疾病或明显不适，请遵医嘱。",
      stagePrepare: "准备",
      hintPrepare: "坐正，放松肩膀，把视线放在光球上",
      stagePursuit: "平滑追踪",
      hintPursuit: "视线跟着光球，头不要动",
      stageSaccade: "快速扫视",
      hintSaccade: "光球跳到哪，眼睛就看到哪，别转头",
      stageFocus: "远近调焦",
      hintFocusNear: "看近 · 光球正在变大",
      hintFocusFar: "看远 · 视线越过屏幕看向远处",
      stageRest: "远眺放松",
      hintRest: "看向 6 米外的物体，轻轻眨眼",
      posture: "只动眼球 · 别转脖子",
      pauseTitle: "已暂停",
      pauseDesc: "护眼操在等你，回来继续就好。",
      resumeBtn: "继续",
      quitBtn: "结束",
      doneTitle: "完成了！今日第 {{today}} 次",
      doneStreak: "已连续 {{streak}} 天，眼睛会感谢你的。",
      doneQuote: "睫状肌松下来了。去倒杯水，顺便看看远处。",
      againBtn: "再来一次",
      finishBtn: "完成",
      launcherTitle: "护眼操 · 跟随光球",
      launcherLabel: "护眼操",
      entryHint: "点这里开始护眼操 · 90 秒一组，眼球跟着光球走",
      entryTip: "下次从顶栏右侧的「护眼操」按钮进入（或右下角浮动按钮），按 Esc 可随时暂停。",
      menuStart: "开始护眼操",
      quotes: [
        "你的眼睛正在被好好照顾 ✨",
        "睫状肌正在放松，再坚持一下",
        "每一次平滑追踪，都是给眼睛的小按摩",
        "眨眼是最好的保湿，别忘了它",
        "屏幕之外，还有更值得看的东西",
        "做得好，头一直没有动 👍",
        "眼睛舒服了，思路才会清晰",
      ],
    },
    en: {
      badge: "90 SEC",
      startTitle: "Eye Workout · Follow the Light",
      startSubtitle: "Let your eyes chase the light and give your ciliary muscle a break.",
      b1Title: "Eyes only",
      b1Desc: "Keep your neck, shoulders and head still — move only your gaze.",
      b2Title: "Smooth pursuit",
      b2Desc: "Glue your gaze to the light and follow it slowly, without jumping.",
      b3Title: "Near–far focus",
      b3Desc: "When the light grows, look near. When it shrinks, look far across the room.",
      b4Title: "Stop anytime",
      b4Desc: "Press Esc to pause or quit. Stop right away if your eyes feel uncomfortable.",
      statsLine: "Today {{today}} · Streak {{streak}} d · Total {{total}}",
      startBtn: "Start workout",
      laterBtn: "Later",
      footnote: "Keep wearing your glasses or contacts as usual. Follow your doctor's advice if you have an eye condition.",
      stagePrepare: "Get ready",
      hintPrepare: "Sit tall, relax your shoulders, rest your gaze on the light.",
      stagePursuit: "Smooth pursuit",
      hintPursuit: "Follow the light slowly — keep your head still.",
      stageSaccade: "Saccades",
      hintSaccade: "Wherever the light jumps, your eyes go. Don't turn your head.",
      stageFocus: "Near–far focus",
      hintFocusNear: "Near · the light is growing",
      hintFocusFar: "Far · look past the screen",
      stageRest: "Look away",
      hintRest: "Focus on something 6 m away and blink gently.",
      posture: "Eyes only · no head turning",
      pauseTitle: "Paused",
      pauseDesc: "Your workout is waiting whenever you're ready.",
      resumeBtn: "Resume",
      quitBtn: "End",
      doneTitle: "Done! {{today}} today",
      doneStreak: "A {{streak}}-day streak — your eyes thank you.",
      doneQuote: "Your ciliary muscle just relaxed. Grab some water and look into the distance.",
      againBtn: "Again",
      finishBtn: "Done",
      launcherTitle: "Eye workout",
      launcherLabel: "Eye care",
      entryHint: "Start the eye workout here · 90 seconds, eyes follow the light",
      entryTip: "Next time use the “Eye care” button on the right of the top bar (or the floating button at bottom-right). Press Esc to pause.",
      menuStart: "Start eye workout",
      quotes: [
        "Your eyes are being taken care of ✨",
        "The ciliary muscle is letting go — keep going.",
        "Every smooth pursuit is a little massage for your eyes.",
        "Blinking is free moisture. Don't forget it.",
        "There is a whole world beyond the screen.",
        "Nice — your head stayed still 👍",
        "Comfortable eyes, clearer thinking.",
      ],
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

  /* =========================================================================
   * 3. 本地持久化（只存统计，不涉及任何应用数据）
   * ========================================================================= */

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

  function dayKey(date) {
    var d = date || new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + "-" + (m.length < 2 ? "0" + m : m) + "-" + (day.length < 2 ? "0" + day : day);
  }

  function previousDayKey() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return dayKey(d);
  }

  function normalizeStats(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var days = source.days && typeof source.days === "object" ? source.days : {};
    var cleanDays = {};
    Object.keys(days).forEach(function (key) {
      var count = days[key];
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && typeof count === "number" && isFinite(count) && count > 0) {
        cleanDays[key] = Math.floor(count);
      }
    });
    return {
      total: typeof source.total === "number" && isFinite(source.total) && source.total > 0 ? Math.floor(source.total) : 0,
      streak: typeof source.streak === "number" && isFinite(source.streak) && source.streak > 0 ? Math.floor(source.streak) : 0,
      lastDay: typeof source.lastDay === "string" ? source.lastDay : null,
      days: cleanDays,
    };
  }

  function readStats() {
    try {
      var raw = gmGet(STORE_STATS, "");
      if (!raw) return normalizeStats(null);
      if (typeof raw === "object") return normalizeStats(raw);
      return normalizeStats(JSON.parse(raw));
    } catch (_) {
      return normalizeStats(null);
    }
  }

  function writeStats(stats) {
    try {
      gmSet(STORE_STATS, JSON.stringify(stats));
    } catch (_) {}
  }

  function recordCompletion() {
    var stats = readStats();
    var today = dayKey();
    stats.days[today] = (stats.days[today] || 0) + 1;
    stats.total += 1;
    if (stats.lastDay !== today) {
      stats.streak = stats.lastDay === previousDayKey() ? stats.streak + 1 : 1;
      stats.lastDay = today;
    } else if (stats.streak < 1) {
      stats.streak = 1;
    }
    var keys = Object.keys(stats.days).sort();
    while (keys.length > 180) {
      delete stats.days[keys.shift()];
    }
    writeStats(stats);
    return stats;
  }

  /* =========================================================================
   * 4. 运行时状态
   * ========================================================================= */

  var viewport = { w: 0, h: 0, dpr: 1, cx: 0, cy: 0 };

  var root = null;
  var canvas = null;
  var ctx = null;
  var hud = null;
  var cardWrap = null;
  var stageNameEl = null;
  var followEl = null;
  var followHintEl = null;
  var followSize = { w: 180, h: 46 };
  var quoteEl = null;
  var meterFill = null;
  var timeEl = null;
  var stepEl = null;

  var launcher = null;
  var fab = null;
  var guardTimer = 0;
  var guardTicks = 0;

  var phase = "closed"; // closed | start | run | pause | done
  var elapsed = 0;
  var lastTs = 0;
  var rafId = 0;
  var lastHudKey = "";
  var lastQuoteIndex = -1;

  var trail = [];
  var ripples = [];
  var saccade = { targets: [], index: -1 };

  var resizeBound = false;
  var keyBound = false;
  var visibilityBound = false;

  /* =========================================================================
   * 5. 入口按钮（顶栏插槽，必要时回退为右下角浮动按钮）
   * ========================================================================= */

  function createLauncherButton() {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "ecb-launch";
    button.title = t("launcherTitle");
    button.setAttribute("aria-label", t("launcherTitle"));
    button.innerHTML = EYE_SVG;
    button.appendChild(el("span", "ecb-launch-text", t("launcherLabel")));
    button.addEventListener("click", openOverlay);
    return button;
  }

  function mountLauncher(useSnowApi) {
    if (!document.body) return false;
    var slot = null;
    if (useSnowApi) {
      try {
        if (typeof snow !== "undefined" && typeof snow.slot === "function") {
          slot = snow.slot("topbar.actions");
        }
      } catch (_) {
        slot = null;
      }
    }
    if (!slot) {
      slot = document.querySelector('[data-snow-slot="topbar.actions"]');
    }
    if (!slot) return false;

    if (!launcher) launcher = createLauncherButton();
    if (launcher.parentNode !== slot) slot.appendChild(launcher);

    if (fab) {
      if (fab.parentNode) fab.parentNode.removeChild(fab);
      fab = null;
    }
    scheduleEntryHint(launcher, "below");
    return true;
  }

  function createFab() {
    if (fab) return;
    fab = document.createElement("button");
    fab.type = "button";
    fab.className = "ecb-fab";
    fab.title = t("launcherTitle");
    fab.setAttribute("aria-label", t("launcherTitle"));
    fab.innerHTML = EYE_SVG;
    fab.appendChild(el("span", "ecb-fab-text", t("launcherLabel")));
    fab.addEventListener("click", openOverlay);
    (document.body || document.documentElement).appendChild(fab);
    scheduleEntryHint(fab, "above");
  }

  /* ---- 首次安装时的一次性定位气泡：直接告诉用户入口在哪 ---- */

  var entryHintEl = null;
  var entryHintTimer = 0;
  var hintScheduled = false;

  function scheduleEntryHint(anchorEl, placement) {
    if (hintScheduled) return;
    hintScheduled = true;
    window.setTimeout(function () {
      if (gmGet(STORE_ENTRY_HINT, "") === "1") return;
      if (root) {
        hintScheduled = false; // 用户已经自己找到入口了
        return;
      }
      showEntryHint(anchorEl, placement);
      if (!entryHintEl) hintScheduled = false;
    }, 1400);
  }

  function showEntryHint(anchorEl, placement) {
    if (!anchorEl || !anchorEl.isConnected || entryHintEl) return;
    if (gmGet(STORE_ENTRY_HINT, "") === "1") return;

    var rect = anchorEl.getBoundingClientRect();
    if (!rect.width) return;

    var hint = el("div", "ecb-entry-hint", t("entryHint"));
    if (placement === "above") hint.classList.add("is-above");
    (document.body || document.documentElement).appendChild(hint);
    entryHintEl = hint;

    var viewW = window.innerWidth || document.documentElement.clientWidth || 0;
    var width = hint.offsetWidth || 220;
    var height = hint.offsetHeight || 36;
    var left = clamp(rect.right - width, 12, Math.max(12, viewW - width - 12));
    var top = placement === "above" ? rect.top - height - 10 : rect.bottom + 10;
    hint.style.left = Math.round(left) + "px";
    hint.style.top = Math.round(top) + "px";

    gmSet(STORE_ENTRY_HINT, "1");
    entryHintTimer = window.setTimeout(removeEntryHint, 9000);
  }

  function removeEntryHint() {
    if (entryHintTimer) {
      window.clearTimeout(entryHintTimer);
      entryHintTimer = 0;
    }
    if (entryHintEl && entryHintEl.parentNode) entryHintEl.parentNode.removeChild(entryHintEl);
    entryHintEl = null;
  }

  function guardLauncher() {
    guardTicks += 1;
    if (mountLauncher(false)) return;
    // 顶栏插槽迟迟没出现时，给一个不打扰的浮动入口
    if (!fab && guardTicks >= 3) createFab();
  }

  function registerMenu() {
    try {
      if (typeof GM_registerMenuCommand === "function") {
        GM_registerMenuCommand(t("menuStart"), function () {
          openOverlay();
        });
      }
    } catch (_) {}
  }

  /* =========================================================================
   * 6. 覆盖层与课程流程
   * ========================================================================= */

  function openOverlay() {
    if (root) return;
    removeEntryHint();
    buildOverlay();
    phase = "start";
    showStartCard();
  }

  function buildOverlay() {
    root = el("div", "ecb-overlay");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");

    canvas = el("canvas", "ecb-canvas");
    ctx = canvas.getContext("2d");

    hud = el("div", "ecb-hud is-hidden");

    var top = el("div", "ecb-top");
    stageNameEl = el("div", "ecb-stage-name", "");
    top.append(stageNameEl);

    // 贴身提示：始终跟着光球走，用户不用把视线移到屏幕边缘
    followEl = el("div", "ecb-follow");
    var posture = el("div", "ecb-follow-posture");
    posture.append(el("span", "ecb-follow-dot"), el("span", "ecb-follow-posture-text", t("posture")));
    followHintEl = el("div", "ecb-follow-hint", "");
    followHintEl.setAttribute("aria-live", "polite");
    followEl.append(posture, followHintEl);

    var closeBtn = el("button", "ecb-close");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", t("quitBtn"));
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    closeBtn.addEventListener("click", onClosePressed);

    var bottom = el("div", "ecb-bottom");
    quoteEl = el("div", "ecb-quote", "");
    quoteEl.setAttribute("aria-live", "polite");
    var meter = el("div", "ecb-meter");
    meterFill = el("div", "ecb-meter-fill");
    meter.append(meterFill);
    var meta = el("div", "ecb-meta");
    timeEl = el("span", "ecb-time", "01:30");
    stepEl = el("span", "ecb-step", "");
    meta.append(timeEl, stepEl);
    bottom.append(quoteEl, meter, meta);

    hud.append(top, followEl, closeBtn, bottom);

    cardWrap = el("div", "ecb-card-wrap");

    root.append(canvas, hud, cardWrap);
    (document.body || document.documentElement).appendChild(root);

    bindEvents(true);
    resizeCanvas();

    try {
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
    } catch (_) {}
  }

  function closeOverlay() {
    stopRaf();
    bindEvents(false);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    canvas = null;
    ctx = null;
    hud = null;
    cardWrap = null;
    stageNameEl = null;
    followEl = null;
    followHintEl = null;
    quoteEl = null;
    meterFill = null;
    timeEl = null;
    stepEl = null;
    phase = "closed";
    elapsed = 0;
    lastTs = 0;
    lastHudKey = "";
    lastQuoteIndex = -1;
    trail.length = 0;
    ripples.length = 0;
    saccade.targets = [];
    saccade.index = -1;
  }

  function startRaf() {
    if (!rafId && (phase === "run" || phase === "pause")) {
      lastTs = 0;
      rafId = window.requestAnimationFrame(frame);
    }
  }

  function stopRaf() {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function beginExercise() {
    if (!root) return;
    elapsed = 0;
    lastTs = 0;
    lastHudKey = "";
    lastQuoteIndex = -1;
    trail.length = 0;
    ripples.length = 0;
    saccade.targets = buildSaccadeTargets(24);
    saccade.index = -1;
    phase = "run";
    hideCard();
    if (hud) hud.classList.remove("is-hidden");
    if (ctx) ctx.clearRect(0, 0, viewport.w, viewport.h);
    startRaf();
  }

  function pauseSession() {
    if (phase !== "run") return;
    phase = "pause";
    showPauseCard();
  }

  function resumeSession() {
    if (phase !== "pause") return;
    phase = "run";
    hideCard();
    startRaf();
  }

  function completeSession() {
    if (phase !== "run") return;
    phase = "done";
    stopRaf();
    if (ctx) ctx.clearRect(0, 0, viewport.w, viewport.h);
    if (hud) hud.classList.add("is-hidden");
    var stats = recordCompletion();
    showDoneCard(stats);
  }

  function onClosePressed() {
    if (phase === "run") {
      pauseSession();
      return;
    }
    closeOverlay();
  }

  /* =========================================================================
   * 7. 事件
   * ========================================================================= */

  function bindEvents(on) {
    if (on) {
      if (!resizeBound) {
        window.addEventListener("resize", resizeCanvas);
        resizeBound = true;
      }
      if (!keyBound) {
        window.addEventListener("keydown", onKeyDown, true);
        keyBound = true;
      }
      if (!visibilityBound) {
        document.addEventListener("visibilitychange", onVisibilityChange);
        visibilityBound = true;
      }
    } else {
      if (resizeBound) {
        window.removeEventListener("resize", resizeCanvas);
        resizeBound = false;
      }
      if (keyBound) {
        window.removeEventListener("keydown", onKeyDown, true);
        keyBound = false;
      }
      if (visibilityBound) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        visibilityBound = false;
      }
    }
  }

  function onKeyDown(event) {
    if (!root) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (phase === "run") pauseSession();
      else closeOverlay();
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "hidden" && phase === "run") pauseSession();
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    var w = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 0);
    var h = Math.max(320, window.innerHeight || document.documentElement.clientHeight || 0);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    viewport.w = w;
    viewport.h = h;
    viewport.dpr = dpr;
    viewport.cx = w / 2;
    viewport.cy = h / 2;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (saccade.targets.length) {
      saccade.targets = buildSaccadeTargets(24);
      saccade.index = -1;
    }

    measureFollow();
    if (phase === "run" || phase === "pause") renderScene(performance.now());
    else ctx.clearRect(0, 0, viewport.w, viewport.h);
  }

  /* =========================================================================
   * 8. 主循环
   * ========================================================================= */

  function frame(now) {
    rafId = 0;
    if (!root) return;
    if (!lastTs) lastTs = now;

    var dt = now - lastTs;
    lastTs = now;
    if (dt < 0) dt = 0;
    if (dt > 120) dt = 120; // 切后台回来时不要一次跳太多

    if (phase === "run") {
      elapsed += dt;
      if (elapsed >= TOTAL_MS) {
        elapsed = TOTAL_MS;
        renderScene(now);
        completeSession();
        return;
      }
    }

    if (phase === "run") updateHud();
    renderScene(now);

    if (phase === "run" || phase === "pause") {
      rafId = window.requestAnimationFrame(frame);
    }
  }

  function stageAt(ms) {
    for (var i = 0; i < STAGES.length; i++) {
      if (ms < STAGES[i].end) return { stage: STAGES[i], index: i };
    }
    return { stage: STAGES[STAGES.length - 1], index: STAGES.length - 1 };
  }

  /* =========================================================================
   * 9. 光球运动学
   * ========================================================================= */

  function makeRng(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function buildSaccadeTargets(count) {
    var rng = makeRng(0x5eed1234);
    var padX = Math.max(100, viewport.w * 0.16);
    var padY = Math.max(90, viewport.h * 0.17);
    var minX = padX;
    var maxX = Math.max(minX + 10, viewport.w - padX);
    var minY = padY;
    var maxY = Math.max(minY + 10, viewport.h - padY);

    var list = [];
    var previous = { x: viewport.cx, y: viewport.cy };

    for (var i = 0; i < count; i++) {
      var best = null;
      var bestDistance = -1;
      for (var k = 0; k < 10; k++) {
        var candidate = {
          x: minX + rng() * (maxX - minX),
          y: minY + rng() * (maxY - minY),
        };
        var distance = Math.hypot(candidate.x - previous.x, candidate.y - previous.y);
        if (distance > bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
      list.push(best);
      previous = best;
    }
    return list;
  }

  function computeBall(stage, local, now) {
    var cx = viewport.cx;
    var cy = viewport.cy;
    var x = cx;
    var y = cy;
    var scale = 1;
    var withTrail = true;
    var resetTrail = false;

    if (stage.id === "prepare") {
      var prepareProgress = clamp(local / stage.duration, 0, 1);
      var eased = 1 - Math.pow(1 - prepareProgress, 3);
      scale = 0.35 + 0.65 * eased + 0.03 * Math.sin(now / 360);
    } else if (stage.id === "pursuit") {
      // Gerono 双纽线：一个平滑的 ∞ 形，覆盖水平、垂直与斜向眼动
      var progress = clamp(local / stage.duration, 0, 1);
      var angle = progress * Math.PI * 4;
      var ampX = Math.min(viewport.w * 0.3, 430);
      var ampY = Math.min(viewport.h * 0.26, 270);
      x = cx + ampX * Math.cos(angle);
      y = cy + ampY * Math.sin(angle) * Math.cos(angle);
      scale = 1 + 0.05 * Math.sin(now / 520);
    } else if (stage.id === "saccade") {
      if (!saccade.targets.length) saccade.targets = buildSaccadeTargets(24);
      var hold = 900;
      var index = clamp(Math.floor(local / hold), 0, saccade.targets.length - 1);
      if (index !== saccade.index) {
        saccade.index = index;
        var target = saccade.targets[index];
        ripples.push({ x: target.x, y: target.y, at: now });
        resetTrail = true;
        withTrail = false;
      }
      var point = saccade.targets[index];
      var sinceJump = local - index * hold;
      x = point.x;
      y = point.y;
      scale = 1 + 0.32 * Math.exp(-sinceJump / 110);
    } else if (stage.id === "focus") {
      // 大小变化 = 近/远注视提示：变大看近处，变小抬头看远处
      var cycle = local % FOCUS_CYCLE;
      var isNear = cycle < TIMING.focusNear;
      var within = isNear ? cycle : cycle - TIMING.focusNear;
      var transition = clamp(within / 320, 0, 1);
      var smooth = transition * transition * (3 - 2 * transition);
      var fromScale = isNear ? 0.55 : 2.1;
      var toScale = isNear ? 2.1 : 0.55;
      scale = fromScale + (toScale - fromScale) * smooth;
      x = cx;
      y = cy;
      withTrail = false;
    } else if (stage.id === "rest") {
      scale = 0.5 + 0.05 * Math.sin(now / 760);
      x = cx;
      y = cy;
      withTrail = false;
    }

    return { x: x, y: y, scale: scale, trail: withTrail, reset: resetTrail };
  }

  /* =========================================================================
   * 10. 绘制
   * ========================================================================= */

  function measureFollow() {
    if (!followEl) return;
    var w = followEl.offsetWidth;
    var h = followEl.offsetHeight;
    if (w > 0) followSize.w = w;
    if (h > 0) followSize.h = h;
  }

  // 把提示贴到光球旁边：优先放下方，下方放不下就翻到上方，再按屏幕边界收一下
  function placeFollowLabel(ball) {
    if (!followEl) return;
    var w = followSize.w;
    var h = followSize.h;
    var core = 8 * ball.scale;
    var gap = core * 3.1 + 18;
    var safeBottom = viewport.h - 92;
    var top = ball.y + gap;

    if (top + h > safeBottom) {
      var above = ball.y - gap - h;
      top = above >= 62 ? above : Math.max(62, safeBottom - h);
    }

    var left = ball.x - w / 2;
    left = clamp(left, 16, Math.max(16, viewport.w - w - 16));
    top = clamp(top, 62, Math.max(62, viewport.h - h - 16));

    followEl.style.transform =
      "translate3d(" + Math.round(left) + "px," + Math.round(top) + "px,0)";
  }

  function renderScene(now) {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, viewport.w, viewport.h);
    if (phase !== "run" && phase !== "pause") return;

    var info = stageAt(elapsed);
    var stage = info.stage;
    var local = clamp(elapsed - stage.start, 0, stage.duration);
    var ball = computeBall(stage, local, now);

    if (ball.reset) trail.length = 0;

    if (ball.trail) {
      trail.push({ x: ball.x, y: ball.y, s: ball.scale, at: now });
      if (trail.length > 30) trail.splice(0, trail.length - 30);
    } else if (trail.length) {
      trail.length = 0;
    }

    ctx.globalCompositeOperation = "lighter";

    // 拖尾
    for (var i = 0; i < trail.length; i++) {
      var point = trail[i];
      var age = now - point.at;
      if (age > 360) continue;
      var fade = 1 - age / 360;
      ctx.beginPath();
      ctx.fillStyle = "rgba(120, 240, 210, " + (0.16 * fade).toFixed(3) + ")";
      ctx.arc(point.x, point.y, Math.max(0.5, 7 * point.s * fade), 0, TAU);
      ctx.fill();
    }

    // 扫视落点涟漪
    for (var r = ripples.length - 1; r >= 0; r--) {
      var ripple = ripples[r];
      var rippleAge = now - ripple.at;
      if (rippleAge > 620) {
        ripples.splice(r, 1);
        continue;
      }
      var k = rippleAge / 620;
      ctx.strokeStyle = "rgba(150, 255, 230, " + (0.34 * (1 - k)).toFixed(3) + ")";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, 14 + 70 * k, 0, TAU);
      ctx.stroke();
    }

    // 光晕
    var core = 8 * ball.scale;
    var halo = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, core * 8);
    halo.addColorStop(0, "rgba(222, 255, 246, 0.95)");
    halo.addColorStop(0.12, "rgba(150, 250, 220, 0.55)");
    halo.addColorStop(0.38, "rgba(80, 210, 190, 0.18)");
    halo.addColorStop(1, "rgba(40, 150, 160, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, core * 8, 0, TAU);
    ctx.fill();

    // 球体
    var body = ctx.createRadialGradient(
      ball.x - core * 0.3,
      ball.y - core * 0.3,
      core * 0.1,
      ball.x,
      ball.y,
      core,
    );
    body.addColorStop(0, "rgba(255, 255, 255, 1)");
    body.addColorStop(0.6, "rgba(192, 255, 238, 1)");
    body.addColorStop(1, "rgba(120, 235, 210, 0.9)");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, core, 0, TAU);
    ctx.fill();

    // 细环
    ctx.strokeStyle = "rgba(150, 255, 230, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, core * 3.1, 0, TAU);
    ctx.stroke();

    ctx.globalCompositeOperation = "source-over";

    placeFollowLabel(ball);
  }

  /* =========================================================================
   * 11. HUD
   * ========================================================================= */

  function updateHud() {
    if (!root) return;

    var info = stageAt(elapsed);
    var stage = info.stage;
    var hintKey = STAGE_KEYS[stage.id][1];

    if (stage.id === "focus") {
      var cycle = (elapsed - stage.start) % FOCUS_CYCLE;
      hintKey = cycle < TIMING.focusNear ? "hintFocusNear" : "hintFocusFar";
    }

    var hudKey = stage.id + ":" + hintKey;
    if (hudKey !== lastHudKey) {
      lastHudKey = hudKey;
      if (stageNameEl) stageNameEl.textContent = t(STAGE_KEYS[stage.id][0]);
      if (followHintEl) {
        followHintEl.textContent = t(hintKey);
        measureFollow();
      }
    }

    if (timeEl) {
      var left = Math.max(0, Math.ceil((TOTAL_MS - elapsed) / 1000));
      var minutes = String(Math.floor(left / 60));
      var seconds = String(left % 60);
      var label =
        (minutes.length < 2 ? "0" + minutes : minutes) + ":" + (seconds.length < 2 ? "0" + seconds : seconds);
      if (timeEl.textContent !== label) timeEl.textContent = label;
    }

    if (meterFill) {
      var ratio = clamp(elapsed / TOTAL_MS, 0, 1);
      meterFill.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
    }

    if (stepEl) {
      stepEl.textContent = info.index + 1 + " / " + STAGES.length;
    }

    if (quoteEl) {
      var quoteIndex = Math.floor(elapsed / 7000) % DICT.quotes.length;
      if (quoteIndex !== lastQuoteIndex) {
        lastQuoteIndex = quoteIndex;
        quoteEl.textContent = DICT.quotes[quoteIndex];
      }
    }
  }

  /* =========================================================================
   * 12. 卡片
   * ========================================================================= */

  function makeCard() {
    if (!cardWrap) return null;
    var card = el("div", "ecb-card");
    cardWrap.replaceChildren(card);
    cardWrap.classList.add("is-visible");
    return card;
  }

  function hideCard() {
    if (!cardWrap) return;
    cardWrap.classList.remove("is-visible");
    cardWrap.replaceChildren();
  }

  function makeButton(label, variant, onClick) {
    var button = el("button", "ecb-btn ecb-btn-" + variant, label);
    button.type = "button";
    button.addEventListener("click", onClick);
    return button;
  }

  function focusPrimary(card) {
    if (!card) return;
    var primary = card.querySelector(".ecb-btn-primary");
    if (!primary) return;
    window.setTimeout(function () {
      if (primary.isConnected) primary.focus();
    }, 30);
  }

  function showStartCard() {
    if (!cardWrap) return;
    if (hud) hud.classList.add("is-hidden");
    var card = makeCard();
    if (!card) return;
    var stats = readStats();
    var todayCount = stats.days[dayKey()] || 0;

    card.append(el("div", "ecb-badge", t("badge")));
    card.append(el("h1", "ecb-title", t("startTitle")));
    card.append(el("p", "ecb-subtitle", t("startSubtitle")));

    var list = el("ul", "ecb-bullets");
    var rows = [
      ["1", "b1Title", "b1Desc"],
      ["2", "b2Title", "b2Desc"],
      ["3", "b3Title", "b3Desc"],
      ["4", "b4Title", "b4Desc"],
    ];
    rows.forEach(function (row) {
      var item = el("li", "ecb-bullet");
      item.append(el("span", "ecb-num", row[0]));
      var body = el("div", "ecb-bullet-body");
      body.append(el("div", "ecb-bullet-title", t(row[1])));
      body.append(el("div", "ecb-bullet-desc", t(row[2])));
      item.append(body);
      list.append(item);
    });
    card.append(list);

    card.append(
      el(
        "div",
        "ecb-stats",
        t("statsLine", { today: todayCount, streak: stats.streak, total: stats.total }),
      ),
    );
    card.append(el("p", "ecb-entry-tip", t("entryTip")));

    var actions = el("div", "ecb-actions");
    actions.append(makeButton(t("startBtn"), "primary", beginExercise));
    actions.append(makeButton(t("laterBtn"), "ghost", closeOverlay));
    card.append(actions);
    card.append(el("p", "ecb-footnote", t("footnote")));

    focusPrimary(card);
  }

  function showPauseCard() {
    var card = makeCard();
    if (!card) return;

    card.append(el("h2", "ecb-title ecb-title-sm", t("pauseTitle")));
    card.append(el("p", "ecb-subtitle", t("pauseDesc")));

    var actions = el("div", "ecb-actions");
    actions.append(makeButton(t("resumeBtn"), "primary", resumeSession));
    actions.append(makeButton(t("quitBtn"), "ghost", closeOverlay));
    card.append(actions);

    focusPrimary(card);
  }

  function showDoneCard(stats) {
    var card = makeCard();
    if (!card) return;
    var todayCount = stats.days[dayKey()] || 0;

    card.append(el("div", "ecb-done-mark", "✓"));
    card.append(el("h2", "ecb-title ecb-title-sm", t("doneTitle", { today: todayCount })));
    card.append(el("p", "ecb-done-streak", t("doneStreak", { streak: stats.streak })));
    card.append(el("p", "ecb-subtitle", t("doneQuote")));

    var actions = el("div", "ecb-actions");
    actions.append(makeButton(t("againBtn"), "primary", beginExercise));
    actions.append(makeButton(t("finishBtn"), "ghost", closeOverlay));
    card.append(actions);

    focusPrimary(card);
  }

  /* =========================================================================
   * 13. 样式
   * ========================================================================= */

  var CSS = [
    ".ecb-overlay{position:fixed;inset:0;z-index:2147483000;overflow:hidden;color:#e8faf5;",
    "background:radial-gradient(120% 90% at 50% 44%,rgba(28,54,60,.94) 0%,rgba(11,22,27,.97) 42%,rgba(4,9,12,.99) 100%);",
    'font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;',
    "-webkit-font-smoothing:antialiased;user-select:none;animation:ecb-fade-in .26s ease both}",
    ".ecb-overlay *{box-sizing:border-box}",
    "@keyframes ecb-fade-in{from{opacity:0}to{opacity:1}}",
    ".ecb-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}",
    ".ecb-hud{position:absolute;inset:0;pointer-events:none;transition:opacity .25s ease}",
    ".ecb-hud.is-hidden{opacity:0}",
    ".ecb-top{position:absolute;top:24px;left:24px;right:24px;text-align:center}",
    ".ecb-stage-name{display:inline-block;font-size:11.5px;font-weight:600;letter-spacing:.24em;",
    "color:rgba(150,240,218,.55);text-transform:uppercase}",
    ".ecb-follow{position:absolute;left:0;top:0;max-width:min(300px,56vw);padding:9px 14px 10px;",
    "border-radius:13px;background:rgba(8,22,27,.66);border:1px solid rgba(127,240,212,.16);",
    "box-shadow:0 12px 34px rgba(0,0,0,.38);text-align:center;will-change:transform;pointer-events:none}",
    ".ecb-follow-posture{display:flex;align-items:center;justify-content:center;gap:6px;",
    "font-size:10.5px;letter-spacing:.1em;color:#ffd79a}",
    ".ecb-follow-dot{width:5px;height:5px;border-radius:50%;background:#ffc25c;",
    "box-shadow:0 0 8px rgba(255,194,92,.9);animation:ecb-pulse-dot 2.4s ease-in-out infinite}",
    ".ecb-follow-hint{margin-top:3px;font-size:13.5px;line-height:1.45;font-weight:550;color:rgba(236,253,248,.95)}",
    "@keyframes ecb-pulse-dot{0%,100%{opacity:.45;transform:scale(.85)}50%{opacity:1;transform:scale(1.1)}}",
    ".ecb-close{position:absolute;top:16px;right:18px;width:34px;height:34px;display:grid;place-items:center;",
    "border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.04);",
    "color:rgba(226,250,244,.65);cursor:pointer;pointer-events:auto;transition:background .16s ease,color .16s ease}",
    ".ecb-close:hover{background:rgba(255,255,255,.1);color:#fff}",
    ".ecb-close svg{width:16px;height:16px}",
    ".ecb-bottom{position:absolute;left:50%;bottom:30px;transform:translateX(-50%);",
    "width:min(560px,calc(100vw - 80px));text-align:center}",
    ".ecb-quote{min-height:22px;font-size:15px;line-height:1.5;color:rgba(206,240,232,.82);transition:opacity .3s ease}",
    ".ecb-meter{margin-top:18px;height:3px;border-radius:999px;background:rgba(126,220,200,.14);overflow:hidden}",
    ".ecb-meter-fill{width:100%;height:100%;border-radius:inherit;transform:scaleX(0);transform-origin:left center;",
    "background:linear-gradient(90deg,#45c9b0,#a9f7e0);box-shadow:0 0 12px rgba(120,240,210,.45)}",
    ".ecb-meta{margin-top:9px;display:flex;justify-content:space-between;font-size:11px;letter-spacing:.1em;",
    "color:rgba(150,205,195,.5);font-variant-numeric:tabular-nums}",
    ".ecb-card-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:28px;",
    "background:rgba(3,8,11,.42);opacity:0;pointer-events:none;transition:opacity .22s ease}",
    ".ecb-card-wrap.is-visible{opacity:1;pointer-events:auto}",
    ".ecb-card{width:min(492px,100%);max-height:calc(100vh - 64px);overflow:auto;padding:28px 30px 24px;",
    "border-radius:20px;background:linear-gradient(180deg,rgba(22,42,48,.97) 0%,rgba(11,22,27,.985) 100%);",
    "border:1px solid rgba(120,226,204,.16);",
    "box-shadow:0 32px 90px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);",
    "animation:ecb-card-in .26s cubic-bezier(.2,.8,.3,1) both}",
    "@keyframes ecb-card-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}",
    ".ecb-card::-webkit-scrollbar{width:6px}",
    ".ecb-card::-webkit-scrollbar-thumb{background:rgba(120,220,200,.2);border-radius:3px}",
    ".ecb-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:10px;letter-spacing:.18em;",
    "font-weight:600;color:#8ef0d6;background:rgba(90,220,190,.1);border:1px solid rgba(110,230,205,.22)}",
    ".ecb-title{margin:14px 0 0;font-size:23px;font-weight:650;letter-spacing:.01em;color:#f0fdfa;line-height:1.32}",
    ".ecb-title-sm{font-size:20px}",
    ".ecb-subtitle{margin:8px 0 0;font-size:13.5px;line-height:1.62;color:rgba(190,226,219,.72)}",
    ".ecb-bullets{list-style:none;margin:20px 0 0;padding:0;display:grid;gap:12px}",
    ".ecb-bullet{display:flex;gap:12px;align-items:flex-start}",
    ".ecb-num{flex:none;width:21px;height:21px;margin-top:1px;display:grid;place-items:center;border-radius:50%;",
    "font-size:11px;font-weight:600;color:#7ce8cd;background:rgba(90,220,190,.1);border:1px solid rgba(110,230,205,.2)}",
    ".ecb-bullet-title{font-size:13.5px;font-weight:600;color:rgba(235,252,248,.94)}",
    ".ecb-bullet-desc{margin-top:3px;font-size:12.5px;line-height:1.55;color:rgba(178,214,207,.66)}",
    ".ecb-stats{margin-top:20px;padding-top:16px;border-top:1px solid rgba(120,226,204,.1);",
    "font-size:12px;letter-spacing:.03em;color:rgba(150,220,205,.72);font-variant-numeric:tabular-nums}",
    ".ecb-entry-tip{margin:9px 0 0;font-size:11.5px;line-height:1.55;color:rgba(150,220,205,.58)}",
    ".ecb-actions{display:flex;gap:10px;margin-top:20px}",
    ".ecb-btn{flex:1 1 0;height:42px;border:0;border-radius:12px;cursor:pointer;font-size:13.5px;font-weight:600;",
    "font-family:inherit;letter-spacing:.02em;transition:transform .14s ease,filter .16s ease,background .16s ease}",
    ".ecb-btn:active{transform:translateY(1px)}",
    ".ecb-btn-primary{color:#06211d;background:linear-gradient(135deg,#7ff0d4,#3fc9b0);",
    "box-shadow:0 10px 28px rgba(70,210,180,.22)}",
    ".ecb-btn-primary:hover{filter:brightness(1.06)}",
    ".ecb-btn-ghost{flex:0 0 108px;color:rgba(220,246,240,.78);background:rgba(255,255,255,.045);",
    "border:1px solid rgba(255,255,255,.09)}",
    ".ecb-btn-ghost:hover{background:rgba(255,255,255,.08)}",
    ".ecb-footnote{margin:16px 0 0;font-size:11px;line-height:1.6;color:rgba(150,190,184,.48)}",
    ".ecb-done-mark{width:46px;height:46px;margin-bottom:16px;border-radius:50%;display:grid;place-items:center;",
    "font-size:21px;color:#06211d;background:linear-gradient(135deg,#7ff0d4,#3fc9b0);",
    "box-shadow:0 0 0 6px rgba(90,220,190,.09),0 10px 30px rgba(70,210,180,.25)}",
    ".ecb-done-streak{margin:6px 0 0;font-size:12.5px;color:#8ef0d6;letter-spacing:.02em}",
    ".ecb-launch{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;padding:0 9px;",
    "border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;opacity:.78;",
    "font-family:inherit;transition:opacity .15s ease,background .15s ease}",
    ".ecb-launch:hover{opacity:1;background:rgba(127,240,212,.14)}",
    ".ecb-launch svg{width:16px;height:16px;flex:none}",
    ".ecb-launch-text{font-size:12px;font-weight:500;letter-spacing:.02em;white-space:nowrap}",
    ".ecb-fab{position:fixed;right:18px;bottom:20px;z-index:900;height:38px;padding:0 14px 0 12px;",
    "display:inline-flex;align-items:center;gap:7px;border-radius:999px;border:1px solid rgba(127,240,212,.28);",
    "background:rgba(16,34,38,.82);color:#9df3dc;cursor:pointer;box-shadow:0 8px 26px rgba(0,0,0,.35);",
    "font-family:inherit;backdrop-filter:blur(8px);opacity:.72;transition:opacity .18s ease,transform .18s ease}",
    ".ecb-fab:hover{opacity:1;transform:translateY(-1px)}",
    ".ecb-fab svg{width:18px;height:18px;flex:none}",
    ".ecb-fab-text{font-size:12px;font-weight:500;letter-spacing:.02em;white-space:nowrap}",
    ".ecb-entry-hint{position:fixed;z-index:2147482000;padding:8px 12px;border-radius:10px;",
    "background:rgba(18,40,44,.96);border:1px solid rgba(127,240,212,.3);color:#d8f8ef;",
    "font-size:12px;line-height:1.5;box-shadow:0 12px 34px rgba(0,0,0,.45);pointer-events:none;",
    "animation:ecb-hint-in .3s ease both}",
    ".ecb-entry-hint::after{content:\"\";position:absolute;top:-5px;right:22px;width:8px;height:8px;",
    "background:rgba(18,40,44,.96);border-left:1px solid rgba(127,240,212,.3);",
    "border-top:1px solid rgba(127,240,212,.3);transform:rotate(45deg)}",
    "@keyframes ecb-hint-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}",
    ".ecb-entry-hint.is-above::after{top:auto;bottom:-5px;transform:rotate(225deg)}",
    "@media (max-width:560px){.ecb-card{padding:22px 20px 18px}.ecb-title{font-size:20px}",
    ".ecb-bottom{bottom:22px;width:calc(100vw - 40px)}.ecb-btn-ghost{flex:0 0 92px}}",
  ].join("");

  /* =========================================================================
   * 14. 启动与清理
   * ========================================================================= */

  function teardown() {
    removeEntryHint();
    if (guardTimer) {
      window.clearInterval(guardTimer);
      guardTimer = 0;
    }
    closeOverlay();
    if (launcher && launcher.parentNode) launcher.parentNode.removeChild(launcher);
    launcher = null;
    if (fab && fab.parentNode) fab.parentNode.removeChild(fab);
    fab = null;
  }

  function boot() {
    addStyle(CSS);
    mountLauncher(true);
    registerMenu();
    guardTimer = window.setInterval(guardLauncher, 2500);
    try {
      if (typeof snow !== "undefined" && typeof snow.onCleanup === "function") {
        snow.onCleanup(teardown);
      }
    } catch (_) {}
  }

  boot();
})();
