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

/**
 * Звонок будильника, как в «Часах»: служба сама играет мелодию на громкости будильника по кругу
 * и вибрирует — не зависит от звука уведомлений и беззвучного режима. Показывает экран звонка
 * поверх блокировки. Молчит после «Встал» / «Ещё 5 минут» или сама через 10 минут.
 */
public class AlarmService extends Service {
    static volatile boolean ringing;
    static volatile String ringingTitle = "";
    static volatile String ringingText = "";

    private static final long[] VIBRATE = {0, 800, 600};
    private static final long AUTO_STOP = 10 * 60_000L;

    private MediaPlayer player;
    private Vibrator vibrator;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoStop = this::stopSelf;

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
        handler.removeCallbacks(autoStop);
        handler.postDelayed(autoStop, AUTO_STOP);
        return START_NOT_STICKY;
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
        stopSound();
        if (vibrator != null) vibrator.cancel();
        ringing = false;
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        Alarms.cancelNotification(this);
        super.onDestroy();
    }
}
