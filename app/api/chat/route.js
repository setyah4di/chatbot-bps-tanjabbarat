// app/api/chat/route.js — otak chatbot: terjemahkan pertanyaan → data BPS
import {
  bpsSearch,
  fetchTableData,
  buildTableAnswer,
  tableYearsAvailable,
} from "../../../lib/bps";

export const runtime = "nodejs";
export const maxDuration = 60;

const STOPWORDS = new Set(
  `berapa berapakah berapa kah kah data angka jumlah nilai rate persen di pada pada tahun tahunan dari sampai hingga ke untuk dan atau yang itu ini kabupaten kab provinsi prov tanjung jabung barat tanjabbar tanjab tanjabbarg jambi jamby silakan tolong mohon saya
  `
    .split(/\s+/)
    .filter(Boolean)
);

const REGION_ALIASES = {
  "provinsi jambi": "provinsi jambi",
  "tanjung jabung barat": "tanjung jabung barat",
  "tanjabbar": "tanjung jabung barat",
  "tanjung jabung timur": "tanjung jabung timur",
  "tanjabtim": "tanjung jabung timur",
  "kerinci": "kerinci",
  "merangin": "merangin",
  "sarolangun": "sarolangun",
  "batanghari": "batanghari",
  "muaro jambi": "muaro jambi",
  "tebo": "tebo",
  "bungo": "bungo",
  "kota jambi": "kota jambi",
  "kota sungai penuh": "kota sungai penuh",
  "sungai penuh": "kota sungai penuh",
  "indonesia": "indonesia",
};

const TREND_WORDS = /tren|perkembangan|kecenderungan|grafik|dari\s+tahun\s+\d{4}\s*(hingga|sampai|ke|s\/d|-)\s*\d{4}/i;

// Mesin pencari BPS tidak mengenali banyak singkatan — ekspansi sebelum mencari.
const ABBREV_EXPANSIONS = {
  hls: "harapan lama sekolah",
  rls: "rata rata lama sekolah",
  apm: "angka partisipasi murni",
  apk: "angka partisipasi kasar",
  uhh: "umur harapan hidup",
  pdrb: "produk domestik regional bruto",
  ipk: "indeks kepuasan masyarakat",
};

function extractYears(text) {
  // Rentang "2021 sampai 2025" / "2021-2025" → semua tahun di antaranya
  const range = text.match(/20(\d{2})\s*(?:tahun\s*)?(?:sampai|hingga|ke|s\/d|sd|-|–|—|\/)\s*(?:tahun\s*)?20(\d{2})/i);
  if (range) {
    const a = Number("20" + range[1]);
    const b = Number("20" + range[2]);
    const max = new Date().getFullYear() + 1;
    if (a >= 1990 && b <= max && b > a) {
      const years = [];
      for (let y = a; y <= b && years.length < 8; y++) years.push(y);
      return years;
    }
  }
  const years = (text.match(/20\d{2}/g) || [])
    .map(Number)
    .filter((y) => y >= 1990 && y <= new Date().getFullYear() + 1);
  return [...new Set(years)].sort((a, b) => a - b);
}

function extractRegions(text) {
  const lower = " " + text.toLowerCase() + " ";
  const found = new Set();
  for (const [alias, label] of Object.entries(REGION_ALIASES)) {
    if (lower.includes(alias)) found.add(label);
  }
  return found;
}

function extractKeywords(text, expand = true) {
  let t = text.toLowerCase();
  t = t.replace(/20\d{2}/g, " ");
  for (const alias of Object.keys(REGION_ALIASES)) t = t.split(alias).join(" ");
  const words = t
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map((w) => (expand && ABBREV_EXPANSIONS[w] ? ABBREV_EXPANSIONS[w] : w));
  return words;
}

// Pilih hasil terbaik: tabel diprioritaskan, lalu tekanan media/publikasi,
// dengan boost jika judul memuat kata kunci.
function rankResults(results, keywords) {
  return results
    .map((r) => {
      const titleLower = r.title.toLowerCase();
      let score = 100 - (100 >> 0) + (10 - (r.type === "table" ? 0 : r.type === "press" ? 1 : r.type === "publication" ? 2 : 3)) * 10;
      for (const kw of keywords) if (titleLower.includes(kw)) score += 5;
      return { r, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r);
}

function answerNonTable(r) {
  const typeLabel = { press: "Siaran pers", publication: "Publikasi", infographic: "Infografis", other: "Halaman" };
  return {
    answer: `Yang paling relevan dari situs BPS Kabupaten Tanjung Jabung Barat:\n\n**${r.title}**\n${r.desc ? r.desc + "\n" : ""}\nBaca lengkap: ${r.url}`,
    links: [r.url],
  };
}

function answerNoResult(keywords) {
  return {
    answer:
      keywords.length
        ? `Tidak menemukan data yang cocok untuk "${keywords.join(" ")}" di situs BPS Tanjung Jabung Barat. Coba gunakan istilah lain, misalnya "kemiskinan", "penduduk", "ipm", "padi", atau "inflasi".`
        : "Tulis pertanyaan data yang ingin dicari, misalnya: *Berapa jumlah penduduk Tanjung Jabung Barat 2024?*",
    links: [],
  };
}

export async function POST(req) {
  let message = "";
  try {
    const body = await req.json();
    message = String(body.message || "").slice(0, 500);
  } catch {
    /* abaikan */
  }
  if (!message.trim()) {
    return Response.json({ answer: "Pertanyaan masih kosong. Contoh: *Berapa IPM Tanjung Jabung Barat 2024?*", links: [] });
  }

  const years = extractYears(message);
  const regions = extractRegions(message);
  const keywords = extractKeywords(message);
  const isTrend = TREND_WORDS.test(message);

  let results = [];
  try {
    results = await bpsSearch(keywords.join(" "));
    if (!results.length) {
      const alt = extractKeywords(message, false).join(" ");
      if (alt && alt !== keywords.join(" ")) results = await bpsSearch(alt);
    }
  } catch {
    return Response.json({
      answer: "Gagal menghubungi mesin pencari BPS. Coba lagi beberapa saat.",
      links: [],
    });
  }
  if (!results.length) return Response.json(answerNoResult(keywords));

  const ranked = rankResults(results, keywords);
  const best = ranked[0];

  // Tahun yang diminta: jika pertanyaan tren tanpa menyebut tahun, ambil 6 tahun terakhir.
  let wantYears = years;
  if (isTrend && wantYears.length < 2) {
    const available = await tableYearsAvailableSafe(best.url);
    if (available.length > 1) {
      const last = available.slice(-6).map(Number);
      wantYears = last;
    }
  }
  wantYears = wantYears.map(Number).filter((y) => y >= 1990 && y <= new Date().getFullYear() + 1);

  // Cari kandidat hasil yang bertipe "table"
  const tableCandidates = ranked.filter((r) => r.type === "table");
  let table = null;
  let chosenResult = best;

  if (tableCandidates.length) {
    for (const cand of tableCandidates.slice(0, 2)) {
      try {
        table = await fetchTableData(cand.url, wantYears);
        if (table && table.meta) {
          chosenResult = cand;
          break;
        }
      } catch (err) {
        console.error("fetchTableData error:", err);
      }
    }
  }

  // Jika tetap tidak ada tabel yang berhasil diambil datanya, fallback ke non-table
  if (!table) return Response.json(answerNonTable(best));

  // Urut naik, batasi 6 tahun. Jika pengguna menyebut tahun tertentu,
  // tampilkan hanya tahun itu (tahun yang datanya tak ada tetap dicatat).
  const have = years.length
    ? years.map(Number).slice(0, 6)
    : Object.keys(table.byYear || {})
        .map(Number)
        .sort((a, b) => a - b)
        .slice(0, 6);
  if (!have.length) return Response.json(answerNonTable(chosenResult));

  const answer = buildTableAnswer(
    { ...table, url: chosenResult.url },
    have,
    {
      regionFilter: regions.size ? regions : null,
      withDef: false,
      prefer: keywords.map((k) => k.toLowerCase()),
    }
  );
  return Response.json({
    answer,
    links: [chosenResult.url, ...ranked.slice(1, 4).map((r) => r.url)].filter(Boolean),
  });
}

async function tableYearsAvailableSafe(url) {
  try {
    return await tableYearsAvailableFetch(url);
  } catch {
    return [];
  }
}

// helper kecil agar tak menambah dependensi
async function tableYearsAvailableFetch(url) {
  const { fetchTableData } = await import("../../../lib/bps");
  const t = await fetchTableData(url, []);
  return tableYearsAvailable(t || { listTahun: [] });
}
