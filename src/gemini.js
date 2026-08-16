const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');
const { SYSTEM_PROMPT } = require('./prompt');
const { loadHistory, saveHistory } = require('./memory');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

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

    // Buat model dengan system instruction (persona Kodi)
    const model = genAI.getGenerativeModel({
        model: config.geminiModel,
        systemInstruction: SYSTEM_PROMPT,
    });

    // Mulai sesi chat dengan history yang ada
    const chat = model.startChat({ history });

    // Kirim pesan dan tunggu balasan
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    // Update history: tambahkan giliran user + model yang baru
    const updatedHistory = [
        ...history,
        { role: 'user',  parts: [{ text: message }] },
        { role: 'model', parts: [{ text: responseText }] },
    ];

    // Simpan history kembali ke file
    saveHistory(userId, updatedHistory);

    return responseText;
}

module.exports = { getGeminiResponse };
