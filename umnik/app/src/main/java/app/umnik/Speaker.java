package app.umnik;

import android.content.Context;
import android.speech.tts.TextToSpeech;

import java.util.Locale;

/** Читает ответы вслух голосом телефона (русский, если он установлен). */
final class Speaker {
    private TextToSpeech tts;
    private volatile boolean ready;
    private String pending;

    Speaker(Context c) {
        tts = new TextToSpeech(c.getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS || tts == null) return;
            int r = tts.setLanguage(new Locale("ru", "RU"));
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.getDefault());
            ready = true;
            if (pending != null) say(pending);
        });
    }

    void say(String text) {
        String s = Ui.forSpeech(text);
        if (s.isEmpty() || tts == null) return;
        if (!ready) {
            pending = s;
            return;
        }
        pending = null;
        // длинные ответы синтезатор не берёт целиком — режем по предложениям
        String[] parts = s.split("(?<=[.!?…])\\s+");
        StringBuilder chunk = new StringBuilder();
        int mode = TextToSpeech.QUEUE_FLUSH;
        for (String p : parts) {
            if (chunk.length() + p.length() > 3000) {
                tts.speak(chunk.toString(), mode, null, "umnik");
                mode = TextToSpeech.QUEUE_ADD;
                chunk.setLength(0);
            }
            chunk.append(p).append(' ');
        }
        if (chunk.length() > 0) tts.speak(chunk.toString(), mode, null, "umnik");
    }

    void stop() {
        pending = null;
        if (tts != null) tts.stop();
    }

    void shutdown() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
    }
}
