// app/api/debug/route.js — diagnosis pencarian BPS dari server tempat bot jalan.
// Buka /api/debug (q=inflasi) atau /api/debug?q=ipm untuk melihat status HTTP,
// cookie, host tiap kartu hasil, dan jumlah hasil setelah filter host,
// dari mesin pencari BPS untuk kedua situs (kabupaten & provinsi).
import { SITES, parseSearchHtml } from "../../../lib/bps";

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
  return Response.json({ time: new Date().toISOString(), q, results }, {
    headers: { "cache-control": "no-store" },
  });
}
