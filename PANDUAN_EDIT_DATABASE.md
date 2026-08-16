# Panduan Mengubah Database Langsung — Teleconi Tracker

Aplikasi ini menyimpan semua data di **MongoDB**. Anda bisa melihat & mengubah data
langsung tanpa lewat aplikasi, dengan menggunakan **MongoDB Compass** (aplikasi GUI gratis)
atau **mongosh** (command line).

> ⚠️ **Hati-hati**: mengubah database langsung berisiko merusak data. Selalu backup dulu
> dan ubah hanya kolom yang Anda pahami. Password TIDAK bisa diubah langsung karena
> disimpan dalam bentuk hash (lihat bagian bawah).

---

## 1. Mendapatkan Connection String (MONGO_URL)

Connection string berada di file: `/app/backend/.env` pada baris `MONGO_URL`.
Nama database ada di baris `DB_NAME`.

Contoh isi file:
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="test_database"
```

Gunakan nilai `MONGO_URL` untuk koneksi, lalu pilih database sesuai `DB_NAME`.

---

## 2. Cara Termudah — MongoDB Compass (GUI)

1. Unduh & pasang MongoDB Compass: https://www.mongodb.com/products/compass
2. Buka Compass → tempel `MONGO_URL` di kolom **New Connection** → klik **Connect**.
3. Pilih database sesuai `DB_NAME`.
4. Anda akan melihat daftar **collections** (tabel):
   - `users`     — data karyawan (nama, role, KTP, BPJS, alamat, gaji, bank, no. rekening)
   - `pos`       — Purchase Order (po_number, site_code, release_date, po_amount, status)
   - `invoices`  — Invoice (invoice_number, po_number, amount, due_date, paid)
   - `costs`     — Biaya operasional (date, site_name, post, category, amount, submitted_by)
   - `salaries`  — Status pembayaran gaji per bulan (employee_id, month, paid)
5. Klik sebuah collection → klik ikon **pensil (edit)** pada baris data untuk mengubah,
   atau ikon **tempat sampah** untuk menghapus. Klik **Update** untuk menyimpan.

---

## 3. Cara Command Line — mongosh

```bash
# masuk ke shell mongo
mongosh "mongodb://localhost:27017"

# pilih database (ganti sesuai DB_NAME)
use test_database

# lihat semua karyawan
db.users.find().pretty()

# ubah gaji satu karyawan
db.users.updateOne({ employee_id: "00204" }, { $set: { gaji: "10000000" } })

# ubah status PO
db.pos.updateOne({ po_number: "PO-2026-001" }, { $set: { status: "Active" } })

# hapus satu invoice
db.invoices.deleteOne({ invoice_number: "INV-2026-004" })

# tandai gaji sudah dibayar
db.salaries.updateOne({ employee_id: "00201", month: "2026-08" }, { $set: { paid: true } })
```

---

## 4. Mereset / Mengubah Password

Password disimpan dalam bentuk **hash bcrypt** di kolom `password_hash`, jadi tidak bisa
diketik langsung. Cara paling aman mengubah password adalah lewat aplikasi
(ikon Settings → Change Password).

Jika benar-benar perlu reset dari database, jalankan skrip Python di server:
```python
import bcrypt
print(bcrypt.hashpw(b"passwordbaru", bcrypt.gensalt()).decode())
```
Salin hasilnya, lalu:
```bash
db.users.updateOne({ employee_id: "00101" }, { $set: { password_hash: "<hasil_hash_di_atas>" } })
```

---

## 5. Struktur Kolom Penting

**users**
| Kolom | Keterangan |
|-------|------------|
| employee_id | ID login karyawan |
| name | Nama lengkap |
| role | Owner / PM / PCM / Engineer |
| ktp, bpjs, address, gaji, bank, no_rek, join_date | Data profil |
| password_hash | Hash password (jangan diedit manual) |

**pos**: po_number, site_code, release_date, po_amount, status (`Plan`/`Active`), budget
**invoices**: invoice_number, po_number, amount, due_date, paid (true/false)
**costs**: date, month, project_name, site_name, post, category, amount, submitted_by, role
**salaries**: employee_id, month (`2026-08`), paid (true/false)

Setelah mengubah data di database, tarik-untuk-refresh atau buka ulang layar di aplikasi
untuk melihat perubahan.
