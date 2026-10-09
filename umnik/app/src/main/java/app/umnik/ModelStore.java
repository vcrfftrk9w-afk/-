package app.umnik;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.StatFs;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.security.MessageDigest;

/**
 * Файл бесплатного ИИ — Gemma 4 E2B от Google (лицензия Apache 2.0) для LiteRT-LM.
 * Качается один раз системным загрузчиком Android (с докачкой и уведомлением), лежит в папке приложения
 * и удаляется вместе с ним. После загрузки сверяем размер и SHA-256 с опубликованными.
 */
final class ModelStore {
    static final String NAME = "gemma-4-E2B-it.litertlm";
    static final long SIZE = 2_588_147_712L;
    /** сколько нужно места: сама модель и до гигабайта кэша, который ИИ делает себе для быстрого запуска */
    static final long NEED = SIZE + (1400L << 20);
    static final String SHA256 = "181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c";
    private static final String PATH = "litert-community/gemma-4-E2B-it-litert-lm/resolve/"
            + "b3ca0d2f076785a8f4b2219ddbd2bdb99954eae1/" + NAME;
    static final String URL = "https://huggingface.co/" + PATH;
    /** зеркало — если сам Hugging Face не открывается */
    static final String MIRROR = "https://hf-mirror.com/" + PATH;

    enum State { NONE, DOWNLOADING, CHECKING, READY, FAILED }

    static final class Status {
        final State state;
        final long done;
        final String error;

        Status(State state, long done, String error) {
            this.state = state;
            this.done = done;
            this.error = error;
        }

        int percent() {
            return (int) Math.min(100, done * 100 / SIZE);
        }
    }

    private ModelStore() {
    }

    static File file(Context c) {
        File dir = c.getExternalFilesDir("models");
        if (dir == null) dir = new File(c.getFilesDir(), "models");
        dir.mkdirs();
        return new File(dir, NAME);
    }

    /** файл скачан целиком и проверен */
    static boolean ready(Context c) {
        File f = file(c);
        return f.exists() && f.length() == SIZE && Prefs.of(c).getBoolean("model_verified", false);
    }

    /** сколько места свободно там, куда качаем */
    static long freeSpace(Context c) {
        try {
            return new StatFs(file(c).getParentFile().getPath()).getAvailableBytes();
        } catch (RuntimeException e) {
            return Long.MAX_VALUE;
        }
    }

    /** Начать загрузку. mobileData — можно и без Wi-Fi; mirror — качать с зеркала. */
    static void start(Context c, boolean mobileData, boolean mirror) {
        cancel(c);
        File f = file(c);
        if (f.exists()) f.delete();
        DownloadManager dm = c.getSystemService(DownloadManager.class);
        DownloadManager.Request r = new DownloadManager.Request(Uri.parse(mirror ? MIRROR : URL))
                .setTitle("Умник: бесплатный ИИ")
                .setDescription("Gemma 4 — 2,6 ГБ, качается один раз")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setAllowedOverMetered(mobileData)
                .setAllowedOverRoaming(false)
                .setDestinationInExternalFilesDir(c, "models", NAME);
        long id = dm.enqueue(r);
        Prefs.of(c).edit().putLong("model_download", id).putBoolean("model_verified", false)
                .putBoolean("model_mirror", mirror).remove("model_error").apply();
    }

    static void cancel(Context c) {
        long id = Prefs.of(c).getLong("model_download", -1);
        if (id >= 0) {
            try {
                c.getSystemService(DownloadManager.class).remove(id);
            } catch (RuntimeException ignored) {
            }
        }
        Prefs.of(c).edit().remove("model_download").apply();
    }

    static void delete(Context c) {
        cancel(c);
        LocalMind.release();
        file(c).delete();
        File[] cache = c.getCacheDir().listFiles();
        if (cache != null) for (File f : cache) if (f.getName().startsWith(NAME)) f.delete();
        Prefs.of(c).edit().putBoolean("model_verified", false).remove("model_error").remove("gpu_failed").apply();
    }

    /** Где сейчас загрузка. Готовый файл проверяет в фоне (это секунд 10–30). */
    static Status status(Context c) {
        if (ready(c)) return new Status(State.READY, SIZE, null);
        String error = Prefs.of(c).getString("model_error", null);
        long id = Prefs.of(c).getLong("model_download", -1);
        if (id < 0) {
            File f = file(c);
            if (f.exists() && f.length() == SIZE) {
                verifyInBackground(c);
                return new Status(State.CHECKING, SIZE, null);
            }
            return new Status(error == null ? State.NONE : State.FAILED, 0, error);
        }
        DownloadManager dm = c.getSystemService(DownloadManager.class);
        try (Cursor q = dm.query(new DownloadManager.Query().setFilterById(id))) {
            if (q == null || !q.moveToFirst()) {
                Prefs.of(c).edit().remove("model_download").apply();
                return new Status(State.NONE, 0, null);
            }
            int st = q.getInt(q.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
            long done = q.getLong(q.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
            if (st == DownloadManager.STATUS_SUCCESSFUL) {
                Prefs.of(c).edit().remove("model_download").apply();
                verifyInBackground(c);
                return new Status(State.CHECKING, SIZE, null);
            }
            if (st == DownloadManager.STATUS_FAILED) {
                int reason = q.getInt(q.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                String why = reason == DownloadManager.ERROR_INSUFFICIENT_SPACE ? "не хватило места в памяти телефона"
                        : reason == DownloadManager.ERROR_CANNOT_RESUME ? "загрузка оборвалась — начни заново"
                        : "сайт с моделью не ответил (код " + reason + "). Попробуй зеркало";
                Prefs.of(c).edit().remove("model_download").putString("model_error", why).apply();
                return new Status(State.FAILED, done, why);
            }
            String paused = st == DownloadManager.STATUS_PAUSED ? waitReason(q) : null;
            return new Status(State.DOWNLOADING, done, paused);
        }
    }

    private static String waitReason(Cursor q) {
        int reason = q.getInt(q.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
        if (reason == DownloadManager.PAUSED_QUEUED_FOR_WIFI) return "ждёт Wi-Fi";
        if (reason == DownloadManager.PAUSED_WAITING_FOR_NETWORK) return "ждёт интернет";
        return "пауза, скоро продолжится";
    }

    private static volatile boolean checking;

    private static void verifyInBackground(Context c) {
        if (checking) return;
        checking = true;
        Context app = c.getApplicationContext();
        new Thread(() -> {
            try {
                boolean ok = SHA256.equals(sha256(file(app)));
                if (ok) {
                    Prefs.of(app).edit().putBoolean("model_verified", true).remove("model_error").apply();
                } else {
                    file(app).delete();
                    Prefs.of(app).edit().putString("model_error", "файл скачался с ошибкой — скачай ещё раз").apply();
                }
            } catch (Exception e) {
                Prefs.of(app).edit().putString("model_error", "не получилось проверить файл: " + e.getMessage()).apply();
            } finally {
                checking = false;
            }
        }, "umnik-model-check").start();
    }

    static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] buf = new byte[1 << 20];
        try (InputStream in = new FileInputStream(f)) {
            for (int n; (n = in.read(buf)) > 0; ) md.update(buf, 0, n);
        }
        StringBuilder s = new StringBuilder();
        for (byte b : md.digest()) s.append(String.format("%02x", b));
        return s.toString();
    }
}
