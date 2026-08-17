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
    const history = loadHistory(userId);
    const systemPrompt = buildSystemPrompt(getCatalogString());
    
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
    ];

    let completion;
    try {
        completion = await groq.chat.completions.create({
            messages,
            model: config.groqModel,
            temperature: 0.7,
            max_tokens: 1024,
        });
    } catch (error) {
        if (error.status === 400 || error.status === 404) {
            console.warn(`[Peringatan] Model ${config.groqModel} bermasalah. Mencari model alternatif otomatis...`);
            try {
                const modelsList = await groq.models.list();
                const activeModel = modelsList.data.find(m => 
                    m.id.includes('llama') || m.id.includes('mixtral') || m.id.includes('gemma')
                );
                
                if (activeModel) {
                    console.log(`[Info] Model alternatif ditemukan: ${activeModel.id}. Menggunakan model ini...`);
                    config.groqModel = activeModel.id; 
                    
                    completion = await groq.chat.completions.create({
                        messages,
                        model: activeModel.id,
                        temperature: 0.7,
                        max_tokens: 1024,
                    });
                } else {
                    throw error;
                }
            } catch (fallbackErr) {
                throw error;
            }
        } else {
            throw error;
        }
    }

    const responseText = completion?.choices[0]?.message?.content || 'Maaf, saya tidak bisa merespons saat ini.';

    const updatedHistory = [
        ...history,
        { role: 'user',      content: message },
        { role: 'assistant', content: responseText },
    ];
    saveHistory(userId, updatedHistory);

    return responseText;
}

module.exports = { getGeminiResponse };
