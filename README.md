# Backend Autoclave Sterilization System

Backend API untuk sistem monitoring dan kontrol autoclave sterilization menggunakan MQTT.

## Tech Stack
- Node.js + Express
- MongoDB (Mongoose)
- MQTT (HiveMQ)
- CORS

## Environment Variables

Buat file `.env` dengan variabel berikut:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
```

## Installation

```bash
npm install
```

## Running Locally

```bash
npm start
```

Server akan berjalan di `http://localhost:5000`

## API Endpoints

### Sterilization Set
- `POST /sterilisasi/set` - Kirim perintah start ke alat
- `GET /sterilisasi/set` - Ambil semua data set
- `GET /sterilisasi/set/last` - Ambil data set terakhir

### Sterilization Running
- `POST /sterilisasi/running` - Kirim perintah stop ke alat
- `GET /sterilisasi/running` - Ambil semua data running
- `GET /sterilisasi/running/last` - Ambil data running terakhir

### Sterilization Finish
- `GET /sterilisasi/finish` - Ambil semua data finish
- `GET /sterilisasi/finish/last` - Ambil data finish terakhir (consumed)

### History
- `GET /sterilisasi/history` - Ambil history lengkap (gabungan finish + set)

## Deployment

Deploy ke Railway:
1. Push code ke GitHub
2. Connect repository di Railway
3. Set environment variables di Railway dashboard
4. Deploy otomatis akan berjalan
