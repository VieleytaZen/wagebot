require('dotenv').config();

module.exports = {
    // Groq API
    groqApiKey: process.env.GROQ_API_KEY,

    // Role-based IDs (Array of WhatsApp IDs)
    // Format di .env dipisahkan dengan koma: 83xxx@lid,628xxx@c.us
    ownerIds: (process.env.OWNER_IDS || process.env.OWNER_ID || '').split(',').map(id => id.trim()).filter(Boolean),
    
    managerIds: (process.env.MANAGER_IDS || process.env.MANAGER_ID || '').split(',').map(id => id.trim()).filter(Boolean),
    
    kasirIds: (process.env.KASIR_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    
    moderatorIds: (process.env.MODERATOR_IDS || '').split(',').map(id => id.trim()).filter(Boolean),

    // Model Groq yang digunakan
    // Pilihan: llama3-8b-8192, llama3-70b-8192, mixtral-8x7b-32768
    groqModel: process.env.GROQ_MODEL || 'llama3-8b-8192',

    // Nama bot (tampil di log)
    botName: process.env.BOT_NAME || 'Kodi - Jus Kode',

    // Maksimal jumlah pesan yang disimpan per user
    // 50 = 25 giliran percakapan — cukup untuk konteks yang panjang
    maxHistory: parseInt(process.env.MAX_HISTORY || '50', 10),

    // Cooldown antar pesan dari user yang sama (ms) — anti-spam
    cooldownMs: parseInt(process.env.COOLDOWN_MS || '1500', 10),
};
