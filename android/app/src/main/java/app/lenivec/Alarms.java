package app.lenivec;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Будильники приложения: подъём и публикации по графику недели.
 * Страница присылает список {dow, min, title, text, skip?} (dow: 0 — воскресенье), мы храним его
 * и ставим каждый на ближайший такой день недели через AlarmManager.setAlarmClock —
 * это настоящий будильник: срабатывает минута в минуту, в режиме сна и при закрытом приложении.
 */
final class Alarms {
    static final String ACTION_FIRE = "app.lenivec.ALARM_FIRE";
    static final String ACTION_SNOOZE = "app.lenivec.ALARM_SNOOZE";
    static final String ACTION_DISMISS = "app.lenivec.ALARM_DISMISS";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_TEXT = "text";
    static final int RING_ID = 777;
    static final int SNOOZE_MIN = 5;

    private static final String CHANNEL = "alarm_ring";
    private static final int CODE_BASE = 1000;
    private static final int CODE_SNOOZE = 999;

    private Alarms() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("alarms", Context.MODE_PRIVATE);
    }

    static void save(Context c, String json) {
        prefs(c).edit().putString("list", json == null ? "[]" : json).apply();
    }

    static JSONArray list(Context c) {
        try {
            return new JSONArray(prefs(c).getString("list", "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        return c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    static boolean canFullScreen(Context c) {
        if (Build.VERSION.SDK_INT < 34) return true;
        return c.getSystemService(NotificationManager.class).canUseFullScreenIntent();
    }

    /** дата будильника в виде «2026-10-08» — как State.todayKey() на странице */
    static String dayKey(long at) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(at));
    }

    /** ближайший момент «день недели dow, минута дня min» строго позже now */
    static long nextTime(int dow, int min, long now) {
        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(now);
        cal.set(Calendar.HOUR_OF_DAY, min / 60);
        cal.set(Calendar.MINUTE, min % 60);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        int ahead = ((dow + 1) - cal.get(Calendar.DAY_OF_WEEK) + 7) % 7; // Calendar.SUNDAY == 1
        cal.add(Calendar.DAY_OF_YEAR, ahead);
        if (cal.getTimeInMillis() <= now) cal.add(Calendar.DAY_OF_YEAR, 7);
        return cal.getTimeInMillis();
    }

    private static PendingIntent fireIntent(Context c, int code, String title, String text) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION_FIRE)
                .putExtra(EXTRA_TITLE, title).putExtra(EXTRA_TEXT, text);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void setAlarm(Context c, long at, PendingIntent fire) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        if (canExact(c)) {
            PendingIntent show = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire); // без разрешения — может опоздать на несколько минут
        }
    }

    /** снять старые и поставить все будильники из списка на ближайшие дни */
    static void scheduleAll(Context c) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        SharedPreferences p = prefs(c);
        int old = p.getInt("scheduled", 0);
        for (int i = 0; i < old; i++) am.cancel(fireIntent(c, CODE_BASE + i, null, null));

        JSONArray arr = list(c);
        long now = System.currentTimeMillis();
        long next = 0;
        String nextTitle = "";
        for (int i = 0; i < arr.length(); i++) {
            JSONObject a = arr.optJSONObject(i);
            if (a == null) continue;
            long at = nextTime(a.optInt("dow"), a.optInt("min"), now);
            // дело на сегодня уже сделано (урок пройден, «Встал» нажат) — сегодня не звоним, следующий раз через неделю
            String skip = a.optString("skip", "");
            if (!skip.isEmpty() && skip.equals(dayKey(at))) at = nextTime(a.optInt("dow"), a.optInt("min"), at);
            setAlarm(c, at, fireIntent(c, CODE_BASE + i, a.optString("title"), a.optString("text")));
            if (next == 0 || at < next) {
                next = at;
                nextTitle = a.optString("title");
            }
        }
        p.edit().putInt("scheduled", arr.length()).putLong("next", next).putString("nextTitle", nextTitle).apply();
    }

    /** разовый будильник через minutes минут — «ещё 5 минут» и проверка */
    static void snooze(Context c, String title, String text, int minutes) {
        long at = System.currentTimeMillis() + minutes * 60_000L;
        setAlarm(c, at, fireIntent(c, CODE_SNOOZE, title, text));
        prefs(c).edit().putLong("snooze", at).apply();
    }

    static String status(Context c) {
        try {
            SharedPreferences p = prefs(c);
            JSONObject o = new JSONObject();
            o.put("exact", canExact(c));
            o.put("fullScreen", canFullScreen(c));
            o.put("count", p.getInt("scheduled", 0));
            o.put("next", p.getLong("next", 0));
            o.put("nextTitle", p.getString("nextTitle", ""));
            long snooze = p.getLong("snooze", 0);
            o.put("snooze", snooze > System.currentTimeMillis() ? snooze : 0);
            o.put("sound", soundName(c));
            o.put("voice", voiceOn(c));
            return o.toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    /** выбранная мелодия, затем мелодия будильника телефона, затем любые стандартные — что сыграет */
    static java.util.List<Uri> soundCandidates(Context c) {
        java.util.LinkedHashSet<Uri> out = new java.util.LinkedHashSet<>();
        String chosen = prefs(c).getString("sound", null);
        if (chosen != null) out.add(Uri.parse(chosen));
        Uri[] std = {
                RingtoneManager.getActualDefaultRingtoneUri(c, RingtoneManager.TYPE_ALARM),
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
        };
        for (Uri u : std) if (u != null) out.add(u);
        return new java.util.ArrayList<>(out);
    }

    static Uri chosenSound(Context c) {
        String s = prefs(c).getString("sound", null);
        return s == null ? null : Uri.parse(s);
    }

    static void setSound(Context c, Uri uri) {
        prefs(c).edit().putString("sound", uri == null ? null : uri.toString()).apply();
    }

    static String soundName(Context c) {
        try {
            java.util.List<Uri> list = soundCandidates(c);
            if (list.isEmpty()) return "";
            android.media.Ringtone r = RingtoneManager.getRingtone(c, list.get(0));
            return r == null ? "" : r.getTitle(c);
        } catch (Exception e) {
            return "";
        }
    }

    private static final long[] VIBRATE = {0, 800, 600, 800, 600, 800};
    private static final String CHANNEL_SCREEN = "alarm_screen"; // экран звонка; звук играет AlarmService

    private static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL_SCREEN) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_SCREEN, "Будильник", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Экран звонка будильника. Мелодию играет сам будильник, на громкости будильника.");
            ch.setSound(null, null);
            ch.enableVibration(false);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
        if (nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Будильник (запасной звук)", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Если телефон не дал запустить будильник — звонит этим уведомлением");
            java.util.List<Uri> snd = soundCandidates(c);
            ch.setSound(snd.isEmpty() ? null : snd.get(0), new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            ch.enableVibration(true);
            ch.setVibrationPattern(VIBRATE);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
    }

    /* ---------- голос будильника ---------- */
    static boolean voiceOn(Context c) {
        return prefs(c).getBoolean("voice", true);
    }

    static void setVoice(Context c, boolean on) {
        prefs(c).edit().putBoolean("voice", on).apply();
    }

    /** что сказать голосом: название дела без эмодзи и значков («💪 Тренировка» → «Тренировка! Пора.») */
    static String spokenPhrase(String title) {
        String t = title == null ? "" : title;
        if (t.contains("Проверка")) return "Проверка будильника. Так я скажу название дела.";
        if (t.contains("Подъём")) return "Подъём! Доброе утро. Пора вставать.";
        String clean = t.replaceAll("[«»\"]", "")
                .replace("TikTok", "тикток").replace("orca", "орка").replace("YouTube", "ютуб").replace("OLX", "о-эл-икс")
                .replaceAll("[^\\p{L}\\p{N}\\s.,:!?\\-—]", "")
                .replaceAll("\\s+", " ")
                .trim();
        if (clean.isEmpty() || clean.equals("Будильник")) return "Будильник! Пора.";
        return clean.endsWith("!") || clean.endsWith(".") ? clean + " Пора." : clean + "! Пора.";
    }

    /** подъём — «Встал», своё дело или публикация — «Начинаю» */
    static String okLabel(String title) {
        return title != null && (title.contains("Подъём") || title.contains("Будильник") || title.contains("Проверка")) ? "✅ Встал!" : "✅ Начинаю!";
    }

    /** уведомление звонка: экран поверх блокировки и кнопки «Встал» / «Ещё 5 минут» */
    static Notification ringNotification(Context c, String title, String text, boolean silent) {
        ensureChannels(c);
        Intent full = new Intent(c, AlarmActivity.class)
                .putExtra(EXTRA_TITLE, title).putExtra(EXTRA_TEXT, text)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent fullPi = PendingIntent.getActivity(c, 1, full, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent dismiss = PendingIntent.getBroadcast(c, 2,
                new Intent(c, AlarmReceiver.class).setAction(ACTION_DISMISS),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent snooze = PendingIntent.getBroadcast(c, 3,
                new Intent(c, AlarmReceiver.class).setAction(ACTION_SNOOZE).putExtra(EXTRA_TITLE, title).putExtra(EXTRA_TEXT, text),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(c, silent ? CHANNEL_SCREEN : CHANNEL)
                : new Notification.Builder(c);
        b.setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(fullPi)
                .setFullScreenIntent(fullPi, true)
                .addAction(new Notification.Action.Builder(null, okLabel(title), dismiss).build())
                .addAction(new Notification.Action.Builder(null, "😴 Ещё " + SNOOZE_MIN + " мин", snooze).build());
        if (Build.VERSION.SDK_INT >= 26) {
            if (!silent) b.setTimeoutAfter(10 * 60_000L); // не звонить бесконечно, если телефон далеко
        } else {
            b.setPriority(Notification.PRIORITY_MAX);
            if (!silent) {
                java.util.List<Uri> snd = soundCandidates(c);
                if (!snd.isEmpty()) b.setSound(snd.get(0), AudioManager.STREAM_ALARM);
                b.setVibrate(VIBRATE);
            }
        }
        Notification n = b.build();
        if (!silent) n.flags |= Notification.FLAG_INSISTENT; // звук по кругу, пока не выключишь
        return n;
    }

    /** звонок: служба играет мелодию; если телефон не дал её запустить — звонит само уведомление */
    static void ring(Context c, String title, String text) {
        try {
            AlarmService.start(c, title, text);
        } catch (Exception e) {
            c.getSystemService(NotificationManager.class).notify(RING_ID, ringNotification(c, title, text, false));
        }
    }

    static void cancelNotification(Context c) {
        c.getSystemService(NotificationManager.class).cancel(RING_ID);
    }

    static void stopRinging(Context c) {
        AlarmService.stop(c);
        cancelNotification(c);
    }
}
