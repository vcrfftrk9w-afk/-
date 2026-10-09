package app.umnik;

import android.content.Context;
import android.content.SharedPreferences;

/** Настройки Умника. Ключ API хранится только в памяти телефона (резервная копия в облако выключена). */
final class Prefs {
    /** чем думает Умник: бесплатный ИИ в телефоне или Claude по ключу */
    static final String FREE = "free", CLAUDE = "claude";
    static final String[] MODELS = {Brain.OPUS, Brain.SONNET, Brain.HAIKU};
    static final String[] MODEL_NAMES = {
            "Claude Opus 5.5 — самый умный",
            "Claude Sonnet 5.5 — быстрее",
            "Claude Haiku 5.5 — быстрый и дешёвый"};
    static final int[] BREAK_CHOICES = {0, 20, 30, 45, 60, 90};
    static final int[] WATCH_CHOICES = {0, 2, 5, 10, 15};

    private Prefs() {
    }

    static SharedPreferences of(Context c) {
        return c.getSharedPreferences("umnik", Context.MODE_PRIVATE);
    }

    static String apiKey(Context c) {
        return of(c).getString("api_key", "").trim();
    }

    static boolean hasKey(Context c) {
        return !apiKey(c).isEmpty();
    }

    /** Если ещё не выбирали: есть ключ — Claude (так было до бесплатного режима), нет — бесплатный ИИ. */
    static String engine(Context c) {
        String e = of(c).getString("engine", null);
        if (FREE.equals(e) || CLAUDE.equals(e)) return e;
        return hasKey(c) ? CLAUDE : FREE;
    }

    static boolean free(Context c) {
        return FREE.equals(engine(c));
    }

    /** можно спрашивать: бесплатный ИИ скачан или вставлен ключ Claude */
    static boolean ready(Context c) {
        return free(c) ? ModelStore.ready(c) : hasKey(c);
    }

    /** короткое имя для заголовка окна */
    static String engineTitle(Context c) {
        return free(c) ? LocalMind.TITLE : modelName(c).split(" — ")[0].replace("Claude ", "");
    }

    static String model(Context c) {
        return of(c).getString("model", Brain.OPUS);
    }

    static String modelName(Context c) {
        String m = model(c);
        for (int i = 0; i < MODELS.length; i++) if (MODELS[i].equals(m)) return MODEL_NAMES[i];
        return m;
    }

    static boolean bubble(Context c) {
        return of(c).getBoolean("bubble", true);
    }

    /** через сколько минут без перерыва напоминать; 0 — не напоминать */
    static int breakMinutes(Context c) {
        return of(c).getInt("break_minutes", 45);
    }

    /** напоминания пишет ИИ (с учётом приложения и времени), иначе — готовые фразы */
    static boolean smartBreaks(Context c) {
        return of(c).getBoolean("smart_breaks", true);
    }

    static boolean nightReminder(Context c) {
        return of(c).getBoolean("night", true);
    }

    /** раз во сколько минут Умник сам смотрит на экран; 0 — не смотрит */
    static int watchMinutes(Context c) {
        return of(c).getInt("watch_minutes", 0);
    }

    static boolean speak(Context c) {
        return of(c).getBoolean("speak", false);
    }

    static String about(Context c) {
        return of(c).getString("about", "");
    }

    /** до какого момента кнопка спрятана (долгое нажатие) */
    static long hiddenUntil(Context c) {
        return of(c).getLong("hidden_until", 0);
    }

    static void put(Context c, String key, Object value) {
        SharedPreferences.Editor e = of(c).edit();
        if (value instanceof Boolean) e.putBoolean(key, (Boolean) value);
        else if (value instanceof Integer) e.putInt(key, (Integer) value);
        else if (value instanceof Long) e.putLong(key, (Long) value);
        else e.putString(key, String.valueOf(value));
        e.apply();
    }
}
