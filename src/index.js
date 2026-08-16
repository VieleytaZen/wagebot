const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getGeminiResponse } = require('./gemini');
const config = require('./config');

// Map untuk cooldown per user (anti-spam)
const cooldowns = new Map();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',  // penting untuk server Linux (Pterodactyl)
            '--disable-gpu',
        ],
    },
});

// ─── Event: QR Code ──────────────────────────────────────────────────────────

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('[Bot] Scan QR Code di atas untuk login ke WhatsApp.');
});

// ─── Event: Siap ─────────────────────────────────────────────────────────────

client.on('ready', () => {
    console.log(`[Bot] ${config.botName} siap dan aktif! 🍊`);
});

// ─── Event: Disconnect ───────────────────────────────────────────────────────

client.on('disconnected', (reason) => {
    console.warn(`[Bot] Terputus dari WhatsApp. Alasan: ${reason}`);
});

// ─── Event: Pesan Masuk ──────────────────────────────────────────────────────

client.on('message', async (msg) => {
    // Hanya balas pesan dari private chat (bukan grup)
    if (msg.from.endsWith('@g.us')) return;

    // Abaikan pesan status/broadcast
    if (msg.from === 'status@broadcast') return;

    // Abaikan pesan kosong
    if (!msg.body || msg.body.trim() === '') return;

    const userId = msg.from;
    const userMessage = msg.body.trim();

    // ── Cooldown anti-spam ────────────────────────────────────────────────────
    const now = Date.now();
    const lastTime = cooldowns.get(userId) || 0;
    if (now - lastTime < config.cooldownMs) {
        // Masih dalam cooldown, abaikan pesan ini
        return;
    }
    cooldowns.set(userId, now);

    console.log(`[Pesan] Dari ${userId}: ${userMessage}`);

    try {
        // Tandai pesan sudah dibaca
        try { await msg.getChat().then(c => c.sendSeen()); } catch (_) {}

        // Mulai indikator "mengetik..."
        let chat = null;
        try {
            await client.sendPresenceAvailable();
            chat = await msg.getChat();
            await chat.sendStateTyping();
        } catch (_) { /* abaikan jika gagal pada kontak @lid */ }

        // Ambil respons dari Groq (proses berlangsung selama "mengetik")
        const response = await getGeminiResponse(userId, userMessage);

        // Hitung delay mengetik yang realistis berdasarkan panjang respons
        // ~180 kata/menit = kecepatan mengetik manusia normal
        const wordCount  = response.trim().split(/\s+/).length;
        const typingMs   = Math.min(Math.max((wordCount / 180) * 60_000, 1000), 6000);
        await new Promise(resolve => setTimeout(resolve, typingMs));

        // Hentikan indikator mengetik & kirim balasan
        try { if (chat) await chat.clearState(); } catch (_) {}
        await msg.reply(response);

        console.log(`[Balas] Ke ${userId} (delay: ${typingMs}ms): ${response.substring(0, 80)}...`);
    } catch (err) {
        const errMsg = err?.message || err?.toString() || JSON.stringify(err);
        console.error(`[Error] Gagal memproses pesan dari ${userId}:`, errMsg);
        console.error(`[Error] Detail:`, err);
        await msg.reply('Maaf, saya sedang mengalami gangguan teknis. Mohon coba lagi dalam beberapa saat ya! 🙏');
    }
});

// ─── Graceful Shutdown (penting untuk Pterodactyl) ───────────────────────────

async function shutdown(signal) {
    console.log(`\n[Bot] Menerima signal ${signal}, melakukan shutdown...`);
    try {
        await client.destroy();
        console.log('[Bot] Client WhatsApp berhasil dihentikan.');
    } catch (err) {
        console.error('[Bot] Error saat shutdown:', err.message);
    }
    process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ─── Jalankan Bot ─────────────────────────────────────────────────────────────

client.initialize();
