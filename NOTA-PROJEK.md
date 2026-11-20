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

## Idea seterusnya

- Part 2: "Bahaya Crank Handle" (kickback dan kecederaan), kemudian kelahiran starter motor elektrik (1912).
- Fasa global: sari kata Inggeris, kemudian versi suara Inggeris "History Garage".
