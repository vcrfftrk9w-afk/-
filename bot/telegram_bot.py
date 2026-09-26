#!/usr/bin/env python3
"""Telegram-бот «Из Ленивца в Миллионеры»: присылает напоминания по недельному графику.

График берётся из bot/schedule.json — его выгружает tools/export-schedule.js
из того же js/week.js, по которому работает приложение.

Нужны две переменные окружения:
  TELEGRAM_TOKEN    — ключ бота от @BotFather (секрет, в репозиторий не класть)
  TELEGRAM_CHAT_ID  — кому писать; если не задан, бот берёт чат того,
                      кто последним написал ему /start
Необязательные:
  TZ_OFFSET  — часовой пояс в часах от UTC (по умолчанию 5)
  LEAD_MIN   — за сколько минут напоминать о деле (по умолчанию 5)
  APP_URL    — ссылка на приложение

Режимы:
  --cron "M H * * *"  отправить напоминания этого слота (так запускает GitHub Actions)
  --loop              работать постоянно: напоминания минута в минуту и команды
                      /today /next /help (для компьютера или телефона с Termux)
  --today             прислать план на сегодня
  --test              прислать проверочное сообщение
  --print-crons       вывести расписание запусков в UTC для workflow
Только стандартная библиотека Python 3.8+.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
TZ = timezone(timedelta(hours=float(os.environ.get('TZ_OFFSET', '5'))))
LEAD = int(os.environ.get('LEAD_MIN', '5'))
APP_URL = os.environ.get('APP_URL', 'https://claude.ai/artifact/DE7DjuVVbdRMKDwWyUD5UM')
TOKEN = os.environ.get('TELEGRAM_TOKEN', '').strip()
API = os.environ.get('TELEGRAM_API_BASE', 'https://api.telegram.org') + f'/bot{TOKEN}/'  # адрес можно подменить в тестах

with open(os.path.join(HERE, 'schedule.json'), encoding='utf-8') as f:
    SCHEDULE = json.load(f)
DAY_NAMES = SCHEDULE['days_ru']


def hhmm(m):
    m %= 1440
    return f'{m // 60:02d}:{m % 60:02d}'


def now_local():
    return datetime.now(TZ)


def js_dow(dt):
    """день недели как в приложении: 0 — воскресенье"""
    return (dt.weekday() + 1) % 7


# ---------- что и когда присылать ----------
def reminders(dow):
    """{минута дня: [текст, ...]} для этого дня недели"""
    out = {}
    blocks = SCHEDULE['days'][str(dow)]

    def add(minute, text):
        out.setdefault(minute, []).append(text)

    tasks = [b for b in blocks if b['kind'] == 'task']
    for b in blocks:
        if b['kind'] == 'wake':
            lines = '\n'.join(f"{hhmm(t['start'])} {t['emoji']} {t['title']}" for t in tasks)
            add(b['start'], f"☀️ Доброе утро! Сегодня {DAY_NAMES[dow].lower()}.\n\nТвои дела:\n{lines}\n\nНачни с первого — остальное потянется.")
        elif b['kind'] == 'road' and 'учёбу' in b['title']:
            add(b['start'], '🚌 Пора выходить на пары — дорога 30 минут.')
        elif b['kind'] == 'routine' and b['title'].startswith('Гигиена'):
            add(b['start'], '🌙 Через 30 минут сон. Гигиена, телефон на зарядку подальше от кровати. Лента подождёт.')
        elif b['kind'] == 'task':
            span = f"{hhmm(b['start'])}–{hhmm(b['end'])}"
            note = f"\n{b['note']}" if b.get('note') else ''
            if b['hard']:
                add(b['start'] - 15, f"⏰ Через 15 минут: {b['emoji']} {b['title']} — ровно в {hhmm(b['start'])}.\nПодготовь подпись, хэштеги и обложку.")
                add(b['start'], f"🔔 Сейчас: {b['emoji']} {b['title']}! Жми «Опубликовать».")
            else:
                add(b['start'] - LEAD, f"⏰ Через {LEAD} мин: {b['emoji']} {b['title']} ({span}){note}")
    return out


def all_slots():
    slots = set()
    for dow in range(7):
        slots.update(reminders(dow).keys())
    return sorted(slots)


# ---------- Telegram ----------
def call(method, **params):
    if not TOKEN:
        sys.exit('Нет TELEGRAM_TOKEN: создай бота в @BotFather и добавь ключ в секреты.')
    data = urllib.parse.urlencode({k: (json.dumps(v) if isinstance(v, (dict, list)) else v) for k, v in params.items()}).encode()
    with urllib.request.urlopen(urllib.request.Request(API + method, data=data), timeout=30) as r:
        res = json.load(r)
    if not res.get('ok'):
        raise RuntimeError(res)
    return res['result']


def chat_id():
    cid = os.environ.get('TELEGRAM_CHAT_ID', '').strip()
    if cid:
        return cid
    # не задан — берём того, кто последним написал боту в личку
    for upd in reversed(call('getUpdates', timeout=0)):
        msg = upd.get('message') or {}
        chat = msg.get('chat') or {}
        if chat.get('type') == 'private':
            print(f"Нашёл чат: {chat['id']} — впиши его в секрет TELEGRAM_CHAT_ID, чтобы работало всегда.")
            return str(chat['id'])
    sys.exit('Не знаю, кому писать: открой своего бота в Telegram и отправь ему /start, потом запусти ещё раз.')


def send(text, cid=None):
    markup = {'inline_keyboard': [[{'text': '📱 Открыть приложение', 'url': APP_URL}]]}
    call('sendMessage', chat_id=cid or chat_id(), text=text, reply_markup=markup, disable_web_page_preview=True)


def today_text(dt=None):
    dt = dt or now_local()
    dow = js_dow(dt)
    tasks = [b for b in SCHEDULE['days'][str(dow)] if b['kind'] == 'task']
    now_m = dt.hour * 60 + dt.minute
    lines = []
    for t in tasks:
        mark = '✔️' if t['end'] <= now_m else ('▶️' if t['start'] <= now_m < t['end'] else '•')
        lines.append(f"{mark} {hhmm(t['start'])} {t['emoji']} {t['title']}")
    return f"📅 {DAY_NAMES[dow]}\n\n" + '\n'.join(lines)


def next_text(dt=None):
    dt = dt or now_local()
    now_m = dt.hour * 60 + dt.minute
    for t in SCHEDULE['days'][str(js_dow(dt))]:
        if t['kind'] == 'task' and t['start'] >= now_m:
            return f"Дальше в {hhmm(t['start'])}: {t['emoji']} {t['title']}\nЧерез {t['start'] - now_m} мин."
    return 'На сегодня дела закончились. Отдыхай и ложись вовремя 🌙'


# ---------- режимы ----------
def run_cron(expr):
    """GitHub запускает по UTC; переводим слот в местное время и шлём его напоминания"""
    minute, hour = (int(x) for x in expr.split()[:2])
    utc_min = hour * 60 + minute
    offset = int(TZ.utcoffset(None).total_seconds() // 60)
    slot = (utc_min + offset) % 1440
    dt = now_local()
    # запуск мог опоздать и перевалить через полночь — день берём по слоту
    if slot > dt.hour * 60 + dt.minute + 60:
        dt -= timedelta(days=1)
    msgs = reminders(js_dow(dt)).get(slot, [])
    if not msgs:
        print(f'{hhmm(slot)} {DAY_NAMES[js_dow(dt)]}: сегодня в этот слот ничего нет')
        return
    cid = chat_id()
    late = (now_local().hour * 60 + now_local().minute - slot) % 1440
    for text in msgs:
        send(text + (f'\n\n(напоминание запоздало на {late} мин)' if 3 <= late <= 120 else ''), cid)
    print(f'{hhmm(slot)}: отправлено {len(msgs)}')


def run_loop():
    cid = chat_id()
    send('🤖 Бот запущен. Буду напоминать о делах по твоему графику.\nКоманды: /today — план, /next — что дальше.', cid)
    sent = set()
    offset = None
    while True:
        dt = now_local()
        key_day = dt.date().isoformat()
        m = dt.hour * 60 + dt.minute
        for text in reminders(js_dow(dt)).get(m, []):
            key = (key_day, m, text[:40])
            if key not in sent:
                send(text, cid)
                sent.add(key)
        try:
            for upd in call('getUpdates', timeout=20, offset=offset or 0):
                offset = upd['update_id'] + 1
                msg = upd.get('message') or {}
                txt = (msg.get('text') or '').strip().lower()
                to = (msg.get('chat') or {}).get('id') or cid
                if txt.startswith('/today'):
                    send(today_text(), to)
                elif txt.startswith('/next'):
                    send(next_text(), to)
                elif txt.startswith('/start') or txt.startswith('/help'):
                    send('Я присылаю напоминания по твоему графику.\n/today — план на сегодня\n/next — что дальше', to)
        except Exception as e:  # сеть пропала — подождём и продолжим
            print('ошибка сети:', e)
            time.sleep(10)
        if len(sent) > 500:
            sent = {k for k in sent if k[0] == key_day}


def main(argv):
    if '--print-crons' in argv:
        offset = int(TZ.utcoffset(None).total_seconds() // 60)
        for s in all_slots():
            u = (s - offset) % 1440
            print(f'    - cron: "{u % 60} {u // 60} * * *"   # {hhmm(s)} местного')
        return
    if '--cron' in argv:
        return run_cron(argv[argv.index('--cron') + 1])
    if '--loop' in argv:
        return run_loop()
    if '--today' in argv:
        return send(today_text())
    if '--test' in argv:
        return send('✅ Бот подключён! Буду напоминать о делах: утром — план дня, за 5 минут — о каждом деле, за 15 минут — о публикациях в TikTok.')
    print(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
