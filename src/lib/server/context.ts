import type { Account, LocalReport, UserSettings } from "../types";
import { formatNum } from "../analytics";
import { getNiche } from "../knowledge";

const EXP = { new: "новичок", some: "есть опыт", pro: "опытный автор" } as const;

/** Компактное описание автора для промптов. */
export function creatorBrief(settings: UserSettings, account?: Account | null, report?: LocalReport | null): string {
  const niche = getNiche(settings.niche);
  const lines = [
    `НИША: ${niche.label}${settings.subNiche ? ` (${settings.subNiche})` : ""}. Аудитория ниши: ${niche.audience}.`,
    `ЦЕЛЬ: ${formatNum(settings.goalFollowers)} подписчиков за ${settings.goalDays} дней. Готов(а) публиковать ${settings.postsPerWeek} видео/нед, ${settings.hoursPerWeek} ч/нед на контент.`,
    `ОПЫТ: ${EXP[settings.experience]}. Лицо в кадре: ${settings.faceOnCamera ? "да" : "нет"}. Регион: ${settings.region}. Язык контента: ${settings.language}.`,
  ];
  if (settings.strengths) lines.push(`СИЛЬНЫЕ СТОРОНЫ/ФИШКИ АВТОРА: ${settings.strengths}`);
  if (account) {
    const p = account.profile;
    lines.push(
      `ПРОФИЛЬ @${p.username} («${p.displayName}»): ${formatNum(p.followers)} подписчиков, ${formatNum(p.likes)} лайков, ${p.videoCount} видео. Био: «${p.bio || "пусто"}». Источник данных: ${account.source}.`,
    );
  }
  if (report) {
    lines.push(
      `МЕТРИКИ: Viral Score ${report.viralScore}/100 (${report.level}); медиана просмотров ${formatNum(report.medianViews)}, средние ${formatNum(report.avgViews)}; ER ${report.engagementRate.toFixed(2)}% (лайки ${report.likeRate.toFixed(2)}%, комменты ${report.commentRate.toFixed(2)}%, репосты ${report.shareRate.toFixed(2)}%); просмотры/подписчики ${report.viewsPerFollower.toFixed(2)}; ${report.postsPerWeek.toFixed(1)} видео/нед; дней с последнего поста: ${report.daysSinceLastPost ?? "н/д"}.`,
      `ПОДОЦЕНКИ: ${report.subScores.map((s) => `${s.label} ${s.score}`).join(", ")}.`,
      `ЛУЧШЕЕ ВРЕМЯ (по данным): ${report.bestSlots.map((s) => s.label).join(", ")}.`,
      `ДЛИТЕЛЬНОСТЬ→ПРОСМОТРЫ: ${report.durationBuckets.filter((b) => b.count).map((b) => `${b.label}: ${formatNum(b.avgViews)} (${b.count} шт)`).join("; ")}.`,
      `ТОП ХЭШТЕГИ: ${report.topHashtags.slice(0, 8).map((t) => `${t.tag} (${formatNum(t.avgViews)})`).join(", ") || "нет"}.`,
    );
  }
  if (account?.videos.length) {
    const vids = [...account.videos].sort((a, b) => b.createTime - a.createTime).slice(0, 25);
    lines.push("ПОСЛЕДНИЕ ВИДЕО (дата | длит | просмотры | лайки | комменты | репосты | подпись | звук):");
    for (const v of vids) {
      lines.push(
        `- ${(v.createTime ? new Date(v.createTime * 1000).toISOString().slice(0, 10) : "дата ?")} | ${v.duration}с | ${v.views} | ${v.likes} | ${v.comments} | ${v.shares} | ${v.title.slice(0, 120).replace(/\n/g, " ")}${v.sound ? ` | ${v.sound}` : ""}${v.pinned ? " | закреп" : ""}`,
      );
    }
  }
  return lines.join("\n");
}
