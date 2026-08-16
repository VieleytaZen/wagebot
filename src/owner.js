const config = require('./config');
const { updateProductStatus, getMenuReport, getUnavailableReport } = require('./catalog');

// ─── Cek Owner ────────────────────────────────────────────────────────────────

/**
 * Cek apakah pengirim adalah owner.
 * Cocokkan langsung dengan full WhatsApp ID (misal: 83xxx@lid atau 628xxx@c.us)
 */
function isOwner(msg) {
    if (!config.ownerNumber) return false;
    return msg.from === config.ownerNumber;
}

// ─── Handler Perintah ─────────────────────────────────────────────────────────

const HELP_TEXT = `🤖 *Panel Owner - Jus Kode Bot*

*Perintah tersedia:*
• \`/stok off [nama]\` — nonaktifkan produk
• \`/stok on [nama]\` — aktifkan kembali produk
• \`/stok list\` — lihat produk tidak tersedia
• \`/menu\` — lihat seluruh menu (per kategori)
• \`/help\` — tampilkan pesan ini

_Nama produk bisa sebagian, contoh:_
\`/stok off alpukat\` → nonaktifkan semua produk alpukat`;

/**
 * Proses perintah owner dan kirim balasan.
 * @param {import('whatsapp-web.js').Message} msg
 * @param {import('whatsapp-web.js').Client} client
 */
async function handleOwnerCommand(msg, client) {
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

    // /menu — kirim per kategori agar tidak terpotong
    if (lower === '/menu') {
        const pages = getMenuReport();
        const header = `📋 *MENU JUS KODE* (${pages.length} kategori)\n_Kirim per kategori..._`;
        await msg.reply(header);
        for (const page of pages) {
            await client.sendMessage(msg.from, page);
            // Jeda kecil agar tidak flooding
            await new Promise(r => setTimeout(r, 400));
        }
        return;
    }

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

module.exports = { isOwner, handleOwnerCommand };
