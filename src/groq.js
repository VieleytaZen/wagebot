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
async function getGroqResponse(userId, message) {
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
                    (m.id.includes('qwen') || m.id.includes('gpt-oss') || m.id.includes('llama') || m.id.includes('mixtral') || m.id.includes('gemma')) &&
                    !m.id.includes('guard') && !m.id.includes('whisper') && !m.id.includes('vision') && !m.id.includes('safeguard')
                );
                
                if (!activeModel) {
                    console.log('[Debug] Semua model yang tersedia di API Groq saat ini:');
                    console.log(modelsList.data.map(m => m.id).join(', '));
                }
                
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

    let responseText = completion?.choices[0]?.message?.content || 'Maaf, saya tidak bisa merespons saat ini.';

    // ── Bersihkan Chain of Thought (CoT) dari berbagai model ────────────────
    // 1. Tag <think>...</think> atau <reasoning>...</reasoning> dengan closing tag
    responseText = responseText.replace(/<(think|reasoning|thought|reflection)>[\s\S]*?<\/\1>\s*/gi, '');
    // 2. Tag <think> tanpa closing tag (model kadang lupa menutup) — hapus dari <think> sampai akhir blok atau seluruh sisa
    responseText = responseText.replace(/<(think|reasoning|thought|reflection)>[\s\S]*/gi, '');
    // 3. Markdown-style thinking headers (e.g. "**Thinking:**\n..." atau "**Alur Pikir:**\n...")
    responseText = responseText.replace(/^\*{1,2}(Thinking|Reasoning|Alur Pikir|Proses Berpikir|Chain of Thought|Internal)[:\s]*\*{1,2}\s*\n[\s\S]*?(?=\n\*{1,2}[^*]|\n#{1,3}\s|\n---|\n\n[A-Z])/gi, '');
    // 4. Blok yang dibungkus ``` dengan label think/reasoning
    responseText = responseText.replace(/```(?:think|thinking|reasoning)[\s\S]*?```\s*/gi, '');
    // 5. Bersihkan sisa whitespace berlebih
    responseText = responseText.replace(/^\s*\n{3,}/gm, '\n\n').trim();

    const updatedHistory = [
        ...history,
        { role: 'user',      content: message },
        { role: 'assistant', content: responseText },
    ];
    saveHistory(userId, updatedHistory);

    return responseText;
}

module.exports = { getGroqResponse };
