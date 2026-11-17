// app/api/debug/route.js — diagnosis pencarian BPS dari server tempat bot jalan.
// Buka /api/debug untuk melihat status HTTP, cookie, dan jumlah hasil
// dari mesin pencari BPS untuk kedua situs (kabupaten & provinsi).
import { SITES } from "../../../lib/bps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function probe(site) {
  const base = `https://searchengine.web.bps.go.id/search?mfd=${site.mfd}&content=all&q=inflasi`;
  const headers = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  };
  const out = { site: site.key, mfd: site.mfd };
  try {
    const first = await fetch(base, { headers, redirect: "manual", cache: "no-store" });
    out.firstStatus = first.status;
    out.firstType = first.headers.get("content-type") || "";
    const sc = first.headers.getSetCookie ? first.headers.getSetCookie() : [];
    out.cookies = sc.length;
    out.location = (first.headers.get("location") || "").slice(0, 80);
    const cookie = sc.map((c) => c.split(";")[0]).join("; ");
    const res = await fetch(`${base}&page=1&title=0&from=all&to=all&sort=relevansi`, {
      headers: cookie ? { ...headers, Cookie: cookie } : headers,
      cache: "no-store",
    });
    out.secondStatus = res.status;
    const html = await res.text();
    out.htmlLength = html.length;
    out.cards = (html.split("card-result").length - 1) || 0;
    out.hasChallenge = /just a moment|attention required|cloudflare/i.test(html);
    out.snippet = html.slice(0, 160).replace(/\s+/g, " ");
  } catch (e) {
    out.error = String(e).slice(0, 120);
  }
  return out;
}

export async function GET() {
  const results = [];
  for (const site of Object.values(SITES)) {
    results.push(await probe(site));
  }
  return Response.json({ time: new Date().toISOString(), results }, {
    headers: { "cache-control": "no-store" },
  });
}
