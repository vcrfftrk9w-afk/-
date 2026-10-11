-- Тексты игры на двух языках. Игрокам из России и стран СНГ
-- показывается русский, всем остальным — английский.

local Strings = {}

Strings.ru = {
	-- звёзды
	star_sparky = "Искорка",
	star_sleepy = "Сонька",
	star_pancake = "Блинчик",
	star_melony = "Арбузик",
	star_rocketo = "Ракетка",
	star_frosty = "Ледышка",
	star_disco = "Диско Стар",
	star_cupcake = "Кекс-звезда",
	star_king = "Король Звездон",
	star_ninja = "Ниндзя Шурикен",
	star_galaxion = "Галактион",
	star_pizza = "Пицца-звезда",
	star_blackhole = "Чёрная Дыра",
	star_granny = "Бабуля Звезда",

	-- редкость
	rar_common = "Обычная",
	rar_uncommon = "Необычная",
	rar_rare = "Редкая",
	rar_epic = "Эпическая",
	rar_legendary = "Легендарная",
	rar_mythic = "Мифическая",
	rar_secret = "Секретная",

	-- мутации
	mut_gold = "Золото",
	mut_rainbow = "Радуга",

	per_sec = "+%s/с",

	-- улучшения
	upg_speed = "Скорость",
	upg_speed_desc = "Быстрее бегаешь",
	upg_pedestals = "Пьедесталы",
	upg_pedestals_desc = "Больше звёзд на базе",
	upg_telescope = "Телескоп",
	upg_telescope_desc = "Призывает звёзды получше",
	upg_lock = "Замок",
	upg_lock_desc = "База дольше закрыта",
	upgv_speed = "скорость %s",
	upgv_pedestals = "мест: %s",
	upgv_telescope = "уровень %s",
	upgv_lock = "%s сек",
	level = "Ур. %s",
	value_arrow = "%s → %s",
	max = "МАКС",
	rebirth_title = "Перерождение #%s",
	rebirth_desc = "Всё начнётся сначала (монеты, звёзды и улучшения), но доход навсегда станет +%s%%",
	rebirth_confirm = "Точно? Нажми ещё раз, чтобы переродиться",

	-- телескоп
	telescope_info = "Телескоп призывает случайную звезду прямо на твою базу. Улучши его, и звёзды будут лучше!",
	summon = "🔭 Призвать звезду · 💰 %s",

	-- мои звёзды
	my_stars = "⭐ Мои звёзды",
	stars_header = "На базе: %s/%s",
	stars_empty = "На базе пока нет звёзд — поймай звезду на поле!",
	sell_for = "Продать %s",
	confirm = "Точно?",
	index_header = "📖 Звездопедия: %s/%s",

	-- покупки за Robux
	pass_cash2x = "💰 Доход x2",
	pass_cash2x_desc = "Все звёзды приносят в 2 раза больше монет",
	pass_speed = "⚡ Быстрые ноги",
	pass_speed_desc = "+6 к скорости, а со звездой бежишь без замедления",
	pass_superbonk = "🥊 Супер-бонк",
	pass_superbonk_desc = "Бонк бьёт дальше, сильнее и чаще",
	pass_pedestals = "⭐ +4 пьедестала",
	pass_pedestals_desc = "На базе помещается на 4 звезды больше",
	pass_autocollect = "🤖 Автосбор",
	pass_autocollect_desc = "Монеты сами собираются каждую секунду",
	prod_meteorShower = "☄️ Метеоритный дождь",
	prod_meteorShower_desc = "Для всего сервера: звёзды сыплются с неба, редкие в 3 раза чаще!",
	prod_galaxion = "🌌 Галактион",
	prod_galaxion_desc = "Мифическая звезда сразу на твою базу: +2000/с",
	prod_coinsSmall = "💰 Мешочек монет",
	prod_coinsBig = "💰 Сундук монет",
	prod_coins_desc = "Получишь %s монет",

	-- кнопки и окна
	btn_base = "База",
	btn_field = "Поле",
	btn_telescope = "Телескоп",
	btn_stars = "Звёзды",
	btn_upgrades = "Улучшения",
	btn_shop = "Магазин",
	btn_codes = "Коды",
	btn_lock = "Замок",
	btn_bonk = "БОНК",
	btn_bonk_key = "БОНК [F]",
	title_upgrades = "⚙️ Улучшения",
	title_telescope = "🔭 Телескоп",
	title_stars = "⭐ Звёзды",
	title_shop = "🛍 Магазин",
	title_codes = "🎁 Коды",
	shop_passes = "Навсегда",
	shop_products = "Покупки",
	buy = "Купить",
	soon = "Скоро",
	owned = "✅ Есть",
	ok = "Круто!",
	redeem = "Активировать",
	code_placeholder = "Введи код",
	code_hint = "Коды выдаёт создатель игры. Попробуй: STARFALL",
	reveal_telescope = "🔭 Телескоп нашёл:",
	reveal_gift = "🎁 Новая звезда!",

	-- экран
	lock_open = "🔓 Открыто",
	bank_hint = "🏦 Это монеты в копилке базы. Встань на зелёную плиту на своей базе, чтобы забрать их!",
	shower_left = "☄️ Метеоритный дождь · %s",
	carry = "⭐ Несёшь: %s (%s) — беги на свою базу!",
	carry_stolen = "🦹 Краденая звезда: %s (%s) — беги на базу, пока не бонкнули!",
	alarm = "🚨 %s крадёт звезду %s! Догони и бонкни вора!",
	bonked_by = "💫 Тебя бонкнул игрок %s!",
	bonk_word = "💥 БОНК!",

	-- надписи в мире
	sign_free = "⭐ Свободная база",
	sign_base = "⭐ База: %s",
	sign_collect = "💰 Собрать",
	sign_lock = "🔒 Закрыть",
	pr_grab = "Поймать",
	pr_steal = "Украсть",
	pr_sell = "Продать за %s",
	pr_telescope = "Телескоп",
	lb_earned = "🏆 Топ богачей",
	lb_stolen = "🦹 Топ воришек",
	lb_empty = "Пока пусто — будь первым!",

	-- уведомления
	n_welcome = "⭐ Добро пожаловать в Звездопад!",
	n_need_coins = "Не хватает монет 💰",
	n_max_level = "Уже максимальный уровень",
	n_upgrade = "Улучшено: %s",
	n_code_ok = "Код активирован! 🎁",
	n_code_bad = "Такого кода нет",
	n_code_used = "Этот код уже активирован",
	n_daily = "🎁 Награда за день %s: %s",
	n_coins = "+%s 💰",
	n_no_save = "⚠ Сохранение недоступно — прогресс может не сохраниться",
	n_pass_owned = "Это у тебя уже есть ✅",
	n_soon = "Эта покупка скоро появится!",
	n_thanks = "Спасибо за покупку! ❤️",
	n_no_base = "Все базы заняты — попробуй другой сервер",
	n_no_teleport = "Со звездой телепорт не работает — беги ногами! 🏃",
	n_sold = "Продано: %s за %s 💰",
	n_delivered = "⭐ Звезда %s теперь на твоей базе!",
	n_delivered_stolen = "🦹 Краденая звезда %s теперь твоя!",
	n_full_sold = "На базе нет места — звезда %s продана за %s 💰",
	n_index_new = "📖 Новая звезда в Звездопедии: %s! Бонус +%s 💰",
	n_offline = "🌙 Пока тебя не было, звёзды накопили %s 💰",
	n_locked = "🔒 База закрыта на %s сек!",
	n_unlocked = "🔓 Замок открылся! Встань на красную плиту, чтобы закрыть базу снова",
	n_lock_far = "Замок закрывается только на своей базе 🏠",
	n_lock_active = "🔒 База уже закрыта",
	n_kicked_out = "🔒 Эта база закрыта!",
	n_base_locked = "🔒 База закрыта — подожди, пока откроется",
	n_base_full = "Нет свободных пьедесталов — продай звезду или купи пьедесталы",
	n_steal_run = "🦹 Беги на свою базу, пока хозяин не догнал!",
	n_returned = "✅ Звезда %s вернулась на твою базу!",
	n_dropped = "💥 Бонк! Звезда %s упала на землю!",
	n_dropped_home = "💥 Бонк! Звезда %s вернулась к хозяину!",
	n_tutorial_done = "🎉 Отлично! Лови звёзды, кради их на чужих базах 🦹 и бонкай воров 🥊!",
	n_rebirth = "🔄 Перерождение! Доход навсегда +%s%%",

	-- для всех на сервере
	n_falling_rare = "🌠 С неба падает звезда %s! Беги ловить!",
	n_caught_rare = "🌟 Игрок %s поймал звезду %s!",
	n_stolen = "🦹 Игрок %s украл звезду %s у игрока %s!",
	n_shower = "☄️ МЕТЕОРИТНЫЙ ДОЖДЬ! Редкие звёзды падают в 3 раза чаще!",
	n_shower_bought = "☄️ Игрок %s запустил МЕТЕОРИТНЫЙ ДОЖДЬ для всех!",
	n_rebirth_all = "🔄 Игрок %s переродился! Перерождений: %s",
	n_summon_rare = "🔭 Игрок %s призвал звезду %s!",

	tut_0 = "1/4 · Поймай падающую звезду на поле ⭐",
	tut_1 = "2/4 · Отнеси звезду на свою базу 🏠",
	tut_2 = "3/4 · Встань на зелёную плиту — собери монеты 💰",
	tut_3 = "4/4 · Встань на красную плиту — закрой базу 🔒",

	reward_coins = "%s 💰",
}

Strings.en = {
	star_sparky = "Sparky",
	star_sleepy = "Sleepy",
	star_pancake = "Pancake",
	star_melony = "Melony",
	star_rocketo = "Rocketo",
	star_frosty = "Frosty",
	star_disco = "Disco Star",
	star_cupcake = "Cupcake Star",
	star_king = "King Starlord",
	star_ninja = "Ninja Shuriken",
	star_galaxion = "Galaxion",
	star_pizza = "Pizza Star",
	star_blackhole = "Black Hole",
	star_granny = "Granny Star",

	rar_common = "Common",
	rar_uncommon = "Uncommon",
	rar_rare = "Rare",
	rar_epic = "Epic",
	rar_legendary = "Legendary",
	rar_mythic = "Mythic",
	rar_secret = "Secret",

	mut_gold = "Gold",
	mut_rainbow = "Rainbow",

	per_sec = "+%s/s",

	upg_speed = "Speed",
	upg_speed_desc = "Run faster",
	upg_pedestals = "Pedestals",
	upg_pedestals_desc = "More stars in your base",
	upg_telescope = "Telescope",
	upg_telescope_desc = "Summons better stars",
	upg_lock = "Lock",
	upg_lock_desc = "Your base stays locked longer",
	upgv_speed = "speed %s",
	upgv_pedestals = "slots: %s",
	upgv_telescope = "level %s",
	upgv_lock = "%s sec",
	level = "Lv. %s",
	value_arrow = "%s → %s",
	max = "MAX",
	rebirth_title = "Rebirth #%s",
	rebirth_desc = "Start over (coins, stars and upgrades reset), but your income is +%s%% forever",
	rebirth_confirm = "Are you sure? Tap again to rebirth",

	telescope_info = "The telescope summons a random star straight to your base. Upgrade it to get better stars!",
	summon = "🔭 Summon a star · 💰 %s",

	my_stars = "⭐ My stars",
	stars_header = "In base: %s/%s",
	stars_empty = "No stars in your base yet — catch one on the field!",
	sell_for = "Sell %s",
	confirm = "Sure?",
	index_header = "📖 Star Index: %s/%s",

	pass_cash2x = "💰 2x Income",
	pass_cash2x_desc = "All your stars make twice as many coins",
	pass_speed = "⚡ Fast Feet",
	pass_speed_desc = "+6 speed, and no slowdown while carrying a star",
	pass_superbonk = "🥊 Super Bonk",
	pass_superbonk_desc = "Your bonk hits farther, harder and more often",
	pass_pedestals = "⭐ +4 Pedestals",
	pass_pedestals_desc = "Your base holds 4 more stars",
	pass_autocollect = "🤖 Auto Collect",
	pass_autocollect_desc = "Coins are collected for you every second",
	prod_meteorShower = "☄️ Meteor Shower",
	prod_meteorShower_desc = "For the whole server: stars rain from the sky, rare ones 3x more often!",
	prod_galaxion = "🌌 Galaxion",
	prod_galaxion_desc = "A mythic star straight to your base: +2000/s",
	prod_coinsSmall = "💰 Bag of Coins",
	prod_coinsBig = "💰 Chest of Coins",
	prod_coins_desc = "You get %s coins",

	btn_base = "Base",
	btn_field = "Field",
	btn_telescope = "Telescope",
	btn_stars = "Stars",
	btn_upgrades = "Upgrades",
	btn_shop = "Shop",
	btn_codes = "Codes",
	btn_lock = "Lock",
	btn_bonk = "BONK",
	btn_bonk_key = "BONK [F]",
	title_upgrades = "⚙️ Upgrades",
	title_telescope = "🔭 Telescope",
	title_stars = "⭐ Stars",
	title_shop = "🛍 Shop",
	title_codes = "🎁 Codes",
	shop_passes = "Forever",
	shop_products = "Purchases",
	buy = "Buy",
	soon = "Soon",
	owned = "✅ Owned",
	ok = "Awesome!",
	redeem = "Redeem",
	code_placeholder = "Enter a code",
	code_hint = "Codes are shared by the game's creator. Try: STARFALL",
	reveal_telescope = "🔭 The telescope found:",
	reveal_gift = "🎁 New star!",

	lock_open = "🔓 Open",
	bank_hint = "🏦 These are the coins in your base bank. Step on the green pad in your base to collect them!",
	shower_left = "☄️ Meteor Shower · %s",
	carry = "⭐ Carrying: %s (%s) — run to your base!",
	carry_stolen = "🦹 Stolen star: %s (%s) — run to your base before you get bonked!",
	alarm = "🚨 %s is stealing your star %s! Catch them and BONK!",
	bonked_by = "💫 You got bonked by %s!",
	bonk_word = "💥 BONK!",

	sign_free = "⭐ Free base",
	sign_base = "⭐ %s's base",
	sign_collect = "💰 Collect",
	sign_lock = "🔒 Lock",
	pr_grab = "Catch",
	pr_steal = "Steal",
	pr_sell = "Sell for %s",
	pr_telescope = "Telescope",
	lb_earned = "🏆 Richest",
	lb_stolen = "🦹 Top Thieves",
	lb_empty = "Empty for now — be the first!",

	n_welcome = "⭐ Welcome to Starfall!",
	n_need_coins = "Not enough coins 💰",
	n_max_level = "Already at max level",
	n_upgrade = "Upgraded: %s",
	n_code_ok = "Code redeemed! 🎁",
	n_code_bad = "That code doesn't exist",
	n_code_used = "You already used this code",
	n_daily = "🎁 Day %s reward: %s",
	n_coins = "+%s 💰",
	n_no_save = "⚠ Saving is unavailable — progress may not be saved",
	n_pass_owned = "You already own this ✅",
	n_soon = "This purchase is coming soon!",
	n_thanks = "Thank you for your purchase! ❤️",
	n_no_base = "All bases are taken — try another server",
	n_no_teleport = "You can't teleport while carrying a star — run! 🏃",
	n_sold = "Sold: %s for %s 💰",
	n_delivered = "⭐ %s is now in your base!",
	n_delivered_stolen = "🦹 The stolen star %s is yours now!",
	n_full_sold = "No room in your base — %s sold for %s 💰",
	n_index_new = "📖 New star in your Star Index: %s! Bonus +%s 💰",
	n_offline = "🌙 While you were away, your stars made %s 💰",
	n_locked = "🔒 Base locked for %s sec!",
	n_unlocked = "🔓 Your lock opened! Step on the red pad to lock your base again",
	n_lock_far = "You can only lock your base from inside it 🏠",
	n_lock_active = "🔒 Your base is already locked",
	n_kicked_out = "🔒 This base is locked!",
	n_base_locked = "🔒 This base is locked — wait until it opens",
	n_base_full = "No free pedestals — sell a star or buy more pedestals",
	n_steal_run = "🦹 Run to your base before the owner catches you!",
	n_returned = "✅ Your star %s is back in your base!",
	n_dropped = "💥 Bonk! %s fell to the ground!",
	n_dropped_home = "💥 Bonk! %s went back to its owner!",
	n_tutorial_done = "🎉 Great job! Catch stars, steal them from other bases 🦹 and bonk thieves 🥊!",
	n_rebirth = "🔄 Rebirth! Income +%s%% forever",

	n_falling_rare = "🌠 %s is falling from the sky! Go catch it!",
	n_caught_rare = "🌟 %s caught %s!",
	n_stolen = "🦹 %s stole %s from %s!",
	n_shower = "☄️ METEOR SHOWER! Rare stars fall 3x more often!",
	n_shower_bought = "☄️ %s started a METEOR SHOWER for everyone!",
	n_rebirth_all = "🔄 %s was reborn! Rebirths: %s",
	n_summon_rare = "🔭 %s summoned %s!",

	tut_0 = "1/4 · Catch a falling star on the field ⭐",
	tut_1 = "2/4 · Carry the star to your base 🏠",
	tut_2 = "3/4 · Step on the green pad to collect coins 💰",
	tut_3 = "4/4 · Step on the red pad to lock your base 🔒",

	reward_coins = "%s 💰",
}

-- Русский для России и соседних стран, английский для остальных
local RUSSIAN = { ru = true, be = true, uk = true, kk = true, ky = true, uz = true, tg = true, hy = true, az = true }

function Strings.lang(localeId: string?): string
	local code = string.lower(string.sub(localeId or "", 1, 2))
	if RUSSIAN[code] then
		return "ru"
	end
	return "en"
end

function Strings.has(key: string): boolean
	return Strings.en[key] ~= nil or Strings.ru[key] ~= nil
end

function Strings.get(lang: string, key: string, ...): string
	local tableForLang = Strings[lang] or Strings.en
	local text = tableForLang[key] or Strings.en[key] or key
	if select("#", ...) > 0 then
		local ok, result = pcall(string.format, text, ...)
		if ok then
			return result
		end
	end
	return text
end

return Strings
