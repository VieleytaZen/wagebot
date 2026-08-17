const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getGroqResponse } = require('./groq');
const { getUserRole, handlePanelCommand } = require('./panel');
const config = require('./config');

// Inisialisasi Groq Client
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: config.groqApiKey });

// Ambil daftar model Groq saat bot menyala agar kita tahu mana yang aktif
(async () => {
    try {
        const models = await groq.models.list();
        const activeModels = models.data.map(m => m.id);
        console.log('[Info] Model Groq yang tersedia di akun ini:');
        console.log(activeModels.join(', '));
    } catch (err) {
        console.warn('[Peringatan] Gagal mengambil daftar model Groq:', err.message);
    }
})();

// Map untuk cooldown per user (anti-spam)
const cooldowns = new Map();

// Map untuk cooldown alert order per user (hindari spam notif ke manajer)
const alertCooldowns = new Map();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 menit

// Pattern deteksi intent memesan
const ORDER_PATTERN = /\b(pesan|mesen|order|mau beli|mau ambil|cara pesan|cara order|bisa pesan)\b/i;

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

    // ── Routing: Panel Internal (RBAC) ─────────────────────────────────────────
    const userRole = getUserRole(msg);
    if (userRole && userMessage.startsWith('/')) {
        try {
            await handlePanelCommand(msg, client, userRole);
        } catch (err) {
            console.error('[Panel] Error saat proses perintah:', err.message);
            await msg.reply('❌ Terjadi error saat memproses perintah.');
        }
        return;
    }

    try {
        // Tandai pesan sudah dibaca
        try { await msg.getChat().then(c => c.sendSeen()); } catch (_) {}

        // Mulai indikator "mengetik..."
        let chat = null;
        try {
            await client.sendPresenceAvailable(); // Penting agar bot terlihat online
            chat = await msg.getChat();
            await chat.sendStateTyping();
        } catch (e) { 
            // whatsapp-web.js sering gagal mengambil chat untuk kontak @lid (linked device / internal bisnis)
            if (!userId.endsWith('@lid')) {
                console.warn('[Debug] Gagal memicu status mengetik:', e.message);
            }
        }

        // Ambil respons dari AI (proses berlangsung selama status "mengetik")
        const response = await getGroqResponse(userId, userMessage);

        // Delay kecil agar tidak terlalu instan (waktu tunggu API sudah memberikan delay natural)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Untuk kontak @lid: resolve nomor asli lewat getContact() lalu kirim ke @c.us
        // Ini menghindari bug whatsapp-web.js di mana msg.reply() silent-fail pada @lid
        let sent = false;
        if (userId.endsWith('@lid')) {
            console.log(`[Debug] Pesan dari @lid. Memeriksa data mentah...`);
            console.log(`[Debug] msg.author:`, msg.author);
            console.log(`[Debug] msg._data.author:`, msg._data?.author);
            console.log(`[Debug] msg.id.participant:`, msg.id?.participant);
            console.log(`[Debug] msg.id.remote:`, msg.id?.remote);
            
            try {
                const contact = await msg.getContact();
                if (contact?.number) {
                    await client.sendMessage(`${contact.number}@c.us`, response);
                    sent = true;
                    console.log(`[Debug] Kirim via @c.us: ${contact.number}@c.us`);
                }
            } catch (e) {
                console.warn('[Debug] getContact gagal, fallback ke msg.reply:', e.message);
            }
        }
        if (!sent) await msg.reply(response);

        // ── Order Alert ke Manajer & Kasir ─────────────────────────────────────
        const hasOrderIntent = ORDER_PATTERN.test(userMessage);
        const lastAlert = alertCooldowns.get(userId) || 0;
        const alertReady = Date.now() - lastAlert > ALERT_COOLDOWN_MS;

        if (hasOrderIntent && alertReady) {
            alertCooldowns.set(userId, Date.now());
            const alertMsg =
                `🔔 *NOTIFIKASI PESANAN*\n\n` +
                `👤 *Pelanggan:* ${userId.split('@')[0]}\n` +
                `💬 *Pesan:* ${userMessage}\n` +
                `🤖 *Balasan Bot:* ${response.substring(0, 120)}...\n\n` +
                `_Segera tindaklanjuti via WhatsApp._`;
                
            // Kirim ke semua Manajer dan Kasir
            const alertRecipients = [...config.managerIds, ...config.kasirIds];
            // Pakai Set untuk hapus duplikat jika nomor sama
            const uniqueRecipients = [...new Set(alertRecipients)];
            
            for (const recipientId of uniqueRecipients) {
                try {
                    await client.sendMessage(recipientId, alertMsg);
                    console.log(`[Alert] Notifikasi pesanan dikirim ke ${recipientId}`);
                } catch (_) {
                    console.warn(`[Alert] Gagal kirim notifikasi ke ${recipientId}`);
                }
            }
        }

        console.log(`[Balas] Ke ${userId}: ${response.substring(0, 80)}...`);
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
