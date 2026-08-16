const fs   = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(process.cwd(), 'data', 'products.json');

// Cache agar tidak baca disk terus
let _cache = null;

// ─── Load & Cache ─────────────────────────────────────────────────────────────

function loadCatalog() {
    if (_cache) return _cache;
    try {
        const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
        _cache = JSON.parse(raw);
    } catch (err) {
        console.error('[Catalog] Gagal load products.json:', err.message);
        _cache = { menu: {} };
    }
    return _cache;
}

function clearCache() {
    _cache = null;
}

/** Kembalikan katalog sebagai JSON minified (hemat token untuk AI) */
function getCatalogString() {
    return JSON.stringify(loadCatalog());
}

// ─── Update Status Produk ─────────────────────────────────────────────────────

/**
 * Cari produk berdasarkan nama (partial, case-insensitive) dan ubah statusnya.
 * @param {string} productName - Nama produk (boleh sebagian)
 * @param {boolean} isAvailable - true = tersedia, false = tidak tersedia
 * @returns {{ found: boolean, matches: string[] }} hasil pencarian
 */
function updateProductStatus(productName, isAvailable) {
    const catalog = loadCatalog();
    const search  = productName.toLowerCase().trim();
    const matches = [];

    for (const [, items] of Object.entries(catalog.menu)) {
        for (const item of items) {
            if (item.nama.toLowerCase().includes(search)) {
                if (isAvailable) {
                    delete item.status;
                } else {
                    item.status = 'Tidak Tersedia';
                }
                matches.push(item.nama);
            }
        }
    }

    if (matches.length > 0) {
        // Simpan perubahan ke file
        fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf-8');
        _cache = catalog; // Refresh cache langsung
    }

    return { found: matches.length > 0, matches };
}

// ─── Laporan Menu untuk WhatsApp ──────────────────────────────────────────────

const EMOJI_CATEGORY = {
    'Makanan'         : '🍽️',
    'Minuman Besar'   : '🥤',
    'Minuman Kecil'   : '🧃',
    'Super Jus'       : '💪',
    'Yoghurt Series'  : '🍦',
    'Whey Series'     : '🏋️',
    'Es Kotjok Series': '🧊',
    'Milkshake Series': '🥛',
    'Wedang Series'   : '☕',
};

function formatRupiah(n) {
    return 'Rp' + n.toLocaleString('id-ID');
}

/**
 * Buat laporan menu lengkap per kategori untuk dikirim via WA.
 * @returns {string[]} Array pesan, satu string per kategori
 */
function getMenuReport() {
    const catalog = loadCatalog();
    const pages   = [];

    for (const [kategori, items] of Object.entries(catalog.menu)) {
        const emoji = EMOJI_CATEGORY[kategori] || '📌';
        let text = `${emoji} *${kategori}*\n`;
        for (const item of items) {
            const status = item.status === 'Tidak Tersedia' ? ' ❌' : ' ✅';
            text += `${status} ${item.nama} — ${formatRupiah(item.harga)}\n`;
        }
        pages.push(text.trim());
    }

    return pages;
}

/**
 * Daftar produk yang tidak tersedia.
 * @returns {string} Pesan ringkas
 */
function getUnavailableReport() {
    const catalog     = loadCatalog();
    const unavailable = [];

    for (const [kategori, items] of Object.entries(catalog.menu)) {
        for (const item of items) {
            if (item.status === 'Tidak Tersedia') {
                unavailable.push(`• ${item.nama} (${kategori})`);
            }
        }
    }

    if (unavailable.length === 0) return '✅ Semua produk tersedia!';
    return `❌ *Produk Tidak Tersedia:*\n${unavailable.join('\n')}`;
}

module.exports = {
    loadCatalog,
    clearCache,
    getCatalogString,
    updateProductStatus,
    getMenuReport,
    getUnavailableReport,
};
