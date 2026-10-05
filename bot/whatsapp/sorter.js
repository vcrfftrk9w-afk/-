// Сортировщик идей: решает, в какую папку положить сообщение, и отвечает на команды.
// Без WhatsApp и без зависимостей — проверка: node tests/whatsapp_sorter_test.mjs
import fs from 'node:fs';
import path from 'node:path';

// Папки. Чтобы добавить свою — допиши такой же блок:
//   names — как ты называешь папку в начале сообщения («тт: …», «в жизнь: …»), это слово из текста убирается;
//   hints — слова, по которым бот угадывает папку, если ты её не назвал. «трениров*» — любое слово,
//           которое так начинается (тренировка, тренироваться), без звёздочки — только слово целиком.
export const CATEGORIES = [
  {
    id: 'tt', icon: '🎬', name: 'Идеи для ТТ',
    names: ['тт', 'tt', 'тикток', 'тиктока', 'тиктоке', 'тик ток', 'тик тока', 'тик-ток', 'tiktok', 'tik tok'],
    hints: ['видео*', 'видос*', 'ролик*', 'снять', 'сниму', 'снимать', 'съемк*', 'тренд*', 'монтаж*',
      'рилс*', 'reels', 'шортс*', 'контент*', 'подписчик*', 'озвучк*', 'залить', 'выложить', 'пост*', 'сценари*'],
  },
  {
    id: 'life', icon: '🌱', name: 'В жизнь',
    names: ['жизнь', 'жизни', 'лайф', 'life', 'реал', 'реале', 'реальность'],
    hints: ['купить', 'сходить', 'пойти', 'позвонить', 'записаться', 'убраться', 'убрать', 'спорт*', 'зал',
      'трениров*', 'учеб*', 'деньг*', 'работ*', 'сделать', 'надо', 'нужно', 'хочу', 'попробовать', 'начать',
      'бросить', 'привычк*', 'подар*', 'поехать', 'съездить'],
  },
];
// Сюда падает то, что бот не смог разложить сам.
export const INBOX = { id: 'inbox', icon: '📥', name: 'Разное', names: ['разное', 'другое', 'инбокс'], hints: [] };
const ALL = [...CATEGORIES, INBOX];

// Слова-связки, которые можно писать перед названием папки: «идея для тт: …», «короче в жизнь …».
const FILLERS = ['идея', 'идеи', 'идею', 'идейка', 'мысль', 'заметка', 'для', 'в', 'во', 'на', 'про', 'к',
  'короче', 'типо', 'типа', 'кстати', 'ну', 'это', 'слушай', 'запиши', 'добавь'];

export const BOT_MARK = '🤖';
const SEP = '[\\s,:;.!—–-]';
const MAX_SHOW = 50;

const norm = s => s.toLowerCase().replace(/ё/g, 'е');
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
const byLength = (a, b) => b.length - a.length;
const words = s => norm(s).match(/[\p{L}\p{N}]+/gu) || [];

// «тт: снять кота» → { cat: tt, text: 'снять кота' }; «тт» → { cat: tt, text: '' }
function parsePrefix(text) {
  const low = norm(text);
  for (const cat of ALL) {
    const names = cat.names.map(norm).sort(byLength).map(esc).join('|');
    const re = new RegExp(`^\\s*(?:(?:${FILLERS.join('|')})${SEP}+)*(?:${names})(?=$|${SEP})`, 'u');
    const m = low.match(re);
    if (m) return { cat, text: text.slice(m[0].length).replace(new RegExp(`^${SEP}+`, 'u'), '').trim() };
  }
  return null;
}

// Угадать папку по словам внутри текста. Ничья или ни одного совпадения — null.
function guess(text) {
  const ws = words(text);
  let best = null, bestScore = 0, tie = false;
  for (const cat of CATEGORIES) {
    const found = cat.hints.filter(h => {
      const n = norm(h);
      return n.endsWith('*') ? ws.some(w => w.startsWith(n.slice(0, -1))) : ws.includes(n);
    });
    if (found.length > bestScore) { best = { cat, word: found[0] }; bestScore = found.length; tie = false; }
    else if (found.length && found.length === bestScore) tie = true;
  }
  return tie ? null : best;
}

// Название папки из команды: «тт», «жизнь», «в жизнь», «разное», «1».
function findCat(label) {
  const l = norm(label).trim().replace(/^(в|во|на)\s+/, '');
  if (/^\d+$/.test(l)) return CATEGORIES[+l - 1] || null;
  const p = parsePrefix(l);
  return p && !p.text ? p.cat : null;
}

export function createSorter(file) {
  let db = { items: {}, pending: null, lastCat: null, nextId: 1 };
  try { db = { ...db, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch { /* первый запуск */ }
  for (const c of ALL) db.items[c.id] ||= [];

  const save = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(db, null, 1));
    fs.renameSync(file + '.tmp', file);
  };
  const catById = id => ALL.find(c => c.id === id);
  const title = c => `${c.icon} ${c.name}`;

  function add(cat, text) {
    db.items[cat.id].push({ id: db.nextId++, text, at: new Date().toISOString() });
    db.lastCat = cat.id;
    db.pending = null; // новая запись — старый вопрос «куда?» больше не ждёт ответа
    return db.items[cat.id].length;
  }

  function move(from, nums, to) {
    const list = db.items[from.id];
    const bad = nums.filter(n => n < 1 || n > list.length);
    if (bad.length) return `${BOT_MARK} В «${from.name}» нет №${bad.join(', ')} — там ${list.length} шт.`;
    for (const n of [...nums].sort((a, b) => b - a)) {
      const [item] = list.splice(n - 1, 1);
      if (to) db.items[to.id].push(item);
      if (item.id === db.pending) db.pending = null;
    }
    db.lastCat = (to || from).id;
    save();
    return null;
  }

  function show(cat) {
    const list = db.items[cat.id];
    if (!list.length) return `${title(cat)} — пусто`;
    const from = Math.max(0, list.length - MAX_SHOW);
    const lines = list.slice(from).map((it, i) => `${from + i + 1}. ${it.text}`);
    if (from) lines.unshift(`…ещё ${from} раньше`);
    return `*${title(cat)}* (${list.length})\n${lines.join('\n')}`;
  }

  const askWhere = () => `Куда это? ${CATEGORIES.map((c, i) => `${i + 1} — ${title(c)}`).join(', ')}. Ответь цифрой — или пусть лежит в «${INBOX.name}».`;

  const HELP = [
    `${BOT_MARK} *Сортировщик идей*`,
    'Просто пиши мне — я раскладываю по папкам:',
    ...CATEGORIES.map(c => `• «${c.names[0]}: …» → ${title(c)}`),
    `Не написал куда — угадаю по словам или спрошу. Непонятное лежит в ${title(INBOX)}.`,
    '',
    '*Команды*',
    '• все — показать все папки',
    `• ${CATEGORIES[0].names[0]} — показать одну папку`,
    `• готово ${CATEGORIES[0].names[0]} 2 — сделал, убрать (можно «готово 2 5», если папку только что смотрел)`,
    `• удали ${CATEGORIES[0].names[0]} 2 — удалить`,
    `• перенеси ${CATEGORIES[0].names[0]} 2 в ${CATEGORIES[1].names[0]} — переложить в другую папку`,
    '• помощь — это сообщение',
  ].join('\n');

  // Главное: текст сообщения → ответ (или null, если отвечать не надо).
  function handle(raw) {
    const text = (raw || '').trim();
    if (!text || text.startsWith(BOT_MARK)) return null;
    const cmd = norm(text).replace(/[.!?\s]+$/, '').replace(/^\//, '');

    if (/^(помощь|help|команды|start|старт|меню)$/.test(cmd)) return HELP;

    if (/^(все|список|покажи|показать|идеи|папки)$/.test(cmd)) {
      db.lastCat = null; save();
      return `${BOT_MARK} ${ALL.map(show).join('\n\n')}`;
    }

    let m = cmd.match(/^(?:покажи|показать|список|открой)\s+(.+)$/);
    if (m && findCat(m[1])) { const c = findCat(m[1]); db.lastCat = c.id; save(); return `${BOT_MARK} ${show(c)}`; }

    // готово / удали [папка] 2 5
    m = cmd.match(/^(готово|сделал|сделала|сделано|выполнил|выполнила|удали|удалить|убери|убрать)\s+(?:([^\d\s][^\d]*?)\s+)?(\d+(?:[\s,]+\d+)*)$/);
    if (m) {
      const cat = m[2] ? findCat(m[2]) : catById(db.lastCat);
      if (!cat) return `${BOT_MARK} Из какой папки? Например: «${m[1]} ${CATEGORIES[0].names[0]} ${m[3]}»`;
      const nums = m[3].split(/[\s,]+/).map(Number);
      const err = move(cat, nums, null);
      if (err) return err;
      const done = /^(готово|сдел|выполн)/.test(m[1]);
      return `${BOT_MARK} ${done ? '🔥 Сделано!' : '🗑 Удалил.'} В «${cat.name}» осталось ${db.items[cat.id].length}.`;
    }

    // перенеси [папка] 2 в жизнь
    m = cmd.match(/^(?:перенеси|перенести|переложи|переложить)\s+(?:([^\d\s][^\d]*?)\s+)?(\d+(?:[\s,]+\d+)*)\s+(.+)$/);
    if (m) {
      const from = m[1] ? findCat(m[1]) : catById(db.lastCat);
      const to = findCat(m[3]);
      if (!from || !to) return `${BOT_MARK} Не понял, откуда и куда. Например: «перенеси ${CATEGORIES[0].names[0]} 2 в ${CATEGORIES[1].names[0]}»`;
      const err = move(from, m[2].split(/[\s,]+/).map(Number), to);
      return err || `${BOT_MARK} Переложил в ${title(to)} (теперь там ${db.items[to.id].length}).`;
    }

    // Ответ на «Куда это?»: цифра или название папки.
    const pending = db.pending && db.items.inbox.find(it => it.id === db.pending);
    if (pending && (/^\d$/.test(cmd) || findCat(cmd))) {
      const to = findCat(cmd);
      if (!to) return `${BOT_MARK} Такой папки нет. ${askWhere()}`;
      if (to.id !== INBOX.id) {
        db.items.inbox.splice(db.items.inbox.indexOf(pending), 1);
        db.items[to.id].push(pending);
      }
      db.pending = null; db.lastCat = to.id; save();
      return `${BOT_MARK} ${to.icon} Положил в «${to.name}» — №${db.items[to.id].length}`;
    }
    if (/^\d+$/.test(cmd)) return `${BOT_MARK} Сейчас нечего перекладывать. Чтобы убрать сделанное: «готово ${CATEGORIES[0].names[0]} ${cmd}»`;

    // Новая запись.
    const p = parsePrefix(text);
    if (p && !p.text) { db.lastCat = p.cat.id; save(); return `${BOT_MARK} ${show(p.cat)}`; } // одно слово «тт» — показать папку
    if (p) {
      const n = add(p.cat, p.text);
      save();
      return `${BOT_MARK} ${p.cat.icon} Записал в «${p.cat.name}» — №${n}`;
    }
    const g = guess(text);
    if (g) {
      const n = add(g.cat, text);
      save();
      const other = CATEGORIES.find(c => c !== g.cat) || INBOX;
      return `${BOT_MARK} ${g.cat.icon} Записал в «${g.cat.name}» — №${n} (по слову «${g.word.replace('*', '')}»). ` +
        `Не туда — «перенеси ${n} в ${other.names[0]}»`;
    }
    add(INBOX, text);
    db.pending = db.items.inbox.at(-1).id;
    save();
    return `${BOT_MARK} 📥 ${askWhere()}`;
  }

  return { handle, data: () => db };
}
