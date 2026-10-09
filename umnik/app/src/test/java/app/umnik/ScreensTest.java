package app.umnik;

import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.view.View;
import android.widget.FrameLayout;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Arrays;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

import app.umnik.chess.Hint;

/**
 * Экраны собираются без падений и рисуются; картинки — в build/screens для глаз.
 * Устройство — обычный телефон 393×852 dp.
 */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35, qualifiers = "w393dp-h852dp-xxhdpi")
public class ScreensTest {
    private static final File DIR = new File("build/screens");

    @Before
    public void clean() {
        DIR.mkdirs();
        Session.start(null, null);
        Prefs.of(org.robolectric.RuntimeEnvironment.getApplication()).edit().clear().commit();
    }

    private static void snap(View root, String name, boolean appBelow) throws Exception {
        int w = root.getWidth(), h = root.getHeight();
        if (w == 0 || h == 0) {
            w = 1179;
            h = 2556;
            root.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
            root.layout(0, 0, w, h);
        }
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        if (appBelow) fakeApp(c, w, h);
        root.draw(c);
        try (FileOutputStream out = new FileOutputStream(new File(DIR, name))) {
            b.compress(Bitmap.CompressFormat.PNG, 100, out);
        }
    }

    /** что-то вроде приложения под окном помощника */
    private static void fakeApp(Canvas c, int w, int h) {
        Paint p = new Paint();
        c.drawColor(Color.WHITE);
        p.setColor(0xFF2AABEE);
        c.drawRect(0, 0, w, 260, p);
        p.setColor(0xFFE9EEF3);
        for (int y = 340; y < h; y += 240) c.drawRoundRect(60, y, w * 0.7f, y + 170, 40, 40, p);
    }

    private static <T extends Activity> T start(Class<T> cls) {
        return Robolectric.buildActivity(cls).setup().get();
    }

    @Test
    public void mainScreen() throws Exception {
        MainActivity a = start(MainActivity.class);
        snap(a.getWindow().getDecorView(), "main.png", false);
    }

    @Test
    @Config(qualifiers = "+night")
    public void mainScreenNight() throws Exception {
        Prefs.put(org.robolectric.RuntimeEnvironment.getApplication(), "api_key", "sk-ant-test-1234");
        MainActivity a = start(MainActivity.class);
        snap(a.getWindow().getDecorView(), "main-night.png", false);
    }

    @Test
    public void sheetWithConversation() throws Exception {
        Prefs.put(org.robolectric.RuntimeEnvironment.getApplication(), "api_key", "sk-ant-test-1234");
        Session.start(new Shot(null, null, "org.telegram.messenger", "Telegram", Apps.Kind.MESSENGER, null,
                "это приложение запрещает снимки экрана", 0), new Brain.Chat(Brain.OPUS, ""));
        Session.lines.add(new Session.Line(true, "✍️ Помоги ответить", null));
        Session.lines.add(new Session.Line(false, "Вот три варианта:\n1. Привет! Да, давай в субботу в 12?\n"
                + "2. Отличная идея, я за!\n3. Суббота подходит, только могу после обеда.", null));
        AssistantActivity a = start(AssistantActivity.class);
        snap(a.getWindow().getDecorView(), "sheet.png", true);
    }

    @Test
    public void sheetWithChessHint() throws Exception {
        Prefs.put(org.robolectric.RuntimeEnvironment.getApplication(), "api_key", "sk-ant-test-1234");
        Hint h = Hint.analyze(Arrays.asList("r.bqkbnr", "pppp.ppp", "..n.....", "....p..Q",
                "..B.P...", "........", "PPPP.PPP", "RNB.K.NR"), true, "unknown", 500);
        Session.start(new Shot(null, null, "com.chess", "Chess", Apps.Kind.CHESS, null, "снимок не получился", 0),
                new Brain.Chat(Brain.OPUS, ""));
        Session.lines.add(new Session.Line(true, "♟ Лучший ход", null));
        Session.lines.add(new Session.Line(false, h.headline, h));
        AssistantActivity a = start(AssistantActivity.class);
        snap(a.getWindow().getDecorView(), "sheet-chess.png", true);
        assertTrue(h.headline, h.headline.contains("f7"));
    }

    @Test
    public void overlayCards() throws Exception {
        Activity host = start(Activity.class);
        Overlay o = new Overlay(host, null);
        // после 1.e4, играем чёрными — доска на экране перевёрнута
        Hint h = Hint.analyze(Arrays.asList("RNBKQBNR", "PPP.PPPP", "........", "...P....",
                "........", "........", "pppppppp", "rnbkqbnr"), false, "black", 500);
        FrameLayout page = new FrameLayout(host);
        page.setPadding(30, 200, 30, 0);
        android.widget.LinearLayout column = Ui.column(host);
        column.addView(o.bubbleView(), new android.widget.LinearLayout.LayoutParams(Ui.dp(host, 56), Ui.dp(host, 56)));
        column.addView(o.chessCard(h), Ui.margins(Ui.fill(), host, 0, 16, 0, 0));
        column.addView(o.messageCard("⏰ Пора сделать перерыв",
                "Ты в телефоне уже 47 мин без перерыва. Встань, потянись и посмотри в окно секунд двадцать 🙂", true),
                Ui.margins(Ui.fill(), host, 0, 16, 0, 0));
        column.addView(o.progressCard("Смотрю на доску и считаю ходы…"), Ui.margins(Ui.fill(), host, 0, 16, 0, 0));
        page.addView(column);
        page.setBackgroundColor(Color.WHITE);
        host.setContentView(page);
        org.robolectric.shadows.ShadowLooper.idleMainLooper();
        snap(host.getWindow().getDecorView(), "overlay.png", true);
    }
}
