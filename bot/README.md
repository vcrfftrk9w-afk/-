# Telegram-бот напоминаний

Бот пишет в Telegram по недельному графику приложения:

- **утром** (07:00 в будни, 07:30 в выходные) — план дня;
- **за 5 минут** — о каждом деле графика;
- **за 15 минут и ровно в срок** — о публикациях TikTok «кино» (19:55) и «orca» (21:00);
- **в 08:00 / 11:00 / 12:00** — «выходи на пары» (в дни пар);
- **в 22:00** — «через 30 минут сон».

## Подключить (2 минуты)

1. В Telegram открой **@BotFather** → `/newbot` → придумай имя. Он пришлёт ключ вида `123456:ABC…`.
2. Открой своего бота и нажми **Start**.
3. В репозитории на GitHub: **Settings → Secrets and variables → Actions → New repository secret**,
   имя `TELEGRAM_TOKEN`, значение — ключ.
4. **Actions → Telegram-напоминания → Run workflow**. Придёт «✅ Бот подключён».
   В логе запуска будет строка «Нашёл чат: …» — добавь это число секретом `TELEGRAM_CHAT_ID`.

Ключ никому не показывай — только в секреты GitHub.

## Как это работает

`.github/workflows/telegram-reminders.yml` запускается по расписанию (31 раз в день — в минуты,
когда есть что напомнить) и вызывает `bot/telegram_bot.py --cron`. Это укладывается в бесплатный
лимит GitHub Actions. GitHub иногда запускает по расписанию с опозданием на несколько минут — бот
тогда пишет в сообщении, на сколько оно запоздало.

**Минута в минуту** — если есть компьютер или Android-телефон, который всегда включён
(Termux, `pkg install python`):

```bash
export TELEGRAM_TOKEN=…  TELEGRAM_CHAT_ID=…
python3 bot/telegram_bot.py --loop
```

В этом режиме бот ещё и отвечает на команды `/today` (план на сегодня) и `/next` (что дальше).

## Часовой пояс

Расписание собрано для **UTC+5**. Если у тебя другой пояс — поменяй `TZ_OFFSET` (переменная
репозитория, **Settings → Variables**) и пересобери строки `cron`:

```bash
TZ_OFFSET=3 TELEGRAM_TOKEN=x python3 bot/telegram_bot.py --print-crons
```

## Если поменялся график

```bash
node tools/export-schedule.js          # js/week.js → bot/schedule.json
TELEGRAM_TOKEN=x python3 bot/telegram_bot.py --print-crons   # новые строки cron в workflow
```

Проверка без настоящего Telegram: `python3 tests/telegram_bot_test.py`.
