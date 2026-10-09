package app.umnik;

import android.graphics.Bitmap;
import android.graphics.Color;

import java.io.ByteArrayOutputStream;

/** Снимок экрана для ИИ: JPEG (уменьшенный), маленькое превью и что за приложение было открыто. */
final class Shot {
    /** null — снимка нет (Android старше 11, приложение запрещает снимки или ошибка) */
    final byte[] jpeg;
    final Bitmap preview;
    final String pkg;
    final String app;
    final Apps.Kind kind;
    /** текст с экрана из спецвозможностей — запасной вариант, когда снимка нет */
    final String screenText;
    /** почему снимка нет — для подписи в окне */
    final String why;
    /** «отпечаток» картинки: если экран не менялся, повторно ИИ не спрашиваем */
    final long fingerprint;
    final long time = System.currentTimeMillis();

    Shot(byte[] jpeg, Bitmap preview, String pkg, String app, Apps.Kind kind, String screenText, String why, long fingerprint) {
        this.jpeg = jpeg;
        this.preview = preview;
        this.pkg = pkg;
        this.app = app;
        this.kind = kind;
        this.screenText = screenText;
        this.why = why;
        this.fingerprint = fingerprint;
    }

    /** Уменьшить так, чтобы длинная сторона была не больше maxEdge, и сжать в JPEG. */
    static byte[] jpeg(Bitmap full, int maxEdge) {
        Bitmap b = scale(full, maxEdge);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        b.compress(Bitmap.CompressFormat.JPEG, 85, out);
        if (b != full) b.recycle();
        return out.toByteArray();
    }

    static Bitmap scale(Bitmap full, int maxEdge) {
        int w = full.getWidth(), h = full.getHeight(), edge = Math.max(w, h);
        if (edge <= maxEdge) return full;
        float k = maxEdge / (float) edge;
        return Bitmap.createScaledBitmap(full, Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), true);
    }

    /** Почти чёрный снимок — приложение (банк, кино) запретило снимки экрана. */
    static boolean blank(Bitmap b) {
        int w = b.getWidth(), h = b.getHeight();
        for (int y = 0; y < 16; y++) {
            for (int x = 0; x < 16; x++) {
                int c = b.getPixel(x * (w - 1) / 15, y * (h - 1) / 15);
                if (Color.red(c) + Color.green(c) + Color.blue(c) > 30) return false;
            }
        }
        return true;
    }

    /** 64-битный отпечаток яркости 8×8: похожие экраны дают почти одинаковые числа */
    static long fingerprint(Bitmap b) {
        Bitmap s = Bitmap.createScaledBitmap(b, 8, 8, true);
        int[] lum = new int[64];
        long sum = 0;
        for (int i = 0; i < 64; i++) {
            int c = s.getPixel(i % 8, i / 8);
            lum[i] = Color.red(c) * 3 + Color.green(c) * 6 + Color.blue(c);
            sum += lum[i];
        }
        if (s != b) s.recycle();
        long avg = sum / 64, bits = 0;
        for (int i = 0; i < 64; i++) if (lum[i] > avg) bits |= 1L << i;
        return bits;
    }

    static boolean similar(long a, long b) {
        return Long.bitCount(a ^ b) <= 4;
    }
}
