'use strict';
/* =========================================================
   ENGLISH CONTENT — правила простыми словами и словарь
   для курса «Английский A0 → C1» (движок — js/english-path.js).

   RULES[уровень][тема] — 3 карточки: формула, как это работает,
   частая ошибка. Порядок тем — как в EnglishPath.LEVELS[...].blocks.
   WORDS[уровень] — ~100 самых нужных слов уровня, строка «слово — перевод».
   ========================================================= */

const EnglishContent = (() => {
  const RULES = [
    [ // A0
      [['Формула', 'Кто + действие: I work — я работаю. Порядок строгий: сначала кто, потом что делает.'],
        ['Глагол не меняется', 'С I, you, we, they глагол всегда в начальной форме: I work, you work, we work, they work. Окончаний, как в русском (работаю, работаешь), нет.'],
        ['Частая ошибка', 'Пропускать «кто». Нельзя сказать просто «Work» — говори «I work»: «я» обязательно.']],
      [['Правило', 'С he, she, it (он, она, оно) к глаголу добавляем -s: he works, she lives, it helps.'],
        ['Как добавлять', 'После -s, -sh, -ch, -x, -o пишем -es: watches, goes. Have превращается в has: she has.'],
        ['Частая ошибка', '«She work» — ошибка. Он, она, оно — значит, у глагола хвостик -s: she works.']],
      [['Правило', 'Чтобы сказать «не», ставим don\'t перед глаголом: I don\'t know — я не знаю.'],
        ['С he / she / it', 'С он, она, оно — doesn\'t, а -s у глагола пропадает: she doesn\'t work (не works!).'],
        ['Частая ошибка', '«I not know» — так нельзя. Нужен помощник: I don\'t know.']],
      [['Правило', 'Вопрос начинается с Do: Do you like music? — Ты любишь музыку?'],
        ['С he / she / it', 'Does + глагол без -s: Does she work? Вопросительное слово — в самом начале: Where do you live?'],
        ['Короткий ответ', 'Yes, I do. / No, I don\'t. Yes, she does. / No, she doesn\'t.']],
      [['Когда нужен', 'Когда в русском нет глагола: «Я студент», «Она дома». В английском вставляем am, is или are: I am a student.'],
        ['Какой выбрать', 'I — am. He, she, it — is. You, we, they — are.'],
        ['«Не» и вопрос', '«Не»: I am not tired. Вопрос — меняем местами: Are you ready? Is he at home?']],
      [['Чьё', 'my — мой, your — твой, his — его, her — её, its — его (о предмете), our — наш, their — их.'],
        ['Где ставить', 'Перед словом: my phone, her sister. Русское «свой» переводим конкретно: I love my job — я люблю свою работу.'],
        ['Частая ошибка', '«Him name» — ошибка. Его имя — his name.']],
    ],
    [ // A1
      [['Правило', 'О прошлом: к глаголу добавляем -ed: work → worked, play → played. Одна форма для всех: I worked, she worked.'],
        ['«Не» и вопрос', 'Помощник did: I didn\'t call. Вопрос: Did you call?'],
        ['Частая ошибка', '«I didn\'t called» — ошибка. После did глагол в начальной форме: I didn\'t call.']],
      [['Правило', 'У самых частых глаголов своя форма прошлого: go → went, see → saw, buy → bought, make → made.'],
        ['Как запомнить', 'По 5 в день вслух: go — went, come — came, have — had, take — took, get — got. В уроках они повторяются сами.'],
        ['«Не» и вопрос', 'Как у правильных: I didn\'t go. Did you see? После did — начальная форма.']],
      [['Правило', 'Will + глагол = будущее: I will call you — я позвоню тебе.'],
        ['«Не» и вопрос', 'won\'t = will not: I won\'t tell. Вопрос: Will you come?'],
        ['Когда', 'Обещания, решения прямо сейчас и прогнозы: I think it will rain.']],
      [['Правило', 'Can + глагол: I can swim — я умею плавать. Could — мог (в прошлом) или вежливая просьба.'],
        ['Без to и без -s', 'She can speak — не «cans» и не «can to speak».'],
        ['«Не» и вопрос', 'can\'t, couldn\'t. Вопрос: Can you help me? Could you open the window?']],
      [['Правило', '«Где-то есть что-то»: There is a cat in the kitchen — на кухне кошка.'],
        ['is или are', 'Один предмет — there is, много — there are. О прошлом — there was, there were.'],
        ['Порядок слов', 'По-русски место в начале, по-английски — в конце: There is a park in our city.']],
      [['Правило', 'Что происходит прямо сейчас: am / is / are + глагол с -ing: I am working.'],
        ['Сравни', 'I work — работаю вообще, обычно. I am working — работаю сейчас, в эту минуту.'],
        ['«Не» и вопрос', 'He isn\'t sleeping. Вопрос: What are you doing?']],
    ],
    [ // A2
      [['Правило', 'Am / is / are going to + глагол = «собираюсь»: I am going to learn Spanish.'],
        ['going to или will', 'going to — план уже есть. will — решаешь прямо сейчас: I\'ll help you!'],
        ['Прогноз по признакам', 'Look at the clouds! It is going to rain — видно, что сейчас будет.']],
      [['Короткие слова', 'Добавляем -er и than: big → bigger than. «Самый» — the + -est: the biggest.'],
        ['Длинные слова', 'more и the most: more interesting, the most expensive.'],
        ['Исключения', 'good → better → the best, bad → worse → the worst. «Такой же, как» — as … as: as tall as me.']],
      [['Правило', 'Have / has + 3-я форма (done, seen, been): I have been to London — я был в Лондоне. Это опыт, без даты.'],
        ['Слова-подсказки', 'ever — когда-нибудь, never — никогда, already — уже, yet — ещё не (или «уже?» в вопросе), just — только что.'],
        ['Частая ошибка', 'С точной датой — простое прошлое: I went to London in 2020 (не «have been in 2020»).']],
      [['Правило', 'Was / were + -ing — что происходило в какой-то момент: I was sleeping at 7.'],
        ['Прервали', 'Длинное действие прервали коротким: I was sleeping when you called.'],
        ['«Не» и вопрос', 'He wasn\'t listening. What were you doing?']],
      [['Разница', 'must — должен (правило, сам решил), have to — приходится (так сложилось), should — стоит (совет).'],
        ['Отрицания', 'mustn\'t — нельзя! don\'t have to — не обязательно. shouldn\'t — не стоит.'],
        ['Частая ошибка', 'После must и should — без to: You must go (не «must to go»).']],
      [['some и any', 'some — в утверждениях: I need some water. any — в вопросах и с «не»: Do you have any money? There aren\'t any eggs.'],
        ['much и many', 'many — что можно посчитать (people, books), much — что нельзя (time, money, water).'],
        ['a lot of, a few, a little', 'a lot of — много (для всего). a few — несколько (считаемых), a little — немного (несчитаемого).']],
    ],
    [ // B1
      [['Правило', 'If + настоящее, will + глагол: If it rains, I will stay at home.'],
        ['Частая ошибка', 'После if — не will: If it rains (не «if it will rain»). Так же после when: When I get home, I\'ll call.'],
        ['unless', 'unless = if not: I won\'t go unless you go — не пойду, если не пойдёшь ты.']],
      [['Правило', 'Мечта о настоящем: If + прошедшее, would + глагол: If I had money, I would buy a house.'],
        ['If I were you', 'Совет: If I were you, I would… — на твоём месте я бы… (were — со всеми: I were, he were).'],
        ['Не путай', 'If I have time, I will — реально возможно. If I had time, I would — сейчас нереально.']],
      [['Правило', 'Важно, что сделали, а не кто: be + 3-я форма: English is spoken everywhere.'],
        ['Времена', 'is made — обычно, was built — в прошлом, will be done — в будущем, has been cancelled — уже, is being repaired — сейчас.'],
        ['Кто сделал', 'Если нужно — by: The film was directed by Nolan.']],
      [['Правило', 'Have / has been + -ing: началось в прошлом и идёт до сих пор: I have been learning English for two years.'],
        ['for и since', 'for — сколько времени (for two years), since — с какого момента (since May).'],
        ['Частая ошибка', '«I learn English for two years» — ошибка. «Учу уже два года» — I have been learning.']],
      [['Правило', 'Пересказываем чужие слова — время шагает назад: «I am tired» → He said that he was tired.'],
        ['Сдвиг', 'am / is → was, will → would, can → could, сделал → had done.'],
        ['Вопросы и просьбы', 'He asked where I lived (без do!). He asked if I was ready. Просьба: He told me to wait.']],
      [['used to', 'Что было раньше и больше нет: I used to live in Omsk. «Не»: I didn\'t use to. Вопрос: Did you use to…?'],
        ['who, which, that', 'who — о людях, which — о предметах, that — о тех и других: The man who called you…'],
        ['where', 'О месте — where: The place where we met.']],
    ],
    [ // B2
      [['Правило', 'О прошлом, которое уже не изменить: If + had + 3-я форма, would have + 3-я форма.'],
        ['Пример', 'If I had known, I would have helped you — если бы я тогда знал, я бы помог.'],
        ['В живой речи', 'I\'d have helped. Вместо would — could или might: I could have won — я мог бы выиграть.']],
      [['О настоящем', 'I wish + прошедшее: I wish I had more time — хотел бы, чтобы времени было больше.'],
        ['О прошлом', 'I wish + had + 3-я форма: I wish I hadn\'t said that — жаль, что я это сказал.'],
        ['О раздражающем', 'I wish you would stop — хоть бы ты перестал. If only — то же самое, но сильнее.']],
      [['Правило', 'Had + 3-я форма — что случилось раньше другого события в прошлом.'],
        ['Пример', 'When I arrived, the train had already left — поезд ушёл ещё до того, как я приехал.'],
        ['Подсказки', 'already, before, by the time, after — частые соседи этого времени.']],
      [['Почти уверен', 'must have + 3-я форма: He must have forgotten — он, должно быть, забыл.'],
        ['Не может быть', 'can\'t have: She can\'t have done it — не может быть, чтобы она это сделала.'],
        ['Возможно и упрёк', 'might / may have — возможно. should have — следовало, но не сделал: You should have told me.']],
      [['После этих — -ing', 'enjoy, avoid, finish, mind, look forward to: I enjoy reading.'],
        ['После этих — to', 'decide, want, agree, hope, plan: She decided to leave.'],
        ['Смысл меняется', 'stop smoking — бросить курить, stop to smoke — остановиться покурить. remember to call — не забыть позвонить, remember meeting — помнить, как встретил.']],
      [['В процессе', 'will be + -ing — что будет идти в момент будущего: This time tomorrow I will be flying.'],
        ['К сроку', 'will have + 3-я форма — что будет готово к моменту: I will have finished by Friday.'],
        ['Подсказки', 'this time tomorrow, at 9 tomorrow → will be doing. by Friday, by 2030 → will have done.']],
    ],
    [ // C1
      [['Прошлое → настоящее', 'If I had taken that job (тогда), I would be rich now (сейчас).'],
        ['Настоящее → прошлое', 'If she were more careful (вообще), she wouldn\'t have crashed the car (тогда).'],
        ['Как не запутаться', 'Смотри на время каждой половины: прошлое — had done / would have done, настоящее — were / would do.']],
      [['Зачем', 'Для выразительности ставим «отрицательное» слово вперёд, а дальше порядок как в вопросе: Never have I seen…'],
        ['Слова-триггеры', 'Never, Rarely, Hardly … when, Not only … but also, Only then, Under no circumstances.'],
        ['Вместо if', 'Had I known = If I had known. Should you need help = If you need help.']],
      [['What …', 'What I need is a holiday — что мне нужно, так это отпуск. Так выделяем главное.'],
        ['It was … who', 'It was my brother who told me — это мой брат мне сказал (а не кто-то другой).'],
        ['All I want', 'All I want is … — всё, чего я хочу, — это… После What и All глагол обычно is.']],
      [['Правило', 'Общее мнение: It is said that … — говорят, что… It is believed that … — считается, что…'],
        ['Личная форма', 'He is believed to be in London. О прошлом — to have + 3-я форма: is reported to have lost.'],
        ['have something done', 'Делают для тебя: I had my hair cut — меня подстригли (я сходил к мастеру).']],
      [['Правило', 'Два предложения — в одно: Having finished the work, he went home — закончив работу, он пошёл домой.'],
        ['Формы', '-ing — одновременно (Walking down the street…), Having + 3-я форма — сначала одно, потом другое, 3-я форма — пассив (Written in 1900…).'],
        ['Частая ошибка', 'Подлежащее должно совпадать: «Walking down the street, the rain started» — ошибка, дождь не шёл по улице.']],
      [['would rather', 'I would rather stay — я бы лучше остался. О другом человеке — прошедшее: I\'d rather you didn\'t smoke.'],
        ['it\'s time, as if', 'It\'s time we went home — нам пора домой (прошедшее!). He talks as if he knew — говорит так, будто знает.'],
        ['suggest, essential', 'После suggest, insist, it is essential — глагол без окончаний: I suggest that he see a doctor.']],
    ],
  ];

  const WORDS = [
    `be — быть
have — иметь
do — делать
go — идти, ехать
come — приходить
see — видеть
know — знать
want — хотеть
like — нравиться
love — любить
work — работать
live — жить
play — играть
eat — есть (кушать)
drink — пить
read — читать
write — писать
speak — говорить
say — сказать
think — думать
need — нуждаться, нужно
help — помогать
give — давать
take — брать
make — делать, создавать
buy — покупать
open — открывать
close — закрывать
sleep — спать
understand — понимать
man — мужчина
woman — женщина
child — ребёнок
friend — друг
family — семья
mother — мама
father — папа
brother — брат
sister — сестра
home — дом (родной)
house — дом (здание)
room — комната
door — дверь
window — окно
table — стол
car — машина
phone — телефон
book — книга
money — деньги
time — время
day — день
night — ночь
morning — утро
evening — вечер
week — неделя
year — год
water — вода
food — еда
bread — хлеб
coffee — кофе
tea — чай
city — город
street — улица
shop — магазин
school — школа
job — работа (место)
name — имя
dog — собака
cat — кошка
music — музыка
good — хороший
bad — плохой
big — большой
small — маленький
new — новый
old — старый
young — молодой
happy — счастливый
tired — уставший
hot — горячий, жаркий
cold — холодный
easy — лёгкий, простой
difficult — трудный
fast — быстрый
slow — медленный
beautiful — красивый
busy — занятый
ready — готовый
free — свободный, бесплатный
right — правильный, правый
today — сегодня
tomorrow — завтра
yesterday — вчера
now — сейчас
here — здесь
there — там
always — всегда
never — никогда
very — очень
and — и`,
    `travel — путешествовать
visit — посещать
wait — ждать
learn — учить, узнавать
remember — помнить
forget — забывать
try — пытаться, пробовать
use — использовать
find — находить
lose — терять, проигрывать
win — выигрывать
start — начинать
finish — заканчивать
call — звонить, звать
ask — спрашивать, просить
answer — отвечать
walk — гулять, идти пешком
run — бегать
swim — плавать
cook — готовить (еду)
wash — мыть
watch — смотреть (видео, матч)
listen — слушать
look — смотреть, выглядеть
leave — уходить, оставлять
arrive — прибывать
stay — оставаться
sell — продавать
send — отправлять
meet — встречать(ся)
weather — погода
rain — дождь
snow — снег
sun — солнце
head — голова
hand — рука (кисть)
eye — глаз
face — лицо
body — тело
clothes — одежда
shoes — обувь
shirt — рубашка
breakfast — завтрак
lunch — обед
dinner — ужин
meat — мясо
fish — рыба
fruit — фрукты
vegetables — овощи
egg — яйцо
milk — молоко
sugar — сахар
kitchen — кухня
bathroom — ванная
bed — кровать
chair — стул
ticket — билет
train — поезд
bus — автобус
plane — самолёт
airport — аэропорт
station — вокзал, станция
hotel — гостиница
holiday — отпуск, праздник
party — вечеринка
birthday — день рождения
game — игра
film — фильм
picture — картинка, фото
question — вопрос
problem — проблема
letter — письмо
office — офис
doctor — врач
hospital — больница
cheap — дешёвый
expensive — дорогой
tall — высокий
short — короткий, низкий
long — длинный
hungry — голодный
sick — больной
angry — злой
sad — грустный
early — рано
late — поздно
often — часто
sometimes — иногда
usually — обычно
again — снова
together — вместе
because — потому что
but — но
or — или
first — первый
last — последний
next — следующий
every — каждый
many — много (то, что можно посчитать)
much — много (то, что нельзя посчитать)`,
    `borrow — брать взаймы
lend — давать взаймы
spend — тратить, проводить (время)
save — копить, спасать
earn — зарабатывать
pay — платить
choose — выбирать
decide — решать
explain — объяснять
describe — описывать
compare — сравнивать
prefer — предпочитать
agree — соглашаться
believe — верить
hope — надеяться
worry — волноваться
feel — чувствовать
hurt — болеть, ранить
break — ломать
fix — чинить
build — строить
grow — расти, выращивать
change — менять(ся)
move — двигаться, переезжать
carry — нести
bring — приносить
catch — ловить, успевать на
miss — скучать, пропускать
invite — приглашать
check — проверять
follow — следовать
happen — случаться
mean — значить
experience — опыт
trip — поездка
journey — путешествие
luggage — багаж
passport — паспорт
map — карта
island — остров
mountain — гора
river — река
sea — море
country — страна
village — деревня
neighbour — сосед
guest — гость
price — цена
bill — счёт (в кафе)
receipt — чек
sale — распродажа
customer — покупатель
health — здоровье
medicine — лекарство
pain — боль
advice — совет
idea — идея
future — будущее
past — прошлое
age — возраст
life — жизнь
world — мир
news — новости
salary — зарплата
boss — начальник
colleague — коллега
meeting — встреча, совещание
mistake — ошибка
reason — причина
result — результат
dangerous — опасный
safe — безопасный
healthy — здоровый
famous — известный
important — важный
interesting — интересный
boring — скучный
funny — смешной
friendly — дружелюбный
polite — вежливый
rude — грубый
lazy — ленивый
clever — умный
strange — странный
quiet — тихий
noisy — шумный
comfortable — удобный
delicious — вкусный
empty — пустой
full — полный
different — разный, другой
similar — похожий
possible — возможный
enough — достаточно
already — уже
yet — ещё (не); уже (в вопросе)
still — всё ещё
almost — почти
probably — вероятно
suddenly — вдруг`,
    `give up — сдаваться, бросать
find out — выяснить
look for — искать
look after — заботиться о
get up — вставать
put off — откладывать
turn on — включать
turn off — выключать
take off — снимать; взлетать
pick up — поднимать, забирать
set up — основать, настроить
run out of — закончиться (о запасе)
come back — возвращаться
get on with — ладить с
look forward to — ждать с нетерпением
carry on — продолжать дальше (разг.)
work out — тренироваться; разобраться
make up — выдумать; помириться
break down — сломаться
deal with — справляться с
count on — рассчитывать на
figure out — понять, разобраться
bring up — растить; поднять тему
show up — появиться, прийти
go through — пережить; просмотреть
achieve — достигать
improve — улучшать
develop — развивать
manage — справляться, управлять
suggest — предлагать (идею)
offer — предлагать (дать)
require — требовать
provide — обеспечивать
avoid — избегать
allow — позволять
refuse — отказываться
admit — признавать
complain — жаловаться
apologize — извиняться
persuade — уговорить
recommend — рекомендовать
succeed — добиться успеха
fail — провалить(ся)
prepare — готовить(ся)
predict — предсказывать
increase — увеличивать(ся)
reduce — сокращать
continue — продолжать
depend — зависеть
expect — ожидать
opportunity — возможность
goal — цель
skill — навык
habit — привычка
effort — усилие
success — успех
failure — неудача
knowledge — знания
opinion — мнение
argument — спор; довод
decision — решение
choice — выбор
attitude — отношение (к чему-то)
behaviour — поведение
relationship — отношения
environment — окружающая среда
society — общество
government — правительство
law — закон
crime — преступление
education — образование
career — карьера
income — доход
debt — долг
loan — кредит, заём
investment — инвестиция
risk — риск
benefit — польза, выгода
amount — количество, сумма
average — средний, среднее
available — доступный
responsible — ответственный
independent — независимый
confident — уверенный в себе
anxious — тревожный
grateful — благодарный
disappointed — разочарованный
surprised — удивлённый
embarrassed — смущённый
reliable — надёжный
useful — полезный
useless — бесполезный
obvious — очевидный
actually — на самом деле
especially — особенно
instead — вместо этого
however — однако
although — хотя
recently — недавно
eventually — в конце концов`,
    `assume — предполагать
consider — рассматривать, считать
determine — определять
establish — устанавливать, основывать
maintain — поддерживать, сохранять
obtain — получать, добывать
ensure — обеспечивать, гарантировать
emphasize — подчёркивать
acknowledge — признавать
contribute — вносить вклад
encourage — поощрять, подбадривать
enhance — усиливать, улучшать
evaluate — оценивать
identify — выявлять, опознавать
implement — внедрять
indicate — указывать
involve — вовлекать, включать
justify — оправдывать
overcome — преодолевать
pursue — стремиться к, преследовать
reveal — раскрывать
struggle — бороться, с трудом справляться
tend — иметь склонность
afford — позволить себе
attempt — попытка; пытаться
claim — утверждать
convince — убеждать (в правоте)
deny — отрицать
distract — отвлекать
doubt — сомневаться
exaggerate — преувеличивать
hesitate — колебаться
influence — влиять; влияние
postpone — переносить на потом
reject — отвергать
rely — полагаться
observe — наблюдать
occur — происходить
consequence — последствие
approach — подход
issue — вопрос, проблема
evidence — доказательства
feature — особенность
purpose — цель, назначение
aspect — сторона, аспект
challenge — трудная задача, вызов
circumstances — обстоятельства
achievement — достижение
awareness — осознание
burden — бремя
concern — беспокойство
contribution — вклад
demand — спрос; требование
expense — расход
outcome — итог, исход
priority — приоритет
prospect — перспектива
requirement — требование
resource — ресурс
strategy — стратегия
threat — угроза
trend — тенденция, тренд
value — ценность, стоимость
perspective — точка зрения
reputation — репутация
deadline — крайний срок
insight — понимание сути
compromise — компромисс
obligation — обязательство
significant — значительный
essential — необходимый
relevant — относящийся к делу
appropriate — подходящий, уместный
efficient — эффективный
sufficient — достаточный
reasonable — разумный
accurate — точный
aware — знающий, осведомлённый
capable — способный
consistent — последовательный
crucial — решающий
complex — сложный
temporary — временный
permanent — постоянный
previous — предыдущий
potential — потенциальный
reluctant — неохотный
vulnerable — уязвимый
genuine — настоящий, искренний
frequent — частый
rare — редкий
fair — справедливый
flexible — гибкий
nevertheless — тем не менее
therefore — поэтому, следовательно
whereas — тогда как
despite — несмотря на
meanwhile — тем временем
furthermore — более того
otherwise — иначе`,
    `undermine — подрывать
mitigate — смягчать (последствия)
anticipate — предвидеть
alleviate — облегчать
articulate — чётко выражать
compel — вынуждать
comply — соблюдать (правила)
constitute — составлять, являться
deteriorate — ухудшаться
diminish — уменьшаться
endorse — одобрять, поддерживать
entail — влечь за собой
exacerbate — усугублять
foster — развивать, поощрять
hinder — мешать, препятствовать
induce — вызывать, побуждать
infer — делать вывод
perceive — воспринимать
prevail — преобладать, одержать верх
refrain — воздерживаться
reconcile — примирять, совмещать
scrutinize — тщательно изучать
substantiate — обосновывать
sustain — поддерживать, выдерживать
undertake — предпринимать, браться
uphold — поддерживать (решение, закон)
yield — приносить (доход); уступать
withstand — выдерживать
convey — передавать (мысль)
discern — различать, распознавать
ambiguity — двусмысленность
bias — предвзятость
coherence — связность
consensus — общее согласие
discrepancy — расхождение
dilemma — дилемма
drawback — недостаток
feasibility — осуществимость
implication — последствие, подтекст
incentive — стимул
integrity — честность, целостность
leverage — рычаг влияния
liability — ответственность; обуза
nuance — нюанс
paradigm — образец мышления, парадигма
premise — предпосылка
rationale — обоснование
scope — рамки, масштаб
setback — неудача, откат назад
stance — позиция
subtlety — тонкость
turmoil — смятение, беспорядки
upheaval — потрясение
viability — жизнеспособность
precedent — прецедент
inevitable — неизбежный
ubiquitous — вездесущий
profound — глубокий
meticulous — дотошный
pragmatic — прагматичный
plausible — правдоподобный
arbitrary — произвольный
coherent — связный, логичный
compelling — убедительный
comprehensive — всесторонний
conspicuous — бросающийся в глаза
contentious — спорный
diligent — усердный
elusive — неуловимый
explicit — явный, прямой
implicit — подразумеваемый
inherent — присущий
intricate — замысловатый
lucrative — прибыльный
mundane — обыденный
notorious — печально известный
obsolete — устаревший
prevalent — распространённый
resilient — стойкий
robust — надёжный, крепкий
scarce — дефицитный, скудный
tentative — предварительный
versatile — разносторонний
volatile — изменчивый, нестабильный
unprecedented — беспрецедентный
detrimental — вредный
redundant — излишний
conducive — благоприятный (для)
adverse — неблагоприятный
tedious — нудный, утомительный
candid — откровенный
paramount — первостепенный
albeit — хотя и
hence — отсюда, следовательно
thereby — тем самым
notwithstanding — несмотря на
seemingly — по-видимому
predominantly — преимущественно
arguably — пожалуй, можно утверждать
consequently — следовательно
allegedly — якобы`,
  ];

  // «слово — перевод» → [слово, перевод]
  const parse = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const i = line.indexOf(' — ');
    return [line.slice(0, i).trim(), line.slice(i + 3).trim()];
  });

  return { RULES, WORDS: WORDS.map(parse) };
})();
