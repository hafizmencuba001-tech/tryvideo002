# Nota projek: Garaj Sejarah (untuk sesi Claude seterusnya)

## Cara sambung projek (untuk pemilik projek)

Kalau ingatan Claude penuh atau sesi tamat:
1. Buka sesi baru dengan repo **tryvideo002** dan cawangan **claude/blocky-3d-art-style-49qp0b**.
2. Taip: **"Baca NOTA-PROJEK.md dan sambung projek Garaj Sejarah"**.

Claude akan baca nota ni dan tahu semua keputusan, fail dan status projek.

**Backup:**
| Apa | Di mana |
|---|---|
| Semua kod, watak, animasi, cerita, bunyi | GitHub, cawangan ini (setiap perubahan direkod dalam "commits") |
| Logo, banner, kulit video, panduan jenama | Folder `branding/` |
| Keputusan dan status projek | Fail ini (`NOTA-PROJEK.md`) |
| Kunci Gemini | Tetapan persekitaran cloud (tidak disimpan dalam kod) |
| Video MP4 | Tidak disimpan dalam GitHub. Simpan sendiri dalam telefon atau Google Drive selepas render. |

**Salinan tambahan:** dalam GitHub, butang hijau **Code**, kemudian **Download ZIP**. Simpan dalam komputer atau Google Drive.

---

Baca fail ni dulu bila sambung projek. Pemilik projek bercakap Bahasa Melayu santai (panggil "awak"). Ikut `CLAUDE.md` untuk peraturan kit.

## Status semasa

- **Episod utama:** `stories/my-sejarah-e1.json`. Tajuknya "Evolusi Starter Motor - Part 1: Sebelum Starter Motor Wujud", panjang anggaran 90.9 s, 23 baris.
- **Belum dirender dengan suara sebenar.** Tunggu kunci Gemini: `GEMINI_API_KEY` dan `VOICE_PROVIDER=gemini` sebagai pemboleh ubah persekitaran dalam tetapan persekitaran cloud. Jangan minta kunci dalam chat.
- Render: `rm -rf comp/vo/my-sejarah-e1 && npm run video -- my-sejarah-e1`. Pastikan `npm install` dah dijalankan dulu.
- Selepas render: semak masa sari kata (dikira daripada tempoh setiap baris), kekuatan bunyi khas, dan panjang video (sasaran ~90 s).

## Keputusan yang dah dibuat (jangan ubah tanpa tanya)

- **Gaya:** Blocky 3D (`s1-kotak`, PandaiTech). Set sendiri: `my-sejarah`, berasaskan `s1-kotak`.
- **Watak:** **Prof. Hamzah** (kunci `sejarah_prof`, peranan `bos`, rambut dan misai putih, jaket tweed, tali leher kupu-kupu, suara Gemini Charon) dan **Dr. Danial** (kunci `sejarah_asst`, peranan `intern`, kardigan toska, kad nama, SIZE 1.12, suara Gemini Puck).
- **Channel:** **Garaj Sejarah** (global nanti: History Garage). Nama watak hanya dalam bio. Panduan, bio, warna dan fail ada dalam `branding/`.
- **Nama orang/jenama sebenar:** "Karl Benz" ditukar jadi "seorang jurutera Jerman" atas permintaan pemilik.
- **Gaya penceritaan campur:** animasi penuh skrin (shot `full`) bila Prof bercerita, watak 3D untuk soalan dan reaksi. Shot `full` tiada gerakan kamera (`"camera": "none"`).
- **Buka dengan kickback** (beat 2.2 s, skrin `coldopen` dengan `t0` 1.1). Tamat dengan kad akhir BERSAMBUNG dan branding (beat 3 s).
- **Jam dinding** hidup: mula 11:48:00 PM dan bergerak ikut masa cerita.

## Fail set sendiri (boleh diubah; enjin dan fail gaya asal JANGAN diubah)

| Fail | Isi |
|---|---|
| `comp/my-sejarah.cast.js` | Lukisan dua watak. Tombol rupa (warna, SIZE) di atas setiap builder. |
| `comp/my-sejarah.screen.js` | Jenis skrin `anim` (animasi monitor dan penuh skrin). Babak: `dashboard`, `tajuk`, `kereta1886`, `flywheel`, `flywheel_hidup`, `garismasa`, `crank`, `kickback`, `butang`, `bersambung` (`text:false` = tanpa tulisan). |
| `comp/my-sejarah.loc-pejabat.js` | Lokasi pejabat + shot `full` + staging Prof + jam hidup + lampu malap (`"lights":"dim"`) + jadual bunyi khas + lapisan atas. |
| `comp/my-sejarah.overlay.js` | Lapisan HTML: watermark, sari kata (medan `sub` setiap baris, perkataan semasa jadi emas), label nama (medan `label`), kad akhir. `BRAND` dan `logoSVG()` ada di sini. |
| `comp/my-sejarah-sfx/*.wav` | Bunyi khas (dijana dengan ffmpeg): bang, putt, ratchet, ding, glitch, thump. |
| `library/my-sejarah/` | `set.json` (pemetaan peranan) dan `cast.json` (suara Gemini). |
| `scripts/suara-sementara.mjs` | Suara sementara untuk ambil gambar di Linux, tanpa kredit API. |

## Medan cerita tambahan (khas set ini)

- Baris: `sub` (teks sari kata, ejaan betul), `label` `{name, role}`, `lights: "dim"`.
- Skrin `anim`: `anim`, `title`, `caption`, `t0` (anjakan masa mula), `text` (untuk `bersambung`).

## Cara render (pemilik cuma ada phone)

Render tidak guna phone. Ia berjalan di server. Phone hanya untuk chat, tekan butang, dan muat turun MP4.

- **Kelajuan di server cloud Claude:** lebih kurang 2.9 saat setiap frame (tiada GPU, rendering perisian). Video 90 s ada 2,727 frame, jadi render ambil lebih kurang **2 jam 10 minit**. Diukur pada 20 Nov 2026.
- **Pilihan 1 (cuba dulu): render di server sesi Claude.** Jalankan di latar belakang (`npm run video -- my-sejarah-e1`), kemudian hantar MP4 kepada pemilik dalam chat. Risiko: sesi boleh ditutup kalau lama tiada aktiviti, dan had masa tugasan latar belakang lebih kurang 2 jam, betul-betul kat had. Kalau terputus, guna Pilihan 2.
- **Pilihan 2 (lebih stabil, percuma): GitHub Actions.** Repo private dapat 2,000 minit percuma sebulan; satu episod lebih kurang 130 minit, jadi muat lebih kurang 15 episod sebulan. Perlu disediakan:
  - Fail workflow `.github/workflows/render.yml`: jalan secara manual (`workflow_dispatch`, input story id) di `ubuntu-latest`, dengan langkah setup Node 22, `npm ci`, `npm run video -- <id>`, dan muat naik `out/<id>.mp4` sebagai artifact.
  - Pemilik tambah `GEMINI_API_KEY` sebagai rahsia repo (Settings → Secrets and variables → Actions). Workflow set `VOICE_PROVIDER=gemini`.
  - Pemilik tekan "Run workflow" dalam app atau web GitHub, kemudian muat turun MP4 dari bahagian Artifacts.
  - Belum disediakan. Buat bila Pilihan 1 gagal atau bila episod dah kerap.

## Pelan suara (bajet RM0)

Pemilik mahu monetize channel tetapi tiada bajet untuk pelan suara berbayar.

1. **Sekarang: Gemini percuma.** Pemboleh ubah persekitaran `GEMINI_API_KEY` dan `VOICE_PROVIDER=gemini`. Suara watak dah ditetapkan dalam `library/my-sejarah/cast.json` (Prof. Hamzah = Charon, Dr. Danial = Puck). Kuota harian terhad; baris yang dah siap disimpan, jadi boleh sambung esok.
2. **Bila hampir layak monetize: suara sendiri, dirakam terus (bukan klon).** Percuma dan paling selamat untuk monetize. Pemilik rakam setiap baris dengan telefon. Claude potong setiap baris, buang bunyi bising, seimbangkan kekuatan, dan letak sebagai `comp/vo/<id>/NN.wav`. Pemilik boleh suarakan dua-dua watak; suara Dr. Danial dinaikkan sedikit dengan ffmpeg supaya berbeza daripada Prof. Hamzah. Sari kata ikut masa suara sebenar.
3. **Bila channel dah dapat duit:** pertimbangkan Gemini berbayar (bil diaktifkan, sangat murah) atau ElevenLabs Starter (lebih kurang USD 5–6 sebulan, lesen komersial jelas, ada klon suara).

**Elakkan untuk video yang dimonetize:**
- ElevenLabs pelan percuma (bukan komersial dan perlu atribusi).
- Model klon suara sumber terbuka seperti XTTS dan F5-TTS (kebanyakan berlesen bukan komersial).

**Syarat platform (semak semula sebelum mohon monetize, polisi selalu berubah):**
- YouTube tak larang suara AI. Yang tak dibenarkan ialah kandungan templat yang diulang atau dibaca dari kandungan orang lain. Pastikan setiap episod betul-betul asli.
- Label AI wajib hanya untuk kandungan realistik. Hidupkan label pun tak rugi.
- Creator Rewards TikTok dilaporkan belum dibuka untuk Malaysia. YouTube lebih sesuai untuk monetize.
- Tanya PandaiTech tentang penggunaan enjin mereka untuk channel komersial.

## Idea seterusnya

- Part 2: "Bahaya Crank Handle" (kickback dan kecederaan), kemudian kelahiran starter motor elektrik (1912).
- Fasa global: sari kata Inggeris, kemudian versi suara Inggeris "History Garage".
