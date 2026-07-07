const STATE_KEY = "boxdgrid_state";
const STATE_VER = 2;
let cachedItems = [];
let lang = "pt";

const LANG = {
  pt: {
    btn: "EN",
    heroTitle: "Colagem de filmes",
    heroDesc: "Insira seu username do Letterboxd e monte uma colagem dos filmes que voc\u00EA assistiu.",
    generateBtn: "Gerar",
    periodLabel: { "7":"7 dias", "30":"30 dias", "90":"3 meses", "180":"6 meses", "365":"1 ano", "all":"todo hist\u00F3rico" },
    periodLabel2: "Per\u00EDodo",
    periodPrefix: "dos \u00FAltimos",
    allTime: "de todo hist\u00F3rico",
    shareText: "Minha colagem de filmes no Letterboxd",
    loading: "Buscando seus filmes...",
    loadingDir: "Buscando informa\u00E7\u00F5es dos diretores...",
    groupLabel: "Agrupar",
    groupFilm: "Filme",
    groupDir: "Diretor(a)",
    gridLabel: "Grid",
    showLabel: "Mostrar",
    showRating: "Nota",
    showLike: "Like",
    showReview: "Resenha",
    showRewatch: "Reviu",
    labelFilm: "filmes",
    labelDir: "diretores",
    errorUser: "Digite seu username do Letterboxd.",
    errorRSS: "Usu\u00E1rio n\u00E3o encontrado ou RSS indispon\u00EDvel.",
    errorNoDiary: "Nenhum filme no di\u00E1rio desse usu\u00E1rio.",
    errorNoPeriod: "Nenhum filme encontrado nesse per\u00EDodo.",
    pngBtn: "PNG",
    jpgBtn: "JPG",
    copyBtn: "Copiar",
    shareBtn: "Compartilhar",
    copied: "Copiado!",
    copyErr: "Erro",
    notAffiliated: "n\u00E3o afiliado",
    siteLink: "boxdgrid.wired.rs",
  },
  en: {
    btn: "PT",
    heroTitle: "Movie collage",
    heroDesc: "Enter your Letterboxd username and build a collage of the films you watched.",
    generateBtn: "Generate",
    periodLabel: { "7":"7 days", "30":"30 days", "90":"3 months", "180":"6 months", "365":"1 year", "all":"all time" },
    periodLabel2: "Period",
    periodPrefix: "of the last",
    allTime: "of all time",
    shareText: "My Letterboxd movie collage",
    loading: "Fetching your films...",
    loadingDir: "Looking up directors...",
    groupLabel: "Group by",
    groupFilm: "Film",
    groupDir: "Director",
    gridLabel: "Grid",
    showLabel: "Show",
    showRating: "Rating",
    showLike: "Like",
    showReview: "Review",
    showRewatch: "Rewatch",
    labelFilm: "films",
    labelDir: "directors",
    errorUser: "Enter your Letterboxd username.",
    errorRSS: "User not found or RSS unavailable.",
    errorNoDiary: "No diary entries for this user.",
    errorNoPeriod: "No films found in this period.",
    pngBtn: "PNG",
    jpgBtn: "JPG",
    copyBtn: "Copy",
    shareBtn: "Share",
    copied: "Copied!",
    copyErr: "Error",
    notAffiliated: "not affiliated",
    siteLink: "boxdgrid.wired.rs",
  },
};

function t(key) { return LANG[lang][key]; }

function loadState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; }
  catch { return {}; }
}

function saveState(partial) {
  const cur = loadState();
  localStorage.setItem(STATE_KEY, JSON.stringify({ ver: STATE_VER, ...cur, ...partial }));
}

function applyLang() {
  document.querySelectorAll("[data-t]").forEach(el => {
    const val = t(el.dataset.t);
    if (val) el.textContent = val;
  });
  document.querySelectorAll("[data-t-period]").forEach(el => {
    const val = t("periodLabel")[el.dataset.tPeriod];
    if (val) el.textContent = val;
  });
  const btn = document.getElementById("lang-btn");
  if (btn) btn.textContent = LANG[lang].btn;
  document.getElementById("generate-btn").textContent = t("generateBtn");
  saveState({ lang });
}

function restoreUI() {
  const s = loadState();
  if (s.ver !== STATE_VER) {
    localStorage.removeItem(STATE_KEY);
    return;
  }
  if (s.lang) lang = s.lang;
  applyLang();
  if (s.username) document.getElementById("username-input").value = s.username;
  if (s.period) document.getElementById("period-select").value = s.period;
  if (s.group) document.getElementById("group-select").value = s.group;
  if (s.grid) document.getElementById("grid-select").value = s.grid;
  if (s.shows) {
    document.querySelectorAll(".tag input").forEach(cb => {
      cb.checked = s.shows[cb.value] !== false;
    });
  }
  if (s.lastHtml && s.lastItems) {
    cachedItems = s.lastItems;
    const g = document.getElementById("grid");
    g.innerHTML = s.lastHtml;
    const n = parseInt(s.grid) || 4;
    g.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    document.getElementById("output").classList.add("visible");
    document.getElementById("grid-info").textContent = s.lastInfo || "";
  }
}

function getShowFlags() {
  const flags = {};
  document.querySelectorAll(".tag input").forEach(cb => { flags[cb.value] = cb.checked; });
  return flags;
}

function txt(el) { return el?.textContent?.trim() || ""; }

function parseRSS(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "text/xml");
  const nsL = "https://letterboxd.com";
  const nsT = "https://themoviedb.org";
  return [...xml.querySelectorAll("item")].map(item => {
    const title = txt(item.querySelector("title"));
    const m = title.match(/^(.+?),\s*(\d{4})(?:\s*-\s*(.*))?$/);
    const description = txt(item.querySelector("description"));
    const img = description.match(/<img[^>]+src=["']([^"']+)["']/);
    const guid = txt(item.querySelector("guid"));
    const watchedDate = item.getElementsByTagNameNS(nsL, "watchedDate")[0]?.textContent || "";

    return {
      filmTitle: m ? m[1].trim() : title,
      year: m ? m[2] : "",
      rating: parseFloat(item.getElementsByTagNameNS(nsL, "memberRating")[0]?.textContent || "0"),
      liked: (item.getElementsByTagNameNS(nsL, "memberLike")[0]?.textContent || "no").toLowerCase() === "yes",
      watchedDate,
      rewatch: (item.getElementsByTagNameNS(nsL, "rewatch")[0]?.textContent || "no").toLowerCase() === "yes",
      hasReview: guid.startsWith("letterboxd-review"),
      tmdbId: item.getElementsByTagNameNS(nsT, "movieId")[0]?.textContent || "",
      posterUrl: img ? `/api/poster?url=${encodeURIComponent(img[1])}` : "",
    };
  });
}

// ── Icons (Letterboxd-style SVG) ──

// Exact Letterboxd SVG icons
const ICONS = {
  heart: '<svg viewBox="0 0 14 12" fill="currentColor"><path fill-rule="evenodd" d="M10.52.5C8.73.5 7 2.42 7 2.42S5.27.5 3.48.5C1.7.5 0 1.3 0 3.66 0 5.33 1.75 6.8 1.75 6.8L7 11.5l5.25-4.7S14 5.33 14 3.66C14 1.3 12.3.5 10.52.5"/></svg>',
  rewatch: '<svg viewBox="0 0 16 12" fill="currentColor"><path fill-rule="evenodd" d="M8 0a8 8 0 0 0-6.4 12.8l1.28-.96A6.4 6.4 0 0 1 8 1.6a6.4 6.4 0 0 1 5.12 10.24l1.28.96A8 8 0 0 0 8 0zm-.64 3.2v4.8l4.16 2.48.72-1.2-3.28-1.92V3.2H7.36z"/></svg>',
  review: '<svg viewBox="0 0 16 14" fill="currentColor"><rect y="0" width="16" height="2" rx="1"/><rect y="6" width="16" height="2" rx="1"/><rect y="12" width="12" height="2" rx="1"/></svg>',
};

const STAR_PATH = "M7.89 1.2c-.34-.95-1.47-.92-1.78 0L4.97 5h-3.9C-.05 5-.39 6.15.53 6.85L3.63 9l-1.18 4.11c-.35 1.13.52 1.8 1.44 1.1L7 11.83l3.11 2.38c.92.7 1.79.03 1.44-1.1L10.37 9l3.1-2.15c.92-.7.58-1.85-.54-1.85H9.08z";

function starSVG(n) {
  if (!n) return "";
  const full = Math.floor(n);
  const half = n % 1 >= 0.5;
  const spacing = 12;
  const w = (full + (half ? 1 : 0)) * spacing;
  let svg = `<svg viewBox="0 0 ${w} 12" fill="currentColor">`;
  for (let i = 0; i < full; i++) {
    svg += `<path transform="translate(${i * spacing}, 0) scale(0.8)" fill-rule="evenodd" d="${STAR_PATH}"/>`;
  }
  if (half) {
    svg += `<path transform="translate(${full * spacing}, 0) scale(0.8)" d="M.71 11.99h1.31L11 0H9.7zm1.1-6h1.6V0H2.02L.42 1.07V2.4l1.4-.87zm5.29 6h4.78v-1.16H9.65l.99-.97c.71-.68 1.19-1.2 1.19-2 0-1.09-.75-1.86-2.2-1.86-1.42 0-2.32.79-2.4 2.23h1.45c.09-.73.4-1.04.89-1.04.47 0 .71.28.71.74 0 .52-.39.91-1 1.54l-2.18 2.3z"/>`;
  }
  svg += "</svg>";
  return svg;
}

function fmtRating(r) {
  if (!r) return "";
  let s = "\u2605".repeat(Math.floor(r));
  if (r % 1 >= 0.5) s += "\u00BD";
  return s;
}

function escaped(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderGrid(items, n) {
  const g = document.getElementById("grid");
  const show = getShowFlags();
  g.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  g.innerHTML = items.map(item => {
    const title = escaped(item.filmTitle);
    const starsSvg = show.rating ? starSVG(item.rating) : "";
    const badges = [];
    if (show.rewatch && item.rewatch) badges.push(`<span class="badge badge-rewatch" data-icon="rewatch" title="revisited">${ICONS.rewatch}</span>`);
    if (show.like && item.liked) badges.push(`<span class="badge badge-like" data-icon="like" title="liked">${ICONS.heart}</span>`);
    if (show.review && item.hasReview) badges.push(`<span class="badge badge-review" data-icon="review" title="has review">${ICONS.review}</span>`);

    return `
      <figure class="grid-item">
        <img src="${item.posterUrl}" alt="${title}" loading="lazy" crossorigin="anonymous"
          onerror="this.outerHTML='<div class=grid-item style=display:flex;align-items:center;justify-content:center;height:100%;background:#111;color:#567;font-size:.65rem;padding:8px;text-align:center>${title}</div>'">
        ${starsSvg ? `<div class="badge-rating" data-icon="rating-${item.rating}">${starsSvg}</div>` : ""}
        ${badges.length ? `<div class="badge-row">${badges.join("")}</div>` : ""}
        <figcaption class="overlay">
          <div class="title">${title}</div>
          <div class="meta">${item.year}${item._director ? " \u00B7 " + escaped(item._director) : ""}</div>
        </figcaption>
      </figure>
    `;
  }).join("");
}

function getCanvasBlob(fmt) {
  return new Promise((resolve, reject) => {
    const n = parseInt(document.getElementById("grid-select").value);
    const els = [...document.querySelectorAll(".grid-item")];
    if (!els.length) return reject("no items");
    const cols = Math.min(n, els.length);
    const rows = Math.ceil(els.length / cols);
    const iw = 300, ih = 450, gap = 2;
    const cv = document.createElement("canvas");
    cv.width = cols * iw + (cols - 1) * gap;
    cv.height = rows * ih + (rows - 1) * gap;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);

    async function renderCell(el, col, row) {
      const x = col * (iw + gap), y = row * (ih + gap);
      const posterImg = el.querySelector("img");
      if (posterImg && posterImg.complete && posterImg.naturalWidth > 0) {
        ctx.drawImage(posterImg, x, y, iw, ih);
      }
      const oh = 50;
      const oy = y + ih - oh;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.78)";
      ctx.fillRect(x, oy, iw, oh);
      const overlayEl = el.querySelector(".overlay");
      if (overlayEl) {
        const t = overlayEl.querySelector(".title")?.textContent || "";
        const m = overlayEl.querySelector(".meta")?.textContent || "";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(t.substring(0, 30), x + 6, oy + 3);
        ctx.fillStyle = "#9ab";
        ctx.font = "9px sans-serif";
        ctx.fillText(m, x + 6, oy + 16);
      }
      // Render SVG badges in the overlay
      let bbx = x + 6, bby = oy + 30;
      const ratingEl = el.querySelector(".badge-rating");
      if (ratingEl) {
        const color = getComputedStyle(ratingEl).color;
        const svgText = ratingEl.innerHTML;
        const img = await svgToImage(svgText, color);
        if (img) {
          const rw = Math.min(img.naturalWidth * (9 / img.naturalHeight), iw - 12);
          ctx.drawImage(img, bbx, bby, rw, 9);
          bbx += rw + 4;
        }
      }
      const icons = el.querySelectorAll(".badge");
      if (icons.length) {
        for (const icon of icons) {
          const color = getComputedStyle(icon).color;
          const svgText = icon.innerHTML;
          const img = await svgToImage(svgText, color);
          if (img) {
            ctx.drawImage(img, bbx, bby, 11, 11);
            bbx += 12;
          }
        }
      }
      ctx.restore();
    }

    function svgToImage(svgText, color) {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        let svg = svgText;
        if (color) svg = svg.replace(/currentColor/g, color);
        svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
        img.src = 'data:image/svg+xml,' + encodeURIComponent(svg);
      });
    }

    async function draw() {
      for (let i = 0; i < els.length; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        await renderCell(els[i], col, row);
      }
      cv.toBlob(blob => resolve(blob), `image/${fmt === "png" ? "png" : "jpeg"}`, 0.92);
    }

    const pending = els.filter(el => {
      const img = el.querySelector("img");
      return img && !(img.complete && img.naturalWidth > 0);
    });
    if (!pending.length) { draw(); return; }
    let c = 0;
    pending.forEach(el => {
      const img = el.querySelector("img");
      if (img) img.onload = () => { if (++c >= pending.length) draw(); };
    });
    setTimeout(draw, 2000);
  });
}

const SMARTLINK = "https://www.effectivecpmnetwork.com/tfm84s4e6a?key=a0917091db28caa0a680bad911c9473b";
let smartlinkReady = true;

function smartlinkClick() {
  if (smartlinkReady) {
    smartlinkReady = false;
    window.open(SMARTLINK, "_blank");
  }
}

function resetSmartlink() {
  smartlinkReady = true;
}

async function downloadImage(fmt) {
  smartlinkClick();
  try {
    const blob = await getCanvasBlob(fmt);
    const a = document.createElement("a");
    a.download = `boxdgrid.${fmt}`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {}
}

async function copyImage() {
  smartlinkClick();
  try {
    const blob = await getCanvasBlob("png");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    const btn = document.getElementById("copy-btn");
    const orig = btn.textContent;
    btn.textContent = "Copiado!";
    setTimeout(() => btn.textContent = orig, 2000);
  } catch {
    const btn = document.getElementById("copy-btn");
    const orig = btn.textContent;
    btn.textContent = "Erro";
    setTimeout(() => btn.textContent = orig, 2000);
  }
}

async function shareImage() {
  try {
    const period = document.getElementById("period-select").value;
    const periodTxt = period === "all" ? t("allTime") : t("periodPrefix") + " " + t("periodLabel")[period];
    const shareTxt = t("shareText") + " (" + periodTxt + ") — " + t("siteLink");
    const blob = await getCanvasBlob("png");
    const file = new File([blob], "boxdgrid.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "boxdgrid", text: shareTxt });
    } else {
      downloadImage("png");
    }
  } catch {}
}

async function generateGrid() {
  const username = document.getElementById("username-input").value.trim();
  const period = document.getElementById("period-select").value;
  const group = document.getElementById("group-select").value;
  const gridSize = parseInt(document.getElementById("grid-select").value);
  const output = document.getElementById("output");
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const info = document.getElementById("grid-info");

  if (!username) {
    error.textContent = t("errorUser");
    error.classList.add("visible");
    return;
  }

  resetSmartlink();
  error.classList.remove("visible");
  output.classList.remove("visible");
  loading.classList.add("visible");

  const shows = getShowFlags();
  saveState({ username, period, group, grid: String(gridSize), shows });

  try {
    const res = await fetch(`/api/rss?username=${encodeURIComponent(username)}`);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || t("errorRSS"));
    }
    let items = parseRSS(await res.text());

    // Filter out lists — only diary entries with a watched date
    items = items.filter(i => i.watchedDate);
    if (!items.length) throw new Error(t("errorNoDiary"));

    if (period !== "all") {
      items = items.filter(i => withinDays(i.watchedDate, parseInt(period)));
    }
    if (!items.length) throw new Error(t("errorNoPeriod"));

    if (group === "director") {
      loading.querySelector("p").textContent = t("loadingDir");
      const map = new Map();
      for (const item of items) {
        const dir = await getDirector(item);
        if (!map.has(dir)) map.set(dir, { ...item, _director: dir, count: 1 });
        else map.get(dir).count++;
      }
      items = [...map.values()].sort((a, b) => b.count - a.count);
    }

    const cap = gridSize * gridSize;
    const display = items.slice(0, cap);
    cachedItems = display;
    renderGrid(display, gridSize);

    const label = group === "director" ? t("labelDir") : t("labelFilm");
    const txt = `${display.length} ${label} \u00B7 ${t("periodLabel")[period] || period}`;
    info.textContent = txt;
    output.classList.add("visible");

    saveState({ lastItems: display, lastHtml: document.getElementById("grid").innerHTML, lastInfo: txt });
  } catch (e) {
    error.textContent = e.message;
    error.classList.add("visible");
  } finally {
    loading.classList.remove("visible");
    const lp = loading.querySelector("p");
    if (lp) lp.textContent = t("loading");
  }
}

function withinDays(dateStr, days) {
  if (!dateStr) return true;
  return (Date.now() - new Date(dateStr).getTime()) / 864e5 <= days;
}

async function getDirector(item) {
  if (item._director) return item._director;
  const id = item.tmdbId;
  if (id) {
    try {
      const r = await fetch(`/api/tmdb-credits?id=${id}`);
      if (r.ok) {
        const d = await r.json();
        if (d.director) return item._director = d.director;
      }
    } catch {}
  }
  try {
    const r = await fetch(`/api/tmdb-search?title=${encodeURIComponent(item.filmTitle)}&year=${item.year}`);
    if (r.ok) {
      const d = await r.json();
      if (d.director) return item._director = d.director;
    }
  } catch {}
  return item._director = "Unknown";
}

document.addEventListener("DOMContentLoaded", () => {
  restoreUI();
  document.getElementById("search-form").addEventListener("submit", e => { e.preventDefault(); generateGrid(); });
  document.getElementById("download-png").addEventListener("click", () => downloadImage("png"));
  document.getElementById("download-jpg").addEventListener("click", () => downloadImage("jpg"));
  document.getElementById("copy-btn").addEventListener("click", copyImage);
  document.getElementById("share-btn").addEventListener("click", shareImage);
  document.getElementById("lang-btn").addEventListener("click", () => {
    lang = lang === "pt" ? "en" : "pt";
    applyLang();
    saveState({ lang });
  });
  document.querySelectorAll(".tag input").forEach(cb => {
    cb.addEventListener("change", () => saveState({ shows: getShowFlags() }));
  });
  ["period-select", "group-select", "grid-select"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      saveState({ [id.replace("-select", "")]: document.getElementById(id).value });
    });
  });
});
