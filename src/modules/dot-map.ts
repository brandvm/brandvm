export interface DotMapOptions {
  speed: number; dim: number; sizeVary: number; bias: number; radius: number;
  push: number; spring: number; damping: number; grow: number; growAt: number;
  glowRadius: number; glow: number; edgeMin: number; edgeBand: number;
  edgeMode: string; pad: number; fps: number; colors: number; levels: number;
}
interface Dot {
  ox: number; oy: number; r: number; edge: number; ph: number; sp: number;
  x: number; y: number; vx: number; vy: number; b: number; _a: number; _s: number;
}
type RGB = [number, number, number];
interface LinearGradient { flat?: undefined; x1: number; y1: number; x2: number; y2: number; stops: { t: number; c: RGB }[]; }
type Gradient = { flat: RGB } | LinearGradient;
interface DotMapElement extends SVGSVGElement { __dotmap?: unknown; }

export function initDotMap() {
  "use strict";
  var DEFAULTS: DotMapOptions = {
    // twinkle
    speed: 0.2, // rate multiplier
    dim: 0.16, // alpha of a dot at its dimmest
    sizeVary: 0.35, // how much size breathes with the twinkle
    bias: 2.1, // >1 keeps most dots dim, with occasional flares
    // cursor — disruption
    radius: 360, // push influence radius, in SVG user units
    push: 0.4, // shove strength. 0 = no displacement at all
    spring: 0.025, // pull back toward home
    damping: 0.6, // velocity decay. higher = longer wobble
    grow: 0.15, // extra size at full displacement
    growAt: 26, // displacement (SVG units) that reaches full grow
    // cursor — glow
    glowRadius: 180, // brighten radius, in SVG user units
    glow: 1, // 0 = no brightening
    // edge falloff  (edgeMin > 1 inverts it: bigger dots at the edges)
    edgeMin: 0.45, // size multiplier at the outermost dot
    edgeBand: 0.3, // how far in the falloff reaches, as a fraction
    edgeMode: "radial", // 'edge' = distance to bounding box | 'radial'
    // bleed: extra canvas beyond the svg box, in SVG user units
    pad: 70,
    // cost
    fps: 60,
    colors: 16, // gradient quantisation
    levels: 8, // alpha quantisation
  };
  var TAU = 6.283185307179586;
  var reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // ---------- geometry ----------
  function parseDots(d: string) {
    var dots: Dot[] = [];
    var subs = d.split("M");
    for (var i = 0; i < subs.length; i++) {
      var nums = subs[i].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
      if (!nums || nums.length < 8) continue;
      var minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (var j = 0; j + 1 < nums.length; j += 2) {
        var x = parseFloat(nums[j]),
          y = parseFloat(nums[j + 1]);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      var r = (maxX - minX) / 2;
      if (!(r > 0)) continue;
      dots.push({ ox: (minX + maxX) / 2, oy: (minY + maxY) / 2, r: r, edge: 1, ph: 0, sp: 0, x: 0, y: 0, vx: 0, vy: 0, b: 0, _a: 0, _s: 0 });
    }
    return dots;
  }
  // stable pseudo-random from position
  function hash(x: number, y: number) {
    var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }
  // ---------- colour ----------
  function parseColor(str: string | null): RGB {
    str = (str || "").trim();
    var m = /^#([0-9a-f]{3,8})$/i.exec(str);
    if (m) {
      var h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }
    m = /^rgba?\(([^)]+)\)$/i.exec(str);
    if (m) {
      var p = m[1].split(",");
      return [parseFloat(p[0]) | 0, parseFloat(p[1]) | 0, parseFloat(p[2]) | 0];
    }
    var named: Record<string, RGB> = { white: [255, 255, 255], black: [0, 0, 0] };
    return named[str.toLowerCase()] || [148, 213, 255];
  }

  function readGradient(svg: SVGSVGElement, path: SVGPathElement): Gradient {
    var fill = path.getAttribute("fill") || "";
    var idm = /url\(#([^)]+)\)/.exec(fill);
    var grad = idm && svg.querySelector('linearGradient[id="' + idm[1] + '"]');
    if (!grad) return { flat: parseColor(fill || "#94D5FF") };
    var stops = [];
    var els = grad.querySelectorAll("stop");
    for (var i = 0; i < els.length; i++) {
      var off = parseFloat(els[i].getAttribute("offset") || "");
      stops.push({
        t: isNaN(off) ? i / Math.max(1, els.length - 1) : off,
        c: parseColor(els[i].getAttribute("stop-color")),
      });
    }
    if (!stops.length) return { flat: [148, 213, 255] };
    stops.sort(function (a, b) {
      return a.t - b.t;
    });
    return {
      x1: parseFloat(grad.getAttribute("x1") || "") || 0,
      y1: parseFloat(grad.getAttribute("y1") || "") || 0,
      x2: parseFloat(grad.getAttribute("x2") || "") || 0,
      y2: parseFloat(grad.getAttribute("y2") || "") || 0,
      stops: stops,
    };
  }

  function sampleGradient(g: LinearGradient, t: number): RGB {
    var s = g.stops;
    if (t <= s[0].t) return s[0].c;
    if (t >= s[s.length - 1].t) return s[s.length - 1].c;
    for (var i = 1; i < s.length; i++) {
      if (t <= s[i].t) {
        var a = s[i - 1],
          b = s[i];
        var k = (t - a.t) / (b.t - a.t || 1);
        return [
          Math.round(a.c[0] + (b.c[0] - a.c[0]) * k),
          Math.round(a.c[1] + (b.c[1] - a.c[1]) * k),
          Math.round(a.c[2] + (b.c[2] - a.c[2]) * k),
        ];
      }
    }
    return s[s.length - 1].c;
  }
  // ---------- instance ----------
  function init(svg: SVGSVGElement, opts?: Partial<DotMapOptions>) {
    var path = svg.querySelector("path");
    if (!path) return;
    var d = path.getAttribute("d");
    if (!d) return;
    const cfg: DotMapOptions = { ...DEFAULTS };
    if (opts) Object.assign(cfg, Object.fromEntries(Object.entries(opts).filter(([, value]) => value != null)));
    const numericKeys: Exclude<keyof DotMapOptions, "edgeMode">[] = [
      "speed",
      "dim",
      "sizeVary",
      "bias",
      "radius",
      "push",
      "spring",
      "damping",
      "grow",
      "growAt",
      "glowRadius",
      "glow",
      "edgeMin",
      "edgeBand",
      "pad",
      "fps",
    ];
    numericKeys.forEach(function (key) {
      var a = svg.getAttribute("data-dot-" + key.toLowerCase());
      if (a != null && a !== "") cfg[key] = parseFloat(a);
    });
    var em = svg.getAttribute("data-dot-edgemode");
    if (em) cfg.edgeMode = em;
    var dots = parseDots(d);
    if (dots.length < 2) return;
    var vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || isNaN(vb[2]) || !vb[2]) {
      vb = [
        0,
        0,
        parseFloat(svg.getAttribute("width") || "") || 1000,
        parseFloat(svg.getAttribute("height") || "") || 1000,
      ];
    }
    var vbX = vb[0],
      vbY = vb[1],
      vbW = vb[2],
      vbH = vb[3];
    var i, p;
    // ---- edge size falloff + twinkle phase ----
    var fMinX = Infinity,
      fMaxX = -Infinity,
      fMinY = Infinity,
      fMaxY = -Infinity;
    for (i = 0; i < dots.length; i++) {
      p = dots[i];
      if (p.ox < fMinX) fMinX = p.ox;
      if (p.ox > fMaxX) fMaxX = p.ox;
      if (p.oy < fMinY) fMinY = p.oy;
      if (p.oy > fMaxY) fMaxY = p.oy;
    }
    var fW = fMaxX - fMinX || 1,
      fH = fMaxY - fMinY || 1;
    var cxF = (fMinX + fMaxX) / 2,
      cyF = (fMinY + fMaxY) / 2;

    function computeEdge() {
      var band = (Math.max(1e-6, cfg.edgeBand) * Math.min(fW, fH)) / 2;
      for (var i = 0; i < dots.length; i++) {
        var p = dots[i],
          t;
        if (cfg.edgeMode === "radial") {
          var nx = (p.ox - cxF) / (fW / 2),
            ny = (p.oy - cyF) / (fH / 2);
          t = (1 - Math.sqrt(nx * nx + ny * ny)) / Math.max(1e-6, cfg.edgeBand);
        } else {
          var dd = Math.min(
            p.ox - fMinX,
            fMaxX - p.ox,
            p.oy - fMinY,
            fMaxY - p.oy
          );
          t = dd / band;
        }
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        p.edge = cfg.edgeMin + (1 - cfg.edgeMin) * t;
      }
    }
    computeEdge();
    for (i = 0; i < dots.length; i++) {
      p = dots[i];
      p.ph = hash(p.ox, p.oy) * TAU;
      p.sp = 0.45 + hash(p.oy, p.ox) * 1.15;
      p.x = p.ox;
      p.y = p.oy;
      p.vx = 0;
      p.vy = 0;
    }
    // ---- colour buckets ----
    var g = readGradient(svg, path);
    var nC = Math.max(2, cfg.colors | 0);
    var nL = Math.max(2, cfg.levels | 0);
    var palette: string[] = [];
    if (g.flat) {
      nC = 1;
      palette.push("rgb(" + g.flat.join(",") + ")");
      for (i = 0; i < dots.length; i++) dots[i].b = 0;
    } else {
      var ax = g.x2 - g.x1,
        ay = g.y2 - g.y1;
      var len2 = ax * ax + ay * ay || 1;
      for (i = 0; i < nC; i++) {
        palette.push("rgb(" + sampleGradient(g, i / (nC - 1)).join(",") + ")");
      }
      for (i = 0; i < dots.length; i++) {
        p = dots[i];
        var t = ((p.ox - g.x1) * ax + (p.oy - g.y1) * ay) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        p.b = Math.round(t * (nC - 1));
      }
    }
    // preallocated draw groups: colour bucket x alpha level
    var groups: Dot[][] = new Array(nC * nL);
    for (i = 0; i < groups.length; i++) groups[i] = [];
    // ---- canvas ----
    var canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "display:block;position:absolute;left:0;top:0;pointer-events:none";
    const context = canvas.getContext("2d");
    const parent = svg.parentElement;
    if (!context || !parent) return;
    const ctx: CanvasRenderingContext2D = context;
    const host: HTMLElement = parent;
    if (getComputedStyle(host).position === "static")
      host.style.position = "relative";
    host.appendChild(canvas);
    svg.style.visibility = "hidden";
    var scale = 1,
      offX = 0,
      offY = 0,
      cw = 0,
      ch = 0,
      dpr = 1;

    function resize() {
      var rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      // matches preserveAspectRatio="xMidYMid meet"
      scale = Math.min(rect.width / vbW, rect.height / vbH);
      var padPx = Math.max(0, cfg.pad || 0) * scale;
      cw = rect.width + padPx * 2;
      ch = rect.height + padPx * 2;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = cw + "px";
      canvas.style.height = ch + "px";
      var hostRect = host.getBoundingClientRect();
      canvas.style.left = rect.left - hostRect.left - padPx + "px";
      canvas.style.top = rect.top - hostRect.top - padPx + "px";
      offX = padPx + (rect.width - vbW * scale) / 2;
      offY = padPx + (rect.height - vbH * scale) / 2;
      draw(now);
    }
    // ---- physics ----
    function physics() {
      var live = active && cfg.push > 0;
      var R = cfg.radius,
        R2 = R * R;
      var sp = cfg.spring,
        dm = cfg.damping;
      for (var i = 0; i < dots.length; i++) {
        var p = dots[i];
        if (live) {
          var dx = p.x - px,
            dy = p.y - py;
          var d2 = dx * dx + dy * dy;
          if (d2 < R2) {
            var dist = Math.sqrt(d2) || 0.0001;
            var f = 1 - dist / R;
            var force = f * f * cfg.push;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }
        p.vx = (p.vx + (p.ox - p.x) * sp) * dm;
        p.vy = (p.vy + (p.oy - p.y) * sp) * dm;
        p.x += p.vx;
        p.y += p.vy;
      }
    }
    // ---- render ----
    var now = 0;

    function draw(t: number) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      var i, gi;
      for (i = 0; i < groups.length; i++) groups[i].length = 0;
      var dim = cfg.dim,
        span = 1 - dim,
        vary = cfg.sizeVary,
        bias = cfg.bias;
      var lit = active && cfg.glow > 0;
      var GR = cfg.glowRadius,
        GR2 = GR * GR;
      var growAt = cfg.growAt || 1;
      for (i = 0; i < dots.length; i++) {
        var p = dots[i];
        // shaped sine: mostly dim, occasional flare
        var w = 0.5 + 0.5 * Math.sin(t * p.sp * cfg.speed + p.ph);
        var tw = Math.pow(w, bias);
        var a = dim + span * tw;
        var s = 1 - vary * 0.5 + vary * tw;
        // how far this dot has been shoved from home
        var ddx = p.x - p.ox,
          ddy = p.y - p.oy;
        var disp = Math.sqrt(ddx * ddx + ddy * ddy);
        var dn = disp / growAt;
        if (dn > 1) dn = 1;
        s *= 1 + dn * cfg.grow;
        var f = dn;
        if (lit) {
          var dx = p.x - px,
            dy = p.y - py;
          var d2 = dx * dx + dy * dy;
          if (d2 < GR2) {
            var g2 = 1 - Math.sqrt(d2) / GR;
            g2 = g2 * g2 * cfg.glow;
            if (g2 > f) f = g2;
          }
        }
        if (f > 0) a += (1 - a) * f;
        p._a = a;
        p._s = p.r * p.edge * s;
        if (p._s <= 0.05) continue;
        var lvl = (a * nL) | 0;
        if (lvl > nL - 1) lvl = nL - 1;
        if (lvl < 0) lvl = 0;
        groups[p.b * nL + lvl].push(p);
      }
      for (gi = 0; gi < groups.length; gi++) {
        var list = groups[gi];
        if (!list.length) continue;
        ctx.globalAlpha = ((gi % nL) + 0.5) / nL;
        ctx.fillStyle = palette[(gi / nL) | 0];
        ctx.beginPath();
        for (i = 0; i < list.length; i++) {
          var q = list[i];
          var rr = q._s * scale;
          var cx = offX + (q.x - vbX) * scale;
          var cy = offY + (q.y - vbY) * scale;
          ctx.moveTo(cx + rr, cy);
          ctx.arc(cx, cy, rr, 0, TAU);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // ---- pointer ----
    var px = -1e6,
      py = -1e6,
      active = false;
    var section =
      svg.closest("section") || svg.closest("[data-dotmap-scope]") || host;
    section.addEventListener(
      "pointermove",
      function (event) {
        const e = event as PointerEvent;
        if (e.pointerType === "touch") return;
        var rect = canvas.getBoundingClientRect();
        if (!rect.width) return;
        px = vbX + (e.clientX - rect.left - offX) / scale;
        py = vbY + (e.clientY - rect.top - offY) / scale;
        active = true;
      }, { passive: true }
    );
    section.addEventListener(
      "pointerleave",
      function () {
        active = false;
      }, { passive: true }
    );
    // ---- loop ----
    var raf = 0,
      last = -1e9,
      visible = true,
      started: number | undefined;

    function frame(ts: number) {
      raf = requestAnimationFrame(frame);
      if (started === undefined) {
        started = ts;
        last = ts;
      }
      var minGap = cfg.fps > 0 ? 1000 / cfg.fps : 0;
      var dt = ts - last;
      if (dt < minGap) return;
      last = ts;
      now = (ts - started) / 1000;
      var steps = Math.round(dt / 16.67);
      if (steps < 1) steps = 1;
      if (steps > 4) steps = 4;
      for (var s = 0; s < steps; s++) physics();
      draw(now);
    }

    function play() {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    }

    function pause() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = -1e9;
      }
    }
    // don't burn frames on a map that's scrolled off screen
    if (window.IntersectionObserver) {
      new IntersectionObserver(
        function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) play();
          else pause();
        }, { rootMargin: "120px" }
      ).observe(svg);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause();
      else play();
    });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(svg);
    else window.addEventListener("resize", resize);
    resize();
    play();
    return {
      cfg: cfg,
      dots: dots,
      draw: draw,
      resize: resize,
      recomputeEdge: computeEdge,
      play: play,
      pause: pause,
      destroy: function () {
        pause();
        canvas.remove();
        svg.style.visibility = "";
      },
    };
  }

  function boot() {
    var nodes = document.querySelectorAll<DotMapElement>("svg[data-dotmap]");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].__dotmap) continue;
      if (reduced) continue; // leave the SVG exactly as authored
      nodes[i].__dotmap = init(nodes[i]) || true;
    }
  }
  window.DotMap = { init: init, boot: boot, parseDots: parseDots };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
