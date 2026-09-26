"""Проверка бота без настоящего Telegram: поддельный сервер API ловит сообщения.
Запуск: python3 tests/telegram_bot_test.py"""
import json, os, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

SENT = []
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = parse_qs(self.rfile.read(int(self.headers['Content-Length'])).decode())
        method = self.path.rsplit('/', 1)[-1]
        if method == 'sendMessage':
            SENT.append({'chat': body['chat_id'][0], 'text': body['text'][0]})
            res = {'ok': True, 'result': {'message_id': len(SENT)}}
        elif method == 'getUpdates':
            res = {'ok': True, 'result': [{'update_id': 1, 'message': {'chat': {'id': 777, 'type': 'private'}, 'text': '/start'}}]}
        else:
            res = {'ok': False}
        out = json.dumps(res).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(out)

srv = HTTPServer(('127.0.0.1', 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = dict(os.environ, TELEGRAM_TOKEN='TEST', TELEGRAM_API_BASE=f'http://127.0.0.1:{srv.server_port}', TZ_OFFSET='5', NO_PROXY='127.0.0.1', no_proxy='127.0.0.1')
env.pop('TELEGRAM_CHAT_ID', None)
ok = True
def check(name, cond, info=''):
    global ok
    print(('✓ ' if cond else '✗ ') + name, info)
    ok = ok and cond
def run(*args, extra=None):
    e = dict(env, **(extra or {}))
    return subprocess.run([sys.executable, os.path.join(root, 'bot/telegram_bot.py'), *args], env=e, capture_output=True, text=True, timeout=60)

r = run('--test'); check('проверочное сообщение уходит', r.returncode == 0 and SENT and SENT[-1]['chat'] == '777', r.stderr[-200:])
check('без TELEGRAM_CHAT_ID бот сам находит чат по /start', 'Нашёл чат: 777' in r.stdout)
crons = run('--print-crons').stdout
check('расписание запусков в UTC выведено', crons.count('cron:') >= 15, crons.count('cron:'))

# слот 19:40 местного = 14:40 UTC: предупреждение о «кино» за 15 минут (через фальшивую дату нельзя — проверяем по слотам функции)
sys.path.insert(0, os.path.join(root, 'bot'))
os.environ['TELEGRAM_TOKEN'] = 'TEST'
import telegram_bot as B
mon = B.reminders(1)
check('в понедельник 07:00 — утренний план', any('Доброе утро' in t for t in mon.get(420, [])))
check('в 08:00 — «выходи на пары»', any('выходить на пары' in t for t in mon.get(480, [])))
check('в 19:40 — «через 15 минут кино»', any('кино' in t and '15 минут' in t for t in mon.get(19*60+40, [])))
check('в 19:55 — «сейчас публикация»', any('Сейчас' in t for t in mon.get(19*60+55, [])))
check('в 20:45 — «через 15 минут orca»', any('orca' in t for t in mon.get(20*60+45, [])))
check('в 15:55 — тренировка через 5 минут', any('Тренировка' in t for t in mon.get(15*60+55, [])))
sun = B.reminders(0)
check('в воскресенье нет «выходи на пары»', not any('выходить на пары' in t for ts in sun.values() for t in ts))
check('в воскресенье подъём в 07:30', any('Доброе утро' in t for t in sun.get(450, [])))
check('/today показывает дела дня', 'Английский' in B.today_text())
n = len(SENT)
r = run('--cron', '40 14 * * *', extra={'TELEGRAM_CHAT_ID': '777'})
check('запуск по cron шлёт напоминание слота (или честно пишет, что слота нет)', r.returncode == 0 and ('отправлено' in r.stdout or 'ничего нет' in r.stdout), r.stdout.strip()[-80:])
print('\n✓ бот работает' if ok else '\n✗ есть проблемы')
sys.exit(0 if ok else 1)
