# TeachTrack — Demo (berdiri sendiri)

Situs demo TeachTrack yang **terpisah** dari web asli dan dari Google Sheets Anda.
Tampilan dan logika sama dengan aplikasi asli. Backend (`demo/backend.txt`) berjalan
langsung di browser, jadi tidak perlu Apps Script, tidak perlu deploy, dan tidak perlu
mengisi kode apa pun.

site by Restu Putra Mulyana

---

## 1. Isi folder

```
index.html          halaman utama (salinan web asli + satu skrip demo)
css/style.css       tampilan (sama dengan web asli)
js/                 logika frontend (sama dengan web asli) + demo.js
js/demo.js          mesin demo: menjalankan backend di browser, kamera & GPS palsu, panel akun
js/config.js        penanda mode demo (tidak perlu diubah)
demo/backend.txt    backend asli TeachTrack v1.1 (gabungan semua file .gs)
README.md           panduan ini
.nojekyll           agar GitHub Pages menyajikan semua berkas apa adanya
```

Anda **tidak perlu menulis atau menempel kode apa pun**. Cukup unggah folder ini ke GitHub.

---

## 2. Menjalankan lewat GitHub (disarankan)

### Langkah A — Buat repository baru
1. Buka https://github.com/new
2. **Repository name:** `teachtrack-demo`
3. Pilih **Public**. Jangan centang "Add a README" atau yang lain. Klik **Create repository**.

### Langkah B — Unggah folder ini
**Cara 1 — lewat Git (paling rapi).** Buka PowerShell di dalam folder `teachtrack-demo`, lalu jalankan:

```bash
git init
git add .
git commit -m "Demo TeachTrack v1.1"
git branch -M main
git remote add origin https://github.com/restuputram2710/teachtrack-demo.git
git push -u origin main
```

**Cara 2 — lewat situs GitHub.** Di halaman repository klik **uploading an existing file**, lalu seret
**isi** folder (bukan folder induknya) ke sana. Pastikan folder `css`, `js`, dan `demo` ikut terunggah
dengan strukturnya. Klik **Commit changes**.

### Langkah C — Aktifkan GitHub Pages
1. Di repository, buka **Settings → Pages**.
2. Di bagian **Build and deployment**, pada **Source** pilih **Deploy from a branch** (bukan *GitHub Actions*).
3. **Branch:** `main`, folder **`/ (root)`**. Klik **Save**.
4. Tunggu 1–2 menit, lalu buka:

   **https://restuputram2710.github.io/teachtrack-demo/**

Setiap kali Anda mengubah isi repository, GitHub Pages memperbarui situsnya sendiri dalam 1–2 menit.

---

## 3. Menjalankan di komputer sendiri (tanpa GitHub)

Browser tidak mengizinkan halaman ini dibuka langsung dengan klik dua kali pada `index.html`.
Jalankan server lokal sederhana:

1. Pastikan **Python** terpasang (https://www.python.org).
2. Buka PowerShell di dalam folder `teachtrack-demo`, lalu jalankan:
   ```bash
   python -m http.server 8000
   ```
3. Buka **http://localhost:8000** di Chrome atau Edge.
4. Untuk menghentikan server, tekan **Ctrl+C**.

---

## 4. Akun demo

Semua akun memakai sandi yang sama: **`Demo12345`**

| Peran | Username | Keterangan |
|---|---|---|
| Admin | `demo.admin` | Dashboard, persetujuan izin, jadwal, agenda, laporan & honor |
| Guru | `demo.guru` | Rina Kurniasih, S.Pd. (Matematika). Akun utama untuk mencoba absen & jurnal |
| Guru lain | `demo.guru2` s.d. `demo.guru10` | Semua memakai sandi yang sama |

Panel **"Akun & data demo"** (tombol gelap di pojok kiri bawah di HP, atau kanan bawah di layar lebar)
berisi daftar akun, kode QR TKB untuk input manual, dan pilihan posisi GPS.

---

## 5. Cara mencoba

**Sebagai admin (`demo.admin`):**
- **Dashboard** menampilkan grafik kehadiran 30 hari terakhir dan komposisi status.
- **Persetujuan** berisi 2 pengajuan izin yang menunggu, serta 1 akun Google yang menunggu persetujuan.
- **Laporan & Honor → Cetak Honorarium (PDF)** membuat honorarium sesuai format SMATER.
  Setelah itu klik **Buka & Cetak**, lalu pilih **Simpan sebagai PDF** di dialog cetak.

**Sebagai guru (`demo.guru`):**
1. Di menu bawah pilih **Scan QR** → **Input Kode TKB Manual**.
2. Salin salah satu kode dari panel **"Akun & data demo"** (misalnya kode TKB Cikunir), lalu tempelkan.
3. Pada langkah GPS, posisi mengikuti pilihan **"Posisi GPS saya"** di panel. Default-nya TKB pertama.
4. Pada langkah foto, kamera palsu menampilkan gambar ilustrasi. Tekan tombol ambil foto, lalu **Kirim**.
5. Di **Jurnal** Anda bisa melihat catatan pekan-pekan sebelumnya, lalu mengunduh PDF jurnal.

**Catatan jadwal:** Jadwal demo hanya ada pada **hari Minggu**. Pada hari lain, absen tetap bisa dicoba
dan akan tercatat sebagai **"Di luar jadwal"** (menunggu verifikasi admin).

---

## 6. Batasan demo

- **Data hanya tersimpan di browser tempat Anda membukanya.** Membuka dari perangkat lain menampilkan data awal yang berbeda.
- **Tidak terhubung** ke Google Sheets, Google Drive, atau aplikasi TeachTrack asli.
- **Kamera palsu:** foto yang diambil adalah gambar ilustrasi, bukan foto sungguhan. Scan QR dengan kamera juga tidak tersedia, jadi gunakan **Input Kode TKB Manual**.
- **PDF** dibuka sebagai halaman cetak. Pilih **Simpan sebagai PDF** untuk menyimpannya.
- **Login Google** tidak tersedia di demo. Gunakan akun demo di atas.
- **Penyimpanan browser terbatas** (sekitar 5 MB). Jika foto yang diunggah sangat banyak, tekan **Reset semua data**.
- **Jangan masukkan data asli** (nama guru sungguhan, NIP, atau foto siswa). Sandi akun demo bersifat publik.

---

## 7. Reset dan keluar

- **Reset semua data:** buka panel demo, lalu tekan **Reset semua data**. Data dibuat ulang dengan tanggal hari ini dan sesi login dihapus.
- **Keluar akun:** tekan **Keluar akun** di panel, atau gunakan tombol keluar di aplikasi.

---

## 8. Memperbarui demo setelah web asli berubah

- Salin ulang berkas dari folder `frontend/` aplikasi asli ke `css/` dan `js/`, **kecuali** `js/config.js` dan `js/demo.js`.
- Ganti `demo/backend.txt` dengan gabungan semua file `backend/*.gs` dalam urutan:
  `Kode.gs`, `Modul_Absensi.gs`, `Modul_Admin.gs`, `Modul_Laporan.gs`, `Modul_Migrasi.gs`, `Modul_Jurnal.gs`, `Setup.gs`, `Modul_Demo.gs`.
- Unggah ulang (commit) ke GitHub.
