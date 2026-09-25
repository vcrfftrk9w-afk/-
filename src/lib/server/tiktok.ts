// ─────────────────────────────────────────────────────────────────────────────
// Интеграция с TikTok
// 1) Официальный вход: Login Kit (OAuth 2.0) + Display API — профиль, статистика, видео.
// 2) Публичный импорт по @username (без входа) — парсинг публичной страницы профиля.
// 3) oEmbed — данные о видео по ссылке.
// ─────────────────────────────────────────────────────────────────────────────
import type { TikTokProfile, TikTokVideo } from "../types";
import { extractHashtags } from "../analytics";

export const TT_SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.list";

export function oauthConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function redirectUri(origin: string) {
  return process.env.TIKTOK_REDIRECT_URI || `${origin}/api/tiktok/callback`;
}

export function authorizeUrl(state: string, origin: string) {
  const p = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    scope: TT_SCOPES,
    response_type: "code",
    redirect_uri: redirectUri(origin),
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${p.toString()}`;
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms
  open_id: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...body,
    }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`TikTok OAuth: ${json.error_description || json.error || res.status}`);
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in ?? 86400) * 1000,
    open_id: json.open_id,
  };
}

export const exchangeCode = (code: string, origin: string) =>
  tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri(origin) });

export const refreshToken = (refresh: string) => tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });

const USER_FIELDS = [
  "open_id",
  "avatar_url",
  "avatar_large_url",
  "display_name",
  "bio_description",
  "profile_deep_link",
  "is_verified",
  "username",
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
].join(",");

const VIDEO_FIELDS = [
  "id",
  "title",
  "video_description",
  "duration",
  "cover_image_url",
  "share_url",
  "create_time",
  "like_count",
  "comment_count",
  "share_count",
  "view_count",
].join(",");

export async function fetchOwnProfile(accessToken: string): Promise<TikTokProfile> {
  const res = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${USER_FIELDS}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok || (json.error && json.error.code !== "ok")) {
    throw new Error(`TikTok user/info: ${json.error?.message || res.status}`);
  }
  const u = json.data.user;
  return {
    username: u.username || u.display_name,
    displayName: u.display_name,
    avatarUrl: u.avatar_large_url || u.avatar_url,
    bio: u.bio_description,
    verified: u.is_verified,
    followers: u.follower_count ?? 0,
    following: u.following_count ?? 0,
    likes: u.likes_count ?? 0,
    videoCount: u.video_count ?? 0,
    profileUrl: u.profile_deep_link,
  };
}

export async function fetchOwnVideos(accessToken: string, max = 100): Promise<TikTokVideo[]> {
  const out: TikTokVideo[] = [];
  let cursor: number | undefined;
  for (let page = 0; page < 6 && out.length < max; page++) {
    const res = await fetch(`https://open.tiktokapis.com/v2/video/list/?fields=${VIDEO_FIELDS}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(cursor ? { max_count: 20, cursor } : { max_count: 20 }),
      cache: "no-store",
    });
    const json = await res.json();
    if (!res.ok || (json.error && json.error.code !== "ok")) {
      throw new Error(`TikTok video/list: ${json.error?.message || res.status}`);
    }
    for (const v of json.data.videos ?? []) {
      const text = v.video_description || v.title || "";
      out.push({
        id: String(v.id),
        title: text,
        coverUrl: v.cover_image_url,
        shareUrl: v.share_url,
        createTime: v.create_time,
        duration: v.duration ?? 0,
        views: v.view_count ?? 0,
        likes: v.like_count ?? 0,
        comments: v.comment_count ?? 0,
        shares: v.share_count ?? 0,
        hashtags: extractHashtags(text),
      });
    }
    if (!json.data.has_more) break;
    cursor = json.data.cursor;
  }
  return out;
}

// ── Публичный профиль по @username ──────────────────────────────────────────
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export function normalizeUsername(input: string) {
  const m = input.trim().match(/tiktok\.com\/@([\w.-]+)/i);
  return (m ? m[1] : input.trim().replace(/^@/, "")).replace(/[^\w.]/g, "");
}

export async function fetchPublicProfile(usernameRaw: string): Promise<{ profile: TikTokProfile; videos: TikTokVideo[] }> {
  const username = normalizeUsername(usernameRaw);
  if (!username) throw new Error("Укажи @username");
  const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
    headers: BROWSER_HEADERS,
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`TikTok ответил ${res.status}`);
  const html = await res.text();

  const m =
    html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/) ||
    html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Не удалось прочитать страницу профиля (TikTok мог показать капчу). Попробуй ещё раз или войди через TikTok.");
  const data = JSON.parse(m[1]);

  // Новый формат
  const detail = data?.__DEFAULT_SCOPE__?.["webapp.user-detail"];
  let user = detail?.userInfo?.user;
  let stats = detail?.userInfo?.stats ?? detail?.userInfo?.statsV2;
  // Старый формат SIGI_STATE
  if (!user && data?.UserModule) {
    user = data.UserModule.users?.[username];
    stats = data.UserModule.stats?.[username];
  }
  if (!user) {
    const code = detail?.statusCode;
    throw new Error(code === 10221 || code === 10202 ? "Аккаунт не найден" : "Профиль закрыт или недоступен");
  }

  const num = (x: unknown) => Number(x ?? 0) || 0;
  const v2 = detail?.userInfo?.statsV2 ?? {};
  const pick = (a: unknown, b: unknown) => (num(a) > 0 ? num(a) : Math.max(0, num(b)));
  const profile: TikTokProfile = {
    username: user.uniqueId ?? username,
    displayName: user.nickname ?? username,
    avatarUrl: user.avatarLarger || user.avatarMedium || user.avatarThumb,
    bio: user.signature ?? "",
    verified: Boolean(user.verified),
    followers: pick(v2.followerCount, stats?.followerCount),
    following: pick(v2.followingCount, stats?.followingCount),
    likes: pick(v2.heart ?? v2.heartCount, stats?.heart ?? stats?.heartCount),
    videoCount: pick(v2.videoCount, stats?.videoCount),
    profileUrl: `https://www.tiktok.com/@${user.uniqueId ?? username}`,
  };

  // Видео иногда встраиваются в страницу (старый формат) — берём, если есть
  const videos: TikTokVideo[] = [];
  const items = data?.ItemModule ? Object.values(data.ItemModule as Record<string, Record<string, unknown>>) : [];
  for (const it of items) {
    const s = (it.stats ?? {}) as Record<string, unknown>;
    const v = (it.video ?? {}) as Record<string, unknown>;
    const desc = String(it.desc ?? "");
    videos.push({
      id: String(it.id),
      title: desc,
      coverUrl: v.cover as string | undefined,
      shareUrl: `https://www.tiktok.com/@${profile.username}/video/${it.id}`,
      createTime: num(it.createTime),
      duration: num(v.duration),
      views: num(s.playCount),
      likes: num(s.diggCount),
      comments: num(s.commentCount),
      shares: num(s.shareCount),
      hashtags: extractHashtags(desc),
    });
  }
  return { profile, videos };
}

// ── oEmbed ──────────────────────────────────────────────────────────────────
export async function fetchOEmbed(url: string) {
  const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Видео не найдено или ссылка неверная");
  const j = await res.json();
  return {
    title: String(j.title ?? ""),
    author: String(j.author_name ?? ""),
    authorUrl: String(j.author_url ?? ""),
    thumbnail: String(j.thumbnail_url ?? ""),
    hashtags: extractHashtags(String(j.title ?? "")),
  };
}

// ── Полное сканирование аккаунта по @username ───────────────────────────────
// С APIFY_TOKEN: актор clockworks/tiktok-scraper отдаёт профиль и последние ролики
// со статистикой (просмотры, лайки, комментарии, репосты, длительность, звук).
// Без токена: только публичные цифры профиля со страницы TikTok.

export const scanConfigured = () => Boolean(process.env.APIFY_TOKEN);

interface ApifyItem {
  id?: string;
  text?: string;
  createTime?: number;
  createTimeISO?: string;
  webVideoUrl?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  collectCount?: number;
  isPinned?: boolean;
  hashtags?: { name?: string }[];
  videoMeta?: { duration?: number; coverUrl?: string; originalCoverUrl?: string };
  musicMeta?: { musicName?: string; musicAuthor?: string; musicOriginal?: boolean };
  authorMeta?: {
    name?: string;
    nickName?: string;
    verified?: boolean;
    signature?: string;
    avatar?: string;
    originalAvatarUrl?: string;
    fans?: number;
    following?: number;
    heart?: number;
    video?: number;
  };
  error?: string;
}

const apifyBase = () => process.env.APIFY_BASE_URL || "https://api.apify.com";
const apifyActor = () => process.env.APIFY_TIKTOK_ACTOR || "clockworks~tiktok-scraper";
const apifyToken = () => encodeURIComponent(process.env.APIFY_TOKEN!);

function apifyInput(username: string, limit: number) {
  return {
    profiles: [username],
    resultsPerPage: limit,
    profileScrapeSections: ["videos"],
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
    shouldDownloadSlideshowImages: false,
  };
}

async function apifyFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${apifyBase()}${path}${path.includes("?") ? "&" : "?"}token=${apifyToken()}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (res.status === 401 || res.status === 403) throw new Error("Apify отклонил токен — проверь APIFY_TOKEN");
  if (res.status === 402) throw new Error("На аккаунте Apify закончились бесплатные кредиты");
  if (!res.ok) throw new Error(`Сканер ответил ${res.status}`);
  return res.json();
}

/** Превращает ответ сканера в профиль и ролики. */
export function parseApifyItems(items: ApifyItem[], username: string): { profile: TikTokProfile; videos: TikTokVideo[] } {
  const real = items.filter((i) => !i.error && i.id);
  if (!real.length) {
    const err = items.find((i) => i.error)?.error;
    throw new Error(err ? `TikTok: ${err}` : "У аккаунта нет публичных видео или он закрыт");
  }
  const a = real.find((i) => i.authorMeta)?.authorMeta ?? {};
  const profile: TikTokProfile = {
    username: a.name || username,
    displayName: a.nickName || a.name || username,
    avatarUrl: a.originalAvatarUrl || a.avatar,
    bio: a.signature ?? "",
    verified: Boolean(a.verified),
    followers: a.fans ?? 0,
    following: a.following ?? 0,
    likes: a.heart ?? 0,
    videoCount: a.video ?? real.length,
    profileUrl: `https://www.tiktok.com/@${a.name || username}`,
  };
  const videos: TikTokVideo[] = real.map((i) => {
    const text = i.text ?? "";
    const tags = (i.hashtags ?? []).map((h) => (h.name ? `#${h.name.toLowerCase()}` : "")).filter(Boolean);
    return {
      id: String(i.id),
      title: text,
      coverUrl: i.videoMeta?.coverUrl || i.videoMeta?.originalCoverUrl,
      shareUrl: i.webVideoUrl,
      createTime: i.createTime ?? (i.createTimeISO ? Math.floor(Date.parse(i.createTimeISO) / 1000) : 0),
      duration: i.videoMeta?.duration ?? 0,
      views: i.playCount ?? 0,
      likes: i.diggCount ?? 0,
      comments: i.commentCount ?? 0,
      shares: i.shareCount ?? 0,
      hashtags: tags.length ? tags : extractHashtags(text),
      sound: i.musicMeta?.musicName ? `${i.musicMeta.musicName}${i.musicMeta.musicAuthor ? ` — ${i.musicMeta.musicAuthor}` : ""}` : undefined,
      pinned: i.isPinned || undefined,
    };
  });
  return { profile, videos };
}

/** Запускает сканирование и сразу возвращает id запуска (без долгого ожидания). */
export async function startApifyScan(usernameRaw: string, limit = 30): Promise<{ runId: string; datasetId: string; username: string }> {
  const username = normalizeUsername(usernameRaw);
  if (!username) throw new Error("Укажи @username");
  const j = await apifyFetch(`/v2/acts/${apifyActor()}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(apifyInput(username, limit)),
  });
  return { runId: j.data.id, datasetId: j.data.defaultDatasetId, username };
}

export type ScanPoll =
  | { status: "running"; found: number }
  | { status: "done"; profile: TikTokProfile; videos: TikTokVideo[] }
  | { status: "failed"; error: string };

/** Проверяет запуск: сколько роликов уже найдено, готово ли. */
export async function pollApifyScan(runId: string, datasetId: string, username: string): Promise<ScanPoll> {
  const run = await apifyFetch(`/v2/actor-runs/${encodeURIComponent(runId)}`);
  const st: string = run.data.status;
  if (st === "SUCCEEDED") {
    const items = (await apifyFetch(`/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json`)) as ApifyItem[];
    try {
      return { status: "done", ...parseApifyItems(items, normalizeUsername(username)) };
    } catch (e) {
      return { status: "failed", error: (e as Error).message };
    }
  }
  if (st === "FAILED" || st === "ABORTED" || st === "TIMED-OUT") {
    return { status: "failed", error: st === "TIMED-OUT" ? "Сканирование заняло слишком долго" : "Сканер не смог открыть аккаунт" };
  }
  const ds = await apifyFetch(`/v2/datasets/${encodeURIComponent(datasetId)}`).catch(() => null);
  return { status: "running", found: ds?.data?.itemCount ?? 0 };
}

/** Синхронный вариант (для скриптов и обновления из «Профиля»). */
export async function scanWithApify(usernameRaw: string, limit = 30): Promise<{ profile: TikTokProfile; videos: TikTokVideo[] }> {
  const { runId, datasetId, username } = await startApifyScan(usernameRaw, limit);
  const until = Date.now() + 240_000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 3000));
    const p = await pollApifyScan(runId, datasetId, username);
    if (p.status === "done") return { profile: p.profile, videos: p.videos };
    if (p.status === "failed") throw new Error(p.error);
  }
  throw new Error("Сканирование заняло слишком долго");
}


// ── Сканирование без ключей: профиль + виджет профиля + страницы роликов ────
// Проверено с серверов Vercel: TikTok отдаёт профиль, виджет /embed/@user
// (последние ~10 роликов) и страницы роликов с полной статистикой.

/** Дата публикации из id ролика TikTok (старшие 32 бита — unix-время). */
export function timeFromVideoId(id: string): number {
  try {
    return Number(BigInt(id) >> BigInt(32));
  } catch {
    return 0;
  }
}

interface EmbedVideo {
  id: string;
  desc?: string;
  coverUrl?: string;
  originCoverUrl?: string;
  playCount?: number;
  privateItem?: boolean;
}

async function fetchEmbedVideos(username: string): Promise<EmbedVideo[]> {
  const res = await fetch(`https://www.tiktok.com/embed/@${encodeURIComponent(username)}`, {
    headers: BROWSER_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const html = await res.text();
  const m = html.match(/<script[^>]*id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return [];
  const data = JSON.parse(m[1])?.source?.data ?? {};
  const key = Object.keys(data).find((k) => k.includes("/embed/")) ?? "";
  const list = (data[key]?.videoList ?? []) as EmbedVideo[];
  return list.filter((v) => v?.id && !v.privateItem);
}

interface ItemStruct {
  id?: string;
  desc?: string;
  createTime?: string | number;
  stats?: Record<string, unknown>;
  statsV2?: Record<string, unknown>;
  video?: {
    duration?: number;
    cover?: string;
    originCover?: string;
    width?: number;
    height?: number;
    VQScore?: string | number;
    volumeInfo?: { Loudness?: number; Peak?: number };
    claInfo?: { hasOriginalAudio?: boolean; captionInfos?: { url?: string; language?: string; languageCode?: string }[] };
    subtitleInfos?: { Url?: string; LanguageCodeName?: string }[];
  };
  music?: { title?: string; authorName?: string; original?: boolean };
  textExtra?: { hashtagName?: string }[];
  isPinnedItem?: boolean;
  diversificationLabels?: string[];
  suggestedWords?: string[];
  stickersOnItem?: { stickerText?: string[] }[];
  textLanguage?: string;
  locationCreated?: string;
  imagePost?: unknown;
}

/** Текст автосубтитров ролика (WebVTT → строка). */
async function fetchTranscript(it: ItemStruct): Promise<string | undefined> {
  const url = it.video?.claInfo?.captionInfos?.find((c) => c.url)?.url ?? it.video?.subtitleInfos?.find((c) => c.Url)?.Url;
  if (!url) return undefined;
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, cache: "no-store", signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return undefined;
    const lines = (await res.text())
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && l !== "WEBVTT" && !l.includes("-->") && !/^\d+$/.test(l) && !/^(NOTE|STYLE|Kind:|Language:)/.test(l));
    const text = Array.from(new Set(lines)).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, 800) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchVideoItem(username: string, id: string): Promise<ItemStruct | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}/video/${id}`, {
      headers: BROWSER_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    return (JSON.parse(m[1])?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct as ItemStruct) ?? null;
  } catch {
    return null;
  }
}

/** Полное сканирование по нику без внешних сервисов. */
export async function scanDirect(usernameRaw: string): Promise<{ profile: TikTokProfile; videos: TikTokVideo[] }> {
  const username = normalizeUsername(usernameRaw);
  const [{ profile }, embed] = await Promise.all([fetchPublicProfile(username), fetchEmbedVideos(username).catch(() => [] as EmbedVideo[])]);
  const items = await Promise.all(embed.slice(0, 12).map((v) => fetchVideoItem(profile.username || username, v.id)));
  const transcripts = await Promise.all(items.map((it) => (it ? fetchTranscript(it) : Promise.resolve(undefined))));
  const num = (x: unknown) => Number(x ?? 0) || 0;
  const videos: TikTokVideo[] = embed.slice(0, 12).map((e, i) => {
    const it = items[i];
    const st = { ...(it?.stats ?? {}), ...(it?.statsV2 ?? {}) };
    const text = it?.desc ?? e.desc ?? "";
    const tags = (it?.textExtra ?? []).map((t) => (t.hashtagName ? `#${t.hashtagName.toLowerCase()}` : "")).filter(Boolean);
    const music = it?.music?.title ? `${it.music.title}${it.music.authorName ? ` — ${it.music.authorName}` : ""}` : undefined;
    const onScreen = (it?.stickersOnItem ?? []).flatMap((s) => s.stickerText ?? []).map((t) => t.trim()).filter(Boolean);
    const vq = Number(it?.video?.VQScore);
    return {
      id: e.id,
      title: text,
      coverUrl: e.coverUrl || e.originCoverUrl || it?.video?.cover,
      shareUrl: `https://www.tiktok.com/@${profile.username || username}/video/${e.id}`,
      createTime: num(it?.createTime) || timeFromVideoId(e.id),
      duration: num(it?.video?.duration),
      views: num(st.playCount) || num(e.playCount),
      likes: num(st.diggCount),
      comments: num(st.commentCount),
      shares: num(st.shareCount),
      saves: num(st.collectCount) || undefined,
      hashtags: tags.length ? tags : extractHashtags(text),
      sound: music,
      pinned: it?.isPinnedItem || undefined,
      labels: it?.diversificationLabels?.length ? Array.from(new Set(it.diversificationLabels)) : undefined,
      keywords: it?.suggestedWords?.length ? it.suggestedWords.slice(0, 8) : undefined,
      quality: Number.isFinite(vq) && vq > 0 ? Math.round(vq) : undefined,
      loudness: typeof it?.video?.volumeInfo?.Loudness === "number" ? it.video.volumeInfo.Loudness : undefined,
      voice: typeof it?.video?.claInfo?.hasOriginalAudio === "boolean" ? it.video.claInfo.hasOriginalAudio : undefined,
      originalSound: typeof it?.music?.original === "boolean" ? it.music.original : undefined,
      onScreenText: onScreen.length ? onScreen.slice(0, 6) : undefined,
      transcript: transcripts[i],
      photo: it?.imagePost ? true : undefined,
      width: num(it?.video?.width) || undefined,
      height: num(it?.video?.height) || undefined,
      lang: it?.textLanguage || undefined,
    };
  });
  return { profile, videos };
}
