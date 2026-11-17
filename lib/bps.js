// lib/bps.js — pengambil data dari situs BPS Kabupaten Tanjung Jabung Barat
// dan BPS Provinsi Jambi (sumber cadangan).
// Tanpa WebAPI key: data tabel diambil dari payload Next.js (flight) halaman
// statistics-table, ganti tahun lewat POST server-action.

export const BPS_BASE = "https://tanjabbarkab.bps.go.id";
const SEARCH_URL = "https://searchengine.web.bps.go.id/search";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Dua sumber data: kabupaten (utama) dan provinsi (cadangan).
// mfd = kode satker di mesin pencari BPS.
export const SITES = {
  kabupaten: {
    key: "kabupaten",
    host: "tanjabbarkab.bps.go.id",
    mfd: "1507",
    label: "BPS Kabupaten Tanjung Jabung Barat",
  },
  provinsi: {
    key: "provinsi",
    host: "jambi.bps.go.id",
    mfd: "1500",
    label: "BPS Provinsi Jambi",
  },
};

export function siteFromUrl(url) {
  if (!url) return SITES.kabupaten;
  return url.includes(SITES.provinsi.host) ? SITES.provinsi : SITES.kabupaten;
}

// ID server-action ganti tahun (build-specific; jika BPS redeploy bisa berubah —
// fungsi fetchYearViaAction akan gagal dan pemanggil harus punya fallback).
// Terverifikasi 17 Nov 2026: ID yang sama berlaku untuk kedua situs
// (tanjabbarkab.bps.go.id dan jambi.bps.go.id).
const NEXT_ACTION_ID = "40382a7a88544467ec6774bedd0d3ebbfb7931756e";

export function detectType(url) {
  if (url.includes("/statistics-table/")) return "table";
  if (url.includes("/pressrelease/")) return "press";
  if (url.includes("/publication/")) return "publication";
  if (url.includes("/infographic")) return "infographic";
  return "other";
}

const TYPE_RANK = { table: 0, press: 1, publication: 2, infographic: 3, other: 4 };

function stripTags(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ---------- Pencarian (search engine BPS, butuh handshake cookie) ----------

export async function bpsSearch(q, siteKey = "kabupaten") {
  if (!q) return [];
  const site = SITES[siteKey] || SITES.kabupaten;
  const base = `${SEARCH_URL}?mfd=${site.mfd}&content=all&q=${encodeURIComponent(q)}`;
  const headers = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  };
  const url = `${base}&page=1&title=0&from=all&to=all&sort=relevansi`;
  // Mesin pencari BPS butuh handshake cookie (302 → 200). Dari IP datacenter
  // (mis. server Vercel) request pertama bisa ditolak, dan hasil kosong tidak
  // boleh di-cache — jadi tanpa cache + coba ulang sampai 3x.
  for (let attempt = 0; attempt < 3; attempt++) {
    let cookie = "";
    try {
      const first = await fetch(base, { headers, redirect: "manual", cache: "no-store" });
      const setCookies = first.headers.getSetCookie ? first.headers.getSetCookie() : [];
      cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    } catch {
      // lanjut tanpa cookie
    }
    try {
      const res = await fetch(url, {
        headers: cookie ? { ...headers, Cookie: cookie } : headers,
        cache: "no-store",
      });
      if (res.ok) {
        const results = parseSearchHtml(await res.text(), site.host);
        if (results.length) return results;
      }
    } catch {
      // coba lagi
    }
    await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
  }
  return [];
}

export function parseSearchHtml(html, host = SITES.kabupaten.host) {
  const results = [];
  const chunks = html.split('<div class="card-result');
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const urlM = chunk.match(new RegExp(`<a href="(https:\\/\\/${host.replace(/\./g, "\\.")}[^"]+)"`));
    if (!urlM) continue;
    const url = urlM[1].replace(/&amp;/g, "&");
    const tM = chunk.match(/<h5[^>]*>([\s\S]*?)<\/h5>/);
    const pM = chunk.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    results.push({
      url,
      title: stripTags(tM ? tM[1] : "") || url,
      desc: stripTags(pM ? pM[1] : ""),
      type: detectType(url),
    });
  }
  return results;
}

// ---------- Parsing payload flight (halaman GET) ----------

// Ambil substring JSON seimbang mulai dari posisi '{' tertentu,
// memperhitungkan karakter escape (\x di-skip).
function extractBalanced(str, start) {
  let depth = 0;
  let esc = false;
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

// Payload GET berisi objek data dengan quotes ter-escape: \"status\":\"OK\" ...
export function extractFlightData(html) {
  const marker = '\\"data\\":{';
  const i = html.indexOf(marker);
  if (i === -1) return null;
  const brace = html.indexOf("{", i + marker.length - 1);
  const raw = extractBalanced(html, brace);
  if (!raw) return null;
  try {
    return JSON.parse(raw.replace(/\\"/g, '"'));
  } catch {
    return null;
  }
}

// Respons POST server-action berisi JSON bersih pada baris "1:{...}"
export function parseActionResponse(text) {
  const marker = '"response":';
  const i = text.indexOf(marker);
  if (i === -1) return null;
  const raw = extractBalanced(text, i + marker.length);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------- Tabel statistik ----------

export function tableIdFromUrl(tableUrl) {
  const m = tableUrl.match(/\/statistics-table\/\d+\/([^/?#]+)\/?/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Daftar tahun tersedia dari payload halaman GET (listTahun)
export function parseListTahun(html) {
  const out = [];
  const re = /\\"th_id\\":(\d+),\\"th\\":\\"(\d{4})\\"/g;
  let m;
  while ((m = re.exec(html))) out.push({ th_id: Number(m[1]), year: m[2] });
  return out;
}

async function fetchYearViaAction(tableUrl, year) {
  const id = tableIdFromUrl(tableUrl);
  if (!id) return null;
  try {
    const res = await fetch(tableUrl, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "text/x-component",
        "Content-Type": "text/plain;charset=UTF-8",
        "next-action": NEXT_ACTION_ID,
      },
      body: JSON.stringify([{ locale: "id", id, year: String(year - 1900) }]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseActionResponse(await res.text());
  } catch {
    return null;
  }
}

// ---------- Pengambil HTML tahan tantangan Cloudflare ----------
// Situs BPS (tanjabbarkab/jambi) memakai Cloudflare yang menantang IP
// datacenter (mis. server Vercel) dengan 403 "Just a moment...". Dari server
// tersebut, ambil langsung; jika gagal, coba lewat relay publik yang
// mengambil dari IP lain. Relay tetap mengambil dari situs BPS — hanya jalan.

export function isChallengeHtml(html) {
  return /just a moment|attention required|cf-browser-verification|checking your browser/i.test(
    (html || "").slice(0, 3000)
  );
}

export const RELAYS = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

export async function fetchHtmlResilient(url) {
  // 1) Langsung ke situs BPS (berhasil dari IP rumah/kantor).
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length > 1000 && !isChallengeHtml(html)) return html;
    }
  } catch {
    // lanjut ke relay
  }
  // 2) Lewat relay publik (berhasil dari IP datacenter).
  for (const relay of RELAYS) {
    try {
      const res = await fetch(relay(url), {
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const html = await res.text();
        if (html.length > 1000 && !isChallengeHtml(html)) return html;
      }
    } catch {
      // relay berikutnya
    }
  }
  return null;
}

// Ambil data tabel untuk daftar tahun. Mengembalikan:
// { meta, listTahun, byYear: { "2020": data, ... }, defaultYear }
// meta = data GET terbaru (var, vervar, last_update, ...).
export async function fetchTableData(tableUrl, wantYears = []) {
  const html = await fetchHtmlResilient(tableUrl);
  if (!html) return null;
  const meta = extractFlightData(html);
  if (!meta || !meta.var) return null;
  const listTahun = parseListTahun(html);
  const defaultYear = (meta.tahun && meta.tahun[0] && meta.tahun[0].label) || null;

  const byYear = {};
  if (defaultYear) byYear[defaultYear] = meta;

  for (const y of wantYears.slice(0, 8)) {
    if (byYear[y]) continue;
    const d = await fetchYearViaAction(tableUrl, Number(y));
    if (d && d.datacontent) byYear[y] = d;
  }
  return { meta, listTahun, byYear, defaultYear };
}

// ---------- Format jawaban ----------

export function fmtNum(v, decimal = 2) {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "-" || s === "") return "-";
    const n = Number(s);
    if (Number.isNaN(n)) return s;
    v = n;
  }
  if (typeof v !== "number" || Number.isNaN(v)) return "-";
  return v.toFixed(decimal).replace(".", ",");
}

function yearLabel(data) {
  return data && data.tahun && data.tahun[0] ? data.tahun[0].label : "?";
}

export function tableYearsAvailable(table) {
  if (table.listTahun && table.listTahun.length)
    return table.listTahun.map((t) => t.year).sort();
  const y = table.defaultYear;
  return y ? [y] : [];
}

// Kunci datacontent BPS: <vervar><var><turvar><th><turtahun>
function dataKey(verVal, varVal, turVal, thVal, ttVal) {
  return `${verVal}${varVal}${turVal}${thVal}${ttVal}`;
}

// Buat jawaban markdown tabel. years: daftar tahun terurut naik (yang datanya ada).
export function buildTableAnswer(table, years, opts = {}) {
  const { meta } = table;
  const info = meta.var[0] || {};
  const vervar = meta.vervar || [];
  const unit = info.unit || "";
  const decimal = typeof info.decimal === "number" ? info.decimal : 2;
  
  let have = years.filter((y) => table.byYear && table.byYear[y]);
  let fallbackUsed = false;

  // Jika tahun yang diminta tidak ada datanya sama sekali di table.byYear,
  // gunakan tahun yang tersedia agar tidak menghasilkan tabel kosong atau undefined-undefined.
  if (!have.length) {
    const available = Object.keys(table.byYear || {})
      .map(Number)
      .filter((y) => !isNaN(y))
      .sort((a, b) => a - b);
    if (available.length) {
      have = available.slice(-5);
      fallbackUsed = true;
    } else if (table.defaultYear) {
      have = [Number(table.defaultYear)];
      fallbackUsed = true;
    }
  }

  // Jika tabel punya beberapa indikator (turvar), pilih yang cocok dengan
  // kata kunci pertanyaan; kalau tidak ada yang cocok, pakai yang pertama.
  let pickTur = null;
  let indicatorNote = null;
  const d0 = have.length ? table.byYear[have[0]] : null;
  if (d0 && d0.turvar && d0.turvar.length > 1) {
    let chosen = null;
    if (opts.prefer && opts.prefer.length) {
      for (const p of opts.prefer) {
        const hit = d0.turvar.find((tv) => (tv.label || "").toLowerCase().includes(p));
        if (hit) {
          chosen = hit;
          break;
        }
      }
    }
    if (!chosen) chosen = d0.turvar[0];
    pickTur = chosen;
    const others = d0.turvar.filter((t) => t !== chosen).map((t) => t.label);
    indicatorNote = others.length
      ? `Indikator: **${chosen.label}**. Tabel ini juga memuat: ${others.join(", ")}.`
      : `Indikator: **${chosen.label}**`;
  }

  const lines = [];
  let span = "";
  if (have.length > 0) {
    span = have.length === 1 ? `${have[0]}` : `${have[0]}–${have[have.length - 1]}`;
  } else if (years.length > 0) {
    span = years.length === 1 ? `${years[0]}` : `${years[0]}–${years[years.length - 1]}`;
  }

  const title = unit ? `${info.label} (${unit})` : info.label;
  if (span) {
    lines.push(`**${title}, ${span}**`);
  } else {
    lines.push(`**${title}**`);
  }
  if (info.def && opts.withDef) {
    lines.push("");
    lines.push(info.def.length > 400 ? info.def.slice(0, 400) + "…" : info.def);
  }
  if (indicatorNote) {
    lines.push("");
    lines.push(indicatorNote);
  }
  lines.push("");
  const header = `| Wilayah | ${have.join(" | ")} |`;
  const sep = `|---|${have.map(() => "---").join("|")}`;
  lines.push(header);
  lines.push(sep);

  const filter = opts.regionFilter; // Set label wilayah yang diminta (lowercase), atau null
  for (const v of vervar) {
    if (filter && !filter.has(v.label.toLowerCase())) continue;
    const cells = have.map((y) => {
      const d = table.byYear[y];
      if (!d || !d.datacontent) return "-";
      const th = d.tahun && d.tahun[0] ? d.tahun[0].val : "";
      const tt = d.turtahun && d.turtahun[0] ? d.turtahun[0].val : 0;
      const turVal = pickTur
        ? pickTur.val
        : d.turvar && d.turvar.length
          ? d.turvar[0].val
          : 0;
      let val = d.datacontent[dataKey(v.val, meta.var[0].val, turVal, th, tt)];
      if (val === undefined && (turVal === undefined || turVal !== 0)) {
        val = d.datacontent[dataKey(v.val, meta.var[0].val, 0, th, tt)];
      }
      return fmtNum(val, decimal);
    });
    lines.push(`| ${v.label} | ${cells.join(" | ")} |`);
  }

  lines.push("");
  const site = siteFromUrl(table.url);
  lines.push(
    `Sumber: [${info.label}](${table.url || ""}) — ${site.label}`
  );
  if (meta.last_update) lines.push(`Terakhir diperbarui: ${meta.last_update}`);
  const missing = years.filter((y) => !table.byYear || !table.byYear[y]);
  if (missing.length) {
    if (fallbackUsed && have.length) {
      lines.push(
        `Catatan: data tahun ${missing.join(", ")} belum tersedia di situs BPS. Menampilkan data tahun ${have.join(", ")} yang tersedia.`
      );
    } else {
      lines.push(`Catatan: data tahun ${missing.join(", ")} tidak tersedia.`);
    }
  }
  return lines.join("\n");
}
