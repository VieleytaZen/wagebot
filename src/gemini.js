const { GoogleGenAI } = require('@google/genai');
const config = require('./config');
const { SYSTEM_PROMPT } = require('./prompt');
const { loadHistory, saveHistory } = require('./memory');

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * Kirim pesan ke Gemini dengan context history percakapan user.
 * History disimpan ke file setelah setiap respons agar tahan restart.
 *
 * @param {string} userId  - ID WhatsApp pengirim (e.g. "6281234567890@c.us")
 * @param {string} message - Pesan teks dari user
 * @returns {Promise<string>} - Teks balasan dari Gemini
 */
async function getGeminiResponse(userId, message) {
    // Load history percakapan user dari file
    const history = loadHistory(userId);

    // Gabungkan history + pesan baru sebagai contents
    const contents = [
        ...history,
        { role: 'user', parts: [{ text: message }] },
    ];

    // Kirim ke Gemini dengan system instruction (persona Kodi)
    const response = await ai.models.generateContent({
        model: config.geminiModel,
        contents,
        config: {
            systemInstruction: SYSTEM_PROMPT,
        },
    });

    const responseText = response.text;

    // Update history: tambahkan giliran user + model yang baru
    const updatedHistory = [
        ...history,
        { role: 'user',  parts: [{ text: message }] },
        { role: 'model', parts: [{ text: responseText }] },
    ];

    // Potong history jika melebihi batas maxHistory
    const maxPairs = config.maxHistory;
    const trimmed = updatedHistory.length > maxPairs
        ? updatedHistory.slice(updatedHistory.length - maxPairs)
        : updatedHistory;

    // Simpan history kembali ke file
    saveHistory(userId, trimmed);

    return responseText;
}

module.exports = { getGeminiResponse };
