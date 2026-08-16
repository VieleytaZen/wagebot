require('dotenv').config();

module.exports = {
    // Groq API
    groqApiKey: process.env.GROQ_API_KEY,

    // WhatsApp ID owner (bisa kelola stok via WA)
    // Lihat dari log bot: [Pesan] Dari 628xxx@c.us atau 83xxx@lid
    ownerNumber: process.env.OWNER_ID || process.env.OWNER_NUMBER || '',

    // WhatsApp ID manajer (terima notifikasi pesanan)
    // Format: 628xxx@c.us atau 83xxx@lid (lihat dari log bot)
    managerNumber: process.env.MANAGER_ID || process.env.MANAGER_NUMBER || '',

    // Model Groq yang digunakan
    // Pilihan: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768
    groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

    // Nama bot (tampil di log)
    botName: process.env.BOT_NAME || 'Kodi - Jus Kode',

    // Maksimal jumlah pesan yang disimpan per user
    // 50 = 25 giliran percakapan — cukup untuk konteks yang panjang
    maxHistory: parseInt(process.env.MAX_HISTORY || '50', 10),

    // Cooldown antar pesan dari user yang sama (ms) — anti-spam
    cooldownMs: parseInt(process.env.COOLDOWN_MS || '1500', 10),
};
