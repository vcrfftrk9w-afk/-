// Демо-аккаунт: правдоподобные данные, чтобы показать все возможности без подключения.
import type { Account, NicheId, TikTokVideo } from "./types";
import { getNiche } from "./knowledge";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeDemoAccount(username: string, niche: NicheId): Account {
  const r = rng(username.split("").reduce((a, c) => a + c.charCodeAt(0), 7) * 97);
  const n = getNiche(niche);
  const now = Math.floor(Date.now() / 1000);
  const videos: TikTokVideo[] = [];
  const count = 36;
  let t = now - 3600 * 5;
  for (let i = 0; i < count; i++) {
    const seed = n.ideaSeeds[i % n.ideaSeeds.length];
    const viral = r() < 0.08;
    const base = 800 + r() * 4000;
    const views = Math.round(viral ? base * (15 + r() * 40) : base * (0.4 + r() * 1.6));
    const erK = 0.04 + r() * 0.08;
    const likes = Math.round(views * erK);
    const comments = Math.round(views * (0.002 + r() * 0.006));
    const shares = Math.round(views * (0.001 + r() * (viral ? 0.02 : 0.005)));
    const tags = [...n.hashtags].sort(() => r() - 0.5).slice(0, 2 + Math.floor(r() * 5));
    const hours = [8, 12, 13, 17, 18, 19, 20, 21, 22];
    const d = new Date(t * 1000);
    d.setHours(hours[Math.floor(r() * hours.length)], Math.floor(r() * 60));
    videos.push({
      id: `demo-${i}`,
      title: `${seed.title}${i >= n.ideaSeeds.length ? ` (ч.${Math.floor(i / n.ideaSeeds.length) + 1})` : ""} ${tags.join(" ")}`,
      createTime: Math.floor(d.getTime() / 1000),
      duration: Math.round([9, 12, 15, 22, 28, 35, 48, 62, 95][Math.floor(r() * 9)]),
      views,
      likes,
      comments,
      shares,
      hashtags: tags.map((x) => x.toLowerCase()),
    });
    t -= Math.round(86400 * (0.5 + r() * 1.8));
  }
  const likesTotal = videos.reduce((s, v) => s + v.likes, 0);
  const followers = Math.round(3200 + r() * 6000);
  const history = Array.from({ length: 14 }, (_, i) => ({
    t: Date.now() - (13 - i) * 86400000,
    followers: Math.round(followers * (0.86 + i * 0.01)),
    likes: Math.round(likesTotal * (0.8 + i * 0.015)),
  }));
  return {
    source: "demo",
    connectedAt: Date.now(),
    profile: {
      username,
      displayName: username.replace(/[._]/g, " "),
      bio: `${n.emoji} ${n.label} · новые видео каждый день`,
      followers,
      following: Math.round(120 + r() * 300),
      likes: likesTotal,
      videoCount: count,
    },
    videos,
    history,
  };
}
