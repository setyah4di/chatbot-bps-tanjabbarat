"use client";

import { useEffect, useRef, useState } from "react";

const EXAMPLES = [
  "Berapa HLS Tanjung Jabung Barat 2024?",
  "Tren IPM Tanjung Jabung Barat 2020–2025",
  "Berapa jumlah penduduk Tanjung Jabung Barat?",
  "Persentase penduduk miskin 2025",
];

// Renderer markdown minimal: bold, tautan, tabel pipe, baris baru.
function renderInline(text, keyBase) {
  const parts = [];
  let rest = text;
  let k = 0;
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  let m;
  let last = 0;
  while ((m = re.exec(rest))) {
    if (m.index > last) parts.push(rest.slice(last, m.index));
    if (m[1]) parts.push(<strong key={`${keyBase}-b${k++}`}>{m[1]}</strong>);
    else if (m[2]) parts.push(<em key={`${keyBase}-i${k++}`}>{m[2]}</em>);
    else if (m[3])
      parts.push(
        <a key={`${keyBase}-a${k++}`} href={m[4]} target="_blank" rel="noopener noreferrer">
          {m[3]}
        </a>
      );
    else if (m[5])
      parts.push(
        <a key={`${keyBase}-u${k++}`} href={m[5]} target="_blank" rel="noopener noreferrer">
          {m[5]}
        </a>
      );
    last = m.index + m[0].length;
  }
  if (last < rest.length) parts.push(rest.slice(last));
  return parts;
}

function BotMessage({ text }) {
  const lines = text.split("\n");
  const blocks = [];
  let tableBuf = [];

  const flushTable = (i) => {
    if (!tableBuf.length) return;
    const rows = tableBuf
      .filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l))
      .map((l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
    if (rows.length) {
      const [head, ...body] = rows;
      blocks.push(
        <table key={`t${i}`}>
          <thead>
            <tr>{head.map((c, j) => <th key={j}>{renderInline(c, `th${i}-${j}`)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri}>{r.map((c, j) => <td key={j}>{renderInline(c, `td${i}-${ri}-${j}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
    }
    tableBuf = [];
  };

  lines.forEach((line, i) => {
    if (/^\s*\|/.test(line)) {
      tableBuf.push(line);
      return;
    }
    flushTable(i);
    if (line.trim() === "") return;
    blocks.push(<div key={`p${i}`}>{renderInline(line, `l${i}`)}</div>);
  });
  flushTable(lines.length);
  return <>{blocks}</>;
}

export default function Page() {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text:
        "Selamat datang! 👋 Saya chatbot data **BPS Kabupaten Tanjung Jabung Barat**.\nTanyakan data apa saja, misalnya: *Berapa persentase penduduk miskin Tanjung Jabung Barat 2025?*\nJawaban bersumber langsung dari tanjabbarkab.bps.go.id.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text) {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "bot", text: data.answer || "Terjadi kesalahan." }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Gagal menghubungi server. Coba lagi." }]);
    }
    setLoading(false);
  }

  return (
    <div className="app">
      <header className="site">
        <h1>🤖 Chatbot Data BPS Kabupaten Tanjung Jabung Barat</h1>
        <p>Tanya jawab data statistik — bersumber dari tanjabbarkab.bps.go.id</p>
      </header>

      <div className="chat" ref={chatRef}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "msg user" : "msg bot"}>
            {m.role === "user" ? m.text : <BotMessage text={m.text} />}
          </div>
        ))}
        {loading && <div className="msg bot">Mencari data di situs BPS…</div>}
      </div>

      <div className="examples">
        {EXAMPLES.map((e) => (
          <button key={e} onClick={() => send(e)} disabled={loading}>
            {e}
          </button>
        ))}
      </div>

      <form
        className="composer"
        onSubmit={(ev) => {
          ev.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(ev) => setInput(ev.target.value)}
          placeholder="Tulis pertanyaan data statistik…"
          autoFocus
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Kirim
        </button>
      </form>

      <footer className="credit">
        Data bersumber dari{" "}
        <a href="https://tanjabbarkab.bps.go.id/id" target="_blank" rel="noopener noreferrer">
          BPS Kabupaten Tanjung Jabung Barat
        </a>
        . Chatbot ini bukan produk resmi BPS.
      </footer>
    </div>
  );
}
