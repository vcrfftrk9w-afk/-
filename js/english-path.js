'use strict';
/* =========================================================
   ENGLISH PATH — английский от нуля до C1 во вкладке «🎓 Курсы».

   Шесть уровней по шкале CEFR: A0 → A1 → A2 → B1 → B2 → C1.
   На каждый уровень — 50 видеоуроков Александра Бебриса (English Galaxy,
   отдельный плейлист YouTube на каждый уровень) и 6 тем грамматики уровня
   с упражнениями: пазлы, аудирование, тест, говорение вслух.

   Урок дня = кусок видео (20/30/45 минут, продолжаешь с того же места)
   + упражнения по теме урока + интервальное повторение фраз,
   в которых ошибался (1 → 2 → 4 → 8 → 16 → 32 дня).

   После 50 уроков — экзамен уровня. Уровень засчитывается только
   после экзамена: тест ≥ 80 %, аудирование и пазлы ≥ 70 %,
   говорение ≥ 60 %. Не сдал — 5 дней повторения по слабым темам
   и пересдача. Поэтому «твой уровень» в приложении — всегда
   подтверждённый, а не «на глаз».
   ========================================================= */

const EnglishPath = (() => {
  const LESSONS = 50;          // уроков в плейлисте уровня
  const LESSON_MIN = 70;       // средняя длина видеоурока, минут
  const REVIEW_DAYS = 5;       // дней повторения после несданного экзамена
  const SRS_DAYS = [1, 2, 4, 8, 16, 32];
  const PASS = { test: 0.8, listening: 0.7, 'puzzle-en': 0.7, speak: 0.6, words: 0.7 };


  /* ---------- уровни: плейлист, что умеешь, грамматика ----------
     s: [английский, русский] — для пазлов, аудирования, говорения
     g: [предложение с ___, ответ, варианты] — для теста */
  const LEVELS = [
    {
      id: 'A0', name: 'Starter', ru: 'Нулевой', list: 'PLD6SPjEPomauFCdDQwuHubP7F2yIVJnwN',
      ids: { 1: 'HJwTaPns-D0', 2: 'dN5KiZOGFyY' },
      can: ['Строишь простые предложения: «я работаю», «она живёт в Лондоне»', 'Говоришь «не» и задаёшь вопросы Do / Does', 'Рассказываешь о себе 10 простыми фразами'],
      blocks: [
        { t: 'Я, ты, мы, они + глагол',
          s: [['I work.', 'Я работаю.'], ['I live in Moscow.', 'Я живу в Москве.'], ['You know me.', 'Ты знаешь меня.'], ['We play football.', 'Мы играем в футбол.'],
            ['They like music.', 'Они любят музыку.'], ['I understand you.', 'Я понимаю тебя.'], ['We want coffee.', 'Мы хотим кофе.'], ['You speak English.', 'Ты говоришь по-английски.'],
            ['I read books.', 'Я читаю книги.'], ['They live in London.', 'Они живут в Лондоне.'], ['I need water.', 'Мне нужна вода.'], ['We work and they play.', 'Мы работаем, а они играют.']],
          g: [['I ___ in Moscow.', 'live', ['live', 'lives', 'living']], ['We ___ football.', 'play', ['play', 'plays', 'player']], ['They ___ music.', 'like', ['like', 'likes', 'liking']],
            ['___ understand you.', 'I', ['I', 'Me', 'My']], ['You ___ English.', 'speak', ['speak', 'speaks', 'speaking']], ['We ___ coffee.', 'want', ['want', 'wants', 'wanting']],
            ['They ___ you.', 'know', ['know', 'knows', 'knowing']], ['I ___ books.', 'read', ['read', 'reads', 'reading']]] },
        { t: 'He / She / It: глагол + s',
          s: [['He works.', 'Он работает.'], ['She lives in London.', 'Она живёт в Лондоне.'], ['He likes football.', 'Он любит футбол.'], ['She speaks English.', 'Она говорит по-английски.'],
            ['It works.', 'Это работает.'], ['He knows me.', 'Он знает меня.'], ['She reads books.', 'Она читает книги.'], ['He watches films.', 'Он смотрит фильмы.'],
            ['My brother plays football.', 'Мой брат играет в футбол.'], ['He goes to work.', 'Он ходит на работу.'], ['She understands you.', 'Она понимает тебя.'], ['It helps me.', 'Это помогает мне.']],
          g: [['She ___ in London.', 'lives', ['live', 'lives', 'living']], ['He ___ football.', 'plays', ['play', 'plays', 'playes']], ['It ___.', 'works', ['work', 'works', 'working']],
            ['He ___ films.', 'watches', ['watch', 'watchs', 'watches']], ['She ___ to work.', 'goes', ['go', 'gos', 'goes']], ['My brother ___ English.', 'speaks', ['speak', 'speaks', 'speakes']],
            ['She ___ coffee.', 'wants', ['want', 'wants', 'wanting']], ['___ knows me.', 'He', ['He', 'Him', 'His']]] },
        { t: 'Отрицание: don\'t / doesn\'t',
          s: [['I don\'t know.', 'Я не знаю.'], ['We don\'t work today.', 'Мы не работаем сегодня.'], ['They don\'t like coffee.', 'Они не любят кофе.'], ['You don\'t understand me.', 'Ты не понимаешь меня.'],
            ['He doesn\'t work.', 'Он не работает.'], ['She doesn\'t speak English.', 'Она не говорит по-английски.'], ['It doesn\'t work.', 'Это не работает.'], ['He doesn\'t live here.', 'Он не живёт здесь.'],
            ['I don\'t watch TV.', 'Я не смотрю телевизор.'], ['She doesn\'t want tea.', 'Она не хочет чай.'], ['We don\'t need help.', 'Нам не нужна помощь.']],
          g: [['He ___ work.', 'doesn\'t', ['don\'t', 'doesn\'t', 'not']], ['I ___ know.', 'don\'t', ['don\'t', 'doesn\'t', 'not']], ['She ___ like coffee.', 'doesn\'t', ['don\'t', 'doesn\'t', 'isn\'t']],
            ['They ___ live here.', 'don\'t', ['don\'t', 'doesn\'t', 'aren\'t']], ['It ___ work.', 'doesn\'t', ['don\'t', 'doesn\'t', 'not']], ['He doesn\'t ___ English.', 'speak', ['speak', 'speaks', 'speaking']],
            ['We ___ need help.', 'don\'t', ['don\'t', 'doesn\'t', 'not']], ['She doesn\'t ___ TV.', 'watch', ['watch', 'watches', 'watching']]] },
        { t: 'Вопросы: Do / Does',
          s: [['Do you speak English?', 'Ты говоришь по-английски?'], ['Do you like music?', 'Ты любишь музыку?'], ['Do they live here?', 'Они живут здесь?'], ['Does he work?', 'Он работает?'],
            ['Does she know you?', 'Она знает тебя?'], ['Does it work?', 'Это работает?'], ['Where do you live?', 'Где ты живёшь?'], ['What do you want?', 'Что ты хочешь?'],
            ['Where does she work?', 'Где она работает?'], ['What does he read?', 'Что он читает?'], ['Do we need water?', 'Нам нужна вода?']],
          g: [['___ you speak English?', 'Do', ['Do', 'Does', 'Are']], ['___ he work?', 'Does', ['Do', 'Does', 'Is']], ['Does she ___ you?', 'know', ['know', 'knows', 'knowing']],
            ['Where ___ you live?', 'do', ['do', 'does', 'are']], ['___ it work?', 'Does', ['Do', 'Does', 'Is']], ['What ___ he want?', 'does', ['do', 'does', 'is']],
            ['___ they like music?', 'Do', ['Do', 'Does', 'Are']], ['Where does she ___?', 'work', ['work', 'works', 'working']]] },
        { t: 'Глагол to be: am / is / are',
          s: [['I am a student.', 'Я студент.'], ['You are my friend.', 'Ты мой друг.'], ['He is at home.', 'Он дома.'], ['She is happy.', 'Она счастлива.'],
            ['It is good.', 'Это хорошо.'], ['We are here.', 'Мы здесь.'], ['They are busy.', 'Они заняты.'], ['I am not tired.', 'Я не устал.'],
            ['Is he at work?', 'Он на работе?'], ['Are you ready?', 'Ты готов?'], ['We are not late.', 'Мы не опаздываем.']],
          g: [['I ___ a student.', 'am', ['am', 'is', 'are']], ['She ___ happy.', 'is', ['am', 'is', 'are']], ['They ___ busy.', 'are', ['am', 'is', 'are']],
            ['___ you ready?', 'Are', ['Am', 'Is', 'Are']], ['He ___ at home.', 'is', ['am', 'is', 'are']], ['We ___ here.', 'are', ['am', 'is', 'are']],
            ['I ___ not tired.', 'am', ['am', 'is', 'are']], ['___ he at work?', 'Is', ['Am', 'Is', 'Are']]] },
        { t: 'Мой, твой, его: my / your / his / her',
          s: [['This is my phone.', 'Это мой телефон.'], ['Your car is new.', 'Твоя машина новая.'], ['His name is Max.', 'Его зовут Макс.'], ['Her sister lives in Paris.', 'Её сестра живёт в Париже.'],
            ['Our house is big.', 'Наш дом большой.'], ['Their dog is funny.', 'Их собака смешная.'], ['What is your name?', 'Как тебя зовут?'], ['My friends are here.', 'Мои друзья здесь.'],
            ['I love my job.', 'Я люблю свою работу.'], ['She calls her mother every day.', 'Она звонит своей маме каждый день.']],
          g: [['This is ___ phone. (я)', 'my', ['my', 'me', 'I']], ['___ name is Max. (он)', 'His', ['His', 'He', 'Him']], ['___ sister lives in Paris. (она)', 'Her', ['Her', 'She', 'Hers']],
            ['What is ___ name? (ты)', 'your', ['your', 'you', 'yours']], ['___ house is big. (мы)', 'Our', ['Our', 'We', 'Us']], ['___ dog is funny. (они)', 'Their', ['Their', 'They', 'Them']],
            ['I love ___ job.', 'my', ['my', 'me', 'mine']], ['She calls ___ mother.', 'her', ['her', 'she', 'hers']]] },
      ],
    },
    {
      id: 'A1', name: 'Elementary', ru: 'Элементарный', list: 'PLD6SPjEPomast6akxxYi4rJ5XJSIf91wg', ids: {},
      can: ['Рассказываешь, что делал вчера и что будешь делать завтра', 'Описываешь, что вокруг и что происходит сейчас', 'Понимаешь медленную простую речь на бытовые темы'],
      blocks: [
        { t: 'Прошедшее время: правильные глаголы',
          s: [['I worked yesterday.', 'Я работал вчера.'], ['We played football last week.', 'Мы играли в футбол на прошлой неделе.'], ['She watched a film.', 'Она посмотрела фильм.'],
            ['They lived in Kazan.', 'Они жили в Казани.'], ['I didn\'t call him.', 'Я не позвонил ему.'], ['Did you like the book?', 'Тебе понравилась книга?'], ['He started a new job.', 'Он начал новую работу.'],
            ['We stayed at home.', 'Мы остались дома.'], ['Did she help you?', 'Она помогла тебе?'], ['I wanted to sleep.', 'Я хотел спать.']],
          g: [['I ___ yesterday.', 'worked', ['work', 'worked', 'working']], ['She ___ a film last night.', 'watched', ['watch', 'watches', 'watched']], ['I didn\'t ___ him.', 'call', ['call', 'called', 'calls']],
            ['___ you like the book?', 'Did', ['Do', 'Did', 'Does']], ['They ___ in Kazan in 2020.', 'lived', ['live', 'lived', 'lives']], ['Did she ___ you?', 'help', ['help', 'helped', 'helps']],
            ['We ___ at home last weekend.', 'stayed', ['stay', 'stayed', 'stays']], ['He ___ a new job last month.', 'started', ['start', 'starts', 'started']]] },
        { t: 'Прошедшее время: неправильные глаголы',
          s: [['I went to the gym.', 'Я сходил в спортзал.'], ['She bought a new phone.', 'Она купила новый телефон.'], ['We saw a great film.', 'Мы посмотрели отличный фильм.'],
            ['He came home late.', 'Он пришёл домой поздно.'], ['I made a mistake.', 'Я сделал ошибку.'], ['They had a good time.', 'Они хорошо провели время.'], ['Where did you go?', 'Куда ты ходил?'],
            ['I didn\'t see him.', 'Я не видел его.'], ['She told me everything.', 'Она рассказала мне всё.'], ['We ate pizza.', 'Мы ели пиццу.']],
          g: [['I ___ to the gym yesterday.', 'went', ['go', 'went', 'goed']], ['She ___ a new phone.', 'bought', ['buyed', 'bought', 'buy']], ['We ___ a great film.', 'saw', ['saw', 'seen', 'see']],
            ['He ___ home late.', 'came', ['come', 'came', 'comed']], ['I ___ a mistake.', 'made', ['make', 'maked', 'made']], ['Where did you ___?', 'go', ['go', 'went', 'gone']],
            ['I didn\'t ___ him.', 'see', ['see', 'saw', 'seen']], ['They ___ a good time.', 'had', ['have', 'had', 'haved']]] },
        { t: 'Будущее время: will',
          s: [['I will call you tomorrow.', 'Я позвоню тебе завтра.'], ['She will help us.', 'Она поможет нам.'], ['It will be cold.', 'Будет холодно.'], ['We won\'t be late.', 'Мы не опоздаем.'],
            ['Will you come?', 'Ты придёшь?'], ['I think he will win.', 'Я думаю, он победит.'], ['They will buy a car.', 'Они купят машину.'], ['I will do it later.', 'Я сделаю это позже.'],
            ['Will it rain tomorrow?', 'Завтра будет дождь?'], ['I won\'t tell anyone.', 'Я никому не скажу.']],
          g: [['I ___ call you tomorrow.', 'will', ['will', 'am', 'did']], ['We ___ be late.', 'won\'t', ['won\'t', 'don\'t', 'didn\'t']], ['___ you come?', 'Will', ['Will', 'Do', 'Are']],
            ['It will ___ cold.', 'be', ['be', 'is', 'being']], ['She will ___ us.', 'help', ['help', 'helps', 'helped']], ['I think he ___ win.', 'will', ['will', 'is', 'does']],
            ['I will ___ it later.', 'do', ['do', 'does', 'did']], ['___ it rain tomorrow?', 'Will', ['Will', 'Does', 'Is']]] },
        { t: 'Can / could: умею, могу',
          s: [['I can swim.', 'Я умею плавать.'], ['She can speak three languages.', 'Она говорит на трёх языках.'], ['Can you help me?', 'Можешь помочь мне?'], ['I can\'t find my keys.', 'Я не могу найти свои ключи.'],
            ['He couldn\'t sleep.', 'Он не мог уснуть.'], ['Could you open the window?', 'Не могли бы вы открыть окно?'], ['We can meet tomorrow.', 'Мы можем встретиться завтра.'], ['Can I ask a question?', 'Можно задать вопрос?'],
            ['I could run fast as a child.', 'В детстве я быстро бегал.'], ['You can\'t park here.', 'Здесь нельзя парковаться.']],
          g: [['I ___ swim.', 'can', ['can', 'cans', 'am']], ['___ you help me?', 'Can', ['Can', 'Do', 'Are']], ['I can\'t ___ my keys.', 'find', ['find', 'found', 'finding']],
            ['He ___ sleep last night.', 'couldn\'t', ['can\'t', 'couldn\'t', 'doesn\'t']], ['___ you open the window, please?', 'Could', ['Could', 'Did', 'Are']], ['She can ___ three languages.', 'speak', ['speak', 'speaks', 'to speak']],
            ['___ I ask a question?', 'Can', ['Can', 'Do', 'Am']], ['You ___ park here.', 'can\'t', ['can\'t', 'don\'t', 'isn\'t']]] },
        { t: 'There is / there are',
          s: [['There is a cat in the kitchen.', 'На кухне кошка.'], ['There are two shops near my house.', 'Рядом с моим домом два магазина.'], ['Is there a bank here?', 'Здесь есть банк?'],
            ['There isn\'t any milk.', 'Молока нет.'], ['Are there any questions?', 'Есть вопросы?'], ['There was a problem.', 'Была проблема.'], ['There were many people.', 'Было много людей.'],
            ['There is a park in our city.', 'В нашем городе есть парк.'], ['There aren\'t any chairs.', 'Стульев нет.'], ['Is there a free table?', 'Есть свободный столик?']],
          g: [['There ___ a cat in the kitchen.', 'is', ['is', 'are', 'be']], ['There ___ two shops near my house.', 'are', ['is', 'are', 'am']], ['___ there a bank here?', 'Is', ['Is', 'Are', 'Do']],
            ['There ___ any milk.', 'isn\'t', ['isn\'t', 'aren\'t', 'don\'t']], ['___ there any questions?', 'Are', ['Is', 'Are', 'Do']], ['There ___ a problem yesterday.', 'was', ['was', 'were', 'is']],
            ['There ___ many people at the party.', 'were', ['was', 'were', 'is']], ['There ___ any chairs.', 'aren\'t', ['isn\'t', 'aren\'t', 'not']]] },
        { t: 'Сейчас: Present Continuous',
          s: [['I am working now.', 'Я сейчас работаю.'], ['She is reading a book.', 'Она читает книгу.'], ['They are playing outside.', 'Они играют на улице.'], ['What are you doing?', 'Что ты делаешь?'],
            ['He isn\'t sleeping.', 'Он не спит.'], ['It is raining.', 'Идёт дождь.'], ['We are waiting for you.', 'Мы ждём тебя.'], ['Are you listening to me?', 'Ты меня слушаешь?'],
            ['I am learning English.', 'Я учу английский.'], ['She is cooking dinner.', 'Она готовит ужин.']],
          g: [['I am ___ now.', 'working', ['work', 'working', 'works']], ['She ___ reading a book.', 'is', ['is', 'are', 'am']], ['What are you ___?', 'doing', ['do', 'doing', 'does']],
            ['It ___ raining.', 'is', ['is', 'are', 'does']], ['They ___ playing outside.', 'are', ['is', 'are', 'am']], ['He ___ sleeping.', 'isn\'t', ['isn\'t', 'doesn\'t', 'aren\'t']],
            ['___ you listening to me?', 'Are', ['Are', 'Do', 'Is']], ['We are ___ for you.', 'waiting', ['wait', 'waits', 'waiting']]] },
      ],
    },
    {
      id: 'A2', name: 'Pre-Intermediate', ru: 'Ниже среднего', list: 'PLD6SPjEPomatk5Pp2z7j-9kOxmgTUiRSr', ids: { 3: '_yifWF8FYic' },
      can: ['Говоришь о планах, опыте и сравниваешь', 'Справляешься в магазине, кафе, аэропорту, у врача', 'Пишешь короткое сообщение или письмо'],
      blocks: [
        { t: 'Планы: going to',
          s: [['I am going to learn Spanish.', 'Я собираюсь учить испанский.'], ['We are going to travel in summer.', 'Летом мы собираемся путешествовать.'], ['She is going to call you.', 'Она собирается тебе позвонить.'],
            ['Are you going to buy it?', 'Ты собираешься это купить?'], ['It is going to rain.', 'Сейчас пойдёт дождь.'], ['I am not going to give up.', 'Я не собираюсь сдаваться.'],
            ['What are you going to do?', 'Что ты собираешься делать?'], ['They are going to move to Sochi.', 'Они собираются переехать в Сочи.'], ['He is going to start a business.', 'Он собирается открыть бизнес.']],
          g: [['I am going ___ learn Spanish.', 'to', ['to', 'for', '—']], ['We ___ going to travel.', 'are', ['is', 'are', 'am']], ['Are you going to ___ it?', 'buy', ['buy', 'buying', 'bought']],
            ['Look at the clouds! It is going to ___.', 'rain', ['rain', 'rains', 'raining']], ['I am not going to ___ up.', 'give', ['give', 'giving', 'gave']], ['What ___ you going to do?', 'are', ['are', 'do', 'will']],
            ['She ___ going to call you.', 'is', ['is', 'are', 'does']], ['He is going to ___ a business.', 'start', ['start', 'started', 'starting']]] },
        { t: 'Сравнения: bigger, more, the best',
          s: [['My city is bigger than yours.', 'Мой город больше твоего.'], ['This phone is cheaper.', 'Этот телефон дешевле.'], ['English is easier than Chinese.', 'Английский легче китайского.'],
            ['It is the best day of my life.', 'Это лучший день в моей жизни.'], ['She is the tallest in the class.', 'Она самая высокая в классе.'], ['This book is more interesting.', 'Эта книга интереснее.'],
            ['Today is worse than yesterday.', 'Сегодня хуже, чем вчера.'], ['He is as tall as me.', 'Он такого же роста, как я.'], ['It is the most expensive hotel.', 'Это самый дорогой отель.']],
          g: [['My city is ___ than yours.', 'bigger', ['big', 'bigger', 'biggest']], ['This book is ___ interesting.', 'more', ['more', 'most', 'much']], ['It is the ___ day of my life.', 'best', ['better', 'best', 'good']],
            ['Today is ___ than yesterday.', 'worse', ['bad', 'worse', 'worst']], ['English is easier ___ Chinese.', 'than', ['than', 'that', 'then']], ['She is the ___ in the class.', 'tallest', ['taller', 'tallest', 'most tall']],
            ['He is as tall ___ me.', 'as', ['as', 'than', 'like']], ['It is the ___ expensive hotel.', 'most', ['more', 'most', 'much']]] },
        { t: 'Опыт: Present Perfect',
          s: [['I have been to London.', 'Я был в Лондоне.'], ['Have you ever tried sushi?', 'Ты когда-нибудь пробовал суши?'], ['She has never seen snow.', 'Она никогда не видела снег.'],
            ['I have already done it.', 'Я уже сделал это.'], ['He hasn\'t called yet.', 'Он ещё не позвонил.'], ['We have known each other for years.', 'Мы знаем друг друга много лет.'],
            ['I have lost my keys.', 'Я потерял свои ключи.'], ['Have you finished?', 'Ты закончил?'], ['They have just arrived.', 'Они только что приехали.'], ['She has lived here since 2019.', 'Она живёт здесь с 2019 года.']],
          g: [['I have ___ to London.', 'been', ['be', 'was', 'been']], ['Have you ever ___ sushi?', 'tried', ['try', 'tried', 'trying']], ['She has ___ seen snow.', 'never', ['never', 'ever', 'yet']],
            ['He hasn\'t called ___.', 'yet', ['yet', 'already', 'just']], ['I have ___ done it.', 'already', ['already', 'yet', 'ever']], ['She ___ lived here since 2019.', 'has', ['has', 'have', 'is']],
            ['We have known each other ___ years.', 'for', ['for', 'since', 'during']], ['I have ___ my keys.', 'lost', ['lose', 'lost', 'losed']]] },
        { t: 'Процесс в прошлом: Past Continuous',
          s: [['I was sleeping when you called.', 'Я спал, когда ты позвонил.'], ['She was cooking at 7 o\'clock.', 'В 7 часов она готовила.'], ['What were you doing yesterday at 10?', 'Что ты делал вчера в 10?'],
            ['They were playing when it started to rain.', 'Они играли, когда начался дождь.'], ['He wasn\'t listening.', 'Он не слушал.'], ['We were watching TV all evening.', 'Мы весь вечер смотрели телевизор.'],
            ['While I was walking, I met Anna.', 'Пока я гулял, я встретил Анну.'], ['Were you working at that time?', 'Ты работал в то время?']],
          g: [['I was ___ when you called.', 'sleeping', ['sleep', 'slept', 'sleeping']], ['She ___ cooking at 7 o\'clock.', 'was', ['was', 'were', 'is']], ['What ___ you doing yesterday?', 'were', ['was', 'were', 'did']],
            ['He ___ listening.', 'wasn\'t', ['wasn\'t', 'didn\'t', 'weren\'t']], ['While I ___ walking, I met Anna.', 'was', ['was', 'were', 'am']], ['They were playing when it ___ to rain.', 'started', ['started', 'was starting', 'starts']],
            ['We ___ watching TV all evening.', 'were', ['was', 'were', 'are']], ['___ you working at that time?', 'Were', ['Was', 'Were', 'Did']]] },
        { t: 'Надо и стоит: must / have to / should',
          s: [['I have to work tomorrow.', 'Мне завтра нужно работать.'], ['You should see a doctor.', 'Тебе стоит сходить к врачу.'], ['We must be careful.', 'Мы должны быть осторожны.'],
            ['You don\'t have to come.', 'Тебе не обязательно приходить.'], ['You mustn\'t smoke here.', 'Здесь нельзя курить.'], ['She has to get up early.', 'Ей приходится рано вставать.'],
            ['Should I call him?', 'Мне позвонить ему?'], ['You shouldn\'t eat so much sugar.', 'Тебе не стоит есть столько сахара.'], ['Do I have to pay now?', 'Мне нужно платить сейчас?']],
          g: [['You ___ see a doctor.', 'should', ['should', 'have', 'must to']], ['She ___ to get up early.', 'has', ['has', 'have', 'must']], ['You ___ smoke here. It is forbidden.', 'mustn\'t', ['mustn\'t', 'don\'t have to', 'shouldn\'t to']],
            ['You don\'t have ___ come.', 'to', ['to', '—', 'for']], ['___ I call him?', 'Should', ['Should', 'Must to', 'Have']], ['Do I ___ to pay now?', 'have', ['have', 'has', 'must']],
            ['We ___ be careful.', 'must', ['must', 'must to', 'have']], ['You ___ eat so much sugar.', 'shouldn\'t', ['shouldn\'t', 'don\'t should', 'haven\'t']]] },
        { t: 'Сколько: some / any / much / many',
          s: [['I need some water.', 'Мне нужно немного воды.'], ['Do you have any money?', 'У тебя есть деньги?'], ['There aren\'t any eggs.', 'Яиц нет.'], ['How much does it cost?', 'Сколько это стоит?'],
            ['How many people were there?', 'Сколько там было людей?'], ['I don\'t have much time.', 'У меня мало времени.'], ['She has a lot of friends.', 'У неё много друзей.'], ['There is a little milk left.', 'Осталось немного молока.'],
            ['I have a few questions.', 'У меня есть несколько вопросов.']],
          g: [['I need ___ water.', 'some', ['some', 'any', 'many']], ['Do you have ___ money?', 'any', ['some', 'any', 'many']], ['How ___ does it cost?', 'much', ['much', 'many', 'lot']],
            ['How ___ people were there?', 'many', ['much', 'many', 'lot']], ['I don\'t have ___ time.', 'much', ['much', 'many', 'few']], ['She has a ___ of friends.', 'lot', ['lot', 'lots', 'many']],
            ['I have a ___ questions.', 'few', ['few', 'little', 'much']], ['There is a ___ milk left.', 'little', ['few', 'little', 'many']]] },
      ],
    },
    {
      id: 'B1', name: 'Intermediate', ru: 'Средний', list: 'PLD6SPjEPomatazRf3GcTCElczAqjObaRH', ids: { 3: 'vJNw-79qg1c' },
      can: ['Поддерживаешь разговор на знакомые темы без подготовки', 'Говоришь «если бы…» и пересказываешь чужие слова', 'Понимаешь главное в видео и сериалах с субтитрами'],
      blocks: [
        { t: 'Реальное условие: If it rains, I will…',
          s: [['If it rains, I will stay at home.', 'Если пойдёт дождь, я останусь дома.'], ['If you call me, I will come.', 'Если ты позвонишь мне, я приду.'], ['I will help you if I have time.', 'Я помогу тебе, если будет время.'],
            ['If she doesn\'t hurry, she will be late.', 'Если она не поторопится, она опоздает.'], ['What will you do if you lose your job?', 'Что ты будешь делать, если потеряешь работу?'],
            ['If we leave now, we will catch the train.', 'Если мы выйдем сейчас, мы успеем на поезд.'], ['I won\'t go unless you go.', 'Я не пойду, если ты не пойдёшь.'], ['When I get home, I will call you.', 'Когда я приду домой, я тебе позвоню.']],
          g: [['If it ___, I will stay at home.', 'rains', ['rains', 'will rain', 'rained']], ['If you call me, I ___ come.', 'will', ['will', 'would', 'am']], ['I will help you if I ___ time.', 'have', ['have', 'will have', 'had']],
            ['If she doesn\'t hurry, she ___ be late.', 'will', ['will', 'would', 'is']], ['When I ___ home, I will call you.', 'get', ['get', 'will get', 'got']], ['I won\'t go ___ you go.', 'unless', ['unless', 'if', 'when']],
            ['If we leave now, we ___ the train.', 'will catch', ['will catch', 'catch', 'caught']], ['What will you do if you ___ your job?', 'lose', ['lose', 'will lose', 'lost']]] },
        { t: 'Нереальное условие: If I had…, I would…',
          s: [['If I had money, I would buy a house.', 'Если бы у меня были деньги, я бы купил дом.'], ['If I were you, I would call her.', 'На твоём месте я бы ей позвонил.'],
            ['What would you do if you won a million?', 'Что бы ты сделал, если бы выиграл миллион?'], ['If he studied more, he would pass the exam.', 'Если бы он больше учился, он бы сдал экзамен.'],
            ['I would travel more if I had time.', 'Я бы больше путешествовал, если бы было время.'], ['If it weren\'t so cold, we would go out.', 'Если бы не было так холодно, мы бы вышли на улицу.'],
            ['She would be happier if she lived by the sea.', 'Она была бы счастливее, если бы жила у моря.'], ['If I knew the answer, I would tell you.', 'Если бы я знал ответ, я бы тебе сказал.']],
          g: [['If I ___ money, I would buy a house.', 'had', ['have', 'had', 'would have']], ['If I ___ you, I would call her.', 'were', ['am', 'were', 'will be']], ['What ___ you do if you won a million?', 'would', ['will', 'would', 'do']],
            ['If he studied more, he ___ pass the exam.', 'would', ['will', 'would', 'is']], ['I would travel more if I ___ time.', 'had', ['have', 'had', 'will have']], ['If I ___ the answer, I would tell you.', 'knew', ['know', 'knew', 'known']],
            ['She would be happier if she ___ by the sea.', 'lived', ['lives', 'lived', 'would live']], ['If it ___ so cold, we would go out.', 'weren\'t', ['isn\'t', 'weren\'t', 'won\'t be']]] },
        { t: 'Пассив: is made / was built',
          s: [['This bridge was built in 1900.', 'Этот мост построили в 1900 году.'], ['English is spoken all over the world.', 'На английском говорят во всём мире.'], ['The letter was sent yesterday.', 'Письмо отправили вчера.'],
            ['My car is being repaired.', 'Мою машину сейчас ремонтируют.'], ['The film was directed by Nolan.', 'Фильм снял Нолан.'], ['These phones are made in China.', 'Эти телефоны делают в Китае.'],
            ['The meeting has been cancelled.', 'Встречу отменили.'], ['The work will be done tomorrow.', 'Работа будет сделана завтра.'], ['I was invited to the party.', 'Меня пригласили на вечеринку.']],
          g: [['This bridge was ___ in 1900.', 'built', ['build', 'built', 'building']], ['English is ___ all over the world.', 'spoken', ['spoke', 'spoken', 'speaking']], ['The letter ___ sent yesterday.', 'was', ['was', 'is', 'has']],
            ['My car is ___ repaired.', 'being', ['being', 'been', 'be']], ['The film was directed ___ Nolan.', 'by', ['by', 'from', 'with']], ['The meeting has ___ cancelled.', 'been', ['be', 'been', 'being']],
            ['The work will ___ done tomorrow.', 'be', ['be', 'been', 'is']], ['These phones ___ made in China.', 'are', ['are', 'is', 'were be']]] },
        { t: 'Давно и до сих пор: Present Perfect Continuous',
          s: [['I have been learning English for two years.', 'Я учу английский уже два года.'], ['She has been working here since May.', 'Она работает здесь с мая.'], ['How long have you been waiting?', 'Сколько ты уже ждёшь?'],
            ['It has been raining all day.', 'Дождь идёт весь день.'], ['We have been living in this flat for five years.', 'Мы живём в этой квартире пять лет.'], ['I\'m tired because I have been running.', 'Я устал, потому что бегал.'],
            ['He has been trying to call you.', 'Он пытается до тебя дозвониться.'], ['What have you been doing lately?', 'Чем ты занимался в последнее время?']],
          g: [['I have been ___ English for two years.', 'learning', ['learn', 'learned', 'learning']], ['She has been working here ___ May.', 'since', ['since', 'for', 'from']], ['How long have you ___ waiting?', 'been', ['be', 'been', 'being']],
            ['It ___ been raining all day.', 'has', ['has', 'have', 'is']], ['We have been living here ___ five years.', 'for', ['for', 'since', 'during']], ['I\'m tired because I have been ___.', 'running', ['run', 'ran', 'running']],
            ['He has been ___ to call you.', 'trying', ['try', 'tried', 'trying']], ['What have you been ___ lately?', 'doing', ['do', 'did', 'doing']]] },
        { t: 'Косвенная речь: He said that…',
          s: [['He said that he was tired.', 'Он сказал, что устал.'], ['She told me she would come.', 'Она сказала мне, что придёт.'], ['They said they had already eaten.', 'Они сказали, что уже поели.'],
            ['He asked me where I lived.', 'Он спросил меня, где я живу.'], ['She asked if I was ready.', 'Она спросила, готов ли я.'], ['He told me to wait.', 'Он сказал мне подождать.'],
            ['I said that I didn\'t know.', 'Я сказал, что не знаю.'], ['She told us not to worry.', 'Она сказала нам не волноваться.']],
          g: [['He said that he ___ tired.', 'was', ['is', 'was', 'be']], ['She told me she ___ come.', 'would', ['will', 'would', 'can']], ['They said they ___ already eaten.', 'had', ['have', 'had', 'has']],
            ['He asked me where I ___.', 'lived', ['live', 'lived', 'do live']], ['She asked ___ I was ready.', 'if', ['if', 'that', 'what']], ['He told me ___ wait.', 'to', ['to', 'that', '—']],
            ['She ___ us not to worry.', 'told', ['said', 'told', 'spoke']], ['I said that I ___ know.', 'didn\'t', ['don\'t', 'didn\'t', 'doesn\'t']]] },
        { t: 'Раньше и «который»: used to, who / which',
          s: [['I used to live in Omsk.', 'Раньше я жил в Омске.'], ['She used to smoke, but she quit.', 'Раньше она курила, но бросила.'], ['Did you use to play football?', 'Ты раньше играл в футбол?'],
            ['I didn\'t use to like coffee.', 'Раньше я не любил кофе.'], ['The man who called you is my boss.', 'Человек, который тебе звонил, — мой начальник.'], ['This is the book which I told you about.', 'Это книга, о которой я тебе говорил.'],
            ['I have a friend who lives in Canada.', 'У меня есть друг, который живёт в Канаде.'], ['The place where we met is closed now.', 'Место, где мы познакомились, теперь закрыто.']],
          g: [['I ___ to live in Omsk.', 'used', ['use', 'used', 'using']], ['Did you ___ to play football?', 'use', ['use', 'used', 'using']], ['The man ___ called you is my boss.', 'who', ['who', 'which', 'where']],
            ['This is the book ___ I told you about.', 'which', ['who', 'which', 'where']], ['The place ___ we met is closed now.', 'where', ['where', 'which', 'who']], ['I didn\'t use to ___ coffee.', 'like', ['like', 'liked', 'liking']],
            ['I have a friend ___ lives in Canada.', 'who', ['who', 'which', 'what']], ['She ___ to smoke, but she quit.', 'used', ['use', 'used', 'was used']]] },
      ],
    },
    {
      id: 'B2', name: 'Upper-Intermediate', ru: 'Выше среднего', list: 'PLD6SPjEPomasUQxxBEBNyZGbzZY6pEfPQ', ids: {},
      can: ['Свободно общаешься с носителями без сильного напряжения', 'Споришь, объясняешь точку зрения, рассуждаешь «если бы тогда…»', 'Смотришь сериалы и читаешь статьи почти без словаря'],
      blocks: [
        { t: 'Условие в прошлом: If I had known…',
          s: [['If I had known, I would have helped you.', 'Если бы я знал, я бы тебе помог.'], ['If she had left earlier, she wouldn\'t have missed the train.', 'Если бы она вышла раньше, она бы не опоздала на поезд.'],
            ['We would have won if we had played better.', 'Мы бы выиграли, если бы играли лучше.'], ['What would you have done in my place?', 'Что бы ты сделал на моём месте?'],
            ['If I hadn\'t gone to that party, I wouldn\'t have met her.', 'Если бы я не пошёл на ту вечеринку, я бы не встретил её.'], ['He would have called if he had had your number.', 'Он бы позвонил, если бы у него был твой номер.'],
            ['If it hadn\'t rained, we would have gone to the beach.', 'Если бы не было дождя, мы бы пошли на пляж.'],
            ['If you had asked me, I would have said yes.', 'Если бы ты меня спросил, я бы согласился.'], ['She wouldn\'t have been late if she had taken a taxi.', 'Она бы не опоздала, если бы взяла такси.']],
          g: [['If I had ___, I would have helped you.', 'known', ['knew', 'known', 'know']], ['If she had left earlier, she wouldn\'t ___ missed the train.', 'have', ['have', 'had', 'has']],
            ['We would have won if we ___ played better.', 'had', ['have', 'had', 'would']], ['What would you have ___ in my place?', 'done', ['did', 'done', 'do']],
            ['If I ___ gone to that party, I wouldn\'t have met her.', 'hadn\'t', ['didn\'t', 'hadn\'t', 'wouldn\'t']], ['He would have called if he had ___ your number.', 'had', ['have', 'had', 'has']],
            ['If it hadn\'t rained, we would have ___ to the beach.', 'gone', ['went', 'gone', 'go']], ['If you ___ told me, I would have come.', 'had', ['had', 'have', 'would']]] },
        { t: 'Сожаления: I wish / if only',
          s: [['I wish I had more time.', 'Жаль, что у меня мало времени.'], ['I wish I were taller.', 'Хотел бы я быть выше.'], ['I wish I hadn\'t said that.', 'Жаль, что я это сказал.'],
            ['If only I knew the truth.', 'Если бы только я знал правду.'], ['She wishes she could speak French.', 'Ей хотелось бы говорить по-французски.'], ['I wish you would stop talking.', 'Хоть бы ты перестал болтать.'],
            ['If only I had listened to you.', 'Если бы только я тебя послушал.'], ['I wish it wasn\'t raining.', 'Жаль, что идёт дождь.']],
          g: [['I wish I ___ more time.', 'had', ['have', 'had', 'will have']], ['I wish I ___ taller.', 'were', ['am', 'were', 'be']], ['I wish I hadn\'t ___ that.', 'said', ['say', 'said', 'saying']],
            ['If only I ___ listened to you.', 'had', ['have', 'had', 'did']], ['She wishes she ___ speak French.', 'could', ['can', 'could', 'will']], ['I wish you ___ stop talking.', 'would', ['will', 'would', 'are']],
            ['If only I ___ the truth.', 'knew', ['know', 'knew', 'known']], ['I wish it ___ raining.', 'wasn\'t', ['isn\'t', 'wasn\'t', 'doesn\'t']]] },
        { t: 'Предпрошедшее: Past Perfect',
          s: [['When I arrived, the train had already left.', 'Когда я приехал, поезд уже ушёл.'], ['She had never seen the sea before.', 'Она никогда раньше не видела море.'], ['I realised I had lost my wallet.', 'Я понял, что потерял кошелёк.'],
            ['They had finished dinner before we came.', 'Они закончили ужинать до того, как мы пришли.'], ['Had you met him before?', 'Ты встречал его раньше?'], ['By the time she called, I had gone to bed.', 'К тому времени, как она позвонила, я уже лёг спать.'],
            ['He was tired because he hadn\'t slept.', 'Он был уставшим, потому что не спал.'],
            ['I had already eaten when they arrived.', 'Я уже поел, когда они пришли.'], ['After she had finished school, she moved to Moscow.', 'После того как она окончила школу, она переехала в Москву.']],
          g: [['When I arrived, the train ___ already left.', 'had', ['has', 'had', 'was']], ['She had never ___ the sea before.', 'seen', ['saw', 'seen', 'see']], ['I realised I had ___ my wallet.', 'lost', ['lose', 'lost', 'losing']],
            ['By the time she called, I had ___ to bed.', 'gone', ['went', 'gone', 'go']], ['___ you met him before?', 'Had', ['Had', 'Did', 'Were']], ['He was tired because he ___ slept.', 'hadn\'t', ['hadn\'t', 'didn\'t', 'wasn\'t']],
            ['They had finished dinner ___ we came.', 'before', ['before', 'after', 'until']], ['When we got there, the film ___ already started.', 'had', ['had', 'has', 'was']]] },
        { t: 'Догадки о прошлом: must have / can\'t have',
          s: [['He must have forgotten.', 'Он, должно быть, забыл.'], ['She can\'t have done it.', 'Не может быть, чтобы она это сделала.'], ['They might have missed the bus.', 'Возможно, они опоздали на автобус.'],
            ['You should have told me.', 'Тебе следовало сказать мне.'], ['I could have won.', 'Я мог бы выиграть.'], ['It must be true.', 'Должно быть, это правда.'], ['He may be at home now.', 'Возможно, он сейчас дома.'],
            ['You shouldn\'t have bought it.', 'Не стоило тебе это покупать.']],
          g: [['He must have ___.', 'forgotten', ['forgot', 'forgotten', 'forget']], ['She ___ have done it — she was with me.', 'can\'t', ['can\'t', 'must', 'should']], ['They ___ have missed the bus, I\'m not sure.', 'might', ['might', 'must', 'can\'t']],
            ['You should have ___ me.', 'told', ['tell', 'told', 'telling']], ['I could ___ won.', 'have', ['have', 'had', 'of']], ['It ___ be true, everybody says so.', 'must', ['must', 'can\'t', 'shouldn\'t']],
            ['You shouldn\'t have ___ it.', 'bought', ['buy', 'bought', 'buyed']], ['He ___ be at home now, maybe.', 'may', ['may', 'must', 'can\'t']]] },
        { t: '-ing или to: stop doing / stop to do',
          s: [['I stopped smoking.', 'Я бросил курить.'], ['I stopped to smoke.', 'Я остановился, чтобы покурить.'], ['Remember to call your mum.', 'Не забудь позвонить маме.'], ['I remember meeting him.', 'Я помню, как встретил его.'],
            ['I enjoy reading.', 'Мне нравится читать.'], ['She decided to leave.', 'Она решила уйти.'], ['Try turning it off and on again.', 'Попробуй выключить и снова включить.'], ['I\'m looking forward to seeing you.', 'С нетерпением жду встречи с тобой.'],
            ['He avoided answering.', 'Он уклонился от ответа.'], ['We agreed to help.', 'Мы согласились помочь.']],
          g: [['I enjoy ___.', 'reading', ['read', 'to read', 'reading']], ['She decided ___ leave.', 'to', ['to', '—', 'for']], ['I\'m looking forward to ___ you.', 'seeing', ['see', 'seeing', 'saw']],
            ['He avoided ___.', 'answering', ['answer', 'to answer', 'answering']], ['Remember ___ your mum tonight.', 'to call', ['to call', 'calling', 'call']], ['I remember ___ him in 2015.', 'meeting', ['to meet', 'meeting', 'meet']],
            ['We agreed ___ help.', 'to', ['to', '—', 'for']], ['I stopped ___. I don\'t smoke any more.', 'smoking', ['to smoke', 'smoking', 'smoke']]] },
        { t: 'Будущее в процессе и к сроку: will be doing / will have done',
          s: [['This time tomorrow I will be flying to Rome.', 'Завтра в это время я буду лететь в Рим.'], ['I will have finished the project by Friday.', 'К пятнице я закончу проект.'],
            ['Will you be using the car tonight?', 'Ты будешь брать машину сегодня вечером?'], ['By 2030 I will have saved enough money.', 'К 2030 году я накоплю достаточно денег.'],
            ['Don\'t call at eight, I will be sleeping.', 'Не звони в восемь, я буду спать.'], ['She will have left by the time you arrive.', 'Она уже уйдёт к тому времени, как ты приедешь.'],
            ['Next year we will have been married for ten years.', 'В следующем году мы будем женаты десять лет.'],
            ['In ten years I will have paid off the loan.', 'Через десять лет я выплачу кредит.'], ['Will you be working tomorrow evening?', 'Ты будешь работать завтра вечером?']],
          g: [['This time tomorrow I will be ___ to Rome.', 'flying', ['fly', 'flying', 'flown']], ['I will have ___ the project by Friday.', 'finished', ['finish', 'finished', 'finishing']],
            ['Will you be ___ the car tonight?', 'using', ['use', 'using', 'used']], ['By 2030 I will ___ saved enough money.', 'have', ['have', 'had', 'be']], ['Don\'t call at eight, I will ___ sleeping.', 'be', ['be', 'have', 'been']],
            ['She will have left ___ the time you arrive.', 'by', ['by', 'until', 'at']], ['Next year we will have ___ married for ten years.', 'been', ['be', 'been', 'being']], ['At nine I will be ___ dinner.', 'having', ['have', 'having', 'had']]] },
      ],
    },
    {
      id: 'C1', name: 'Advanced', ru: 'Продвинутый', list: 'PLD6SPjEPomasDsMM75DZgg4ON0nyd6dN3', ids: {},
      can: ['Говоришь бегло и точно, сложными конструкциями', 'Понимаешь длинную речь, лекции и фильмы без субтитров', 'Можешь учиться и работать на английском'],
      blocks: [
        { t: 'Смешанные условия: If I had…, I would be…',
          s: [['If I had taken that job, I would be rich now.', 'Если бы я тогда взял ту работу, я бы сейчас был богат.'], ['If she were more careful, she wouldn\'t have crashed the car.', 'Будь она внимательнее, она бы не разбила машину.'],
            ['If I hadn\'t missed the flight, I would be in Paris now.', 'Если бы я не опоздал на рейс, я бы сейчас был в Париже.'], ['If he spoke English, he would have got the job.', 'Если бы он говорил по-английски, его бы взяли на ту работу.'],
            ['We wouldn\'t be lost if we had taken the map.', 'Мы бы не заблудились, если бы взяли карту.'], ['If I had studied medicine, I would be a doctor today.', 'Если бы я изучал медицину, я бы сегодня был врачом.'],
            ['If I were braver, I would have told her the truth.', 'Будь я смелее, я бы сказал ей правду.'], ['If she hadn\'t moved abroad, she wouldn\'t speak English so well.', 'Если бы она не переехала за границу, она бы не говорила так хорошо по-английски.'],
            ['If we had saved more, we wouldn\'t be in debt now.', 'Если бы мы больше копили, мы бы сейчас не были в долгах.']],
          g: [['If I had taken that job, I ___ be rich now.', 'would', ['would', 'will', 'had']], ['If I hadn\'t missed the flight, I would ___ in Paris now.', 'be', ['be', 'have been', 'being']],
            ['If she ___ more careful, she wouldn\'t have crashed the car.', 'were', ['were', 'had', 'is']], ['If he spoke English, he would ___ got the job.', 'have', ['have', 'had', 'be']],
            ['We wouldn\'t be lost if we ___ taken the map.', 'had', ['had', 'have', 'would']], ['If I had studied medicine, I would ___ a doctor today.', 'be', ['be', 'been', 'have']]] },
        { t: 'Инверсия: Never have I…, Not only…',
          s: [['Never have I seen such a beautiful place.', 'Никогда я не видел такого красивого места.'], ['Not only is he smart, but he is also kind.', 'Он не только умный, но и добрый.'],
            ['Hardly had I arrived when it started to rain.', 'Едва я приехал, как пошёл дождь.'], ['Rarely do we meet such people.', 'Редко встречаешь таких людей.'], ['Under no circumstances should you open this door.', 'Ни при каких обстоятельствах не открывай эту дверь.'],
            ['Only then did I understand the truth.', 'Только тогда я понял правду.'], ['Had I known, I would have come.', 'Знай я об этом, я бы пришёл.'], ['Should you need help, call me.', 'Если понадобится помощь, позвони мне.']],
          g: [['Never ___ I seen such a beautiful place.', 'have', ['have', 'I have', 'did']], ['Not only ___ he smart, but he is also kind.', 'is', ['is', 'he is', 'does']], ['Hardly ___ I arrived when it started to rain.', 'had', ['had', 'have', 'did']],
            ['Rarely ___ we meet such people.', 'do', ['do', 'we', 'are']], ['Only then ___ I understand the truth.', 'did', ['did', 'had', 'I']], ['___ I known, I would have come.', 'Had', ['Had', 'If', 'Have']],
            ['___ you need help, call me.', 'Should', ['Should', 'Would', 'Do']], ['Under no circumstances ___ you open this door.', 'should', ['should', 'you should', 'do']]] },
        { t: 'Выделение: What I need is…, It was… who…',
          s: [['What I need is a long holiday.', 'Что мне нужно, так это долгий отпуск.'], ['It was my brother who told me.', 'Это мой брат мне рассказал.'], ['What surprised me was his reaction.', 'Что меня удивило, так это его реакция.'],
            ['It is the price that worries me.', 'Меня беспокоит именно цена.'], ['All I want is some peace and quiet.', 'Всё, чего я хочу, — немного тишины и покоя.'], ['The reason why I left is simple.', 'Причина, по которой я ушёл, проста.'],
            ['It wasn\'t until midnight that he came home.', 'Он пришёл домой только в полночь.'],
            ['What I love about this city is the people.', 'Больше всего в этом городе я люблю людей.'], ['It was in Paris that we first met.', 'Впервые мы встретились именно в Париже.']],
          g: [['___ I need is a long holiday.', 'What', ['What', 'That', 'Which']], ['It was my brother ___ told me.', 'who', ['who', 'what', 'which']], ['What surprised me ___ his reaction.', 'was', ['was', 'were', 'it was']],
            ['It is the price ___ worries me.', 'that', ['that', 'what', 'who']], ['All I want ___ some peace and quiet.', 'is', ['is', 'are', 'be']], ['It wasn\'t ___ midnight that he came home.', 'until', ['until', 'by', 'before']],
            ['The reason ___ I left is simple.', 'why', ['why', 'what', 'because']]] },
        { t: 'Безличный пассив: It is said that…, He is believed to…',
          s: [['It is said that he is a millionaire.', 'Говорят, что он миллионер.'], ['He is believed to be in London.', 'Считается, что он в Лондоне.'], ['The company is reported to have lost millions.', 'Сообщается, что компания потеряла миллионы.'],
            ['It is thought that the castle was built in 1200.', 'Считается, что замок построили в 1200 году.'], ['She is known to be very strict.', 'Известно, что она очень строгая.'], ['I had my hair cut yesterday.', 'Вчера я подстригся.'],
            ['We are having the kitchen painted.', 'Нам красят кухню.'], ['He is expected to win.', 'Ожидается, что он победит.']],
          g: [['It is ___ that he is a millionaire.', 'said', ['said', 'saying', 'say']], ['He is believed ___ be in London.', 'to', ['to', 'that', '—']], ['The company is reported to ___ lost millions.', 'have', ['have', 'has', 'had']],
            ['It is thought ___ the castle was built in 1200.', 'that', ['that', 'what', 'to']], ['I had my hair ___ yesterday.', 'cut', ['cut', 'cutting', 'to cut']], ['We are having the kitchen ___.', 'painted', ['painted', 'paint', 'painting']],
            ['He is expected ___ win.', 'to', ['to', 'that', '—']], ['She is known to ___ very strict.', 'be', ['be', 'being', 'is']]] },
        { t: 'Причастные обороты: Having finished…, Not knowing…',
          s: [['Having finished the work, he went home.', 'Закончив работу, он пошёл домой.'], ['Not knowing what to say, I kept silent.', 'Не зная, что сказать, я промолчал.'], ['Walking down the street, I saw an old friend.', 'Идя по улице, я увидел старого друга.'],
            ['Written in 1900, the book is still popular.', 'Написанная в 1900 году, книга до сих пор популярна.'], ['Feeling tired, she went to bed early.', 'Чувствуя усталость, она рано легла спать.'],
            ['Having lived abroad, he speaks three languages.', 'Пожив за границей, он говорит на трёх языках.'], ['Given the chance, I would do it again.', 'Будь у меня возможность, я бы сделал это снова.'],
            ['Having said that, I agree with you.', 'При этом я с тобой согласен.'], ['Seen from above, the city looks tiny.', 'Если смотреть сверху, город кажется крошечным.']],
          g: [['___ finished the work, he went home.', 'Having', ['Having', 'Have', 'Had']], ['Not ___ what to say, I kept silent.', 'knowing', ['knowing', 'known', 'know']], ['___ down the street, I saw an old friend.', 'Walking', ['Walking', 'Walked', 'Walk']],
            ['___ in 1900, the book is still popular.', 'Written', ['Written', 'Writing', 'Wrote']], ['___ tired, she went to bed early.', 'Feeling', ['Feeling', 'Felt', 'Feel']], ['___ the chance, I would do it again.', 'Given', ['Given', 'Giving', 'Gave']],
            ['Having ___ abroad, he speaks three languages.', 'lived', ['lived', 'living', 'live']]] },
        { t: 'Тонкости: would rather, it\'s time, as if, suggest',
          s: [['I would rather stay at home.', 'Я бы лучше остался дома.'], ['I\'d rather you didn\'t smoke here.', 'Я бы предпочёл, чтобы ты здесь не курил.'], ['It\'s time we went home.', 'Нам пора домой.'],
            ['He talks as if he knew everything.', 'Он говорит так, будто знает всё.'], ['I suggest that he see a doctor.', 'Я предлагаю ему сходить к врачу.'], ['It is essential that she be on time.', 'Крайне важно, чтобы она пришла вовремя.'],
            ['You had better hurry.', 'Тебе лучше поторопиться.'], ['I\'d rather not talk about it.', 'Я бы предпочёл об этом не говорить.']],
          g: [['I would rather ___ at home.', 'stay', ['stay', 'to stay', 'staying']], ['I\'d rather you ___ smoke here.', 'didn\'t', ['didn\'t', 'don\'t', 'won\'t']], ['It\'s time we ___ home.', 'went', ['go', 'went', 'will go']],
            ['He talks as if he ___ everything.', 'knew', ['knows', 'knew', 'known']], ['I suggest that he ___ a doctor.', 'see', ['see', 'sees', 'to see']], ['It is essential that she ___ on time.', 'be', ['be', 'is', 'was']],
            ['You had better ___.', 'hurry', ['hurry', 'to hurry', 'hurrying']], ['I\'d rather ___ talk about it.', 'not', ['not', 'don\'t', 'no']]] },
      ],
    },
  ];
  const IDX = LEVELS.reduce((m, L, i) => { m[L.id] = i; return m; }, {});

  /* ---------- даты и выбор ---------- */
  const today = () => State.todayKey();
  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d + n);
    return State.dateKey(dt);
  }
  // k разных элементов, по-разному для разных дней
  function pick(arr, k, seed) {
    const out = [];
    const n = arr.length;
    if (!n) return out;
    let j = ((seed * 7) % n + n) % n;
    const step = n > 1 ? [5, 3, 7, 1].find((s) => n % s !== 0 || s === 1) : 1;
    for (let t = 0; out.length < Math.min(k, n) && t < n * 2; t += 1) {
      if (!out.includes(arr[j])) out.push(arr[j]);
      j = (j + step) % n;
    }
    return out;
  }
  const words = (s) => String(s).replace(/[.?!]+$/, '').split(/\s+/).map((w) => w.replace(/^[«"(]+|[»",;:)]+$/g, '')).filter((w) => w && w !== '—' && w !== '-');
  function sentence(lv, bi, si) {
    const [en, ru] = LEVELS[lv].blocks[bi].s[si];
    return { key: `${lv}.${bi}.${si}`, en, ru, words: words(en), ruWords: words(ru) };
  }
  function gap(lv, bi, gi) {
    const [q, a, o] = LEVELS[lv].blocks[bi].g[gi];
    return { key: `g${lv}.${bi}.${gi}`, q, a, o, lv, bi };
  }
  const sentencesOf = (lv, blocks) => blocks.flatMap((bi) => LEVELS[lv].blocks[bi].s.map((_, si) => sentence(lv, bi, si)));
  const gapsOf = (lv, blocks) => blocks.flatMap((bi) => LEVELS[lv].blocks[bi].g.map((_, gi) => gap(lv, bi, gi)));
  const byKey = (key) => {
    const [lv, bi, si] = key.split('.').map(Number);
    const L = LEVELS[lv];
    return L && L.blocks[bi] && L.blocks[bi].s[si] ? sentence(lv, bi, si) : null;
  };

  /* ---------- слова и правила (содержание — js/english-content.js) ---------- */
  const EC = typeof EnglishContent !== 'undefined' ? EnglishContent : { RULES: [], WORDS: [] };
  const WORDS = LEVELS.map((_, lv) => EC.WORDS[lv] || []);
  const rulesOf = (lv, bi) => ((EC.RULES[lv] || [])[bi]) || null;
  const NEW_WORDS = 4;        // новых слов в обычный день
  const KNOWN_BOX = 3;        // слово «выучено», когда угадано по интервалам 3 раза подряд
  // слово с вариантами ответа (переводы и английские слова того же уровня)
  function wordItem(key, extra) {
    const [lv, i] = key.slice(1).split('.').map(Number);
    const list = WORDS[lv];
    if (!list || !list[i]) return null;
    const others = [7, 19, 31, 43, 57].map((d) => (i + d) % list.length).filter((j) => j !== i);
    const three = [...new Set(others)].slice(0, 3);
    const rot = i % 4; // правильный ответ не всегда первым
    const ru = three.map((j) => list[j][1]);
    const en = three.map((j) => list[j][0]);
    ru.splice(rot, 0, list[i][1]);
    en.splice(rot, 0, list[i][0]);
    return Object.assign({ key, en: list[i][0], ru: list[i][1], lv, word: true, o: ru, oe: en }, extra || {});
  }
  const wordsDue = (p) => {
    const k = today();
    return Object.keys(p.wsrs || {}).filter((x) => p.wsrs[x].d <= k && wordItem(x))
      .sort((a, b) => (p.wsrs[a].d < p.wsrs[b].d ? -1 : p.wsrs[a].d > p.wsrs[b].d ? 1 : p.wsrs[a].b - p.wsrs[b].b));
  };
  // новые слова по порядку: сначала своего уровня, кончились — следующего
  function newWordKeys(p, n) {
    const out = [];
    for (let lv = p.level; lv < LEVELS.length && lv <= p.level + 1 && out.length < n; lv += 1) {
      for (let i = (p.wnext || {})[lv] || 0; i < WORDS[lv].length && out.length < n; i += 1) {
        const key = `w${lv}.${i}`;
        if (!(p.wsrs || {})[key]) out.push(key);
      }
    }
    return out;
  }
  function wordsStep(newKeys, dueKeys, title, sub) {
    const items = newKeys.map((k) => wordItem(k, { isNew: true })).concat(dueKeys.map((k) => wordItem(k, { due: true }))).filter(Boolean);
    if (!items.length) return [];
    const nNew = items.filter((x) => x.isNew).length;
    const nDue = items.length - nNew;
    return [{ type: 'words', title: title || 'Слова', sub: sub || [nNew ? `${nNew} новых` : '', nDue ? `${nDue} повторить` : ''].filter(Boolean).join(' · '), items }];
  }
  const ruleStep = (lv, bi, title) => {
    const cards = rulesOf(lv, bi);
    return cards ? [{ type: 'read', title: title || `Правило: ${LEVELS[lv].blocks[bi].t}`, sub: 'Простыми словами · 1 минута', cards, rule: true }] : [];
  };

  /* ---------- состояние пути ---------- */
  function init(opts) {
    const o = opts || {};
    return {
      level: 0, lesson: 1, part: 1, videoMin: [20, 30, 45].includes(o.min) ? o.min : 30,
      confirmed: {}, placed: {}, tries: {}, weak: {}, srs: {}, learned: 0,
      review: 0, ended: {}, plan: null, early: null,
      wsrs: {}, wnext: {}, ruleSeen: {},
      placement: o.start === 'place' ? 'todo' : null,
    };
  }
  /* старый 30-дневный курс → путь: тот же урок A0 */
  function migrate(st) {
    if (st.path) return st.path;
    const p = init({ min: 30 });
    p.lesson = Math.min(LESSONS, Math.floor(((st.day || 1) - 1) / 3) + 1);
    st.path = p;
    st.finished = null;
    st.extra = 0;
    return p;
  }
  // у пути, начатого до появления слов и правил, этих полей ещё нет
  const P = (st) => {
    const p = migrate(st);
    if (!p.wsrs) p.wsrs = {};
    if (!p.wnext) p.wnext = {};
    if (!p.ruleSeen) p.ruleSeen = {};
    return p;
  };

  /* ---------- урок дня ---------- */
  const blockOf = (lv, lesson) => Math.min(LEVELS[lv].blocks.length - 1, Math.floor(((lesson - 1) * LEVELS[lv].blocks.length) / LESSONS));
  const partsPer = (p) => Math.max(1, Math.ceil(LESSON_MIN / (p.videoMin || 30)));
  const dueKeys = (p) => {
    const k = today();
    return Object.keys(p.srs || {}).filter((x) => p.srs[x].d <= k && byKey(x))
      .sort((a, b) => (p.srs[a].d < p.srs[b].d ? -1 : p.srs[a].d > p.srs[b].d ? 1 : p.srs[a].b - p.srs[b].b));
  };
  const weakBlocks = (p, lv) => {
    const n = LEVELS[lv].blocks.length;
    return Array.from({ length: n }, (_, bi) => bi)
      .sort((a, b) => ((p.weak || {})[`${lv}.${b}`] || 0) - ((p.weak || {})[`${lv}.${a}`] || 0));
  };

  /* план дня фиксируется, чтобы шаги не менялись, пока проходишь урок */
  function plan(st) {
    const p = P(st);
    const k = today();
    if (p.plan && p.plan.date === k) return p.plan;
    const kind = p.placement === 'todo' ? 'place' : p.review > 0 ? 'review' : p.lesson > LESSONS ? 'exam' : 'lesson';
    const pl = { date: k, kind, level: p.level, lesson: p.lesson, part: p.part, srs: dueKeys(p).slice(0, kind === 'exam' || kind === 'place' ? 0 : 6) };
    // правило темы — в первый день новой темы; слова — новые в урок, повторение в урок и в повторение
    const bi = blockOf(p.level, Math.min(p.lesson, LESSONS));
    pl.rule = kind === 'lesson' && !p.ruleSeen[`${p.level}.${bi}`];
    pl.wn = kind === 'lesson' ? newWordKeys(p, NEW_WORDS) : [];
    pl.wd = kind === 'lesson' || kind === 'review' ? wordsDue(p).slice(0, 6) : [];
    const sig = (x) => (x ? `${x.kind}|${x.level}|${x.lesson}|${x.part}|${x.srs.length ? 1 : 0}|${x.rule ? 1 : 0}|${(x.wn || []).length + (x.wd || []).length ? 1 : 0}` : '');

    if (p.plan && sig(p.plan) !== sig(pl)) st.prog = {};
    p.plan = pl;
    return pl;
  }

  const speakStep = (items, title, sub, pass) => ({ type: 'speak', title, sub, items, pass });

  function today_(st) {
    const p = P(st);
    const pl = plan(st);
    const lv = pl.level;
    const L = LEVELS[lv];
    const srsItems = pl.srs.map(byKey).filter(Boolean);
    const srsStep = srsItems.length ? [{ type: 'puzzle-en', title: 'Повторение: твои фразы', sub: `Пора вспомнить: ${srsItems.length} шт. — так они уйдут в долгую память`, items: srsItems, srs: true }] : [];

    if (pl.kind === 'place') {
      const items = [];
      LEVELS.forEach((X, li) => {
        for (let k = 0; k < 5; k += 1) { const bi = k % X.blocks.length; items.push(gap(li, bi, (k * 3) % X.blocks[bi].g.length)); }
      });
      return { kind: 'place', title: 'Определяем твой уровень', sub: '30 вопросов от простых к сложным · ~10 минут',
        steps: [{ type: 'test', title: 'Тест на уровень', sub: 'Не знаешь — выбирай наугад, это нормально', items, place: true }] };
    }

    if (pl.kind === 'exam') {
      const all = L.blocks.map((_, bi) => bi);
      const seed = (p.tries[L.id] || 0) * 11 + 3;
      return {
        kind: 'exam', check: 'final', title: `🏁 Экзамен уровня ${L.id}`, sub: 'Сдал — уровень подтверждён и открывается следующий',
        steps: [
          { type: 'test', title: 'Грамматика', sub: '15 вопросов · нужно 80%', items: pick(gapsOf(lv, all), 15, seed), pass: PASS.test },
          { type: 'listening', title: 'Аудирование', sub: '5 фраз на слух · нужно 70%', items: pick(sentencesOf(lv, all), 5, seed + 5), pass: PASS.listening },
          { type: 'puzzle-en', title: 'Перевод на английский', sub: '5 предложений · нужно 70%', items: pick(sentencesOf(lv, all), 5, seed + 9), pass: PASS['puzzle-en'] },
          speakStep(pick(sentencesOf(lv, all), 4, seed + 13), 'Говорение', '4 фразы вслух · нужно 60%', PASS.speak),
          { type: 'words', title: 'Слова уровня', sub: '10 слов · нужно 70%', pass: PASS.words, exam: true,
            items: pick(WORDS[lv].map((_, i) => `w${lv}.${i}`), 10, seed + 17).map((k) => wordItem(k)).filter(Boolean) },
        ],
      };
    }

    if (pl.kind === 'review') {
      const wb = weakBlocks(p, lv).slice(0, 2);
      const seed = p.review * 5 + (p.tries[L.id] || 0);
      const left = REVIEW_DAYS - p.review + 1;
      return {
        kind: 'review', title: `Повторение перед пересдачей ${L.id} · ${left} из ${REVIEW_DAYS}`, sub: `Слабые темы: ${wb.map((bi) => L.blocks[bi].t).join(', ')}`,
        steps: ruleStep(lv, wb[0], `Правило слабой темы: ${L.blocks[wb[0]].t}`).concat(wordsStep([], pl.wd || [], 'Слова: повторение'), srsStep, [
          { type: 'puzzle-en', title: 'Пазл на изучаемом языке', sub: 'Слабые темы', items: pick(sentencesOf(lv, wb), 5, seed) },
          { type: 'listening', title: 'Аудирование', sub: 'Переведи услышанное', items: pick(sentencesOf(lv, wb), 3, seed + 4) },
          { type: 'test', title: 'Тест', sub: 'Заполни пропуск', items: pick(gapsOf(lv, wb), 8, seed + 2) },
          speakStep(pick(sentencesOf(lv, wb), 3, seed + 6), 'Говорение', 'Скажи вслух по-английски'),
        ]),
      };
    }

    // обычный день: кусок видео + упражнения по теме урока
    const bi = blockOf(lv, pl.lesson);
    const B = L.blocks[bi];
    const bank = sentencesOf(lv, [bi]);
    const seed = pl.lesson * 3 + pl.part;
    const key = `${L.id}-${pl.lesson}`;
    return {
      kind: 'lesson', title: `${L.id} · урок ${pl.lesson}: ${B.t}`, sub: `Видео ~${p.videoMin} мин (часть ${pl.part}) + упражнения ~12 мин`,
      steps: [
        { type: 'video', title: `Видеоурок ${pl.lesson} · ${L.id}`, sub: `Смотри ~${p.videoMin} минут — продолжишь с того же места`,
          video: { id: L.ids[pl.lesson] || null, list: L.list, index: pl.lesson - 1, lesson: key, num: pl.lesson, minutes: p.videoMin, start: 0 }, path: true },
      ].concat(pl.rule ? ruleStep(lv, bi) : [], wordsStep(pl.wn || [], pl.wd || []), srsStep, [
        { type: 'puzzle-en', title: 'Пазл на изучаемом языке', sub: 'Составление предложения', items: pick(bank, pl.rule ? 3 : 4, seed) },
        { type: 'puzzle-ru', title: 'Пазл на родном языке', sub: 'Составление предложения', items: pick(bank, 2, seed + 4) },
        { type: 'listening', title: 'Аудирование', sub: 'Переведите услышанное предложение', items: pick(bank, 3, seed + 8) },
        { type: 'test', title: 'Тест', sub: 'Заполните пропуск', items: pick(gapsOf(lv, [bi]), 5, seed) },
        speakStep(pick(bank, 2, seed + 11), 'Говорение', 'Скажи по-английски вслух'),
      ]),
    };
  }

  /* ---------- лёгкий день: 5 минут, когда нет сил ----------
     Фразы, которые пора повторить (или 4 фразы текущей темы), и одна фраза вслух.
     Урок и план дня не трогаем — завтра продолжишь с того же места. */
  function lightDay(st) {
    const p = P(st);
    const lv = Math.min(p.level, LEVELS.length - 1);
    const bi = blockOf(lv, Math.min(p.lesson, LESSONS));
    const bank = sentencesOf(lv, [bi]);
    const seed = Number(today().replace(/-/g, '')) % 97;
    const due = dueKeys(p).slice(0, 4).map(byKey).filter(Boolean);
    const items = due.length >= 3 ? due : due.concat(pick(bank.filter((x) => !due.some((d) => d.key === x.key)), 4 - due.length, seed));
    return {
      kind: 'light', light: true, title: '😮‍💨 Лёгкий день', sub: '5 минут — серия не прервётся, урок останется на завтра',
      steps: wordsStep([], wordsDue(p).slice(0, 5), 'Слова: повторение').concat([
        { type: 'puzzle-en', title: due.length ? 'Повторение: твои фразы' : 'Пазл на изучаемом языке', sub: `${items.length} фразы`, items, srs: due.length > 0 },
        speakStep(pick(bank, 1, seed + 5), 'Говорение', 'Одна фраза вслух'),
      ]),
    };
  }

  /* ---------- повторить слова в любой момент (на день не влияет) ----------
     Пора повторить — их; нет — 8 уже знакомых слов вперемешку. */
  function practice(st) {
    const p = P(st);
    const due = wordsDue(p).slice(0, 10);
    const keys = due.length ? due : pick(Object.keys(p.wsrs).filter((k) => wordItem(k)), 8, Number(today().replace(/-/g, '')) % 89);
    if (!keys.length) return null;
    return { type: 'words', title: 'Повторить слова', sub: `${keys.length} слов`, practice: true, items: keys.map((k) => wordItem(k, { due: due.includes(k) })).filter(Boolean) };
  }
  // карточки правила темы — для кнопки «📖 Правило» в уроке
  function rulesFor(st) {
    const p = P(st);
    const lv = Math.min(p.level, LEVELS.length - 1);
    const bi = blockOf(lv, Math.min(p.lesson, LESSONS));
    const cards = rulesOf(lv, bi);
    return cards ? { title: LEVELS[lv].blocks[bi].t, cards } : null;
  }
  // словарь по уровням: сколько слов в работе и сколько выучено
  function wordStats(st) {
    const p = P(st);
    const per = LEVELS.map((L, lv) => ({ id: L.id, total: WORDS[lv].length, seen: 0, known: 0 }));
    Object.keys(p.wsrs).forEach((k) => {
      const lv = Number(k.slice(1).split('.')[0]);
      if (!per[lv]) return;
      per[lv].seen += 1;
      if (p.wsrs[k].b >= KNOWN_BOX) per[lv].known += 1;
    });
    return { per, seen: per.reduce((a, x) => a + x.seen, 0), known: per.reduce((a, x) => a + x.known, 0), total: per.reduce((a, x) => a + x.total, 0), due: wordsDue(p).length };
  }

  /* ---------- ответы: интервальное повторение и слабые темы ---------- */
  function onItem(st, step, item, ok) {
    const p = P(st);
    if (item.place) return;
    // слово: новое → в повторение; угадал при повторении → интервал растёт, ошибся → завтра снова
    if (item.word) {
      const cur = p.wsrs[item.key];
      if (item.isNew) {
        const [lv, i] = item.key.slice(1).split('.').map(Number);
        p.wnext[lv] = Math.max(p.wnext[lv] || 0, i + 1);
      }
      if (!ok) { p.wsrs[item.key] = { b: 0, d: addDays(today(), 1) }; return; }
      if (!cur) { p.wsrs[item.key] = { b: 1, d: addDays(today(), SRS_DAYS[1]) }; return; }
      if (!item.due) return; // уже в повторении, а сегодня оно не по графику — интервал не трогаем
      const b = Math.min(cur.b + 1, SRS_DAYS.length);
      p.wsrs[item.key] = { b, d: b >= SRS_DAYS.length ? '9999-12-31' : addDays(today(), SRS_DAYS[b]) };
      return;
    }

    if (item.q && item.lv != null) {
      if (!ok) { const k = `${item.lv}.${item.bi}`; p.weak[k] = (p.weak[k] || 0) + 1; }
      else if (p.weak[`${item.lv}.${item.bi}`]) p.weak[`${item.lv}.${item.bi}`] -= 0.5;
      return;
    }
    if (!item.key || !byKey(item.key)) return;
    const cur = p.srs[item.key];
    const [lv, bi] = item.key.split('.').map(Number);
    if (!ok) {
      p.srs[item.key] = { b: 0, d: addDays(today(), 1) };
      const k = `${lv}.${bi}`; p.weak[k] = (p.weak[k] || 0) + 1;
      return;
    }
    if (!cur) {
      if (!step.srs) { p.srs[item.key] = { b: 1, d: addDays(today(), SRS_DAYS[1]) }; p.learned = (p.learned || 0) + 1; }
      return;
    }
    if (!step.srs) return; // уже в повторении — двигаем только в шаге повторения
    const b = cur.b + 1;
    if (b >= SRS_DAYS.length) { delete p.srs[item.key]; return; } // выучено надолго
    p.srs[item.key] = { b, d: addDays(today(), SRS_DAYS[b]) };
  }
  // тест на уровень: ответ на каждый вопрос хранится по его ключу —
  // вышел посреди теста и прошёл заново, ответы не задвоятся
  function onPlace(st, item, ok) {
    const p = P(st);
    if (!p.placeRes || typeof p.placeRes !== 'object' || Array.isArray(p.placeRes)) p.placeRes = {};
    p.placeRes[item.key] = ok ? 1 : 0;
  }
  // сколько верных ответов на уровне lv в тесте на уровень
  const placeRight = (p, lv) => Object.keys(p.placeRes || {}).filter((k) => k.indexOf(`g${lv}.`) === 0 && p.placeRes[k] === 1).length;

  /* видео урока досмотрено до конца */
  function videoEnded(st, key) {
    const p = P(st);
    p.ended = p.ended || {};
    p.ended[key] = true;
  }

  /* ---------- день закрыт ---------- */
  function complete(st, D) {
    const p = P(st);
    const pl = p.plan || {};
    const L = LEVELS[p.level];
    let msg = 'Урок дня пройден! Завтра — продолжение';
    let finished = false;
    if (D.kind === 'place') {
      // уровень засчитан, если на его 5 вопросов 4 верных ответа — и все уровни ниже тоже
      let lv = 0;
      while (lv < LEVELS.length && placeRight(p, lv) >= 4) { p.placed[LEVELS[lv].id] = today(); lv += 1; }

      p.level = Math.min(lv, LEVELS.length - 1);
      p.lesson = 1; p.part = 1;
      p.placement = 'done';
      delete p.placeRes;
      msg = lv === 0 ? 'Начинаем с A0 — с самого начала, как надо.'
        : lv >= LEVELS.length ? 'Ты сдал тест на всех уровнях! Начинаем с C1 — шлифовка до блеска.'
          : `Тест показал: начинаем с уровня ${LEVELS[p.level].id}. Уровни ниже засчитаны по тесту.`;
    } else if (D.kind === 'exam') {
      p.tries[L.id] = (p.tries[L.id] || 0) + 1;
      if (st.failed) {
        if (p.early) { p.lesson = p.early; p.early = null; msg = `Экзамен ${L.id} пока не сдан — возвращаемся к урокам, ты ещё успеешь.`; }
        else { p.review = REVIEW_DAYS; msg = `Экзамен ${L.id} пока не сдан. ${REVIEW_DAYS} дней повторения по слабым темам — и пересдача. Так и работает гарантия.`; }
      } else {
        p.confirmed[L.id] = today();
        p.early = null;
        if (p.level >= LEVELS.length - 1) { finished = true; msg = `🏆 Экзамен C1 сдан! Ты прошёл путь до продвинутого уровня.`; }
        else { p.level += 1; p.lesson = 1; p.part = 1; msg = `🏆 Уровень ${L.id} подтверждён! Открыт ${LEVELS[p.level].id}.`; }
      }
    } else if (D.kind === 'review') {
      p.review = Math.max(0, p.review - 1);
      msg = p.review ? `Повторение засчитано. Осталось ${p.review}.` : `Повторение закончено — завтра пересдача ${L.id}.`;
    } else {
      // правило темы прочитано — в следующие дни этой темы его не показываем (оно всегда есть по кнопке «📖»)
      if (pl.rule) {
        const lvR = pl.level != null ? pl.level : p.level;
        p.ruleSeen[`${lvR}.${blockOf(lvR, Math.min(pl.lesson || p.lesson, LESSONS))}`] = today();
      }
      const key = `${L.id}-${pl.lesson || p.lesson}`;
      if ((p.ended || {})[key]) {
        delete p.ended[key];
        p.lesson += 1; p.part = 1;
        msg = p.lesson > LESSONS ? `Все 50 уроков ${L.id} пройдены! Завтра — экзамен уровня.` : `Урок ${p.lesson - 1} досмотрен! Завтра — урок ${p.lesson}.`;
      } else {
        p.part += 1;
        msg = `Часть ${p.part - 1} урока ${p.lesson} пройдена! Завтра — продолжение с того же места.`;
      }
    }
    p.plan = null;
    return { msg, finished };
  }

  /* сдать экзамен досрочно (знаешь уровень — не обязательно смотреть все уроки) */
  function examNow(st) {
    const p = P(st);
    if (p.lesson > LESSONS || p.review) return;
    p.early = p.lesson;
    p.lesson = LESSONS + 1;
    p.plan = null;
    st.prog = {};
  }

  /* ---------- что показать ---------- */
  function confirmedLevel(st) {
    const p = P(st);
    let best = null;
    LEVELS.forEach((L) => { if (p.confirmed[L.id]) best = L; });
    return best;
  }
  function label(st) {
    const p = P(st);
    const L = LEVELS[p.level];
    if (p.placement === 'todo') return 'тест на уровень';
    if (p.review) return `${L.id} · повторение`;
    if (p.lesson > LESSONS) return `${L.id} · экзамен`;
    return `${L.id} · урок ${p.lesson}`;
  }
  // путь до C1 в процентах: уроки + экзамены
  function pct(st) {
    const p = P(st);
    const per = LESSONS + 1;
    const doneLv = LEVELS.reduce((a, L) => a + (p.confirmed[L.id] || p.placed[L.id] ? 1 : 0), 0);
    const inLevel = p.confirmed[LEVELS[p.level].id] ? per : Math.min(LESSONS, p.lesson - 1);
    const passed = p.confirmed[LEVELS[p.level].id] ? doneLv * per : doneLv * per + inLevel;
    return Math.min(100, Math.round((passed / (LEVELS.length * per)) * 100));
  }
  function minutes(st) {
    const p = P(st);
    return p.placement === 'todo' ? 10 : p.lesson > LESSONS ? 25 : p.review ? 15 : p.videoMin + 12;
  }
  /* сколько дней до конца уровня: уроки × части + экзамен */
  function daysLeftTo(st, lvTarget) {
    const p = P(st);
    const per = partsPer(p);
    let days = 0;
    for (let lv = p.level; lv <= lvTarget; lv += 1) {
      if (p.confirmed[LEVELS[lv].id]) continue;
      if (lv === p.level) days += Math.max(0, LESSONS - p.lesson + 1) * per - (p.lesson <= LESSONS ? p.part - 1 : 0) + p.review + 1;
      else days += LESSONS * per + 1;
    }
    return Math.max(0, days);
  }
  function when(days) {
    if (days <= 0) return 'уже';
    if (days < 45) return `≈ ${days} дн.`;
    const m = Math.round(days / 30.4);
    return `≈ ${m} мес.`;
  }

  function pageHTML(st, esc) {
    const p = P(st);
    const cur = LEVELS[p.level];
    const conf = confirmedLevel(st);
    const placedTop = LEVELS.filter((L) => p.placed[L.id]).pop();
    const ladder = LEVELS.map((L, i) => {
      const ok = !!p.confirmed[L.id];
      const pl = !ok && !!p.placed[L.id];
      const now = i === p.level && !ok;
      const lp = now ? Math.round((Math.min(LESSONS, p.lesson - 1) / LESSONS) * 100) : ok || pl ? 100 : 0;
      return `<li class="en-lv ${ok ? 'ok' : ''} ${pl ? 'placed' : ''} ${now ? 'now' : ''}">
        <span class="en-lv-badge">${L.id}</span>
        <span class="en-lv-txt"><b>${L.id} · ${esc(L.ru)}</b><small>${ok ? `✓ подтверждён экзаменом ${fmt(p.confirmed[L.id])}` : pl ? '✓ засчитан по тесту' : now ? `${p.lesson > LESSONS ? 'экзамен' : `урок ${p.lesson} из ${LESSONS}`}` : `${LESSONS} уроков + экзамен`}</small>
          <span class="en-bar"><i style="width:${lp}%"></i></span></span>
      </li>`;
    }).join('');
    const nextLv = LEVELS[Math.min(LEVELS.length - 1, p.level)];
    const srsN = Object.keys(p.srs || {}).length;
    const dueN = dueKeys(p).length;
    const fc = LEVELS.slice(p.level).filter((L) => !p.confirmed[L.id]).map((L) => `<span><b>${L.id}</b>${when(daysLeftTo(st, IDX[L.id]))}</span>`).join('');
    return `
      <div class="en-level">
        <div class="en-level-main">
          <small>Твой подтверждённый уровень</small>
          <b>${conf ? conf.id : placedTop ? `${placedTop.id}` : '—'}</b>
          <em>${conf ? `${esc(conf.ru)} · экзамен сдан ${fmt(p.confirmed[conf.id])}` : placedTop ? 'по тесту на уровень · подтвердишь экзаменом' : 'появится после первого экзамена'}</em>
        </div>
        <div class="en-level-now"><small>Сейчас</small><b>${esc(label(st))}</b><em>${p.lesson <= LESSONS && !p.review && p.placement !== 'todo' ? `часть ${p.part} · ~${p.videoMin} мин видео` : ''}</em></div>
      </div>
      <h4 class="cr-sec">🪜 Уровни до C1</h4>
      <ol class="en-ladder">${ladder}</ol>
      <div class="en-stats">
        <div><b>${p.learned || 0}</b><small>фраз выучено</small></div>
        <div><b>${srsN}</b><small>на повторении</small></div>
        <div><b>${dueN}</b><small>вспомнить сегодня</small></div>
      </div>
      ${vocabHTML(st, esc)}
      <h4 class="cr-sec">📅 Когда подтвердишь уровень</h4>
      <div class="en-forecast">${fc || '<span><b>C1</b>пройден 🏆</span>'}</div>
      <p class="muted small">Если заниматься каждый день. Расчёт: ${LESSONS} уроков по ~${LESSON_MIN} мин на уровень, у тебя ~${p.videoMin} мин видео в день. Пропуск дня сдвигает срок, но ничего не сгорает.</p>
      <h4 class="cr-sec">🎯 После ${nextLv.id} ты сможешь</h4>
      <ul class="en-can">${nextLv.can.map((x) => `<li>✓ ${esc(x)}</li>`).join('')}</ul>
      <div class="cr-settings en-settings">
        <span class="muted small">Видео в день</span>
        <div class="en-mins">${[20, 30, 45].map((m) => `<button class="chip ${p.videoMin === m ? 'active' : ''}" data-en-min="${m}">${m} мин</button>`).join('')}</div>
      </div>
      ${p.lesson <= LESSONS && !p.review && p.placement !== 'todo' ? `<button class="btn btn-ghost btn-block" id="en-exam-now">Уже знаю ${cur.id}? Сдать экзамен досрочно</button>` : ''}`;
  }
  /* словарь: слова по уровням, сколько выучено, повторить прямо сейчас */
  function vocabHTML(st, esc) {
    const w = wordStats(st);
    const rows = w.per.map((x) => `
      <div class="en-voc-row"><b>${x.id}</b><span class="en-bar"><i style="width:${Math.round((x.known / x.total) * 100)}%"></i><i class="seen" style="width:${Math.round(((x.seen - x.known) / x.total) * 100)}%"></i></span><small>${x.known}/${x.total}</small></div>`).join('');
    return `
      <h4 class="cr-sec">🔤 Словарь</h4>
      <div class="en-voc">
        <p class="en-voc-top"><b>${w.known}</b> выучено · ${w.seen} в работе · ${w.total} слов всего</p>
        ${rows}
        <p class="muted small">Каждый урок — 4 новых слова. Слово «выучено», когда ты вспомнил его 3 раза с растущим перерывом.</p>
        <button class="btn btn-ghost btn-block" id="en-words-now" ${w.seen ? '' : 'disabled'}>${w.due ? `🔁 Повторить слова (${w.due} пора)` : '🔁 Повторить слова'}</button>
      </div>`;
  }
  function fmt(key) {
    if (!key) return '';
    const [y, m, d] = key.split('-');
    return `${d}.${m}.${y}`;
  }
  function setMinutes(st, m) {
    const p = P(st);
    if ([20, 30, 45].includes(m)) { p.videoMin = m; if (p.plan && p.plan.date === today()) p.plan = null; }
  }

  /* ---------- разговорный тренер (ИИ в Claude) ---------- */
  function tutorPrompt(st) {
    const p = P(st);
    const L = LEVELS[p.level];
    const topics = L.blocks.map((b) => b.t).join('; ');
    return `You are a friendly English conversation partner for a Russian speaker. Their level: ${L.id} (${L.name}).
Grammar they are practising now: ${topics}.
Rules:
- Speak English at exactly ${L.id} level: ${p.level <= 1 ? 'very short simple sentences, basic words' : p.level <= 3 ? 'clear everyday English' : 'natural, rich English'}.
- Ask ONE question at a time about their life, plans, opinions. Keep replies to 2-4 short lines.
- If their last message has mistakes, start with "✏️ " and the corrected sentence, then one short explanation in Russian. Then continue the conversation.
- If they write in Russian, help them say it in English and ask them to repeat it.
- Never switch to long lectures.`;
  }

  return {
    LEVELS, LESSONS, PASS, IDX, WORDS, init, migrate, today: today_, lightDay, practice, rulesFor, wordStats, complete, onItem, onPlace, videoEnded, examNow,


    label, pct, minutes, pageHTML, setMinutes, confirmedLevel, tutorPrompt, daysLeftTo, byKey, words,
  };
})();
