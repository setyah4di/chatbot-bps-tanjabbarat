"use client";

import { useEffect, useRef, useState } from "react";

const EXAMPLES = [
  { icon: "📈", label: "Tren IPM 2020–2025", query: "Tren IPM Tanjung Jabung Barat 2020–2025" },
  { icon: "👥", label: "Jumlah Penduduk", query: "Berapa jumlah penduduk Tanjung Jabung Barat?" },
  { icon: "📉", label: "Kemiskinan 2025", query: "Persentase penduduk miskin Tanjung Jabung Barat 2025" },
  { icon: "🎓", label: "Harapan Lama Sekolah", query: "Berapa HLS Tanjung Jabung Barat 2024?" },
  { icon: "💼", label: "Pengangguran Terbuka", query: "Tingkat Pengangguran Terbuka Tanjung Jabung Barat" },
  { icon: "🌾", label: "Pertanian & Sawit", query: "Data produksi pertanian perkebunan kelapa sawit Tanjung Jabung Barat" },
];

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function BotAvatar() {
  return <img src="/logo_bps.png" alt="Logo BPS" />;
}



function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Inline renderer: Bold, Italic, Inline Code, Links
function renderInline(text, keyBase) {
  const parts = [];
  let rest = text;
  let k = 0;
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  let m;
  let last = 0;
  while ((m = re.exec(rest))) {
    if (m.index > last) parts.push(rest.slice(last, m.index));
    if (m[1]) {
      parts.push(<strong key={`${keyBase}-b${k++}`}>{m[1]}</strong>);
    } else if (m[2]) {
      parts.push(<em key={`${keyBase}-i${k++}`}>{m[2]}</em>);
    } else if (m[3]) {
      parts.push(<code key={`${keyBase}-c${k++}`}>{m[3]}</code>);
    } else if (m[4]) {
      parts.push(
        <a key={`${keyBase}-a${k++}`} href={m[5]} target="_blank" rel="noopener noreferrer">
          {m[4]}
        </a>
      );
    } else if (m[6]) {
      parts.push(
        <a key={`${keyBase}-u${k++}`} href={m[6]} target="_blank" rel="noopener noreferrer">
          {m[6]}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < rest.length) parts.push(rest.slice(last));
  return parts;
}

function BotMessage({ text }) {
  const [copied, setCopied] = useState(false);
  const lines = text.split("\n");
  const blocks = [];
  let tableBuf = [];

  const handleCopy = () => {
    // Copy clean text
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const flushTable = (i) => {
    if (!tableBuf.length) return;
    const rows = tableBuf
      .filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l))
      .map((l) =>
        l
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim())
      );
    if (rows.length) {
      const [head, ...body] = rows;
      blocks.push(
        <div className="table-wrapper" key={`t${i}`}>
          <table>
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th key={j}>{renderInline(c, `th${i}-${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, j) => (
                    <td key={j}>{renderInline(c, `td${i}-${ri}-${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-hint">Geser tabel ke samping jika terpotong pada layar ponsel →</div>
        </div>
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

    // Bullet items
    if (/^\s*[-*]\s+/.test(line)) {
      const bulletContent = line.replace(/^\s*[-*]\s+/, "");
      blocks.push(
        <div className="msg-bullet-item" key={`b${i}`}>
          <div className="msg-bullet-dot" />
          <div>{renderInline(bulletContent, `bl${i}`)}</div>
        </div>
      );
      return;
    }

    blocks.push(
      <p className="bot-p" key={`p${i}`}>
        {renderInline(line, `l${i}`)}
      </p>
    );
  });
  flushTable(lines.length);

  return (
    <>
      <div>{blocks}</div>
      <div className="msg-actions">
        <button className="copy-btn" onClick={handleCopy} title="Salin teks respon ini">
          {copied ? (
            <>
              <CheckIcon />
              <span style={{ color: "#10b981", fontWeight: 600 }}>Tersalin!</span>
            </>
          ) : (
            <>
              <CopyIcon />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}

const INITIAL_MESSAGE = {
  role: "bot",
  time: getCurrentTime(),
  text:
    "Halo! Selamat datang di **Chatbot Data Statistik BPS Tanjung Jabung Barat** 👋\n\nSaya siap membantu Anda menemukan data resmi Kabupaten Tanjung Jabung Barat, seperti:\n- **Indeks Pembangunan Manusia (IPM)**\n- **Kependudukan & Ketenagakerjaan**\n- **Kemiskinan & Garis Kemiskinan**\n- **Pendidikan (HLS & RLS)**\n- **Pertanian, Perkebunan, dan PDRB**\n\nSilakan pilih salah satu pertanyaan populer di bawah atau ketik langsung pertanyaan Anda!",
};

export default function Page() {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleScroll = () => {
    if (!chatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 140;
    setShowScrollBottom(isUp);
  };

  const resetChat = () => {
    if (window.confirm("Mulai percakapan baru? Riwayat obrolan akan dibersihkan.")) {
      setMessages([{ ...INITIAL_MESSAGE, time: getCurrentTime() }]);
      setInput("");
      if (inputRef.current) inputRef.current.focus();
    }
  };

  async function send(text) {
    const q = (text || input).trim();
    if (!q || loading) return;

    const userTime = getCurrentTime();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q, time: userTime }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: data.answer || "Maaf, data tidak ditemukan atau terjadi kesalahan dalam memproses permintaan.",
          time: getCurrentTime(),
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: "Gagal terhubung ke server. Pastikan koneksi internet aktif dan coba lagi beberapa saat lagi.",
          time: getCurrentTime(),
        },
      ]);
    }
    setLoading(false);
  }

  return (
    <div className="app">
      {/* Header dengan identitas BPS */}
      <header className="site">
        <div className="header-left">
          <div className="header-logo-badge">
            <img src="/logo_bps.png" alt="Logo BPS" className="header-logo-img" />
          </div>
          <div className="header-titles">
            <div className="header-badge-row">
              <span className="badge-tag">BPS Tanjab Barat</span>
              <span className="badge-status">
                <span className="badge-status-dot" />
                Online
              </span>
            </div>
            <h1>Chatbot Data Statistik</h1>
            <p>Layanan Informasi Resmi BPS Kabupaten Tanjung Jabung Barat</p>
          </div>
        </div>

        <div className="header-actions">
          <button className="header-btn" onClick={resetChat} title="Mulai sesi obrolan baru">
            <RefreshIcon />
            <span>Mulai Ulang</span>
          </button>
          <a
            className="header-btn"
            href="https://tanjabbarkab.bps.go.id/id"
            target="_blank"
            rel="noopener noreferrer"
            title="Kunjungi Website Resmi BPS Tanjung Jabung Barat"
          >
            <span>Situs BPS</span>
            <ExternalLinkIcon />
          </a>
        </div>
      </header>

      {/* Chat Area */}
      <div className="chat" ref={chatRef} onScroll={handleScroll}>
        {messages.map((m, i) => (
          <div key={i} className={`msg-row ${m.role === "user" ? "user" : "bot"}`}>
            <div className={`msg-avatar ${m.role === "user" ? "user" : "bot"}`}>
              {m.role === "user" ? <UserIcon /> : <BotAvatar />}
            </div>

            <div className="msg-content-wrapper">
              <div className="msg-meta">
                <span className="msg-author">
                  {m.role === "user" ? "Anda" : "Asisten Statistik BPS"}
                </span>
                <span>•</span>
                <span>{m.time || getCurrentTime()}</span>
              </div>

              <div className={`msg ${m.role === "user" ? "user" : "bot"}`}>
                {m.role === "user" ? m.text : <BotMessage text={m.text} />}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="msg-row bot">
            <div className="msg-avatar bot">
              <BotAvatar />
            </div>
            <div className="msg-content-wrapper">
              <div className="msg-meta">
                <span className="msg-author">Asisten Statistik BPS</span>
                <span>•</span>
                <span>Mencari data...</span>
              </div>
              <div className="loading-indicator">
                <div className="dots-loader">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="loading-text">Sedang mencari data di situs BPS Tanjung Jabung Barat…</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tombol kembali ke paling bawah jika pengguna scroll ke atas */}
      {showScrollBottom && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom}>
          ↓ Pesan Terbaru
        </button>
      )}

      {/* Rekomendasi Pertanyaan Populer */}
      <div className="examples-section">
        <div className="examples-header">
          <span>💡</span>
          <span>Pertanyaan Populer:</span>
        </div>
        <div className="examples-list">
          {EXAMPLES.map((e) => (
            <button
              key={e.query}
              className="example-chip"
              onClick={() => send(e.query)}
              disabled={loading}
            >
              <span>{e.icon}</span>
              <span>{e.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form Input Composer */}
      <form
        className="composer"
        onSubmit={(ev) => {
          ev.preventDefault();
          send();
        }}
      >
        <div className="input-container">
          <input
            ref={inputRef}
            value={input}
            onChange={(ev) => setInput(ev.target.value)}
            placeholder="Tulis pertanyaan seputar data statistik BPS..."
            disabled={loading}
          />
          {input.length > 0 && (
            <button
              type="button"
              className="clear-input-btn"
              onClick={() => setInput("")}
              title="Bersihkan teks"
            >
              ✕
            </button>
          )}
        </div>

        <button type="submit" disabled={loading || !input.trim()} title="Kirim pertanyaan">
          <SendIcon />
          <span className="send-btn-text">Kirim</span>
        </button>
      </form>

      {/* Footer Info */}
      <footer className="credit">
        Data bersumber dari{" "}
        <a href="https://tanjabbarkab.bps.go.id/id" target="_blank" rel="noopener noreferrer">
          BPS Kabupaten Tanjung Jabung Barat
        </a>
        . Informasi disajikan secara otomatis untuk kemudahan akses data publik.
      </footer>
    </div>
  );
}
