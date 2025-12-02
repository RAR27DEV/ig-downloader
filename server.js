const express = require("express");
const cors = require("cors");
const ytdlp = require("yt-dlp-exec");

const app = express();
app.use(cors());
app.use(express.json());

// Validasi URL
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// Jalankan yt-dlp
function runYtDlp(url) {
    return ytdlp(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true
    });
}


// Endpoint API
app.post("/api/download", async (req, res) => {
    const { url } = req.body;

    if (!url || !isValidURL(url)) {
        return res.status(400).json({ error: "URL tidak valid" });
    }

    try {
        const data = await runYtDlp(url);

        // CASE 1: CAROUSEL (ada entries)
        if (Array.isArray(data.entries)) {
            const items = [];

            for (const entry of data.entries) {
                // Foto
                if (entry.url && entry.ext === "jpg") {
                    items.push({
                        url: entry.url,
                        type: "photo"
                    });
                }

                // Video
                else if (entry.formats) {
                    const vid = entry.formats.reverse().find(f => f.url && f.ext === "mp4");
                    if (vid) {
                        items.push({
                            url: vid.url,
                            type: "video"
                        });
                    }
                }
            }

            return res.json({
                type: "carousel",
                title: data.title,
                thumbnail: data.thumbnail,
                items
            });
        }

        // CASE 2: FOTO
        if (data.url && data.ext === "jpg") {
            return res.json({
                type: "photo",
                title: data.title,
                thumbnail: data.thumbnail,
                items: [
                    { url: data.url, type: "photo" }
                ]
            });
        }

        // CASE 3: VIDEO (Reels, IGTV, Story)
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
                items: [
                    { url: video.url, type: "video" }
                ]
            });
        }


        return res.status(500).json({ error: "Jenis konten tidak dikenal" });

    } catch (e) {
        return res.status(500).json({ error: e.toString() });
    }
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server berjalan di port " + PORT));
