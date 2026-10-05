// WhatsApp-бот «Сортировщик идей». Подключается к твоему WhatsApp как ещё одно устройство
// (как WhatsApp Web) и разбирает сообщения, которые ты пишешь сам себе в чат «Я» / «Заметки».
//
// Запуск:  npm install && npm start
// Переменные окружения (все необязательные):
//   PHONE     — твой номер (79991234567): вместо QR-кода бот покажет 8-значный код для входа.
//               Нужен, если бот запущен на том же телефоне, где WhatsApp, — QR там не отсканировать.
//   OWNERS    — номера через запятую, которым можно писать боту, если бот стоит на отдельном номере.
//   DATA_DIR  — где хранить вход и идеи (по умолчанию ./data рядом с ботом).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import makeWASocket, {
  Browsers, DisconnectReason, fetchLatestBaileysVersion, isJidGroup, jidDecode, jidNormalizedUser,
  normalizeMessageContent, useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { BOT_MARK, createSorter } from './sorter.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(process.env.DATA_DIR || path.join(HERE, 'data'));
const PHONE = (process.env.PHONE || '').replace(/\D/g, '');
const OWNERS = (process.env.OWNERS || '').split(',').map(s => s.replace(/\D/g, '')).filter(Boolean);
const MAX_AGE_SEC = 24 * 3600; // сообщения старше суток (пришедшие после долгого простоя) не трогаем

const sorter = createSorter(path.join(DATA, 'ideas.json'));
const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });
const handled = new Set(); // id уже разобранных сообщений и наших ответов — чтобы не отвечать дважды и самому себе

const userOf = jid => (jid && jidDecode(jid)?.user) || '';
const remember = id => { handled.add(id); if (handled.size > 2000) handled.delete(handled.values().next().value); };

function textOf(msg) {
  const m = normalizeMessageContent(msg.message);
  if (!m) return '';
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || '';
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(DATA, 'auth'));
  const { version } = await fetchLatestBaileysVersion().catch(() => ({}));
  console.log('Подключаюсь к WhatsApp…');
  const sock = makeWASocket({
    auth: state, logger, version,
    browser: Browsers.ubuntu('Сортировщик идей'),
    markOnlineOnConnect: false, // чтобы телефон продолжал получать уведомления
    syncFullHistory: false,
  });
  sock.ev.on('creds.update', saveCreds);

  let codeAsked = false;
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && PHONE && !codeAsked) {
      codeAsked = true;
      try {
        const code = await sock.requestPairingCode(PHONE);
        console.log(`\nКод для входа: ${code.slice(0, 4)}-${code.slice(4)}`);
        console.log('WhatsApp → ⋮ / Настройки → Связанные устройства → Привязка устройства → «Привязать по номеру телефона» → введи код.\n');
      } catch (e) {
        console.log('Не получилось запросить код:', e.message, '— попробуй ещё раз или без PHONE (через QR).');
      }
    } else if (qr && !PHONE) {
      console.log('\nОтсканируй QR: WhatsApp → Настройки → Связанные устройства → Привязка устройства\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log(`✅ Бот подключён к ${userOf(sock.user?.id)}. Напиши себе в WhatsApp (чат «Я»): помощь`);
    }
    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      if (status === DisconnectReason.loggedOut) {
        console.log('❌ Бот отвязан от WhatsApp. Удали папку', path.join(DATA, 'auth'), 'и запусти снова.');
        process.exit(1);
      }
      console.log('Связь прервалась, переподключаюсь…', status ?? '');
      setTimeout(() => start().catch(fatal), status === DisconnectReason.restartRequired ? 0 : 3000);
    }
  });

  // Чат «Я»: в нём собеседник — ты сам (номер или скрытый id @lid).
  const isSelfChat = key => {
    const me = [sock.user?.id, sock.user?.lid].filter(Boolean).map(jidNormalizedUser);
    return [key.remoteJid, key.remoteJidAlt].filter(Boolean).some(j => me.includes(jidNormalizedUser(j)));
  };
  const isOwner = key => OWNERS.length > 0 &&
    [key.remoteJid, key.remoteJidAlt].some(j => OWNERS.includes(userOf(j)));

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;
    for (const msg of messages) {
      const { key } = msg;
      if (!key?.remoteJid || !key.id || handled.has(key.id) || isJidGroup(key.remoteJid)) continue;
      if (Date.now() / 1000 - Number(msg.messageTimestamp || 0) > MAX_AGE_SEC) continue;
      const mine = key.fromMe && isSelfChat(key);
      const fromOwner = !key.fromMe && isOwner(key);
      if (!mine && !fromOwner) continue;
      remember(key.id);

      const text = textOf(msg);
      if (!text || text.startsWith(BOT_MARK)) continue;
      let reply;
      try { reply = sorter.handle(text); } catch (e) {
        console.error('Ошибка разбора:', e);
        reply = `${BOT_MARK} Что-то сломалось, запись не сохранилась. Попробуй ещё раз.`;
      }
      if (!reply) continue;
      try {
        const sent = await sock.sendMessage(key.remoteJid, { text: reply });
        if (sent?.key?.id) remember(sent.key.id);
        console.log(`→ ${text.slice(0, 60)}\n← ${reply.split('\n')[0]}`);
      } catch (e) {
        console.error('Не отправилось:', e.message);
      }
    }
  });
}

function fatal(e) {
  console.error(e);
  process.exit(1);
}

fs.mkdirSync(DATA, { recursive: true });
console.log('Запускаю сортировщик идей… (данные в', DATA + ')');
start().catch(fatal);
