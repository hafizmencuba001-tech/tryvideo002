# Mula Sini: Video Claude (Library 30 Animasi)

Folder ini ialah enjin untuk buat video animasi menegak (TikTok, Reels, Shorts) dengan Claude. Anda tak perlu pandai code. Claude yang jalankan semuanya.

## Apa ada dalam folder ini

- **Enjin animasi** sahaja. Gaya (set) ditambah satu demi satu dari galeri: https://pandaitech.my/v/gaya (30 gaya: s1 hingga s5 dan s7 hingga s31).
- Setiap gaya yang ditambah bawa watak tetap, tempat, satu episod contoh (`stories/s10-e1.json` dan seterusnya) dan kad set `library/<nama-set>/README.md`.
- **CLAUDE.md**: arahan untuk Claude. Anda tak perlu baca atau ubah.

## 3 ayat untuk ditaip kepada Claude

Buka folder ini dalam Claude (Claude Desktop atau Claude Code), kemudian taip:

1. **"Sediakan folder ni untuk saya"**
   Claude pasang apa yang perlu (Node, ffmpeg, semak Chrome). Tak perlu password Mac. Buat sekali sahaja.
2. **Tampal link gaya dari galeri**, contoh `https://pandaitech.my/v/gaya/s10-kertas`
   Claude muat turun gaya itu sahaja, tunjuk 2 gambar contoh, dan boleh render video contoh.
3. **"Buat episod baru set s10 tentang promosi durian"**
   Claude tulis cerita ~100 patah perkataan, tunjuk ayat-ayatnya dalam senarai bernombor, tunjuk 2 gambar, kemudian tanya "Ok render?". Mahu tukar satu benda sahaja? Cakap: "Tukar baris 3 sahaja jadi ...". Tulis tepat tulisan yang anda nak nampak di skrin.

## Video saya di mana?

Dalam folder `out/`. Contoh: `out/s10-e1.mp4`. Claude akan beritahu laluan penuh dan buka video itu. Gambar semakan ada di `out/stills/`.

## Suara

- **Percuma** (lalai): suara komputer. Cepat, tapi bunyi macam robot. Ini sementara sahaja.
- **ElevenLabs** (disyorkan): suara sebenar, jauh lebih baik.
  1. Daftar di https://elevenlabs.io.
  2. Klik profil anda (kiri bawah) > **API Keys** > **Create**, kemudian salin key itu.
  3. Cakap kepada Claude: **"Letak ElevenLabs key saya, ini dia: ..."** (tampal key). Claude simpan dalam fail `.env` dan tukar suara kepada ElevenLabs.
- **Google Gemini** (percuma, ada had harian): cakap "Guna suara Gemini", dan beri key daripada https://aistudio.google.com/apikey.

Jangan kongsi fail `.env` atau key anda dengan sesiapa.

## Kalau tersangkut

Cakap sahaja kepada Claude apa yang berlaku. Masalah biasa: render macam tergantung (Claude akan cari ralat dalam cerita), skrin hitam (guna Google Chrome), suara tak keluar (semak key ElevenLabs), "gaya belum ada" (tampal link gaya itu dari galeri).
