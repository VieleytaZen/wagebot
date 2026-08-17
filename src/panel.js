const config = require('./config');
const { updateProductStatus, getMenuReport, getUnavailableReport } = require('./catalog');

// ─── RBAC (Role-Based Access Control) ─────────────────────────────────────────

/**
 * Cek role pengirim pesan berdasarkan ID WhatsApp.
 * @param {import('whatsapp-web.js').Message} msg
 * @returns {string|null} 'owner', 'manager', 'kasir', 'moderator', atau null jika bukan siapa-siapa
 */
function getUserRole(msg) {
    const id = msg.from;
    
    if (config.ownerIds.includes(id)) return 'owner';
    if (config.managerIds.includes(id)) return 'manager';
    if (config.kasirIds.includes(id)) return 'kasir';
    if (config.moderatorIds.includes(id)) return 'moderator';
    
    return null;
}

// ─── Handler Perintah ─────────────────────────────────────────────────────────

const HELP_TEXT = `🤖 *Panel Internal - Jus Kode Bot*

*Perintah yang tersedia untuk Anda:*
• \`/stok off [nama]\` — nonaktifkan produk
• \`/stok on [nama]\` — aktifkan kembali produk
• \`/stok list\` — lihat produk tidak tersedia
• \`/menu\` — lihat seluruh menu (per kategori)
• \`/help\` — tampilkan pesan ini

_Nama produk bisa sebagian, contoh:_
\`/stok off alpukat\` → nonaktifkan semua produk alpukat`;

/**
 * Proses perintah panel internal.
 * @param {import('whatsapp-web.js').Message} msg
 * @param {import('whatsapp-web.js').Client} client
 * @param {string} role Role pengguna yang mengirim pesan
 */
async function handlePanelCommand(msg, client, role) {
    const text = msg.body.trim();
    const lower = text.toLowerCase();

    // /help
    if (lower === '/help') {
        await msg.reply(HELP_TEXT);
        return;
    }

    // /stok list
    if (lower === '/stok list') {
        await msg.reply(getUnavailableReport());
        return;
    }

    // /menu
    if (lower === '/menu') {
        const pages = getMenuReport();
        const header = `📋 *MENU JUS KODE* (${pages.length} kategori)\n_Kirim per kategori..._`;
        await msg.reply(header);
        for (const page of pages) {
            await client.sendMessage(msg.from, page);
            await new Promise(r => setTimeout(r, 400));
        }
        return;
    }

    // Hak Akses (RBAC): Semua role saat ini bisa akses perintah stok
    // Jika di masa depan owner/manager punya perintah khusus, bisa ditambahkan di bawah ini.
    // Contoh: if (role === 'owner' && lower.startsWith('/harga')) { ... }

    // /stok off [nama]
    const offMatch = text.match(/^\/stok off (.+)$/i);
    if (offMatch) {
        const name = offMatch[1].trim();
        const { found, matches } = updateProductStatus(name, false);
        if (!found) {
            await msg.reply(`❌ Produk "*${name}*" tidak ditemukan di menu.`);
        } else {
            await msg.reply(`✅ *Dinonaktifkan:*\n${matches.map(m => `• ${m}`).join('\n')}`);
        }
        return;
    }

    // /stok on [nama]
    const onMatch = text.match(/^\/stok on (.+)$/i);
    if (onMatch) {
        const name = onMatch[1].trim();
        const { found, matches } = updateProductStatus(name, true);
        if (!found) {
            await msg.reply(`❌ Produk "*${name}*" tidak ditemukan di menu.`);
        } else {
            await msg.reply(`✅ *Diaktifkan kembali:*\n${matches.map(m => `• ${m}`).join('\n')}`);
        }
        return;
    }

    // Perintah tidak dikenal
    await msg.reply(`❓ Perintah tidak dikenal.\n\nKetik */help* untuk daftar perintah.`);
}

module.exports = { getUserRole, handlePanelCommand };
