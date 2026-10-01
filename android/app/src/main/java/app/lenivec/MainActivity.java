package app.lenivec;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.media.RingtoneManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Приложение целиком лежит внутри APK (assets) и открывается в WebView по адресу
 * https://appassets.androidplatform.net/assets/index.html — у страницы постоянный адрес,
 * поэтому прогресс в localStorage сохраняется между запусками и обновлениями.
 * Мост AndroidApp даёт странице то, чего нет в WebView: голос, уведомления, сохранение файлов.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";
    private static final String CHANNEL = "reminders";
    private static final int REQ_NOTIFY = 1;
    private static final int REQ_FILE = 2;
    private static final int REQ_SOUND = 3;

    private WebView web;
    private TextToSpeech tts;
    private volatile boolean ttsReady;
    private ValueCallback<Uri[]> fileCallback;
    private int notifyId = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0F0E17);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                // внешние ссылки (Telegram, Google Календарь, YouTube) — в их приложениях или браузере
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException e) {
                    toast("Нечем открыть ссылку");
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(pick, "Выбери файл"), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidApp");

        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int r = tts.setLanguage(new Locale("ru", "RU"));
                ttsReady = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // будильник звонит, а человек открыл приложение — показываем экран с кнопками
        if (AlarmService.ringing) {
            startActivity(new Intent(this, AlarmActivity.class)
                    .putExtra(Alarms.EXTRA_TITLE, AlarmService.ringingTitle)
                    .putExtra(Alarms.EXTRA_TEXT, AlarmService.ringingText));
        }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_SOUND) {
            if (resultCode == RESULT_OK && data != null) {
                Uri picked = data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
                if (picked != null) Alarms.setSound(this, picked);
            }
            web.evaluateJavascript("window.onAlarmSound && window.onAlarmSound()", null);
            return;
        }
        if (requestCode == REQ_FILE && fileCallback != null) {
            Uri uri = (resultCode == RESULT_OK && data != null) ? data.getData() : null;
            fileCallback.onReceiveValue(uri == null ? null : new Uri[]{uri});
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIFY) prefs().edit().putBoolean("notifyAsked", true).apply();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences("app", Context.MODE_PRIVATE);
    }

    private void toast(String text) {
        runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_SHORT).show());
    }

    private String notifyState() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                return nm.areNotificationsEnabled() ? "granted" : "denied";
            }
            return prefs().getBoolean("notifyAsked", false) ? "denied" : "default";
        }
        return nm.areNotificationsEnabled() ? "granted" : "denied";
    }

    /** То, что страница может вызвать как window.AndroidApp.* (см. js/android.js). */
    private class Bridge {
        @JavascriptInterface
        public void speak(String text, float rate) {
            if (!ttsReady || text == null) return;
            tts.setSpeechRate(rate > 0 ? rate : 1f);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "say");
        }

        @JavascriptInterface
        public void stopSpeaking() {
            if (tts != null) tts.stop();
        }

        @JavascriptInterface
        public String notifyState() {
            return MainActivity.this.notifyState();
        }

        @JavascriptInterface
        public void requestNotify() {
            if (Build.VERSION.SDK_INT >= 33 && !"granted".equals(MainActivity.this.notifyState())) {
                runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIFY));
            }
        }

        @JavascriptInterface
        public void notify(String title, String body) {
            if (!"granted".equals(MainActivity.this.notifyState())) return;
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
                nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Напоминания", NotificationManager.IMPORTANCE_HIGH));
            }
            Intent open = new Intent(MainActivity.this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent tap = PendingIntent.getActivity(MainActivity.this, 0, open, PendingIntent.FLAG_IMMUTABLE);
            android.app.Notification.Builder b = Build.VERSION.SDK_INT >= 26
                    ? new android.app.Notification.Builder(MainActivity.this, CHANNEL)
                    : new android.app.Notification.Builder(MainActivity.this);
            b.setSmallIcon(android.R.drawable.ic_popup_reminder)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new android.app.Notification.BigTextStyle().bigText(body))
                    .setContentIntent(tap)
                    .setAutoCancel(true);
            nm.notify(notifyId++, b.build());
        }

        /** Будильники из графика: JSON-массив {dow, min, title, text}; dow 0 — воскресенье. */
        @JavascriptInterface
        public String setAlarms(String json) {
            Alarms.save(MainActivity.this, json);
            Alarms.scheduleAll(MainActivity.this);
            return Alarms.status(MainActivity.this);
        }

        @JavascriptInterface
        public String alarmStatus() {
            return Alarms.status(MainActivity.this);
        }

        /** проверка: звонит прямо сейчас — со звуком, экраном и кнопками */
        @JavascriptInterface
        public void ringNow() {
            Alarms.ring(MainActivity.this, "🔔 Проверка будильника", "Так он зазвонит утром. Нажми «Встал», чтобы выключить.");
        }

        /** будильник говорит название дела голосом — вкл/выкл */
        @JavascriptInterface
        public void setAlarmVoice(boolean on) {
            Alarms.setVoice(MainActivity.this, on);
        }

        /** выбрать мелодию будильника из мелодий телефона */
        @JavascriptInterface
        public void pickSound() {
            Intent i = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER)
                    .putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM)
                    .putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Мелодия будильника")
                    .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
                    .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
            Uri cur = Alarms.chosenSound(MainActivity.this);
            if (cur != null) i.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, cur);
            runOnUiThread(() -> {
                try {
                    startActivityForResult(i, REQ_SOUND);
                } catch (ActivityNotFoundException e) {
                    toast("На этом телефоне нельзя выбрать мелодию — будет звучать мелодия будильника из «Часов»");
                }
            });
        }

        /** проверка: будильник зазвонит через минуту */
        @JavascriptInterface
        public void testAlarm() {
            Alarms.snooze(MainActivity.this, "🔔 Проверка будильника", "Работает! Так же он разбудит тебя утром.", 1);
        }

        /** открыть нужный экран настроек: notify, exact, fullscreen */
        @JavascriptInterface
        public void openSettings(String which) {
            Intent i;
            Uri pkg = Uri.parse("package:" + getPackageName());
            if ("exact".equals(which) && Build.VERSION.SDK_INT >= 31) {
                i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg);
            } else if ("fullscreen".equals(which) && Build.VERSION.SDK_INT >= 34) {
                i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg);
            } else if (Build.VERSION.SDK_INT >= 26) {
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg);
            }
            try {
                startActivity(i);
            } catch (ActivityNotFoundException e) {
                try {
                    startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg));
                } catch (ActivityNotFoundException ignored) {
                    toast("Открой настройки приложения вручную");
                }
            }
        }

        /** Скачивание из приложения (календарь .ics, отчёт, резервная копия) — в папку «Загрузки». */
        @JavascriptInterface
        public void saveFile(String name, String mime, String text) {
            String safe = (name == null || name.isEmpty()) ? "lenivec.txt" : name.replaceAll("[\\\\/:*?\"<>|]", "_");
            byte[] bytes = (text == null ? "" : text).getBytes(StandardCharsets.UTF_8);
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime == null || mime.isEmpty() ? "text/plain" : mime.split(";")[0]);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IllegalStateException("no uri");
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                        out.write(bytes);
                    }
                    toast("Сохранено в «Загрузки»: " + safe);
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    File f = new File(dir, safe);
                    try (FileOutputStream out = new FileOutputStream(f)) {
                        out.write(bytes);
                    }
                    toast("Сохранено: " + f.getAbsolutePath());
                }
            } catch (Exception e) {
                toast("Не получилось сохранить файл");
            }
        }
    }
}
