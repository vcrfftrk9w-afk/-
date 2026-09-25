// ─────────────────────────────────────────────────────────────────────────────
// Общие типы приложения ViralPilot
// ─────────────────────────────────────────────────────────────────────────────

export type NicheId =
  | "dance"
  | "comedy"
  | "beauty"
  | "fashion"
  | "fitness"
  | "food"
  | "gaming"
  | "education"
  | "lifestyle"
  | "music"
  | "tech"
  | "travel"
  | "pets"
  | "business"
  | "art";

export type DataSource = "oauth" | "public" | "demo" | "manual" | "import";

export interface TikTokProfile {
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  verified?: boolean;
  followers: number;
  following: number;
  likes: number;
  videoCount: number;
  profileUrl?: string;
}

export interface TikTokVideo {
  id: string;
  title: string; // описание / подпись
  coverUrl?: string;
  shareUrl?: string;
  createTime: number; // unix seconds, 0 = дата неизвестна
  duration: number; // seconds, 0 = неизвестно
  views: number;
  likes: number;
  comments: number;
  shares: number;
  hashtags: string[];
  saves?: number; // сохранения (в избранное)
  sound?: string; // название звука/трека
  pinned?: boolean;
  // ── Что внутри ролика (из данных TikTok при сканировании) ──
  labels?: string[]; // категории TikTok (Comedy, Dance, Daily Life…)
  keywords?: string[]; // поисковые запросы, по которым TikTok показывает ролик
  quality?: number; // оценка качества видео TikTok (VQScore), 0..100
  loudness?: number; // громкость, LUFS (тише −24 — ролик звучит тихо)
  voice?: boolean; // есть свой голос/речь в оригинальной дорожке
  originalSound?: boolean; // свой звук (true) или чужой/трендовый трек (false)
  onScreenText?: string[]; // текст-стикеры на экране
  transcript?: string; // автосубтитры: что говорится в ролике
  photo?: boolean; // фото-карусель
  width?: number;
  height?: number;
  lang?: string;
}

export interface UserSettings {
  niche: NicheId;
  subNiche?: string;
  goalFollowers: number;
  goalDays: number;
  postsPerWeek: number;
  hoursPerWeek: number;
  experience: "new" | "some" | "pro";
  region: string; // "RU", "KZ", "UA", "US", ...
  language: string; // язык контента
  faceOnCamera: boolean;
  strengths?: string;
}

export interface Account {
  source: DataSource;
  profile: TikTokProfile;
  videos: TikTokVideo[];
  connectedAt: number;
  history: { t: number; followers: number; likes: number }[]; // снимки роста
}

// ── Аналитика ───────────────────────────────────────────────────────────────

export interface SubScore {
  key: string;
  label: string;
  score: number; // 0..100
  hint: string;
}

export interface Insight {
  type: "win" | "warn" | "tip";
  title: string;
  text: string;
  impact?: "high" | "medium" | "low";
}

export interface HeatCell {
  day: number; // 0 = Пн
  hour: number; // 0..23
  value: number; // нормированная эффективность 0..1
  count: number;
}

export interface LocalReport {
  viralScore: number;
  level: string;
  subScores: SubScore[];
  avgViews: number;
  medianViews: number;
  engagementRate: number; // %
  likeRate: number;
  commentRate: number;
  shareRate: number;
  viewsPerFollower: number;
  postsPerWeek: number;
  daysSinceLastPost: number | null;
  bestVideo?: TikTokVideo;
  worstVideo?: TikTokVideo;
  topHashtags: { tag: string; avgViews: number; uses: number }[];
  durationBuckets: { label: string; avgViews: number; count: number }[];
  heatmap: HeatCell[];
  bestSlots: { day: number; hour: number; label: string }[];
  slotsFromData: boolean; // false = общие рекомендации, а не твои данные
  insights: Insight[];
  timeline: { date: string; views: number; er: number; title: string }[];
}

// ── AI-ответы ───────────────────────────────────────────────────────────────

export interface AIAnalysis {
  summary: string;
  diagnosis: string;
  strengths: string[];
  weaknesses: string[];
  priorities: { title: string; why: string; how: string; impact: "high" | "medium" | "low" }[];
  contentPillars: { name: string; description: string; share: number }[];
  profileFixes: { field: string; current: string; suggestion: string }[];
  hookAdvice: string[];
  predictedFollowers30d: number;
  source: "ai" | "local";
}

export interface Trend {
  id: string;
  name: string;
  type: "sound" | "format" | "hashtag" | "challenge" | "effect" | "meme";
  description: string;
  whyItWorks: string;
  howToShoot: string[];
  hashtags: string[];
  sound?: string;
  heat: number; // 0..100
  lifecycle: "rising" | "peak" | "fading" | "evergreen";
  difficulty: "easy" | "medium" | "hard";
  nicheFit: number; // 0..100
  exampleIdea: string;
  sources?: { title: string; url: string }[];
}

export interface TrendsResponse {
  trends: Trend[];
  fetchedAt: number;
  live: boolean; // true = найдены в интернете через AI-поиск
  origin?: "web" | "ai" | "local"; // web = поиск в интернете, ai = подбор ИИ без поиска, local = офлайн-база
  note?: string;
}

export interface VideoIdea {
  id: string;
  title: string;
  hook: string;
  concept: string;
  format: string;
  trendRef?: string;
  viralPotential: number; // 0..100
  effort: "low" | "medium" | "high";
  durationSec: number;
  whyItWillWork: string;
  hashtags: string[];
  sound?: string;
  saved?: boolean;
}

export interface Scene {
  t: string; // "0–2с"
  shot: string; // что в кадре / ракурс
  action: string; // что делаешь
  onScreenText?: string;
  voiceover?: string;
}

export interface ProductionPlan {
  title: string;
  hookVariants: string[];
  scenes: Scene[];
  shotList: string[];
  equipment: string[];
  lighting: string;
  editing: string[];
  sound: string;
  caption: string;
  hashtags: string[];
  cta: string;
  postingTime: string;
  pinnedComment: string;
  checklist: string[];
  mistakesToAvoid: string[];
  source: "ai" | "local";
}

export interface PlanTask {
  id: string;
  title: string;
  detail: string;
  kind: "film" | "post" | "engage" | "learn" | "optimize" | "live";
  xp: number;
  done?: boolean;
}

export interface PlanDay {
  day: number;
  theme: string;
  tasks: PlanTask[];
}

export interface GrowthPlan {
  title: string;
  strategy: string;
  phases: { name: string; days: string; goal: string }[];
  days: PlanDay[];
  createdAt: number;
  source: "ai" | "local";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Разбор контента ────────────────────────────────────────────────────────

export type VideoFormat = "talk" | "trend-sound" | "own-sound" | "photo" | "unknown";

export interface VideoBreakdown {
  id: string;
  rank: "top" | "good" | "weak" | "flop";
  perf: number; // просмотры / медиана автора
  format: VideoFormat;
  formatLabel: string;
  topics: string[];
  signals: { ok: boolean; text: string }[];
  fixes: string[];
  verdict: string;
}

export interface ContentDNA {
  summary: string; // «Ты снимаешь …»
  topics: { label: string; count: number }[];
  formats: { key: VideoFormat; label: string; count: number; avgViews: number }[];
  keywords: string[];
  avgDuration: number;
  quality?: number;
  loudness?: number;
  formula?: string;
  doMore: string[];
  stopDoing: string[];
  videos: VideoBreakdown[];
  suggestedNiche?: NicheId;
}

/** Глубокий разбор ИИ: смотрит обложки роликов, подписи, звук, субтитры. */
export interface DeepAnalysis {
  whatYouFilm: string; // что автор снимает, простыми словами
  style: string; // подача, манера, как выглядят ролики
  audience: string; // кому это интересно
  strongest: string; // что получается лучше всего (с опорой на конкретный ролик)
  formula: string; // формула удачного ролика этого автора
  videos: { id: string; inside: string; hook: string; whyResult: string; fix: string }[];
  more: string[];
  stop: string[];
  nextVideos: { title: string; hook: string; why: string }[];
  createdAt: number;
  source: "ai" | "local";
}

/** Миссия дня: одно конкретное видео, которое нужно снять, с пошаговой инструкцией. */
export interface Mission {
  id: string;
  number: number; // порядковый номер миссии
  createdAt: number;
  kind: "repeat-best" | "trend" | "series" | "reply" | "seed" | "starter";
  title: string; // что снимаем
  why: string; // почему именно это — с опорой на данные автора
  basedOn?: string; // «повторяем формулу ролика …» / «тренд …»
  format: string;
  durationSec: number;
  hook: string; // что сказать/написать в первые 2 секунды
  onScreenText: string; // текст на экране в первом кадре
  prep: string[]; // перед съёмкой
  shots: { t: string; what: string; say?: string }[]; // кадры по секундам
  edit: string[]; // монтаж
  caption: string;
  hashtags: string[];
  sound: string;
  postAt: string; // когда выложить
  afterPost: string[]; // первый час после публикации
  bonus?: string[]; // быстрые правки профиля
  source: "ai" | "local";
  doneSteps?: Record<string, boolean>;
  completedAt?: number;
}
