// app/api/debug/route.js — diagnosis pencarian BPS dari server tempat bot jalan.
// Buka /api/debug (q=inflasi) atau /api/debug?q=ipm untuk melihat status HTTP,
// cookie, host tiap kartu hasil, dan jumlah hasil setelah filter host,
// dari mesin pencari BPS untuk kedua situs (kabupaten & provinsi).
import { SITES, parseSearchHtml, RELAYS, isChallengeHtml } from "../../../lib/bps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function probe(site, q) {
  const base = `https://searchengine.web.bps.go.id/search?mfd=${site.mfd}&content=all&q=${encodeURIComponent(q)}`;
  const headers = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  };
  const out = { site: site.key, mfd: site.mfd, q };
  try {
    const first = await fetch(base, { headers, redirect: "manual", cache: "no-store" });
    out.firstStatus = first.status;
    const sc = first.headers.getSetCookie ? first.headers.getSetCookie() : [];
    out.cookies = sc.length;
    const cookie = sc.map((c) => c.split(";")[0]).join("; ");
    const res = await fetch(`${base}&page=1&title=0&from=all&to=all&sort=relevansi`, {
      headers: cookie ? { ...headers, Cookie: cookie } : headers,
      cache: "no-store",
    });
    out.secondStatus = res.status;
    const html = await res.text();
    out.htmlLength = html.length;
    out.cards = html.split("card-result").length - 1;
    // Semua host yang muncul di tautan hasil
    const hosts = {};
    for (const m of html.matchAll(/https:\/\/([a-z0-9.-]+)\.bps\.go\.id[^"'\s<]+/g)) {
      hosts[m[1]] = (hosts[m[1]] || 0) + 1;
    }
    out.hosts = hosts;
    // Hasil setelah filter host (persis seperti yang dipakai chatbot)
    const parsed = parseSearchHtml(html, site.host);
    out.parsedCount = parsed.length;
    out.parsedTitles = parsed.slice(0, 3).map((r) => r.title.slice(0, 60));
  } catch (e) {
    out.error = String(e).slice(0, 120);
  }
  return out;
}

export async function GET(req) {
  const q = new URL(req.url).searchParams.get("q") || "inflasi";
  const results = [];
  for (const site of Object.values(SITES)) {
    results.push(await probe(site, q));
  }
  // Probe halaman tabel (seperti yang dilakukan chatbot saat menjawab),
  // plus tes jalur ?url= apa pun: langsung vs relay.
  const tableProbes = [];
  for (const [name, url] of [
    ["kab-RLS", "https://tanjabbarkab.bps.go.id/id/statistics-table/2/NTUjMg==/metode-baru-rata-rata-lama-sekolah-tahun.html"],
    ["prov-IHK", "https://jambi.bps.go.id/id/statistics-table/2/MzYjMg==/indeks-harga-konsumen-ihk-kota-jambi-2018-equal-100-tahun-2025.html"],
  ]) {
    const out = { name };
    try {
      const direct = await fetch(url, {
        headers: { "User-Agent": UA },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      const html = await direct.text();
      out.directStatus = direct.status;
      out.challenge = isChallengeHtml(html);
    } catch (e) {
      out.directStatus = "ERR " + String(e).slice(0, 80);
    }
    for (let i = 0; i < RELAYS.length; i++) {
      try {
        const r = await fetch(RELAYS[i](url), { cache: "no-store", signal: AbortSignal.timeout(20000) });
        const h = await r.text();
        out[`relay${i}`] = r.ok && h.length > 1000 && !isChallengeHtml(h) ? `OK ${h.length}B` : `gagal(${r.status},${h.length}B)`;
      } catch (e) {
        out[`relay${i}`] = "ERR " + String(e).slice(0, 60);
      }
    }
    tableProbes.push(out);
  }
  // Probe header browser lengkap (mungkin lolos skor bot Cloudflare)
  const fullHeaders = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Referer: "https://www.google.com/",
    "Sec-Ch-Ua": '"Chromium";v="126", "Google Chrome";v="126"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "cross-site",
    "Upgrade-Insecure-Requests": "1",
  };
  let headerProbe;
  try {
    const res = await fetch("https://tanjabbarkab.bps.go.id/id/statistics-table/2/NTUjMg==/metode-baru-rata-rata-lama-sekolah-tahun.html", {
      headers: fullHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const h = await res.text();
    headerProbe = { status: res.status, challenge: isChallengeHtml(h), length: h.length };
  } catch (e) {
    headerProbe = { error: String(e).slice(0, 80) };
  }
  // Probe webapi.bps.go.id (layanan API resmi — mungkin tak kena tantangan)
  let webapiProbe;
  try {
    const res = await fetch("https://webapi.bps.go.id/v1/api/domain/1507/key/TEST", {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const t = await res.text();
    webapiProbe = {
      status: res.status,
      isJson: t.trim().startsWith("{"),
      challenge: isChallengeHtml(t),
      head: t.slice(0, 120).replace(/\s+/g, " "),
    };
  } catch (e) {
    webapiProbe = { error: String(e).slice(0, 80) };
  }
  return Response.json({ time: new Date().toISOString(), q, results, tableProbes, headerProbe, webapiProbe }, {
    headers: { "cache-control": "no-store" },
  });
}
