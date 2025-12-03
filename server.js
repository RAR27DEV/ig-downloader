const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { execFile, exec } = require("child_process");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Lokasi yt-dlp binary untuk Render (/tmp writable)
const YTDLP_PATH = "/tmp/yt-dlp";

// Download yt-dlp jika belum tersedia
function ensureYtDlpExists() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(YTDLP_PATH)) {
            return resolve(true);
        }

        console.log("Downloading yt-dlp Linux binary...");

        exec(
            `curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${YTDLP_PATH} && chmod +x ${YTDLP_PATH}`,
            (err) => {
                if (err) return reject("Gagal download yt-dlp: " + err);
                console.log("yt-dlp berhasil di-download.");
                resolve(true);
            }
        );
    });
}

// Jalankan yt-dlp binary
function runYtDlp(url) {
    return new Promise((resolve, reject) => {
        execFile(YTDLP_PATH, ["-j", url], { maxBuffer: 1024 * 1024 * 10 }, (err, stdout) => {
            if (err) return reject(err);
            try {
                resolve(JSON.parse(stdout));
            } catch (e) {
                reject("Gagal parsing JSON: " + e);
            }
        });
    });
}

// Validasi URL
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// Endpoint utama
app.post("/api/download", async (req, res) => {
    const { url } = req.body;

    if (!isValidURL(url)) {
        return res.status(400).json({ error: "URL tidak valid" });
    }

    try {
        await ensureYtDlpExists(); // pastikan yt-dlp tersedia
        const data = await runYtDlp(url);

        // CASE 1: Carousel
        if (Array.isArray(data.entries)) {
            const items = [];

            for (const entry of data.entries) {
                if (entry.url && entry.ext === "jpg") {
                    items.push({ url: entry.url, type: "photo" });
                } else if (entry.formats) {
                    const vid = entry.formats
                        .filter(f => f.ext === "mp4" && f.acodec !== "none" && f.vcodec !== "none")
                        .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

                    if (vid) items.push({ url: vid.url, type: "video" });
                }
            }

            return res.json({
                type: "carousel",
                title: data.title,
                thumbnail: data.thumbnail,
                items
            });
        }

        // CASE 2: Foto
        if (data.url && data.ext === "jpg") {
            return res.json({
                type: "photo",
                title: data.title,
                thumbnail: data.thumbnail,
                items: [{ url: data.url, type: "photo" }]
            });
        }

        // CASE 3: Video
        if (data.formats) {
            const video = data.formats
                .filter(f => f.ext === "mp4" && f.acodec !== "none" && f.vcodec !== "none")
                .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

            if (!video) {
                return res.status(500).json({ error: "Tidak ada format video dengan audio" });
            }

            return res.json({
                type: "video",
                title: data.title,
                thumbnail: data.thumbnail,
                items: [{ url: video.url, type: "video" }]
            });
        }

        res.status(500).json({ error: "Jenis konten tidak dikenali" });

    } catch (e) {
        res.status(500).json({ error: e.toString() });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server berjalan di port " + PORT));
