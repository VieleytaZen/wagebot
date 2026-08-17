const fs = require('fs');
const path = require('path');
const config = require('./config');

// Direktori penyimpanan session per user
const SESSIONS_DIR = path.join(process.cwd(), 'data', 'sessions');

// Pastikan folder ada saat modul dimuat
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Ambil path file session untuk user tertentu
 */
function getSessionPath(userId) {
    // Sanitasi userId agar aman sebagai nama file
    const safeId = userId.replace(/[^a-zA-Z0-9_\-@.]/g, '_');
    return path.join(SESSIONS_DIR, `${safeId}.json`);
}

/**
 * Load history percakapan user dari file
 * @param {string} userId - ID WhatsApp user
 * @returns {Array} History dalam format Groq [{role, content}]
 */
function loadHistory(userId) {
    const filePath = getSessionPath(userId);
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            return Array.isArray(data.history) ? data.history : [];
        }
    } catch (err) {
        console.error(`[Memory] Gagal load history untuk ${userId}:`, err.message);
    }
    return [];
}

/**
 * Simpan history percakapan user ke file
 * @param {string} userId - ID WhatsApp user
 * @param {Array} history - History dalam format Groq [{role, content}]
 */
function saveHistory(userId, history) {
    const filePath = getSessionPath(userId);
    try {
        // Batasi jumlah pesan agar file tidak membengkak
        const trimmed = history.slice(-config.maxHistory);
        const data = {
            userId,
            updatedAt: new Date().toISOString(),
            history: trimmed,
        };
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error(`[Memory] Gagal save history untuk ${userId}:`, err.message);
    }
}

/**
 * Hapus history percakapan user (reset session)
 * @param {string} userId
 */
function clearHistory(userId) {
    const filePath = getSessionPath(userId);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error(`[Memory] Gagal hapus history untuk ${userId}:`, err.message);
    }
}

module.exports = { loadHistory, saveHistory, clearHistory };
