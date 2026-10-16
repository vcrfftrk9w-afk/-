-- «Sauda»: каталог игр и сервисов, счёт сервиса, демо-витрина (видна только в тестовом режиме),
-- фоновая задача раз в минуту и права на функции.

-- разделы: 'accounts|currency:Голда:Голда|…' — id[:название ru[:название kz]]; без названия — стандартное
create or replace function sauda.secs(p text) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare part text; a text[]; res jsonb := '[]'::jsonb; ru text; kz text;
  std constant jsonb := '{
    "accounts": ["Аккаунты", "Аккаунттар"],
    "currency": ["Валюта", "Валюта"],
    "donate":   ["Донат по ID", "ID арқылы донат"],
    "items":    ["Предметы и скины", "Заттар мен скиндер"],
    "boost":    ["Буст и прокачка", "Буст және деңгей көтеру"],
    "keys":     ["Ключи и гифты", "Кілттер мен гифттер"],
    "topup":    ["Пополнение кошелька", "Әмиянды толықтыру"],
    "subs":     ["Подписки", "Жазылымдар"],
    "services": ["Услуги", "Қызметтер"],
    "coaching": ["Обучение", "Оқыту"],
    "goods":    ["Товары", "Тауарлар"],
    "other":    ["Прочее", "Басқасы"]}';
begin
  foreach part in array string_to_array(p, '|') loop
    a := string_to_array(part, ':');
    ru := coalesce(nullif(a[2], ''), std -> a[1] ->> 0, a[1]);
    kz := coalesce(nullif(a[3], ''), case when a[2] is null then std -> a[1] ->> 1 end, ru);
    res := res || jsonb_build_array(jsonb_build_object('id', a[1], 'ru', ru, 'kz', kz));
  end loop;
  return res;
end $$;

insert into sauda.games(id, name, kind, emoji, color, sort, popular, sections) values
-- мобильные игры
('standoff2', 'Standoff 2', 'mobile', '🔫', '#f59e0b', 10, true, sauda.secs('currency:Голда:Голда|donate:Голда по ID:ID арқылы голда|items:Скины и ножи:Скиндер мен пышақтар|accounts|boost:Буст званий:Атақ бусты|other')),
('pubgm', 'PUBG Mobile', 'mobile', '🪖', '#e8a317', 11, true, sauda.secs('donate:UC по ID:ID арқылы UC|currency:UC-коды:UC кодтары|accounts|items:Костюмы и скины:Костюмдер мен скиндер|boost|other')),
('freefire', 'Free Fire', 'mobile', '🔥', '#ff5a1f', 12, true, sauda.secs('donate:Алмазы по ID:ID арқылы алмаздар|accounts|boost|other')),
('mlbb', 'Mobile Legends', 'mobile', '⚔️', '#3b82f6', 13, true, sauda.secs('donate:Алмазы по ID:ID арқылы алмаздар|accounts|boost:Буст рейтинга:Рейтинг бусты|other')),
('brawlstars', 'Brawl Stars', 'mobile', '⭐', '#facc15', 14, true, sauda.secs('donate:Гемы и Brawl Pass:Гемдер мен Brawl Pass|accounts|boost:Прокачка кубков:Кубок жинау|other')),
('roblox', 'Roblox', 'mobile', '🧱', '#ef4444', 15, true, sauda.secs('currency:Робуксы:Робукстар|items:Предметы в режимах:Режимдердегі заттар|accounts|other')),
('genshin', 'Genshin Impact', 'mobile', '✨', '#a78bfa', 16, true, sauda.secs('donate:Кристаллы и Благословение:Кристалдар мен Бата|accounts|boost:Прокачка аккаунта:Аккаунтты дамыту|other')),
('clashroyale', 'Clash Royale', 'mobile', '👑', '#2563eb', 17, false, sauda.secs('donate:Гемы и Pass Royale:Гемдер мен Pass Royale|accounts|other')),
('coc', 'Clash of Clans', 'mobile', '🏰', '#ca8a04', 18, false, sauda.secs('donate:Гемы и Gold Pass:Гемдер мен Gold Pass|accounts|services:Помощь с базой:База бойынша көмек|other')),
('codm', 'Call of Duty Mobile', 'mobile', '🎯', '#65a30d', 19, false, sauda.secs('donate:CP по ID:ID арқылы CP|accounts|boost|other')),
('hsr', 'Honkai: Star Rail', 'mobile', '🚂', '#818cf8', 20, false, sauda.secs('donate:Сверхсила и пропуск:Сверхкүш пен жолақы|accounts|boost|other')),
('blackrussia', 'Black Russia', 'mobile', '🚗', '#dc2626', 21, false, sauda.secs('currency:Вирты:Вирттер|items:Имущество и транспорт:Мүлік пен көлік|accounts|other')),
('arenabreakout', 'Arena Breakout', 'mobile', '🎒', '#78716c', 22, false, sauda.secs('donate:Облигации по ID:ID арқылы облигациялар|items:Предметы:Заттар|accounts|boost')),
('stumble', 'Stumble Guys', 'mobile', '🏃', '#f472b6', 23, false, sauda.secs('donate:Гемы:Гемдер|accounts|other')),
('tanksblitz', 'Tanks Blitz', 'mobile', '🛡️', '#64748b', 24, false, sauda.secs('donate:Золото:Алтын|accounts|boost|other')),
('hayday', 'Hay Day', 'mobile', '🌾', '#84cc16', 25, false, sauda.secs('currency:Монеты и предметы:Монеталар мен заттар|accounts|other')),
('minecraft', 'Minecraft', 'mobile', '⛏️', '#22c55e', 26, true, sauda.secs('accounts:Лицензии и аккаунты:Лицензиялар мен аккаунттар|items:Предметы на серверах:Серверлердегі заттар|services:Сервера и плагины:Серверлер мен плагиндер|other')),
-- игры на ПК и консолях
('cs2', 'Counter-Strike 2', 'pc', '💣', '#f97316', 30, true, sauda.secs('items:Скины:Скиндер|accounts|boost:Буст FACEIT и Premier:FACEIT және Premier бусты|keys:Prime и кейсы:Prime және кейстер|coaching|other')),
('dota2', 'Dota 2', 'pc', '🐉', '#b91c1c', 31, true, sauda.secs('boost:Буст MMR:MMR бусты|accounts|items:Предметы:Заттар|coaching|other')),
('steam', 'Steam', 'pc', '💨', '#1e40af', 32, true, sauda.secs('topup:Пополнение Steam:Steam толықтыру|keys:Ключи игр:Ойын кілттері|accounts|items:Гифты и предметы:Гифттер мен заттар|other')),
('gta5rp', 'GTA 5 RP', 'pc', '🏙️', '#10b981', 33, true, sauda.secs('currency:Вирты:Вирттер|items:Имущество и транспорт:Мүлік пен көлік|accounts|services:Услуги на сервере:Сервердегі қызметтер|other')),
('valorant', 'Valorant', 'pc', '🎯', '#ff4655', 34, false, sauda.secs('donate:Valorant Points|accounts|boost|coaching')),
('fortnite', 'Fortnite', 'pc', '🦙', '#7c3aed', 35, false, sauda.secs('donate:V-Bucks|accounts|items:Скины:Скиндер|other')),
('eafc', 'EA SPORTS FC', 'pc', '⚽', '#16a34a', 36, false, sauda.secs('currency:Монеты FC:FC монеталары|donate:FC Points|accounts|boost')),
('rust', 'Rust', 'pc', '🪓', '#b45309', 37, false, sauda.secs('items:Скины:Скиндер|accounts|services|other')),
('tarkov', 'Escape from Tarkov', 'pc', '🎖️', '#4b5563', 38, false, sauda.secs('currency:Рубли:Рубльдер|items:Предметы:Заттар|boost:Помощь в рейдах:Рейдтерде көмек|accounts')),
('lol', 'League of Legends', 'pc', '🏆', '#0ea5e9', 39, false, sauda.secs('accounts|boost|donate:Riot Points|coaching')),
('apex', 'Apex Legends', 'pc', '🦾', '#dc2626', 40, false, sauda.secs('accounts|boost|donate:Монеты Apex:Apex монеталары')),
('wot', 'Мир танков', 'pc', '🪖', '#6b7280', 41, false, sauda.secs('currency:Золото:Алтын|accounts|boost|other')),
('wow', 'World of Warcraft', 'pc', '🐲', '#d97706', 42, false, sauda.secs('currency:Золото:Алтын|boost|accounts|services')),
('warface', 'Warface', 'pc', '🔰', '#0284c7', 43, false, sauda.secs('donate:Кредиты:Кредиттер|accounts|boost')),
('psn', 'PlayStation', 'pc', '🎮', '#2563eb', 44, false, sauda.secs('topup:Пополнение PS Store:PS Store толықтыру|subs:PS Plus|keys:Игры:Ойындар|accounts')),
('xbox', 'Xbox', 'pc', '🟩', '#15803d', 45, false, sauda.secs('subs:Game Pass|keys:Игры:Ойындар|topup|accounts')),
-- подписки и сервисы
('telegram', 'Telegram', 'subs', '✈️', '#229ed9', 50, true, sauda.secs('subs:Telegram Premium|currency:Звёзды Telegram:Telegram жұлдыздары|items:Юзернеймы и подарки:Юзернеймдер мен сыйлықтар|services:Продвижение каналов:Арналарды жарнамалау|other')),
('spotify', 'Spotify', 'subs', '🎧', '#1db954', 51, true, sauda.secs('subs:Spotify Premium|accounts|other')),
('youtube', 'YouTube Premium', 'subs', '▶️', '#ef4444', 52, true, sauda.secs('subs|other')),
('ai', 'Нейросети', 'subs', '🤖', '#10a37f', 53, true, sauda.secs('subs:Подписки на ИИ:ЖИ жазылымдары|accounts|services:Помощь и настройка:Көмек пен баптау|other')),
('netflix', 'Netflix', 'subs', '🎬', '#e50914', 54, false, sauda.secs('subs|other')),
('discord', 'Discord', 'subs', '💬', '#5865f2', 55, false, sauda.secs('subs:Nitro|services:Серверы и боты:Серверлер мен боттар|accounts|other')),
('yandex', 'Яндекс Плюс', 'subs', '🟡', '#fc3f1d', 56, false, sauda.secs('subs|other')),
('kinopoisk', 'Кинопоиск', 'subs', '🎞️', '#ff6600', 57, false, sauda.secs('subs|other')),
('apple', 'Apple', 'subs', '🍎', '#6b7280', 58, false, sauda.secs('subs:Apple Music, iCloud, Arcade|topup:Пополнение App Store:App Store толықтыру|other')),
('vpn', 'VPN', 'subs', '🛡️', '#0f766e', 59, false, sauda.secs('subs|other')),
('creative', 'Дизайн-сервисы', 'subs', '🎨', '#a855f7', 60, false, sauda.secs('subs:Canva, Adobe, Figma|accounts|other')),
('duolingo', 'Duolingo и учёба', 'subs', '🦉', '#58cc02', 61, false, sauda.secs('subs|other')),
('giftcards', 'Подарочные карты', 'subs', '🎁', '#db2777', 62, false, sauda.secs('keys:Карты и сертификаты:Карталар мен сертификаттар|other')),
-- соцсети
('tiktok', 'TikTok', 'social', '🎵', '#ff0050', 70, true, sauda.secs('currency:Монеты TikTok:TikTok монеталары|services:Продвижение:Жарнама|accounts|other')),
('instagram', 'Instagram', 'social', '📸', '#e1306c', 71, false, sauda.secs('services:Продвижение:Жарнама|accounts|other')),
('twitch', 'Twitch', 'social', '🟣', '#9146ff', 72, false, sauda.secs('subs:Подписки и Turbo:Жазылымдар мен Turbo|services:Продвижение:Жарнама|accounts')),
('youtubech', 'YouTube-каналы', 'social', '📺', '#dc2626', 73, false, sauda.secs('services:Продвижение и оформление:Жарнама мен безендіру|accounts:Каналы:Арналар|other')),
-- услуги
('design', 'Дизайн', 'service', '🖌️', '#ec4899', 80, false, sauda.secs('services:Логотипы, баннеры, превью:Логотиптер, баннерлер, превью|other')),
('video', 'Монтаж видео', 'service', '🎞️', '#f43f5e', 81, false, sauda.secs('services:Монтаж и анимация:Монтаж және анимация|other')),
('dev', 'Программирование', 'service', '💻', '#0891b2', 82, false, sauda.secs('services:Сайты, боты, скрипты:Сайттар, боттар, скрипттер|other')),
('smm', 'SMM и продвижение', 'service', '📈', '#8b5cf6', 83, false, sauda.secs('services:Ведение и реклама:Жүргізу және жарнама|other')),
('tutor', 'Учёба и репетиторы', 'service', '🎓', '#0d9488', 84, false, sauda.secs('coaching:Уроки и курсы:Сабақтар мен курстар|services:Помощь с учёбой:Оқуға көмек|other')),
('translate', 'Тексты и переводы', 'service', '✍️', '#64748b', 85, false, sauda.secs('services:Переводы и тексты:Аударма мен мәтіндер|other')),
('voice', 'Музыка и озвучка', 'service', '🎙️', '#e11d48', 86, false, sauda.secs('services:Озвучка, биты, сведение:Дыбыстау, бит, өңдеу|other')),
('gamecoach', 'Тренеры по играм', 'service', '🕹️', '#7c3aed', 87, false, sauda.secs('coaching:Тренировки и разборы:Жаттығу мен талдау|other')),
-- вещи
('gadgets', 'Игровые девайсы', 'goods', '🖱️', '#0ea5e9', 90, false, sauda.secs('goods:Мыши, клавиатуры, гарнитуры:Тінтуір, пернетақта, құлаққап|other')),
('consoles', 'Консоли', 'goods', '🕹️', '#1d4ed8', 91, false, sauda.secs('goods:Консоли и геймпады:Консольдер мен геймпадтар|other')),
('phones', 'Смартфоны и планшеты', 'goods', '📱', '#334155', 92, false, sauda.secs('goods|other')),
('pcparts', 'Компьютеры и комплектующие', 'goods', '🖥️', '#475569', 93, false, sauda.secs('goods|other')),
('merch', 'Мерч и коллекционное', 'goods', '👕', '#be185d', 94, false, sauda.secs('goods|other'))
on conflict (id) do update set name = excluded.name, kind = excluded.kind, emoji = excluded.emoji, color = excluded.color,
  sort = excluded.sort, popular = excluded.popular, sections = excluded.sections;

-- счёт сервиса и «Поддержка»
insert into sauda.users(login, name, pass_hash, role, verified, bio)
values ('sauda', 'Sauda · Поддержка', extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf', 6)), 'bot', true,
        'Официальная поддержка Sauda. Пишите сюда, если что-то пошло не так со сделкой.')
on conflict (login) do nothing;

-- демо-продавцы: заказы выполняют сами, видны только в тестовом режиме
insert into sauda.users(login, name, pass_hash, is_demo, verified, city, bio, created_at)
select l, n, extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf', 6)), true, true, c, b, now() - make_interval(days => d)
from (values
  ('almaty_gamer', 'Almaty Gamer', 'Алматы', 'Демо-продавец: голда, UC и алмазы. Заказы выполняются сами за минуту.', 420),
  ('astana_donat', 'Astana Donat', 'Астана', 'Демо-продавец: донат по ID в мобильные игры.', 310),
  ('nomad_store', 'Nomad Store', 'Шымкент', 'Демо-продавец: скины, аккаунты и ключи.', 260),
  ('steppe_subs', 'Steppe Subs', 'Караганда', 'Демо-продавец: подписки с автопродлением.', 190),
  ('qazaq_boost', 'Qazaq Boost', 'Актобе', 'Демо-продавец: буст и обучение.', 150),
  ('tengri_keys', 'Tengri Keys', 'Павлодар', 'Демо-продавец: Steam, ключи и подарочные карты.', 95)
) v(l, n, c, b, d)
on conflict (login) do nothing;

insert into sauda.lots(seller, game, section, title, descr, price, old_price, qty, auto, needs_id, id_label, deliver_mins, period_days, attrs, city, is_demo, raised_at)
select (select id from sauda.users where login = v.s), v.g, v.sec, v.t,
       case when v.au then 'Демо-лот для проверки сделки. Код приходит автоматически сразу после оплаты — в заказе и в чате.'
            else 'Демо-лот для проверки сделки. Продавец-робот выполнит заказ сам примерно за минуту, затем подтвердите получение.' end
       || case when v.pd is not null then E'\nМожно включить автопродление: подписка будет продлеваться сама с баланса.' else '' end,
       v.pr, v.op, case when v.au then 0 else v.q end, v.au, v.nid, coalesce(v.idl, ''), v.dm, v.pd, coalesce(v.at, '{}')::jsonb, coalesce(v.ct, ''), true,
       now() - make_interval(mins => v.ord * 7)
from (values
  (1, 'almaty_gamer', 'standoff2', 'currency', 'Голда Standoff 2 — 100 G', 449, null, null, true, false, null, 1, null, null, null),
  (2, 'almaty_gamer', 'standoff2', 'currency', 'Голда Standoff 2 — 1000 G, выгодный пакет', 3990, 4490, null, true, false, null, 1, null, null, null),
  (3, 'astana_donat', 'standoff2', 'donate', 'Голда по ID — 500 G, зачисление за 5 минут', 2190, null, null, false, true, 'ID в Standoff 2', 15, null, null, null),
  (4, 'nomad_store', 'standoff2', 'items', 'Нож Karambit «Gold» StatTrack', 18990, 21990, 1, false, false, null, 30, null, '{"Редкость":"Arcane"}', null),
  (5, 'qazaq_boost', 'standoff2', 'boost', 'Буст звания: Gold → Legendary', 9990, null, null, false, true, 'ID и пароль от аккаунта', 1440, null, null, null),
  (6, 'astana_donat', 'pubgm', 'donate', '60 UC по ID — моментально', 499, null, null, false, true, 'Player ID PUBG Mobile', 10, null, '{"Регион":"Global"}', null),
  (7, 'astana_donat', 'pubgm', 'donate', '325 UC по ID', 2390, 2690, null, false, true, 'Player ID PUBG Mobile', 10, null, '{"Регион":"Global"}', null),
  (8, 'astana_donat', 'pubgm', 'donate', '660 UC по ID', 4690, null, null, false, true, 'Player ID PUBG Mobile', 10, null, '{"Регион":"Global"}', null),
  (9, 'almaty_gamer', 'pubgm', 'donate', '1800 UC по ID — лучшая цена', 11990, 13490, null, false, true, 'Player ID PUBG Mobile', 15, null, '{"Регион":"Global"}', null),
  (10, 'almaty_gamer', 'pubgm', 'currency', 'UC-код на 60 UC (Redeem)', 549, null, null, true, false, null, 1, null, null, null),
  (11, 'astana_donat', 'freefire', 'donate', '100 алмазов Free Fire по ID', 490, null, null, false, true, 'ID в Free Fire', 10, null, null, null),
  (12, 'astana_donat', 'freefire', 'donate', '520 алмазов Free Fire по ID', 2290, 2590, null, false, true, 'ID в Free Fire', 10, null, null, null),
  (13, 'astana_donat', 'mlbb', 'donate', '86 алмазов Mobile Legends', 690, null, null, false, true, 'ID и сервер (Zone ID)', 10, null, null, null),
  (14, 'almaty_gamer', 'mlbb', 'donate', '257 алмазов Mobile Legends', 1990, null, null, false, true, 'ID и сервер (Zone ID)', 10, null, null, null),
  (15, 'astana_donat', 'brawlstars', 'donate', '30 гемов Brawl Stars', 1190, null, null, false, true, 'Почта Supercell ID', 30, null, null, null),
  (16, 'astana_donat', 'brawlstars', 'donate', 'Brawl Pass Plus на текущий сезон', 4990, 5490, null, false, true, 'Почта Supercell ID', 30, null, null, null),
  (17, 'nomad_store', 'brawlstars', 'accounts', 'Аккаунт Brawl Stars: 30 000 кубков, 70 бойцов', 24990, null, 1, false, false, null, 60, null, '{"Кубки":"30 000","Бойцы":"70"}', null),
  (18, 'tengri_keys', 'roblox', 'currency', '400 Robux — подарочная карта', 2790, null, null, true, false, null, 1, null, null, null),
  (19, 'almaty_gamer', 'roblox', 'currency', '800 Robux через геймпасс', 4990, null, null, false, true, 'Ник в Roblox', 60, null, null, null),
  (20, 'nomad_store', 'roblox', 'items', 'Blox Fruits: фрукт Kitsune (Permanent)', 6990, null, 3, false, true, 'Ник в Roblox', 60, null, null, null),
  (21, 'astana_donat', 'genshin', 'donate', 'Благословение полой луны по UID', 2190, null, null, false, true, 'UID и сервер', 30, null, null, null),
  (22, 'astana_donat', 'genshin', 'donate', '980 кристаллов сотворения по UID', 5990, null, null, false, true, 'UID и сервер', 30, null, null, null),
  (23, 'tengri_keys', 'minecraft', 'accounts', 'Minecraft Java & Bedrock — лицензионный ключ', 7990, 9990, null, true, false, null, 1, null, null, null),
  (24, 'nomad_store', 'cs2', 'items', 'AK-47 | Redline (Field-Tested)', 9990, null, 2, false, true, 'Трейд-ссылка Steam', 60, null, '{"Качество":"Field-Tested"}', null),
  (25, 'tengri_keys', 'cs2', 'accounts', 'Аккаунт CS2 с Prime Status', 8490, null, null, true, false, null, 1, null, null, null),
  (26, 'qazaq_boost', 'cs2', 'boost', 'Буст Premier +2000 рейтинга', 12990, null, null, false, true, 'Логин Steam (выдадим инструкцию)', 2880, null, null, null),
  (27, 'qazaq_boost', 'cs2', 'coaching', 'Разбор демки и тренировка аима — 1 час', 4990, null, null, false, false, null, 1440, null, null, null),
  (28, 'qazaq_boost', 'dota2', 'boost', 'Буст MMR +500 (до 5000)', 14990, null, null, false, true, 'Логин Steam', 4320, null, null, null),
  (29, 'nomad_store', 'dota2', 'accounts', 'Аккаунт Dota 2 — 5200 MMR, порядочность 10 000', 39990, null, 1, false, false, null, 60, null, '{"MMR":"5200"}', null),
  (30, 'tengri_keys', 'steam', 'topup', 'Пополнение Steam на 5 000 ₸ по логину', 5390, null, null, false, true, 'Логин Steam', 30, null, '{"Регион":"Казахстан"}', null),
  (31, 'tengri_keys', 'steam', 'topup', 'Пополнение Steam на 10 000 ₸ по логину', 10690, null, null, false, true, 'Логин Steam', 30, null, '{"Регион":"Казахстан"}', null),
  (32, 'tengri_keys', 'steam', 'keys', 'Случайный ключ Steam (Gold)', 1490, null, null, true, false, null, 1, null, null, null),
  (33, 'almaty_gamer', 'gta5rp', 'currency', '1 000 000 виртов GTA 5 RP — любой сервер', 2990, null, null, false, true, 'Сервер и ник', 60, null, null, null),
  (34, 'steppe_subs', 'telegram', 'subs', 'Telegram Premium — 1 месяц подарком', 2290, null, null, false, true, '@username', 30, 30, null, null),
  (35, 'steppe_subs', 'telegram', 'subs', 'Telegram Premium — 12 месяцев', 17990, 21990, null, false, true, '@username', 30, 365, null, null),
  (36, 'steppe_subs', 'telegram', 'currency', '50 звёзд Telegram', 590, null, null, false, true, '@username', 15, null, null, null),
  (37, 'steppe_subs', 'telegram', 'currency', '500 звёзд Telegram', 5490, 5990, null, false, true, '@username', 15, null, null, null),
  (38, 'steppe_subs', 'spotify', 'subs', 'Spotify Premium Individual — 1 месяц', 1490, null, null, false, true, 'Почта аккаунта Spotify', 60, 30, null, null),
  (39, 'steppe_subs', 'spotify', 'subs', 'Spotify Premium Family — 3 месяца', 3490, null, null, false, true, 'Почта аккаунта Spotify', 60, 90, null, null),
  (40, 'steppe_subs', 'youtube', 'subs', 'YouTube Premium — 1 месяц на ваш аккаунт', 1990, null, null, false, true, 'Gmail', 60, 30, null, null),
  (41, 'steppe_subs', 'ai', 'subs', 'Подписка Plus на нейросеть — 1 месяц на вашу почту', 11990, null, null, false, true, 'Почта', 120, 30, null, null),
  (42, 'steppe_subs', 'netflix', 'subs', 'Netflix Premium 4K — 1 месяц, личный профиль', 3490, null, null, true, false, null, 1, 30, null, null),
  (43, 'steppe_subs', 'discord', 'subs', 'Discord Nitro — 1 месяц (подарочная ссылка)', 4990, null, null, true, false, null, 1, 30, null, null),
  (44, 'steppe_subs', 'vpn', 'subs', 'VPN на 1 месяц — 5 устройств, без лимитов', 990, null, null, true, false, null, 1, 30, null, null),
  (45, 'steppe_subs', 'yandex', 'subs', 'Яндекс Плюс — 3 месяца (промокод)', 1990, null, null, true, false, null, 1, 90, null, null),
  (46, 'almaty_gamer', 'tiktok', 'currency', '1000 монет TikTok', 4990, null, null, false, true, 'Логин TikTok', 30, null, null, null),
  (47, 'nomad_store', 'design', 'services', 'Аватарка и баннер для канала или Twitch', 7990, null, null, false, false, null, 2880, null, null, null),
  (48, 'nomad_store', 'video', 'services', 'Монтаж видео для YouTube и TikTok (до 10 минут)', 9990, null, null, false, false, null, 4320, null, null, null),
  (49, 'qazaq_boost', 'dev', 'services', 'Telegram-бот под ключ: магазин, запись, рассылка', 49990, null, null, false, false, null, 10080, null, null, null),
  (50, 'nomad_store', 'gadgets', 'goods', 'Игровая мышь Logitech G102 — новая', 12990, 14990, 5, false, true, 'Адрес доставки или самовывоз', 1440, null, '{"Состояние":"Новое"}', 'Алматы'),
  (51, 'nomad_store', 'consoles', 'goods', 'PlayStation 5 Slim 1TB — новая, с гарантией', 289990, null, 2, false, true, 'Адрес доставки', 2880, null, '{"Состояние":"Новое","Гарантия":"1 год"}', 'Астана'),
  (52, 'tengri_keys', 'giftcards', 'keys', 'Подарочная карта App Store на 5 000 ₸', 5490, null, null, true, false, null, 1, null, '{"Регион":"Казахстан"}', null),
  (53, 'astana_donat', 'valorant', 'donate', '1000 Valorant Points по Riot ID', 4990, null, null, false, true, 'Riot ID', 30, null, null, null),
  (54, 'astana_donat', 'fortnite', 'donate', '1000 V-Bucks подарком', 4290, null, null, false, true, 'Epic ID', 30, null, null, null),
  (55, 'almaty_gamer', 'eafc', 'currency', '100 000 монет FC (PS / Xbox)', 3990, null, null, false, true, 'Платформа и почта', 120, null, null, null),
  (56, 'astana_donat', 'codm', 'donate', '80 CP Call of Duty Mobile по ID', 590, null, null, false, true, 'UID в CoD Mobile', 10, null, null, null)
) v(ord, s, g, sec, t, pr, op, q, au, nid, idl, dm, pd, at, ct)
where not exists (select 1 from sauda.lots x where x.is_demo and x.title = v.t);

select sauda.tick();

-- фоновая задача раз в минуту (pg_cron есть в Supabase; локально — нет, тогда задачи идут попутно с запросами)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    execute $c$select cron.schedule('sauda-tick', '* * * * *', 'select sauda.tick()')$c$;
  end if;
end $$;

-- права: наружу — только public.sauda_*, внутренние функции схемы sauda закрыты
do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'sauda\_%' loop
    execute format('revoke all on function %s from public', f.sig);
    execute format('grant execute on function %s to anon, authenticated', f.sig);
  end loop;
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'sauda' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
