export type Niche =
  | "dance"
  | "comedy"
  | "education"
  | "beauty"
  | "cooking"
  | "gaming"
  | "lifestyle"
  | "fashion"
  | "fitness"
  | "motivation"
  | "music"
  | "pets";

export interface NicheInfo {
  id: Niche;
  label: string;
  emoji: string;
  description: string;
  pillars: string[];
}

export const NICHES: NicheInfo[] = [
  {
    id: "dance",
    label: "Танцы",
    emoji: "💃",
    description: "Челленджи, хореография, дуэты",
    pillars: ["Трендовые танцы", "Своя хореография", "Обучающие туториалы", "Закулисье/бэкстейдж"],
  },
  {
    id: "comedy",
    label: "Юмор / скетчи",
    emoji: "😂",
    description: "Скетчи, пародии, ситуативный юмор",
    pillars: ["Скетчи с сюжетом", "Пародии на тренды", "Импровизация", "Закадровый юмор"],
  },
  {
    id: "education",
    label: "Образование / факты",
    emoji: "🧠",
    description: "Лайфхаки, факты, обучающий контент",
    pillars: ["Быстрые факты", "Разбор темы по полочкам", "Мифы vs правда", "Отвечаю на вопросы"],
  },
  {
    id: "beauty",
    label: "Красота / уход",
    emoji: "💄",
    description: "Макияж, уход за кожей, обзоры",
    pillars: ["Туториалы по макияжу", "Обзоры продуктов", "До/После", "Уход за собой"],
  },
  {
    id: "cooking",
    label: "Кулинария",
    emoji: "🍳",
    description: "Рецепты, лайфхаки готовки, обзоры еды",
    pillars: ["Быстрые рецепты", "Лайфхаки кухни", "Обзоры блюд/мест", "Готовим вместе"],
  },
  {
    id: "gaming",
    label: "Игры",
    emoji: "🎮",
    description: "Геймплей, обзоры, смешные моменты",
    pillars: ["Хайлайты геймплея", "Гайды/советы", "Реакции", "Смешные баги/моменты"],
  },
  {
    id: "lifestyle",
    label: "Лайфстайл / влог",
    emoji: "✨",
    description: "Будни, распаковки, влоги дня",
    pillars: ["День из жизни", "Распаковки", "Рутины", "Путешествия"],
  },
  {
    id: "fashion",
    label: "Мода / стиль",
    emoji: "👗",
    description: "Образы, стайлинг, тренды одежды",
    pillars: ["OOTD/образы", "Стайлинг-советы", "Шопинг-хаулы", "Тренды сезона"],
  },
  {
    id: "fitness",
    label: "Фитнес / спорт",
    emoji: "🏋️",
    description: "Тренировки, прогресс, советы по форме",
    pillars: ["Тренировки", "Прогресс-видео", "Техника упражнений", "Питание/советы"],
  },
  {
    id: "motivation",
    label: "Мотивация / саморазвитие",
    emoji: "🚀",
    description: "Мотивационный контент, продуктивность",
    pillars: ["Мотивационные цитаты+визуал", "Личные истории", "Продуктивность", "Разбор привычек"],
  },
  {
    id: "music",
    label: "Музыка",
    emoji: "🎤",
    description: "Каверы, оригинальные треки, инструменты",
    pillars: ["Каверы", "Оригинальная музыка", "Закулисье записи", "Дуэты/коллабы"],
  },
  {
    id: "pets",
    label: "Питомцы",
    emoji: "🐾",
    description: "Забавные и трогательные видео с животными",
    pillars: ["Забавные моменты", "Дрессировка/советы", "День из жизни питомца", "Трогательные истории"],
  },
];

export function getNiche(id: Niche): NicheInfo {
  return NICHES.find((n) => n.id === id) ?? NICHES[0];
}
