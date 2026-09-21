/* Мастерская: письмо, которое трудно написать.
   Собирает настоящий черновик из твоих кусков. Правило письма одно:
   тому, кто его получит, должно быть легко ответить.

   Все формулировки — без рода: «пишу», «хочу», «могу». Приложение не знает,
   кто ты, и не должно догадываться. */
(function (root) {
  'use strict';

  var M = root.Most || (root.Most = {});
  var W = M.workshop || (M.workshop = {});

  function join(parts) {
    return parts.filter(function (p) { return p && String(p).trim(); })
      .map(function (p) { return String(p).trim(); })
      .join('\n\n');
  }

  function bullets(text) {
    return String(text || '').split('\n')
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .map(function (s) { return '— ' + s; })
      .join('\n');
  }

  function hi(to, warm) {
    var name = String(to || '').trim();
    if (!name) return warm ? 'Привет.' : 'Здравствуйте.';
    return name + ', ' + (warm ? 'привет.' : 'здравствуйте.');
  }

  function sign(me) {
    var name = String(me || '').trim();
    return name ? name : '';
  }

  W.letters = [
    {
      id: 'quit',
      title: 'Уйти с работы',
      about: 'Коротко, без оправданий и без обиды. Такое письмо легче отправить, чем произнести.',
      fields: [
        { id: 'to', label: 'Кому', placeholder: 'Имя руководителя' },
        { id: 'last', label: 'Последний рабочий день', placeholder: '30 октября' },
        { id: 'why', label: 'Причина — если хочешь её называть', type: 'area', rows: 2, placeholder: 'Можно оставить пустым. Объяснять причину вы не обязаны' },
        { id: 'thanks', label: 'За что поблагодарить', placeholder: 'за три года и за то, чему научили' },
        { id: 'me', label: 'Твоё имя', placeholder: '' }
      ],
      build: function (v, tone) {
        var soft = tone === 'soft';
        return join([
          hi(v.to, false),
          soft ? 'Пишу заранее, чтобы у вас было время.' : null,
          'Хочу сообщить о своём решении уйти. Последний рабочий день — ' + (v.last || '[дата]') + '.',
          v.why ? 'Если коротко: ' + v.why : null,
          'До этой даты могу передать дела и описать всё, что на мне, — чтобы после ухода ничего не рассыпалось.',
          v.thanks ? 'Спасибо ' + v.thanks + '.' : null,
          soft ? 'Если нужно обсудить детали — скажите, когда вам удобно.' : 'Скажите, когда удобно обсудить детали.',
          sign(v.me)
        ]);
      }
    },
    {
      id: 'raise',
      title: 'Попросить больше денег',
      about: 'Работают факты и одна цифра. «Я стараюсь» — не работает.',
      fields: [
        { id: 'to', label: 'Кому', placeholder: 'Имя руководителя' },
        { id: 'facts', label: 'Что сделано за последние полгода — с каждой строки новая', type: 'area', rows: 4,
          placeholder: 'Запустил отчётность, стало на 6 часов в неделю меньше ручной работы\nВзял на себя двух новых людей' },
        { id: 'amount', label: 'Цифра, к которой предлагаешь прийти', placeholder: '220 000' },
        { id: 'when', label: 'Когда удобно поговорить', placeholder: 'на этой неделе' },
        { id: 'me', label: 'Твоё имя', placeholder: '' }
      ],
      build: function (v, tone) {
        var soft = tone === 'soft';
        return join([
          hi(v.to, false),
          soft
            ? 'Хочу обсудить пересмотр зарплаты и сразу показать, из чего я исхожу.'
            : 'Хочу обсудить пересмотр моей зарплаты.',
          v.facts ? 'Что изменилось за последние полгода:\n' + bullets(v.facts) : null,
          'Ориентир, к которому предлагаю прийти, — ' + (v.amount || '[сумма]') + '.',
          'Готовы обсудить ' + (v.when || 'на этой неделе') + '? Достаточно пятнадцати минут.',
          sign(v.me)
        ]);
      }
    },
    {
      id: 'offer',
      title: 'Предложить свою работу',
      about: 'Первое письмо незнакомому человеку. Чем легче ответить «нет», тем выше шанс «да».',
      fields: [
        { id: 'to', label: 'Кому', placeholder: 'Имя или название' },
        { id: 'context', label: 'Что у них происходит — почему ты пишешь именно им', type: 'area', rows: 2, placeholder: 'Видел ваш сайт: форма записи отваливается на телефоне' },
        { id: 'what', label: 'Что предлагаешь сделать', type: 'area', rows: 2, placeholder: 'Починить форму и проверить на трёх телефонах' },
        { id: 'price', label: 'Сколько это стоит', placeholder: '5 000 рублей' },
        { id: 'howlong', label: 'Сколько займёт', placeholder: 'два вечера' },
        { id: 'me', label: 'Твоё имя', placeholder: '' }
      ],
      build: function (v, tone) {
        var soft = tone === 'soft';
        return join([
          hi(v.to, false),
          v.context ? v.context : null,
          'Могу это сделать: ' + (v.what || '[что именно]') + '.',
          'Займёт ' + (v.howlong || '[срок]') + ', стоит ' + (v.price || '[цена]') + '.',
          soft
            ? 'Если сейчас не нужно — так и скажите, я пойму и не буду напоминать.'
            : 'Если не нужно — просто ответьте «нет», этого достаточно.',
          sign(v.me)
        ]);
      }
    },
    {
      id: 'no',
      title: 'Отказать',
      about: 'Отказ без вранья и без длинных оправданий. Длинное оправдание читается как просьба уговорить.',
      fields: [
        { id: 'to', label: 'Кому', placeholder: 'Имя' },
        { id: 'what', label: 'От чего отказываешься', placeholder: 'взять проект в декабре' },
        { id: 'why', label: 'Почему — одной строкой', placeholder: 'не вытяну по времени' },
        { id: 'alt', label: 'Чем можешь помочь вместо этого — если можешь', placeholder: 'могу посоветовать человека' },
        { id: 'me', label: 'Твоё имя', placeholder: '' }
      ],
      build: function (v, tone) {
        var soft = tone === 'soft';
        return join([
          hi(v.to, true),
          'Спасибо, что позвали.',
          'В этот раз откажусь: ' + (v.why || 'сейчас не вытяну') + '.' +
            (v.what ? ' Речь про ' + v.what + '.' : ''),
          soft ? 'Не хочу браться наполовину — это было бы хуже отказа.' : null,
          v.alt ? 'Если поможет: ' + v.alt + '.' : null,
          sign(v.me)
        ]);
      }
    },
    {
      id: 'reach',
      title: 'Написать человеку без повода',
      about: 'Самое короткое письмо здесь. И самое недооценённое.',
      fields: [
        { id: 'to', label: 'Кому', placeholder: 'Имя' },
        { id: 'memory', label: 'Что вспомнилось', type: 'area', rows: 2, placeholder: 'Как мы застряли на той крыше и ржали' },
        { id: 'me', label: 'Твоё имя', placeholder: '' }
      ],
      build: function (v) {
        return join([
          hi(v.to, true),
          'Без повода: ' + (v.memory || 'вспомнилось, как мы виделись в последний раз') + '.',
          'Вспомнилось — и вот пишу. Как ты сейчас?',
          sign(v.me)
        ]);
      }
    },
    {
      id: 'ask',
      title: 'Попросить о неудобном',
      about: 'Просьба, в которой заранее разрешено отказать. Такие просьбы выполняют чаще.',
      fields: [
        { id: 'to', label: 'Кому', placeholder: 'Имя' },
        { id: 'what', label: 'О чём просишь', type: 'area', rows: 2, placeholder: 'Посидеть с детьми в четверг вечером' },
        { id: 'easy', label: 'Что будет легко сделать, если он согласится', placeholder: 'скажи просто «давай», остальное я организую' },
        { id: 'me', label: 'Твоё имя', placeholder: '' }
      ],
      build: function (v, tone) {
        var soft = tone === 'soft';
        return join([
          hi(v.to, true),
          'У меня неудобная просьба, и сразу скажу: отказать — нормально.',
          v.what ? v.what : '[о чём просишь]',
          v.easy ? 'Если да — ' + v.easy + '.' : null,
          soft ? 'Если нет — просто скажи «нет», я не обижусь и не пропаду.' : 'Если нет — скажи «нет», этого хватит.',
          sign(v.me)
        ]);
      }
    }
  ];

  W.letterById = function (id) {
    for (var i = 0; i < W.letters.length; i++) if (W.letters[i].id === id) return W.letters[i];
    return null;
  };

  W.buildLetter = function (id, values, tone) {
    var kind = W.letterById(id);
    if (!kind) return '';
    return kind.build(values || {}, tone || 'plain');
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);
