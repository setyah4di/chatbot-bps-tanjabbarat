# Chatbot Data BPS Kabupaten Tanjung Jabung Barat

Chatbot web publik (tanpa LLM, gratis) yang menjawab pertanyaan data statistik
dengan mengambil data langsung dari situs [BPS Kabupaten Tanjung Jabung Barat](https://tanjabbarkab.bps.go.id/id).

## Cara kerja
- Pencarian: mesin pencari BPS (`searchengine.web.bps.go.id`, mfd=1507), hasil tabel statistik diprioritaskan.
- Data tabel: diambil dari payload Next.js (flight) halaman statistics-table.
- Ganti tahun: POST server-action ke halaman tabel yang sama (id aksi build-specific; jika BPS redeploy dan ganti tahun gagal, chatbot memakai tahun default tersedia dengan catatan).
- Jawaban berupa teks + tabel markdown + tautan sumber + tanggal pembaruan.

## Menjalankan lokal
```
npm install
npm run dev
# buka http://localhost:3000
```

## Deploy ke Vercel (gratis)
1. Push folder ini ke repositori GitHub.
2. Buka [vercel.com](https://vercel.com), sign in dengan GitHub.
3. *Add New Project* → impor repositori → Deploy (tanpa env vars).
4. Setelah selesai, URL publik seperti `https://bps-chatbot.vercel.app` bisa dipakai siapa pun.
