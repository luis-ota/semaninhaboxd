const STATE_KEY = "boxdgrid_state";
const STATE_VER = 2;
let cachedItems = [];

function loadState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY)) || {}; }
  catch { return {}; }
}

function saveState(partial) {
  const cur = loadState();
  localStorage.setItem(STATE_KEY, JSON.stringify({ ver: STATE_VER, ...cur, ...partial }));
}

function restoreUI() {
  const s = loadState();
  if (s.ver !== STATE_VER) {
    localStorage.removeItem(STATE_KEY);
    return;
  }
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
  const w = (full + (half ? 1 : 0)) * 16;
  let svg = `<svg viewBox="0 0 ${w} 15" fill="currentColor">`;
  for (let i = 0; i < full; i++) {
    svg += `<path transform="translate(${i * 16}, 0)" fill-rule="evenodd" d="${STAR_PATH}"/>`;
  }
  if (half) {
    svg += `<path transform="translate(${full * 16}, 0)" d="M.71 11.99h1.31L11 0H9.7zm1.1-6h1.6V0H2.02L.42 1.07V2.4l1.4-.87zm5.29 6h4.78v-1.16H9.65l.99-.97c.71-.68 1.19-1.2 1.19-2 0-1.09-.75-1.86-2.2-1.86-1.42 0-2.32.79-2.4 2.23h1.45c.09-.73.4-1.04.89-1.04.47 0 .71.28.71.74 0 .52-.39.91-1 1.54l-2.18 2.3z"/>`;
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
    if (show.rewatch && item.rewatch) badges.push(`<span class="badge badge-rewatch" data-icon="rewatch" title="Reassistido">${ICONS.rewatch}</span>`);
    if (show.like && item.liked) badges.push(`<span class="badge badge-like" data-icon="like" title="Gostou">${ICONS.heart}</span>`);
    if (show.review && item.hasReview) badges.push(`<span class="badge badge-review" data-icon="review" title="Tem resenha">${ICONS.review}</span>`);

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

    function draw() {
      els.forEach((el, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = col * (iw + gap), y = row * (ih + gap);
        const img = el.querySelector("img");
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, x, y, iw, ih);
        }
        const badges = el.querySelectorAll(".badge-row .badge, .badge-rating");
        const iconMap = { rewatch: "\u21BB", like: "\u2665", review: "\u270E" };
        badges.forEach(b => {
          const rect = b.getBoundingClientRect();
          const gridRect = document.getElementById("grid").getBoundingClientRect();
          const bx = rect.left - gridRect.left + x;
          const by = rect.top - gridRect.top + y;
          ctx.save();
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = b.classList.contains("badge-rating") ? "#00e054" : "#000";
          ctx.beginPath();
          ctx.roundRect(bx, by, rect.width, rect.height, 4);
          ctx.fill();
          ctx.globalAlpha = 1;
          const icon = b.dataset.icon || "";
          if (icon.startsWith("rating-")) {
            const r = parseFloat(icon.slice(7));
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.max(9, rect.height - 5)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(fmtRating(r), bx + rect.width / 2, by + rect.height / 2);
          } else {
            ctx.fillStyle = b.classList.contains("badge-rewatch") ? "#678" : b.classList.contains("badge-like") ? "#ff8000" : b.classList.contains("badge-review") ? "#40bcf4" : "#fff";
            ctx.font = `bold ${Math.max(10, rect.height - 4)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const ch = icon ? iconMap[icon] : "";
            if (ch) ctx.fillText(ch, bx + rect.width / 2, by + rect.height / 2);
          }
          ctx.restore();
        });
        const overlay = el.querySelector(".overlay");
        if (overlay) {
          const t = overlay.querySelector(".title")?.textContent || "";
          const m = overlay.querySelector(".meta")?.textContent || "";
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.7)";
          ctx.fillRect(x, y + ih - 50, iw, 50);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 14px sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(t.substring(0, 30), x + 6, y + ih - 26);
          ctx.fillStyle = "#9ab";
          ctx.font = "11px sans-serif";
          ctx.fillText(m, x + 6, y + ih - 8);
          ctx.restore();
        }
      });
      cv.toBlob(blob => resolve(blob), `image/${fmt === "png" ? "png" : "jpeg"}`, 0.92);
    }

    const pending = els.filter(el => {
      const img = el.querySelector("img");
      return img && !(img.complete && img.naturalWidth > 0);
    });
    if (!pending.length) return draw();
    let c = 0;
    pending.forEach(el => {
      const img = el.querySelector("img");
      if (img) img.onload = () => { if (++c >= pending.length) draw(); };
    });
    setTimeout(draw, 2000);
  });
}

const SMARTLINK = "https://www.effectivecpmnetwork.com/tfm84s4e6a?key=a0917091db28caa0a680bad911c9473b";
const SL_KEY = "boxdgrid_sl";

function smartlinkClick() {
  if (!localStorage.getItem(SL_KEY)) {
    localStorage.setItem(SL_KEY, "1");
    window.open(SMARTLINK, "_blank");
  }
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
  smartlinkClick();
  try {
    const blob = await getCanvasBlob("png");
    const file = new File([blob], "boxdgrid.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "boxdgrid", text: "Minha colagem de filmes no Letterboxd" });
    } else {
      // fallback: download
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
    error.textContent = "Digite seu username do Letterboxd.";
    error.classList.add("visible");
    return;
  }

  error.classList.remove("visible");
  output.classList.remove("visible");
  loading.classList.add("visible");

  const shows = getShowFlags();
  saveState({ username, period, group, grid: String(gridSize), shows });

  try {
    const res = await fetch(`/api/rss?username=${encodeURIComponent(username)}`);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Usuario nao encontrado ou RSS indisponivel.");
    }
    let items = parseRSS(await res.text());

    // Filter out lists — only diary entries with a watched date
    items = items.filter(i => i.watchedDate);
    if (!items.length) throw new Error("Nenhum filme no diario desse usuario.");

    if (period !== "all") {
      items = items.filter(i => withinDays(i.watchedDate, parseInt(period)));
    }
    if (!items.length) throw new Error("Nenhum filme encontrado nesse periodo.");

    if (group === "director") {
      loading.querySelector("p").textContent = "Buscando informacoes dos diretores...";
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

    const labels = { "7": "7 dias", "30": "30 dias", "90": "3 meses", "180": "6 meses", "365": "1 ano", "all": "todo historico" };
    const label = group === "director" ? "diretores" : "filmes";
    const txt = `${display.length} ${label} \u00B7 ${labels[period] || period}`;
    info.textContent = txt;
    output.classList.add("visible");

    saveState({ lastItems: display, lastHtml: document.getElementById("grid").innerHTML, lastInfo: txt });
  } catch (e) {
    error.textContent = e.message;
    error.classList.add("visible");
  } finally {
    loading.classList.remove("visible");
    const lp = loading.querySelector("p");
    if (lp) lp.textContent = "Buscando seus filmes...";
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
  document.querySelectorAll(".tag input").forEach(cb => {
    cb.addEventListener("change", () => saveState({ shows: getShowFlags() }));
  });
  ["period-select", "group-select", "grid-select"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      saveState({ [id.replace("-select", "")]: document.getElementById(id).value });
    });
  });
});
