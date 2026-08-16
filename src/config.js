require('dotenv').config();

module.exports = {
    // Gemini API
    geminiApiKey: process.env.GEMINI_API_KEY,

    // Model Gemini yang digunakan
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

    // Nama bot (tampil di log)
    botName: process.env.BOT_NAME || 'Kodi - Jus Kode',

    // Maksimal jumlah pesan yang disimpan per user (pairs: user+model)
    // 50 = 25 giliran percakapan — cukup untuk konteks yang panjang
    maxHistory: parseInt(process.env.MAX_HISTORY || '50', 10),

    // Cooldown antar pesan dari user yang sama (ms) — anti-spam
    cooldownMs: parseInt(process.env.COOLDOWN_MS || '1500', 10),
};
