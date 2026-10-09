package app.umnik;

import android.accessibilityservice.AccessibilityService;
import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.Display;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.Toast;

import com.anthropic.models.beta.messages.BetaOutputConfig;

import org.json.JSONObject;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import app.umnik.chess.Hint;

/**
 * Глаза Умника — служба спецвозможностей. Знает, какое приложение открыто, делает снимок экрана по нажатию
 * кнопки, считает время в телефоне и напоминает о перерывах, по желанию сама подсказывает по экрану.
 * Снимки никуда не сохраняются: уходят в Claude только вместе с вопросом.
 */
public final class UmnikService extends AccessibilityService implements Overlay.Actions {
    static volatile UmnikService instance;

    private static final long TICK = 30_000L;
    private static final long HIDE_FOR = 30 * 60_000L;
    private static final String CHANNEL = "breaks";
    /** в таких приложениях Умник сам на экран не смотрит */
    private static final String[] PRIVATE = {"bank", "sber", "tinkoff", "tbank", "vtb", "alfa", "raiffeisen", "pay",
            "wallet", "gosuslugi", "qiwi", "yoomoney", "password", "bitwarden", "keepass", "authenticator", "otp"};
    private static final String[] BREAK_PHRASES = {
            "Ты в телефоне уже %s без перерыва. Встань, потянись и посмотри в окно секунд двадцать 🙂",
            "%s подряд в экране! Попей воды и разомни шею — глазам тоже нужен отдых 👀",
            "Перерыв! %s в телефоне. Пройдись по комнате пару минут и возвращайся 🚶",
            "Уже %s без остановки. Закрой глаза на минуту и глубоко подыши — потом будет легче сосредоточиться 🌿"};

    final ScreenTime time = new ScreenTime();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService work = Executors.newCachedThreadPool();
    private final Executor captureThread = Executors.newSingleThreadExecutor();
    private final Set<String> keyboards = new HashSet<>();
    private final Deque<String> tips = new ArrayDeque<>();
    private final Random random = new Random();
    private Overlay overlay;
    private Speaker speaker;
    private String currentPkg;
    private boolean screenOn = true;
    private long nextWatch;
    private long lastWatchPrint;
    private long lastSave;
    private Shot chessShot;
    private int captureId;

    private final Runnable ticker = this::tick;
    private final Runnable showAgain = this::refreshBubble;

    private final BroadcastReceiver screen = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            long now = System.currentTimeMillis();
            String a = i.getAction();
            if (Intent.ACTION_SCREEN_OFF.equals(a)) {
                screenOn = false;
                time.screenOff(now);
                saveStats();
                overlay.hideCard();
            } else if (Intent.ACTION_SCREEN_ON.equals(a) || Intent.ACTION_USER_PRESENT.equals(a)) {
                if (!screenOn) time.screenOn(now);
                screenOn = true;
            }
            refreshBubble();
        }
    };

    private final SharedPreferences.OnSharedPreferenceChangeListener prefsChanged = (p, key) -> {
        if ("bubble".equals(key) || "hidden_until".equals(key)) refreshBubble();
        if ("watch_minutes".equals(key)) nextWatch = 0;
    };

    /* ---------- жизнь службы ---------- */

    @Override
    protected void onServiceConnected() {
        instance = this;
        overlay = new Overlay(this, this);
        speaker = new Speaker(this);
        restoreStats();
        loadKeyboards();
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_ON);
        f.addAction(Intent.ACTION_SCREEN_OFF);
        f.addAction(Intent.ACTION_USER_PRESENT);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(screen, f, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(screen, f);
        PowerManager pm = getSystemService(PowerManager.class);
        screenOn = pm == null || pm.isInteractive();
        if (screenOn) time.screenOn(System.currentTimeMillis());
        Prefs.of(this).registerOnSharedPreferenceChangeListener(prefsChanged);
        createChannel();
        refreshBubble();
        main.postDelayed(ticker, TICK);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent e) {
        if (e.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || e.getPackageName() == null) return;
        String pkg = e.getPackageName().toString();
        if (pkg.equals(getPackageName()) || pkg.equals("com.android.systemui") || pkg.equals("android")
                || keyboards.contains(pkg)) return;
        if (pkg.equals(currentPkg)) return;
        currentPkg = pkg;
        time.app(pkg, System.currentTimeMillis());
        overlay.setChessWanted(Apps.kind(this, pkg) == Apps.Kind.CHESS);
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration c) {
        super.onConfigurationChanged(c);
        if (overlay != null) overlay.reposition();
    }

    @Override
    public void onInterrupt() {
        if (speaker != null) speaker.stop();
    }

    @Override
    public boolean onUnbind(Intent intent) {
        stop();
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        stop();
        super.onDestroy();
    }

    private void stop() {
        if (instance != this) return;
        instance = null;
        main.removeCallbacksAndMessages(null);
        time.screenOff(System.currentTimeMillis());
        saveStats();
        try {
            unregisterReceiver(screen);
        } catch (RuntimeException ignored) {
        }
        Prefs.of(this).unregisterOnSharedPreferenceChangeListener(prefsChanged);
        if (overlay != null) overlay.removeAll();
        if (speaker != null) speaker.shutdown();
        work.shutdownNow();
    }

    /** окно помощника открылось или закрылось — кнопку в это время прячем */
    static void sheetVisible(boolean visible) {
        Session.sheetOpen = visible;
        UmnikService s = instance;
        if (s != null) s.main.post(s::refreshBubble);
    }

    private void refreshBubble() {
        if (overlay == null) return;
        long hidden = Prefs.hiddenUntil(this);
        boolean show = Prefs.bubble(this) && screenOn && !Session.sheetOpen && !locked()
                && System.currentTimeMillis() >= hidden;
        if (show) overlay.showBubble();
        else overlay.hideBubble();
        main.removeCallbacks(showAgain);
        if (hidden > System.currentTimeMillis()) main.postDelayed(showAgain, hidden - System.currentTimeMillis() + 500);
    }

    private boolean locked() {
        KeyguardManager k = getSystemService(KeyguardManager.class);
        return k != null && k.isKeyguardLocked();
    }

    private void loadKeyboards() {
        try {
            InputMethodManager imm = getSystemService(InputMethodManager.class);
            for (InputMethodInfo i : imm.getInputMethodList()) keyboards.add(i.getPackageName());
        } catch (RuntimeException ignored) {
        }
    }

    /* ---------- каждые полминуты: время, перерывы, сам-подсказки ---------- */

    private void tick() {
        long now = System.currentTimeMillis();
        if (screenOn && !locked()) {
            time.tick(now);
            if (Prefs.nightReminder(this) && time.nightDue(now)) remind(true);
            else if (time.breakDue(now, Prefs.breakMinutes(this))) remind(false);
            watch(now);
            if (now - lastSave > 2 * 60_000L) saveStats();
        }
        main.postDelayed(ticker, TICK);
    }

    private void remind(boolean night) {
        long session = time.session(System.currentTimeMillis());
        String fallback = night
                ? "Уже поздно — пора закругляться и ложиться спать 🌙 Сон важнее ленты."
                : String.format(BREAK_PHRASES[random.nextInt(BREAK_PHRASES.length)], ScreenTime.format(session));
        if (!Prefs.smartBreaks(this) || !Prefs.hasKey(this)) {
            showReminder(fallback);
            return;
        }
        String app = currentPkg == null ? "" : Apps.label(this, currentPkg);
        String ask = "Человек в телефоне без перерыва " + ScreenTime.format(session) + ". Сейчас открыто «" + app + "». "
                + Session.context(null, null) + (night ? " Уже ночь — главное, чтобы он лёг спать." : "");
        work.execute(() -> {
            String text;
            try {
                text = Session.brain(this).once(Prefs.model(this), Prompts.BREAK, ask, null, BetaOutputConfig.Effort.LOW, 1500);
            } catch (Brain.Failure e) {
                text = "";
            }
            String shown = text.isEmpty() ? fallback : text;
            main.post(() -> showReminder(shown));
        });
    }

    private void showReminder(String text) {
        if (overlay.bubbleVisible() && !Session.sheetOpen) {
            overlay.showMessage("⏰ Пора сделать перерыв", text, false);
        } else {
            notifyBreak(text);
        }
        if (Prefs.speak(this)) speaker.say(text);
    }

    /** Умник сам смотрит на экран, если это включено, — и молчит, если сказать нечего. */
    private void watch(long now) {
        int every = Prefs.watchMinutes(this);
        if (every <= 0 || Build.VERSION.SDK_INT < 30 || !Prefs.hasKey(this) || Session.sheetOpen) return;
        if (!overlay.bubbleVisible() || overlay.cardVisible() || now < nextWatch) return;
        nextWatch = now + every * 60_000L;
        if (currentPkg == null || Apps.kind(this, currentPkg) == Apps.Kind.HOME || isPrivate(currentPkg) || typingPassword()) return;
        capture(1600, shot -> {
            if (shot.jpeg == null || Shot.similar(shot.fingerprint, lastWatchPrint)) return;
            lastWatchPrint = shot.fingerprint;
            StringBuilder ask = new StringBuilder(Session.context(shot, time));
            if (!tips.isEmpty()) {
                ask.append("\n\nПрошлые подсказки:");
                for (String t : tips) ask.append("\n• ").append(t);
            }
            work.execute(() -> {
                try {
                    String tip = Session.brain(this).once(Prefs.model(this), Prompts.WATCH, ask.toString(), shot.jpeg,
                            BetaOutputConfig.Effort.LOW, 3000);
                    if (tip.isEmpty() || tip.toUpperCase(Locale.ROOT).startsWith("SKIP")) return;
                    tips.addLast(tip);
                    while (tips.size() > 5) tips.removeFirst();
                    main.post(() -> {
                        if (Session.sheetOpen || !overlay.bubbleVisible()) return;
                        overlay.showMessage("💡 Умник заметил", tip, true);
                        if (Prefs.speak(this)) speaker.say(tip);
                    });
                } catch (Brain.Failure ignored) {
                    // сам-подсказка — не страшно, если не вышла
                }
            });
        });
    }

    private static boolean isPrivate(String pkg) {
        String p = pkg.toLowerCase(Locale.ROOT);
        for (String w : PRIVATE) if (p.contains(w)) return true;
        return false;
    }

    private boolean typingPassword() {
        try {
            AccessibilityNodeInfo f = findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            return f != null && f.isPassword();
        } catch (RuntimeException e) {
            return false;
        }
    }

    /* ---------- снимок экрана ---------- */

    interface ShotReady {
        void done(Shot shot);
    }

    /** Сделать снимок (кнопку на это время прячем); готовый Shot приходит в главный поток. */
    void capture(int maxEdge, ShotReady ready) {
        String pkg = currentPkg;
        String app = pkg == null ? "" : Apps.label(this, pkg);
        Apps.Kind kind = Apps.kind(this, pkg);
        if (Build.VERSION.SDK_INT < 30) {
            ready.done(new Shot(null, null, pkg, app, kind, screenText(2000),
                    "снимки экрана Умник умеет с Android 11, пока вижу только текст", 0));
            return;
        }
        String text = null; // приложения, которые запрещают снимки, свой текст тоже не отдают
        overlay.hideForCapture();
        int id = ++captureId;
        // если система так и не ответила со снимком — кнопку всё равно вернуть
        main.postDelayed(() -> {
            if (id == captureId && overlay.capturing()) overlay.restoreAfterCapture();
        }, 4000);
        main.postDelayed(() -> takeScreenshot(Display.DEFAULT_DISPLAY, captureThread, new TakeScreenshotCallback() {
            @Override
            public void onSuccess(ScreenshotResult r) {
                Shot shot;
                try {
                    Bitmap hw = Bitmap.wrapHardwareBuffer(r.getHardwareBuffer(), r.getColorSpace());
                    Bitmap full = hw.copy(Bitmap.Config.ARGB_8888, false);
                    hw.recycle();
                    r.getHardwareBuffer().close();
                    if (Shot.blank(full)) {
                        shot = new Shot(null, null, pkg, app, kind, text, "это приложение запрещает снимки экрана", 0);
                    } else {
                        shot = new Shot(Shot.jpeg(full, maxEdge), Shot.scale(full, 360), pkg, app, kind, text, null,
                                Shot.fingerprint(full));
                    }
                } catch (RuntimeException e) {
                    shot = new Shot(null, null, pkg, app, kind, text, "снимок не получился", 0);
                }
                Shot done = shot;
                main.post(() -> {
                    overlay.restoreAfterCapture();
                    ready.done(done);
                });
            }

            @Override
            public void onFailure(int code) {
                main.post(() -> {
                    overlay.restoreAfterCapture();
                    ready.done(new Shot(null, null, pkg, app, kind, text, "снимок не получился (код " + code + ")", 0));
                });
            }
        }), 160);
    }

    /** текст с экрана из дерева спецвозможностей (без полей с паролями) */
    private String screenText(int limit) {
        StringBuilder s = new StringBuilder();
        try {
            collect(getRootInActiveWindow(), s, limit, 0);
        } catch (RuntimeException ignored) {
        }
        return s.toString().trim();
    }

    private static void collect(AccessibilityNodeInfo n, StringBuilder s, int limit, int depth) {
        if (n == null || s.length() >= limit || depth > 40) return;
        if (!n.isPassword()) {
            CharSequence t = n.getText();
            if (t == null || t.length() == 0) t = n.getContentDescription();
            if (t != null && t.length() > 0) s.append(t).append('\n');
        }
        for (int i = 0; i < n.getChildCount(); i++) collect(n.getChild(i), s, limit, depth + 1);
    }

    /* ---------- нажатия на кнопки поверх экрана ---------- */

    @Override
    public void onBubbleTap() {
        overlay.hideCard();
        capture(1600, shot -> openSheet(shot, null));
    }

    @Override
    public void onBubbleLongPress() {
        overlay.hideCard();
        Prefs.put(this, "hidden_until", System.currentTimeMillis() + HIDE_FOR);
        Toast.makeText(this, "Умник спрятался на 30 минут. Вернуть раньше — в приложении «Умник».", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onChessTap() {
        if (!Prefs.hasKey(this)) {
            overlay.showMessage("♟ Шахматы", "Сначала вставь ключ Claude в приложении «Умник».", false);
            return;
        }
        if (Build.VERSION.SDK_INT < 30) {
            overlay.showMessage("♟ Шахматы", "Чтобы видеть доску, нужен Android 11 или новее.", false);
            return;
        }
        overlay.hideCard();
        capture(2000, shot -> {
            if (shot.jpeg == null) {
                overlay.showMessage("♟ Шахматы", "Не вижу доску: " + shot.why + ".", false);
                return;
            }
            chessShot = shot;
            overlay.showProgress("Смотрю на доску и считаю ходы…");
            work.execute(() -> {
                try {
                    Hint h = Session.chess(Session.brain(this), Prefs.model(this), shot.jpeg);
                    main.post(() -> overlay.showChess(h));
                } catch (Brain.Failure e) {
                    main.post(() -> overlay.showMessage("♟ Не получилось", e.getMessage(), false));
                }
            });
        });
    }

    @Override
    public void onFlip() {
        Hint h = Session.hint;
        if (h == null) return;
        overlay.showProgress("Считаю за другую сторону…");
        work.execute(() -> {
            try {
                Hint f = Session.flip(h);
                main.post(() -> overlay.showChess(f));
            } catch (Brain.Failure e) {
                main.post(() -> overlay.showMessage("♟ Шахматы", e.getMessage(), false));
            }
        });
    }

    @Override
    public void onExplain() {
        Hint h = Session.hint;
        overlay.hideCard();
        newChat(chessShot);
        if (h != null) Session.setHint(h);
        open(AssistantActivity.EXPLAIN);
    }

    @Override
    public void onAskAbout(String text) {
        capture(1600, shot -> {
            newChat(shot);
            Session.note = "Ты сам только что подсказал по этому экрану: «" + text + "»";
            Session.lines.add(new Session.Line(false, "💡 " + text, null));
            open(null);
        });
    }

    void openSheet(Shot shot, String mode) {
        newChat(shot);
        open(mode);
    }

    private void newChat(Shot shot) {
        Session.start(shot, new Brain.Chat(Prefs.model(this), Prefs.about(this)));
    }

    private void open(String mode) {
        startActivity(new Intent(this, AssistantActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(AssistantActivity.MODE, mode));
    }

    /** окно попросило новый снимок: оно уже закрылось, ждём, пока исчезнет, снимаем и открываем снова */
    void recapture() {
        main.postDelayed(() -> capture(1600, shot -> {
            Session.refresh(shot);
            startActivity(new Intent(this, AssistantActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    .putExtra(AssistantActivity.MODE, AssistantActivity.REFRESHED));
        }), 450);
    }

    /* ---------- уведомления и статистика ---------- */

    private void createChannel() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Перерывы", NotificationManager.IMPORTANCE_DEFAULT));
    }

    private void notifyBreak(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle("⏰ Пора сделать перерыв")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(open)
                .setAutoCancel(true)
                .build();
        try {
            nm.notify(1, n);
        } catch (SecurityException ignored) {
            // уведомления запрещены — напоминание уже сказано вслух или показано
        }
    }

    private void saveStats() {
        lastSave = System.currentTimeMillis();
        try {
            JSONObject apps = new JSONObject();
            synchronized (time) {
                for (Map.Entry<String, Long> e : time.today.entrySet()) apps.put(e.getKey(), e.getValue());
            }
            Prefs.put(this, "stats", new JSONObject().put("day", time.day()).put("apps", apps).toString());
        } catch (Exception ignored) {
        }
    }

    private void restoreStats() {
        try {
            JSONObject o = new JSONObject(Prefs.of(this).getString("stats", "{}"));
            JSONObject apps = o.optJSONObject("apps");
            if (apps == null) return;
            Map<String, Long> saved = new HashMap<>();
            for (Iterator<String> it = apps.keys(); it.hasNext(); ) {
                String k = it.next();
                saved.put(k, apps.getLong(k));
            }
            time.restore(o.optInt("day", -1), saved, System.currentTimeMillis());
        } catch (Exception ignored) {
        }
    }

    /** сегодняшняя статистика для главного экрана (служба могла и не работать — тогда из сохранённого) */
    static String statsText(Context c) {
        UmnikService s = instance;
        ScreenTime t = s != null ? s.time : null;
        if (t == null) {
            t = new ScreenTime();
            try {
                JSONObject o = new JSONObject(Prefs.of(c).getString("stats", "{}"));
                JSONObject apps = o.optJSONObject("apps");
                Map<String, Long> saved = new HashMap<>();
                if (apps != null) for (Iterator<String> it = apps.keys(); it.hasNext(); ) {
                    String k = it.next();
                    saved.put(k, apps.getLong(k));
                }
                t.restore(o.optInt("day", -1), saved, System.currentTimeMillis());
            } catch (Exception ignored) {
            }
        }
        long now = System.currentTimeMillis();
        StringBuilder b = new StringBuilder("Сегодня в телефоне: ").append(ScreenTime.format(t.total()));
        if (s != null) b.append("\nБез перерыва сейчас: ").append(ScreenTime.format(t.session(now)));
        for (Map.Entry<String, Long> e : t.top(5)) {
            b.append("\n• ").append(Apps.label(c, e.getKey())).append(" — ").append(ScreenTime.format(e.getValue()));
        }
        return b.toString();
    }
}
