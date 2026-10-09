package app.umnik;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Что за приложение открыто: название и вид — от него зависят быстрые кнопки и подсказки. */
final class Apps {
    enum Kind { CHESS, MESSENGER, BROWSER, VIDEO, GAME, STUDY, HOME, OTHER }

    private static final String[] CHESS = {"chess", "lichess", "shredder", "droidfish", "stockfish"};
    private static final String[] MESSENGER = {"telegram", "challegram", "whatsapp", "viber", "messag", "discord",
            "signal", "securesms", "orca", "vkontakte", "oneme", "android.gm", "mail", "skype", "teams", "slack", "icq", "tamtam"};
    private static final String[] BROWSER = {"chrome", "browser", "firefox", "opera", "yandex", "duckduckgo", "brave",
            "emmx", "vivaldi", "kiwi"};
    private static final String[] VIDEO = {"youtube", "tiktok", "musically", "trill", "instagram", "likee", "twitch",
            "netflix", "kinopoisk", "rutube", "reddit", "twitter", "pinterest", "snapchat", "zen", "ivi.client", "okko"};
    private static final String[] STUDY = {"duolingo", "photomath", "brainly", "uchi", "yaklass", "skysmart", "quizlet",
            "dnevnik", "school", "edu", "gdz", "mathway", "socratic", "lingualeo", "anki"};

    private static final Map<String, String> labels = new HashMap<>();
    private static final Map<String, Kind> kinds = new HashMap<>();

    private Apps() {
    }

    static synchronized String label(Context c, String pkg) {
        if (pkg == null) return "";
        String l = labels.get(pkg);
        if (l != null) return l;
        try {
            PackageManager pm = c.getPackageManager();
            l = String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)));
        } catch (Exception e) {
            l = pkg;
        }
        labels.put(pkg, l);
        return l;
    }

    static synchronized Kind kind(Context c, String pkg) {
        if (pkg == null) return Kind.OTHER;
        Kind k = kinds.get(pkg);
        if (k != null) return k;
        String p = pkg.toLowerCase(Locale.ROOT);
        String l = label(c, pkg).toLowerCase(Locale.ROOT);
        int category = -1;
        try {
            category = c.getPackageManager().getApplicationInfo(pkg, 0).category;
        } catch (Exception ignored) {
            // приложение уже удалено
        }
        if (has(p, CHESS) || l.contains("шахмат") || l.contains("chess")) k = Kind.CHESS;
        else if (isLauncher(c, pkg)) k = Kind.HOME;
        else if (has(p, MESSENGER)) k = Kind.MESSENGER;
        else if (has(p, STUDY)) k = Kind.STUDY;
        else if (has(p, VIDEO) || category == ApplicationInfo.CATEGORY_VIDEO || category == ApplicationInfo.CATEGORY_SOCIAL) k = Kind.VIDEO;
        else if (category == ApplicationInfo.CATEGORY_GAME) k = Kind.GAME;
        else if (has(p, BROWSER)) k = Kind.BROWSER;
        else k = Kind.OTHER;
        kinds.put(pkg, k);
        return k;
    }

    /** «мессенджер», «браузер»… — для строки контекста */
    static String kindName(Kind k) {
        switch (k) {
            case CHESS: return "шахматы";
            case MESSENGER: return "мессенджер";
            case BROWSER: return "браузер";
            case VIDEO: return "видео и соцсети";
            case GAME: return "игра";
            case STUDY: return "учёба";
            case HOME: return "главный экран";
            default: return "";
        }
    }

    private static boolean has(String s, String[] words) {
        for (String w : words) if (s.contains(w)) return true;
        return false;
    }

    private static boolean isLauncher(Context c, String pkg) {
        try {
            android.content.Intent home = new android.content.Intent(android.content.Intent.ACTION_MAIN)
                    .addCategory(android.content.Intent.CATEGORY_HOME);
            android.content.pm.ResolveInfo r = c.getPackageManager().resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY);
            return r != null && r.activityInfo != null && pkg.equals(r.activityInfo.packageName);
        } catch (Exception e) {
            return false;
        }
    }
}
