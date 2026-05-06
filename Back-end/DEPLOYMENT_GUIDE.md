# Panduan Deploy Backend ke Railway

## Persiapan

### 1. Setup MongoDB Atlas (Database Cloud)

1. Buka [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Buat akun gratis (jika belum punya)
3. Buat cluster baru (pilih FREE tier)
4. Tunggu cluster selesai dibuat (±5 menit)
5. Klik "Connect" → "Connect your application"
6. Copy connection string, contoh:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/autoclave?retryWrites=true&w=majority
   ```
7. Ganti `<password>` dengan password database Anda
8. Simpan connection string ini untuk nanti

### 2. Push Code ke GitHub

#### A. Inisialisasi Git (jika belum)

```bash
cd Back-end
git init
```

#### B. Buat repository di GitHub

1. Buka [GitHub](https://github.com)
2. Klik tombol "+" → "New repository"
3. Nama repository: `autoclave-backend` (atau nama lain)
4. Pilih "Public" atau "Private"
5. **JANGAN** centang "Initialize with README" (karena sudah ada)
6. Klik "Create repository"

#### C. Push code ke GitHub

```bash
# Tambahkan semua file
git add .

# Commit
git commit -m "Initial commit: Backend autoclave system"

# Tambahkan remote (ganti dengan URL repository Anda)
git remote add origin https://github.com/username/autoclave-backend.git

# Push ke GitHub
git branch -M main
git push -u origin main
```

### 3. Deploy ke Railway

#### A. Buat akun Railway

1. Buka [Railway.app](https://railway.app)
2. Klik "Login" → pilih "Login with GitHub"
3. Authorize Railway untuk akses GitHub Anda

#### B. Deploy dari GitHub

1. Di Railway dashboard, klik "New Project"
2. Pilih "Deploy from GitHub repo"
3. Pilih repository `autoclave-backend` yang baru dibuat
4. Railway akan otomatis detect Node.js project
5. Klik "Deploy Now"

#### C. Set Environment Variables

1. Setelah deploy, klik project Anda
2. Klik tab "Variables"
3. Tambahkan variabel berikut:

   ```
   PORT=5000
   MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/autoclave?retryWrites=true&w=majority
   ```

4. Klik "Add" untuk setiap variabel

#### D. Dapatkan URL Production

1. Klik tab "Settings"
2. Scroll ke "Domains"
3. Klik "Generate Domain"
4. Copy URL yang digenerate, contoh:
   ```
   https://autoclave-backend-production.up.railway.app
   ```

### 4. Update Frontend

Setelah mendapat URL production, update file `.env` di frontend:

```env
BACKEND_URL=https://autoclave-backend-production.up.railway.app
```

Atau update `Front-end/src/config.ts`:

```typescript
export const BACKEND_URL = 'https://autoclave-backend-production.up.railway.app';
```

## Testing

Test endpoint dengan curl atau Postman:

```bash
# Test root endpoint
curl https://your-app.up.railway.app/

# Test API endpoint
curl https://your-app.up.railway.app/sterilisasi/running/last
```

## Monitoring

1. Di Railway dashboard, klik project Anda
2. Klik tab "Deployments" untuk melihat status deploy
3. Klik tab "Logs" untuk melihat log real-time
4. Klik tab "Metrics" untuk melihat usage

## Troubleshooting

### Deploy Gagal

1. Cek logs di Railway dashboard
2. Pastikan `package.json` memiliki script `"start": "node server.js"`
3. Pastikan semua dependencies sudah di-install

### Database Connection Error

1. Pastikan MongoDB Atlas cluster sudah running
2. Pastikan IP whitelist di MongoDB Atlas diset ke `0.0.0.0/0` (allow all)
3. Pastikan connection string benar (username, password, database name)

### MQTT Connection Error

1. MQTT broker (HiveMQ) harus bisa diakses dari Railway
2. Cek logs untuk error connection
3. Pastikan tidak ada firewall yang blocking

## Update Code

Setiap kali ada perubahan code:

```bash
git add .
git commit -m "Update: deskripsi perubahan"
git push
```

Railway akan otomatis re-deploy setelah push ke GitHub.

## Free Tier Limits

Railway free tier:
- $5 credit per bulan
- 500 jam execution time
- 1GB RAM
- 1GB disk

Cukup untuk development dan testing!
