// Load .env manually
try {
  const envFile = await Bun.file("./.env").text();
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([^#\s=]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const PORT = parseInt(process.env.PORT || "3033");
const TMDB_API_KEY = process.env.TMDB_API_KEY || "";
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN || "";
const tmdbAuth = TMDB_TOKEN
  ? { Authorization: `Bearer ${TMDB_TOKEN}` }
  : TMDB_API_KEY
    ? {}
    : {};
const tmdbParams = (extra: Record<string,string> = {}) => TMDB_TOKEN
  ? extra
  : { api_key: TMDB_API_KEY, ...extra };

// ── Text cache (JSON/XML) ──
interface CacheEntry { data: string; expiry: number }
const cache = new Map<string, CacheEntry>();

function cached(key: string, ttlMs: number, fetcher: () => Promise<Response>): Promise<Response> {
  const existing = cache.get(key);
  if (existing && Date.now() < existing.expiry) {
    return Promise.resolve(new Response(existing.data, {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "X-Cache": "hit" },
    }));
  }
  return fetcher().then(async res => {
    if (res.ok) {
      const text = await res.text();
      cache.set(key, { data: text, expiry: Date.now() + ttlMs });
      return new Response(text, {
        headers: { "Content-Type": res.headers.get("Content-Type") || "application/json", "Access-Control-Allow-Origin": "*", "X-Cache": "miss" },
      });
    }
    return res;
  });
}

// ── Binary cache (images) ──
interface BinCacheEntry { buf: ArrayBuffer; type: string; expiry: number }
const binCache = new Map<string, BinCacheEntry>();

function cachedBin(key: string, ttlMs: number, fetcher: () => Promise<{ buf: ArrayBuffer; type: string; ok: boolean }>): Promise<Response> {
  const existing = binCache.get(key);
  if (existing && Date.now() < existing.expiry) {
    return Promise.resolve(new Response(existing.buf, {
      headers: { "Content-Type": existing.type, "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400", "X-Cache": "hit" },
    }));
  }
  return fetcher().then(res => {
    if (!res.ok) return new Response("Poster not found", { status: 404 });
    binCache.set(key, { buf: res.buf, type: res.type, expiry: Date.now() + ttlMs });
    return new Response(res.buf, {
      headers: { "Content-Type": res.type, "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400", "X-Cache": "miss" },
    });
  }).catch(() => new Response("Proxy error", { status: 502 }));
}

Bun.serve({
  hostname: "0.0.0.0",
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Proxy Letterboxd RSS — cached 5 min
    if (url.pathname === "/api/rss") {
      const username = url.searchParams.get("username");
      if (!username) return new Response("Missing username", { status: 400 });
      return cached(`rss:${username}`, 300_000, async () => {
        const res = await fetch(`https://letterboxd.com/${username}/rss/`, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "User not found or RSS unavailable" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const xml = await res.text();
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Access-Control-Allow-Origin": "*" },
        });
      });
    }

    // Proxy TMDb credits — cached 1h
    if (url.pathname === "/api/tmdb-credits" && TMDB_API_KEY) {
      const movieId = url.searchParams.get("id");
      if (!movieId) return new Response("Missing id", { status: 400 });
      return cached(`tmdb:credits:${movieId}`, 3_600_000, async () => {
        const params = new URLSearchParams(tmdbParams());
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${movieId}/credits?${params}`,
          { headers: { ...tmdbAuth }, signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return new Response("TMDb error", { status: res.status });
        const data = await res.json() as any;
        const director = data.crew?.find((c: any) => c.job === "Director");
        return new Response(JSON.stringify({ director: director?.name || null }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      });
    }

    // Proxy TMDb search — cached 1h
    if (url.pathname === "/api/tmdb-search" && TMDB_API_KEY) {
      const title = url.searchParams.get("title");
      const year = url.searchParams.get("year");
      if (!title) return new Response("Missing title", { status: 400 });
      const query = year ? `${title} ${year}` : title;
      return cached(`tmdb:search:${query}`, 3_600_000, async () => {
        const params = new URLSearchParams(tmdbParams({ query }));
        const res = await fetch(
          `https://api.themoviedb.org/3/search/movie?${params}`,
          { headers: { ...tmdbAuth }, signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return new Response("TMDb error", { status: res.status });
        const data = await res.json() as any;
        const movie = data.results?.[0];
        if (!movie) return new Response(JSON.stringify({ director: null }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
        const creditsParams = new URLSearchParams(tmdbParams());
        const creditsRes = await fetch(
          `https://api.themoviedb.org/3/movie/${movie.id}/credits?${creditsParams}`,
          { headers: { ...tmdbAuth }, signal: AbortSignal.timeout(5000) }
        );
        const credits = await creditsRes.json() as any;
        const director = credits.crew?.find((c: any) => c.job === "Director");
        return new Response(JSON.stringify({ director: director?.name || null, poster: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      });
    }

    // Proxy poster images (Letterboxd CDN has no CORS)
    if (url.pathname === "/api/poster") {
      const imgUrl = url.searchParams.get("url");
      if (!imgUrl) return new Response("Missing url", { status: 400 });
      return cachedBin(`poster:${imgUrl}`, 86_400_000, async () => {
        const res = await fetch(imgUrl, {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return { ok: false, buf: new ArrayBuffer(0), type: "" };
        const buf = await res.arrayBuffer();
        const type = res.headers.get("Content-Type") || "image/jpeg";
        return { ok: true, buf, type };
      });
    }

    // Serve static files
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = Bun.file(`./public${filePath}`);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Server running at http://localhost:${PORT}`);
if (!TMDB_API_KEY) {
  console.log("TMDB_API_KEY not set — 'by director' mode will be disabled.");
  console.log("Get a free key at https://www.themoviedb.org/settings/api");
}
