const Groq = require('groq-sdk');
const config = require('./config');
const { buildSystemPrompt } = require('./prompt');
const { getCatalogString }  = require('./catalog');
const { loadHistory, saveHistory } = require('./memory');

const groq = new Groq({ apiKey: config.groqApiKey });

/**
 * Kirim pesan ke Groq dengan context history percakapan user.
 * History disimpan ke file setelah setiap respons agar tahan restart.
 *
 * @param {string} userId  - ID WhatsApp pengirim (e.g. "6281234567890@c.us")
 * @param {string} message - Pesan teks dari user
 * @returns {Promise<string>} - Teks balasan dari Groq
 */
async function getGeminiResponse(userId, message) {
    // Load history percakapan user dari file
    const history = loadHistory(userId);

    // Bangun system prompt dengan data katalog terkini (minified JSON)
    const systemPrompt = buildSystemPrompt(getCatalogString());

    // Susun messages: system prompt + history + pesan baru
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
    ];

    // Kirim ke Groq dan tunggu balasan
    const completion = await groq.chat.completions.create({
        messages,
        model: config.groqModel,
        temperature: 0.7,
        max_tokens: 1024,
    });

    const responseText = completion.choices[0].message.content;

    // Update history: tambahkan giliran user + assistant yang baru
    const updatedHistory = [
        ...history,
        { role: 'user',      content: message },
        { role: 'assistant', content: responseText },
    ];

    // Simpan history kembali ke file (memory.js sudah handle trim)
    saveHistory(userId, updatedHistory);

    return responseText;
}

module.exports = { getGeminiResponse };
