const fs   = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(process.cwd(), 'data', 'products.json');

/**
 * Load katalog produk dari file JSON.
 * Di-cache setelah pertama kali dibaca agar tidak baca disk terus.
 */
let _cache = null;

function loadCatalog() {
    if (_cache) return _cache;
    try {
        const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
        _cache = JSON.parse(raw);
    } catch (err) {
        console.error('[Catalog] Gagal load products.json:', err.message);
        _cache = {};
    }
    return _cache;
}

/**
 * Kembalikan katalog sebagai JSON minified (hemat token).
 */
function getCatalogString() {
    return JSON.stringify(loadCatalog());
}

module.exports = { loadCatalog, getCatalogString };
