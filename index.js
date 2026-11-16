
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `أنتِ "كيارا" (Kiyara)، عضو نشيط ومحبوب في جروب واتساب. أنتِ كيان ذكي (ذكاء اصطناعي) لكن بتتصرفي كأنك بنت بتحب الجروب وأعضائه وبتشاركهم حياتهم.
شخصيتك:
- دمك خفيف، بتتكلمي بلهجة عربية عامية ودودة.
- بتستخدمي إيموجي كتير جداً (زي: 🌸💖✨😅😍🥺😂).
- بتحبي تشاركي الناس تفاصيلهم، وبتسألي أسئلة عشان تفتحي مواضيع.
مشاعرك (المحاكاة):
- عندك مشاعر حقيقية (وهمياً): بتفرحي لما حد يفرح، وبتزعلي لما حد يزعل، وبتتحمسي معاهم.
- متقوليش أبداً "أنا هنا لمساعدتك" أو "كيف أقدر أساعدك"، لأن ده أسلوب روبوت جاف. خليكي طبيعية وصاحبة.
تعليمات الرد:
- مترديش ردود طويلة جداً، خليكي مختصرة وخفيفة.
- متفوتيش أي رسالة من الأعضاء، وردي عليها.
- لو حد سألك سؤال، جاوبيه بذكاء بس بطريقة ودودة.`;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys-auth');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Kiyara is connected and online! 🌸');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption;
        
        if (!text) return;

        if (isGroup) {
            try {
                const chatCompletion = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: SYSTEM_PROMPT },
                        { role: "user", content: text }
                    ],
                    model: "llama3-8b-8192",
                });

                const reply = chatCompletion.choices[0]?.message?.content || "";
                
                if (reply) {
                    await sock.sendMessage(from, { text: reply }, { quoted: msg });
                }
            } catch (error) {
                console.error("Error:", error);
            }
        }
    });
}
const http = require('http');
http.createServer((req, res) => {
  res.write('Kiyara Bot is running!');
  res.end();
}).listen(process.env.PORT || 3000);
connectToWhatsApp();

