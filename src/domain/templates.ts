import type { LadderStep, TaskKind } from './types';

export interface TaskSeed {
  title: string;
  firstStep: string;
  firstStepMin: number;
  estimateMin: number;
  kind: TaskKind;
  ladder?: LadderStep[];
}

export interface StageSeed {
  title: string;
  tasks: TaskSeed[];
}

export interface TrackTemplate {
  id: string;
  title: string;
  /** Кому обычно подходит. Без обещаний богатства. */
  fit: string;
  goalTitle: string;
  goalCheckpoint: string;
  horizonWeeks: number;
  stages: StageSeed[];
}

/**
 * Пути роста дохода. Не всем нужно становиться предпринимателями:
 * первый путь в списке — самый обычный и часто самый разумный.
 */
export const TRACKS: TrackTemplate[] = [
  {
    id: 'promotion',
    title: 'Повышение или смена работы',
    fit: 'Есть работа, но доход ниже рыночного или потолок близко.',
    goalTitle: 'За три месяца подготовить портфолио и начать искать более высокооплачиваемую работу',
    goalCheckpoint: 'Отправлено 15 персональных откликов, проведено хотя бы 2 собеседования',
    horizonWeeks: 12,
    stages: [
      {
        title: 'Понять рынок',
        tasks: [
          {
            title: 'Собрать 10 вакансий своего уровня и выписать повторяющиеся требования',
            firstStep: 'Открыть сайт с вакансиями и сохранить одну подходящую',
            firstStepMin: 2,
            estimateMin: 30,
            kind: 'prep',
          },
          {
            title: 'Сравнить свою зарплату с вилками в этих вакансиях',
            firstStep: 'Выписать свою текущую сумму в заметку',
            firstStepMin: 2,
            estimateMin: 15,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Привести в порядок резюме',
        tasks: [
          {
            title: 'Обновить описание последнего места работы',
            firstStep: 'Открыть файл резюме',
            firstStepMin: 2,
            estimateMin: 20,
            kind: 'prep',
            ladder: [
              { text: 'Обновить описание последнего места работы', minutes: 20 },
              { text: 'Открыть файл резюме и найти нужный раздел', minutes: 5 },
              { text: 'Написать один черновой пункт про результат', minutes: 2 },
              { text: 'Просто открыть файл и закрыть. Это тоже вход', minutes: 1 },
            ],
          },
          {
            title: 'Добавить в резюме три измеримых результата',
            firstStep: 'Вспомнить одну задачу, где что-то стало лучше, и записать её',
            firstStepMin: 3,
            estimateMin: 25,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Выйти наружу',
        tasks: [
          {
            title: 'Отправить пять персональных откликов',
            firstStep: 'Открыть одну сохранённую вакансию и прочитать требования',
            firstStepMin: 3,
            estimateMin: 45,
            kind: 'reality',
            ladder: [
              { text: 'Отправить пять персональных откликов', minutes: 45 },
              { text: 'Отправить один отклик', minutes: 12 },
              { text: 'Написать первые два предложения сопроводительного письма', minutes: 5 },
              { text: 'Выбрать одну вакансию и сохранить её', minutes: 2 },
            ],
          },
          {
            title: 'Написать двум знакомым из профессии, что ищешь работу',
            firstStep: 'Выбрать одного человека из списка контактов',
            firstStepMin: 2,
            estimateMin: 15,
            kind: 'reality',
          },
        ],
      },
      {
        title: 'Подготовиться к собеседованиям',
        tasks: [
          {
            title: 'Подготовить рассказ о себе на две минуты',
            firstStep: 'Записать первую фразу голосом или текстом',
            firstStepMin: 3,
            estimateMin: 30,
            kind: 'prep',
          },
          {
            title: 'Разобрать ответы после каждого собеседования и поправить резюме',
            firstStep: 'Выписать один вопрос, на котором запнулся',
            firstStepMin: 3,
            estimateMin: 20,
            kind: 'reality',
          },
        ],
      },
    ],
  },
  {
    id: 'skill',
    title: 'Освоение прикладного навыка',
    fit: 'Нужен конкретный навык, который повышает доход. Без бесконечных курсов.',
    goalTitle: 'За три месяца освоить прикладной навык и применить его на реальной задаче',
    goalCheckpoint: 'Сделана одна настоящая работа с этим навыком — для себя, для знакомых или за деньги',
    horizonWeeks: 12,
    stages: [
      {
        title: 'Сузить навык',
        tasks: [
          {
            title: 'Выбрать одну узкую тему вместо широкой области',
            firstStep: 'Выписать три варианта и вычеркнуть один',
            firstStepMin: 3,
            estimateMin: 20,
            kind: 'prep',
          },
          {
            title: 'Найти три вакансии или заказа, где этот навык нужен',
            firstStep: 'Ввести название навыка в поиск вакансий',
            firstStepMin: 2,
            estimateMin: 20,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Минимальная теория',
        tasks: [
          {
            title: 'Пройти один короткий вводный материал до конца',
            firstStep: 'Открыть материал и посмотреть первые пять минут',
            firstStepMin: 5,
            estimateMin: 40,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Практика на реальной задаче',
        tasks: [
          {
            title: 'Сделать маленькую работу целиком, пусть и черновую',
            firstStep: 'Создать файл или проект и назвать его',
            firstStepMin: 2,
            estimateMin: 60,
            kind: 'prep',
          },
          {
            title: 'Показать работу человеку из профессии и получить отклик',
            firstStep: 'Выбрать, кому показать, и написать одну фразу',
            firstStepMin: 3,
            estimateMin: 15,
            kind: 'reality',
          },
        ],
      },
      {
        title: 'Применить за пределами учёбы',
        tasks: [
          {
            title: 'Взять одну настоящую задачу с этим навыком',
            firstStep: 'Написать одному человеку, что готов сделать такую задачу',
            firstStepMin: 4,
            estimateMin: 30,
            kind: 'reality',
          },
        ],
      },
    ],
  },
  {
    id: 'freelance',
    title: 'Фриланс или услуги',
    fit: 'Можно продавать конкретную услугу, не увольняясь с работы.',
    goalTitle: 'Проверить, готов ли кто-то платить за мою услугу, не увольняясь с работы',
    goalCheckpoint: 'Отправлено 10 персональных обращений и получен хотя бы один оплаченный заказ или отказ с причиной',
    horizonWeeks: 12,
    stages: [
      {
        title: 'Изучить реальные заказы',
        tasks: [
          {
            title: 'Найти три примера заказов и выписать повторяющиеся требования',
            firstStep: 'Открыть площадку с заказами и сохранить один',
            firstStepMin: 2,
            estimateMin: 30,
            kind: 'prep',
            ladder: [
              { text: 'Найти три примера заказов и выписать требования', minutes: 30 },
              { text: 'Найти один заказ и выписать три требования', minutes: 10 },
              { text: 'Открыть площадку и сохранить один заказ', minutes: 2 },
            ],
          },
        ],
      },
      {
        title: 'Выбрать узкую услугу',
        tasks: [
          {
            title: 'Сформулировать одну услугу в одном предложении',
            firstStep: 'Написать черновую формулировку, даже неудачную',
            firstStepMin: 3,
            estimateMin: 20,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Освоить необходимые основы',
        tasks: [
          {
            title: 'Разобрать инструмент на уровне, достаточном для первой работы',
            firstStep: 'Открыть инструмент и сделать один элемент',
            firstStepMin: 5,
            estimateMin: 45,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Сделать работы для портфолио',
        tasks: [
          {
            title: 'Сделать две работы по образцу реальных требований',
            firstStep: 'Создать файл первой работы',
            firstStepMin: 2,
            estimateMin: 90,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Сформулировать предложение',
        tasks: [
          {
            title: 'Написать короткое описание услуги с ценой и сроком',
            firstStep: 'Написать одну строку: что делаю и за сколько',
            firstStepMin: 3,
            estimateMin: 25,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Найти потенциальных клиентов',
        tasks: [
          {
            title: 'Собрать список из десяти подходящих адресатов',
            firstStep: 'Записать одного возможного клиента',
            firstStepMin: 2,
            estimateMin: 30,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Отправить персональные обращения',
        tasks: [
          {
            title: 'Отправить пять персональных сообщений',
            firstStep: 'Открыть черновик и вписать имя первого адресата',
            firstStepMin: 2,
            estimateMin: 40,
            kind: 'reality',
            ladder: [
              { text: 'Отправить пять персональных сообщений', minutes: 40 },
              { text: 'Отправить одно сообщение', minutes: 10 },
              { text: 'Написать черновик одного сообщения, не отправляя', minutes: 5 },
              { text: 'Вписать имя одного адресата в черновик', minutes: 2 },
            ],
          },
        ],
      },
      {
        title: 'Разобрать ответы и изменить предложение',
        tasks: [
          {
            title: 'Выписать причины отказов и поправить предложение',
            firstStep: 'Перечитать один ответ и выписать одну причину',
            firstStepMin: 3,
            estimateMin: 25,
            kind: 'reality',
          },
        ],
      },
    ],
  },
  {
    id: 'validate',
    title: 'Проверка небольшой идеи',
    fit: 'Есть идея услуги или продукта. Нужно проверить спрос без кредитов и увольнения.',
    goalTitle: 'Проверить спрос на идею малыми силами, не влезая в долги',
    goalCheckpoint: 'Проведено пять разговоров с возможными покупателями и получен один предоплаченный заказ или ясный отказ',
    horizonWeeks: 10,
    stages: [
      {
        title: 'Сформулировать, что проверяем',
        tasks: [
          {
            title: 'Записать одно предположение, которое может оказаться ложным',
            firstStep: 'Дописать фразу: «Я думаю, что люди готовы платить за…»',
            firstStepMin: 3,
            estimateMin: 20,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Поговорить с людьми',
        tasks: [
          {
            title: 'Провести пять коротких разговоров с возможными покупателями',
            firstStep: 'Написать одному человеку с просьбой о 10 минутах',
            firstStepMin: 3,
            estimateMin: 60,
            kind: 'reality',
          },
        ],
      },
      {
        title: 'Сделать минимальную версию',
        tasks: [
          {
            title: 'Собрать самую простую версию предложения',
            firstStep: 'Набросать один экран или одну страницу текста',
            firstStepMin: 5,
            estimateMin: 60,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Попросить оплату',
        tasks: [
          {
            title: 'Сделать предложение с ценой трём людям',
            firstStep: 'Отправить цену одному человеку',
            firstStepMin: 4,
            estimateMin: 30,
            kind: 'reality',
          },
        ],
      },
    ],
  },
  {
    id: 'grow_existing',
    title: 'Развитие существующего дела',
    fit: 'Дело уже есть, но доход не растёт или держится на случайных заказах.',
    goalTitle: 'Увеличить повторяемый доход существующего дела',
    goalCheckpoint: 'Три источника заказов работают регулярно, а не разово',
    horizonWeeks: 12,
    stages: [
      {
        title: 'Понять, откуда приходят деньги',
        tasks: [
          {
            title: 'Выписать последние десять заказов и их источники',
            firstStep: 'Открыть историю оплат и выписать один заказ',
            firstStepMin: 3,
            estimateMin: 30,
            kind: 'prep',
          },
        ],
      },
      {
        title: 'Усилить рабочий канал',
        tasks: [
          {
            title: 'Сделать одно действие в самом результативном канале',
            firstStep: 'Открыть канал и написать первую строку',
            firstStepMin: 3,
            estimateMin: 30,
            kind: 'reality',
          },
        ],
      },
      {
        title: 'Поднять цену или средний чек',
        tasks: [
          {
            title: 'Подготовить и озвучить новую цену одному клиенту',
            firstStep: 'Написать новую цену в заметке',
            firstStepMin: 2,
            estimateMin: 25,
            kind: 'reality',
          },
        ],
      },
      {
        title: 'Вернуть прошлых клиентов',
        tasks: [
          {
            title: 'Написать пяти прошлым клиентам с конкретным предложением',
            firstStep: 'Выбрать одного клиента из списка',
            firstStepMin: 2,
            estimateMin: 35,
            kind: 'reality',
          },
        ],
      },
    ],
  },
];

export interface HabitSeed {
  title: string;
  anchor: string;
  minVersion: string;
  normalVersion: string;
  extendedVersion: string;
  minMinutes: number;
  normalMinutes: number;
  extendedMinutes: number;
}

/** Привычки привязаны к событиям, а не только ко времени. */
export const HABIT_SEEDS: HabitSeed[] = [
  {
    title: 'Движение',
    anchor: 'После утренней чистки зубов',
    minVersion: 'Две минуты движения',
    normalVersion: 'Десять минут зарядки',
    extendedVersion: 'Полноценная тренировка',
    minMinutes: 2,
    normalMinutes: 10,
    extendedMinutes: 45,
  },
  {
    title: 'Шаг к цели',
    anchor: 'После того как сел за стол',
    minVersion: 'Открыть рабочий файл',
    normalVersion: 'Один небольшой фрагмент задачи',
    extendedVersion: 'Фокус-блок на 50 минут',
    minMinutes: 2,
    normalMinutes: 15,
    extendedMinutes: 50,
  },
  {
    title: 'Разбор дня',
    anchor: 'После ужина',
    minVersion: 'Одна строка: что сделал',
    normalVersion: 'Короткий итог и план на завтра',
    extendedVersion: 'Разбор недели',
    minMinutes: 2,
    normalMinutes: 10,
    extendedMinutes: 25,
  },
  {
    title: 'Чтение по профессии',
    anchor: 'После того как убрал посуду',
    minVersion: 'Одна страница',
    normalVersion: 'Пятнадцать минут',
    extendedVersion: 'Глава целиком',
    minMinutes: 2,
    normalMinutes: 15,
    extendedMinutes: 40,
  },
  {
    title: 'Деньги под контролем',
    anchor: 'После получения любой оплаты',
    minVersion: 'Записать сумму',
    normalVersion: 'Обновить расходы за неделю',
    extendedVersion: 'Пересобрать финансовую картину',
    minMinutes: 2,
    normalMinutes: 12,
    extendedMinutes: 30,
  },
];

export function findTrack(trackId: string | undefined): TrackTemplate | undefined {
  return TRACKS.find((t) => t.id === trackId);
}
