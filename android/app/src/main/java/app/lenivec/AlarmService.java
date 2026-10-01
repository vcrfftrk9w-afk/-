package app.lenivec;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;

/**
 * Звонок будильника, как в «Часах»: служба сама играет мелодию на громкости будильника по кругу
 * и вибрирует — не зависит от звука уведомлений и беззвучного режима. Показывает экран звонка
 * поверх блокировки. Голосом говорит, что за дело («Тренировка! Пора»), мелодия на это время
 * стихает, и так каждые 20 секунд. Молчит после «Встал» / «Ещё 5 минут» или сама через 10 минут.
 */
public class AlarmService extends Service {
    static volatile boolean ringing;
    static volatile String ringingTitle = "";
    static volatile String ringingText = "";

    private static final long[] VIBRATE = {0, 800, 600};
    private static final long AUTO_STOP = 10 * 60_000L;
    private static final long VOICE_FIRST = 2_000L;   // сначала мелодия, через 2 секунды — голос
    private static final long VOICE_EVERY = 20_000L;  // и повторять каждые 20 секунд

    private MediaPlayer player;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoStop = this::stopSelf;
    private TextToSpeech tts;
    private volatile boolean ttsReady;
    private String phrase = "";
    private final Runnable sayAgain = this::say;

    static void start(Context c, String title, String text) {
        Intent i = new Intent(c, AlarmService.class)
                .putExtra(Alarms.EXTRA_TITLE, title).putExtra(Alarms.EXTRA_TEXT, text);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i);
        else c.startService(i);
    }

    static void stop(Context c) {
        c.stopService(new Intent(c, AlarmService.class));
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent == null ? null : intent.getStringExtra(Alarms.EXTRA_TITLE);
        String text = intent == null ? null : intent.getStringExtra(Alarms.EXTRA_TEXT);
        ringingTitle = title == null ? "⏰ Будильник" : title;
        ringingText = text == null ? "" : text;

        Notification n = Alarms.ringNotification(this, ringingTitle, ringingText, true);
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(Alarms.RING_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(Alarms.RING_ID, n);
        }
        ringing = true;
        play();
        vibrate();
        startVoice();
        handler.removeCallbacks(autoStop);
        handler.postDelayed(autoStop, AUTO_STOP);
        return START_NOT_STICKY;
    }

    /* ---------- голос: говорит название дела ---------- */
    private void startVoice() {
        handler.removeCallbacks(sayAgain);
        if (!Alarms.voiceOn(this)) return;
        phrase = Alarms.spokenPhrase(ringingTitle);
        if (tts != null) { handler.postDelayed(sayAgain, VOICE_FIRST); return; }
        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS || tts == null) return;
            int r = tts.setLanguage(new Locale("ru", "RU"));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) return; // нет русского голоса — только мелодия
            tts.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)            // на громкости будильника, даже в беззвучном
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {}
                @Override public void onDone(String id) { handler.post(() -> duck(false)); }
                @Override public void onError(String id) { handler.post(() -> duck(false)); }
            });
            ttsReady = true;
            handler.postDelayed(sayAgain, VOICE_FIRST);
        });
    }

    private void say() {
        if (!ringing || !ttsReady || tts == null || phrase.isEmpty()) return;
        duck(true);
        tts.speak(phrase, TextToSpeech.QUEUE_FLUSH, null, "alarm");
        handler.postDelayed(sayAgain, VOICE_EVERY);
    }

    /** пока говорит — мелодия тише, чтобы слова было слышно */
    private void duck(boolean quiet) {
        if (player == null) return;
        try {
            float v = quiet ? 0.15f : 1f;
            player.setVolume(v, v);
        } catch (Exception ignored) {
        }
    }

    private void play() {
        stopSound();
        AudioManager am = getSystemService(AudioManager.class);
        try {
            // громкость будильника на нуле — звонок бесполезен: поднимаем до 60%
            if (am.getStreamVolume(AudioManager.STREAM_ALARM) == 0) {
                am.setStreamVolume(AudioManager.STREAM_ALARM, Math.max(1, am.getStreamMaxVolume(AudioManager.STREAM_ALARM) * 6 / 10), 0);
            }
        } catch (Exception ignored) {
            // режим «Не беспокоить» может запретить менять громкость
        }
        for (Uri uri : Alarms.soundCandidates(this)) {
            try {
                MediaPlayer mp = new MediaPlayer();
                mp.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
                mp.setDataSource(this, uri);
                mp.setLooping(true);
                mp.prepare();
                mp.start();
                player = mp;
                return;
            } catch (Exception e) {
                // мелодия недоступна — пробуем следующую
            }
        }
    }

    private void vibrate() {
        vibrator = getSystemService(Vibrator.class);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                vibrator.vibrate(VibrationEffect.createWaveform(VIBRATE, 0),
                        new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
            } else {
                vibrator.vibrate(VIBRATE, 0);
            }
        } catch (Exception ignored) {
        }
    }

    private void stopSound() {
        if (player != null) {
            try {
                player.stop();
            } catch (Exception ignored) {
            }
            player.release();
            player = null;
        }
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(autoStop);
        handler.removeCallbacks(sayAgain);
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        stopSound();
        if (vibrator != null) vibrator.cancel();
        ringing = false;
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        Alarms.cancelNotification(this);
        super.onDestroy();
    }
}
