package app.umnik;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Сколько человек сидит в телефоне: без перерыва (экран гас меньше чем на 3 минуты — перерывом не считается)
 * и за сегодня по приложениям. Время приходит снаружи — так логику легко проверить тестами.
 */
final class ScreenTime {
    static final long GAP = 3 * 60_000L;
    static final long REPEAT = 15 * 60_000L;

    private long sessionStart = -1;
    private long screenOffAt = -1;
    private long lastTick = -1;
    private String app;
    private int reminders;
    private long lastReminder;
    private int nightDay = -1;
    private int day = -1;
    final Map<String, Long> today = new HashMap<>();

    synchronized void screenOn(long now) {
        if (sessionStart < 0 || screenOffAt < 0 || now - screenOffAt >= GAP) {
            sessionStart = now;
            reminders = 0;
            lastReminder = 0;
        }
        screenOffAt = -1;
        lastTick = now;
    }

    synchronized void screenOff(long now) {
        tick(now);
        screenOffAt = now;
        lastTick = -1;
    }

    synchronized void app(String pkg, long now) {
        tick(now);
        app = pkg;
    }

    synchronized String app() {
        return app;
    }

    /** засчитать время с прошлого раза текущему приложению */
    synchronized void tick(long now) {
        int d = dayOf(now);
        if (d != day) {
            today.clear();
            day = d;
        }
        if (lastTick >= 0 && app != null && now > lastTick) {
            Long was = today.get(app);
            // больше часа между отметками при горящем экране не бывает — значит, пропустили его выключение
            today.put(app, (was == null ? 0 : was) + Math.min(now - lastTick, 60 * 60_000L));
        }
        if (screenOffAt < 0) lastTick = now;
    }

    /** сколько без перерыва (0 — экран выключен) */
    synchronized long session(long now) {
        if (sessionStart < 0 || screenOffAt >= 0) return 0;
        return now - sessionStart;
    }

    synchronized long total() {
        long t = 0;
        for (long v : today.values()) t += v;
        return t;
    }

    synchronized long of(String pkg) {
        Long v = today.get(pkg);
        return v == null ? 0 : v;
    }

    /** самые долгие приложения за сегодня */
    synchronized List<Map.Entry<String, Long>> top(int n) {
        List<Map.Entry<String, Long>> all = new ArrayList<>(today.entrySet());
        Collections.sort(all, (a, b) -> Long.compare(b.getValue(), a.getValue()));
        return all.subList(0, Math.min(n, all.size()));
    }

    /** Пора напомнить о перерыве: первый раз через breakMinutes, потом каждые 15 минут. */
    synchronized boolean breakDue(long now, int breakMinutes) {
        if (breakMinutes <= 0) return false;
        long s = session(now);
        long due = reminders == 0 ? breakMinutes * 60_000L : lastReminder + REPEAT;
        if (s < due) return false;
        reminders++;
        lastReminder = s;
        return true;
    }

    /** Ночью (с 23 до 5) один раз за ночь сказать, что пора спать — если сидит уже 10+ минут. */
    synchronized boolean nightDue(long now) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        int hour = c.get(Calendar.HOUR_OF_DAY);
        if (hour >= 5 && hour < 23) return false;
        if (session(now) < 10 * 60_000L) return false;
        c.add(Calendar.HOUR_OF_DAY, -6); // ночь с 23:00 до 05:00 относится к одному дню
        int night = c.get(Calendar.YEAR) * 1000 + c.get(Calendar.DAY_OF_YEAR);
        if (night == nightDay) return false;
        nightDay = night;
        return true;
    }

    /** восстановить сегодняшнее время по приложениям после перезапуска службы */
    synchronized void restore(int savedDay, Map<String, Long> saved, long now) {
        if (savedDay == dayOf(now)) {
            day = savedDay;
            today.putAll(saved);
        }
    }

    synchronized int day() {
        return day;
    }

    static int dayOf(long now) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        return c.get(Calendar.YEAR) * 1000 + c.get(Calendar.DAY_OF_YEAR);
    }

    /** «1 ч 5 мин», «40 мин», «меньше минуты» */
    static String format(long ms) {
        long min = ms / 60_000L;
        if (min < 1) return "меньше минуты";
        if (min < 60) return min + " мин";
        return (min / 60) + " ч" + (min % 60 == 0 ? "" : " " + (min % 60) + " мин");
    }
}
