package app.umnik;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

import java.util.ArrayList;
import java.util.List;

import app.umnik.chess.Eye;

/**
 * «Зрение» на нарисованных скриншотах телефона: доска в окне приложения, подписи клеток, подсветка
 * последнего хода. Сначала начальная позиция (запоминание фигур), потом партии с обеих сторон доски.
 */
@RunWith(RobolectricTestRunner.class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = 35)
public class EyeTest {
    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
    private static final String SOLID = " ♟♞♝♜♛♚";
    private static final int LIGHT = 0xFFF0D9B5, DARK = 0xFFB58863, MARK = 0x699BC700;

    private final Context c = RuntimeEnvironment.getApplication();

    @Before
    public void clean() {
        Prefs.of(c).edit().clear().commit();
    }

    /** Скриншот 1080×2400: тёмное приложение, сверху и снизу полосы с текстом, посередине доска. */
    private static Shot screen(String placement, boolean whiteBottom, String from, String to) {
        Bitmap b = Bitmap.createBitmap(1080, 2400, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(b);
        canvas.drawColor(0xFF161512);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(0xFF262421);
        canvas.drawRect(0, 0, 1080, 90, p);
        p.setColor(0xFFBABABA);
        p.setTextSize(42);
        canvas.drawText("Соперник 1650", 40, 200, p);
        canvas.drawText("Вы 1580", 40, 1520, p);

        float left = 0, top = 300, cell = 135;
        String[] ranks = placement.split("/");
        Paint piece = new Paint(Paint.ANTI_ALIAS_FLAG);
        piece.setTextAlign(Paint.Align.CENTER);
        piece.setTypeface(Typeface.DEFAULT);
        piece.setTextSize(cell * 0.82f);
        Paint.FontMetrics fm = piece.getFontMetrics();
        float shift = -(fm.ascent + fm.descent) / 2;
        Paint coord = new Paint(Paint.ANTI_ALIAS_FLAG);
        coord.setTypeface(Typeface.DEFAULT_BOLD);
        coord.setTextSize(cell * 0.2f);
        for (int row = 0; row < 8; row++) {
            int rank = whiteBottom ? 7 - row : row;
            String line = expand(ranks[7 - rank]);
            for (int col = 0; col < 8; col++) {
                int file = whiteBottom ? col : 7 - col;
                boolean light = (file + rank) % 2 == 1;
                float x = left + col * cell, y = top + row * cell;
                p.setColor(light ? LIGHT : DARK);
                canvas.drawRect(x, y, x + cell, y + cell, p);
                String name = "" + (char) ('a' + file) + (rank + 1);
                if (name.equals(from) || name.equals(to)) {
                    p.setColor(MARK);
                    canvas.drawRect(x, y, x + cell, y + cell, p);
                }
                // подписи, как в lichess: цифры у левого края, буквы внизу, цветом соседней клетки
                coord.setColor(light ? DARK : LIGHT);
                if (col == 0) canvas.drawText(String.valueOf(rank + 1), x + 6, y + cell * 0.22f, coord);
                if (row == 7) canvas.drawText(String.valueOf((char) ('a' + file)), x + cell * 0.8f, y + cell - 6, coord);
                char c = line.charAt(file);
                if (c == '.') continue;
                boolean white = Character.isUpperCase(c);
                String glyph = SOLID.charAt("pnbrqk".indexOf(Character.toLowerCase(c)) + 1) + "︎";
                piece.setStyle(Paint.Style.FILL);
                piece.setColor(white ? 0xFFFFFFFF : 0xFF202020);
                canvas.drawText(glyph, x + cell / 2, y + cell / 2 + shift, piece);
                piece.setStyle(Paint.Style.STROKE);
                piece.setStrokeWidth(cell * (white ? 0.035f : 0.02f));
                piece.setColor(0xFF000000);
                canvas.drawText(glyph, x + cell / 2, y + cell / 2 + shift, piece);
            }
        }
        // как в службе: уменьшенный снимок и пиксели для «зрения»
        Shot s = new Shot(Shot.jpeg(b, 1600), Shot.scale(b, 360), "com.chess.test", "Шахматы", Apps.Kind.CHESS, null, null, 0);
        s.pixels = Shot.pixels(b, 1600);
        return s;
    }

    private static String expand(String rank) {
        StringBuilder s = new StringBuilder();
        for (char ch : rank.toCharArray()) {
            if (Character.isDigit(ch)) for (int k = 0; k < ch - '0'; k++) s.append('.');
            else s.append(ch);
        }
        return s.toString();
    }

    /** как доска видна на экране: 8 строк сверху вниз */
    private static List<String> rows(String placement, boolean whiteBottom) {
        String[] ranks = placement.split("/");
        List<String> out = new ArrayList<>();
        for (int row = 0; row < 8; row++) {
            String line = expand(ranks[whiteBottom ? row : 7 - row]);
            out.add(whiteBottom ? line : new StringBuilder(line).reverse().toString());
        }
        return out;
    }

    private static Eye.Result look(Shot s, Eye.Pieces known) {
        return Eye.look(s.pixels.px, s.pixels.w, s.pixels.h, known);
    }

    @Test
    public void learnsPiecesFromStartAndReadsGames() {
        Eye.Result start = look(screen(START, true, null, null), null);
        assertTrue("доска найдена", start.found);
        assertTrue("это начальная позиция", start.start);
        assertNotNull(start.learned);
        assertEquals(rows(START, true), start.rows);
        assertTrue(start.whiteBottom);
        assertEquals("доска во всю ширину: 1080 → 720 точек", 720, start.size, 3);

        Eye.Pieces known = Eye.Pieces.load(start.learned.save());
        assertNotNull("образцы сохраняются и читаются", known);

        // итальянская партия: белые только что сыграли слоном f1 → c4, ход чёрных
        String italian = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R";
        Eye.Result r = look(screen(italian, true, "f1", "c4"), known);
        assertFalse(r.start);
        assertEquals(rows(italian, true), r.rows);
        assertTrue(r.whiteBottom);
        assertEquals("black", r.turn);

        // играем чёрными — доска перевёрнута; белые сходили ладьёй f1 → e1
        String black = "r2q1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBP3/PP3PPP/R2QR1K1";
        r = look(screen(black, false, "f1", "e1"), known);
        assertEquals(rows(black, false), r.rows);
        assertFalse("чёрные снизу", r.whiteBottom);
        assertEquals("black", r.turn);

        // эндшпиль без подсветки — чей ход, не видно
        String endgame = "8/5pk1/6p1/8/3R4/6P1/5PK1/3r4";
        r = look(screen(endgame, true, null, null), known);
        assertEquals(rows(endgame, true), r.rows);
        assertEquals("unknown", r.turn);
    }

    @Test
    public void learnsWhenBlackIsAtTheBottom() {
        Eye.Result start = look(screen(START, false, null, null), null);
        assertTrue(start.start);
        assertFalse(start.whiteBottom);
        String mate = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR";
        Eye.Result r = look(screen(mate, true, "g8", "f6"), start.learned);
        assertEquals(rows(mate, true), r.rows);
        assertTrue(r.whiteBottom);
        assertEquals("white", r.turn);
    }

    @Test
    public void noBoardNoPieces() {
        Bitmap b = Bitmap.createBitmap(720, 1600, Bitmap.Config.ARGB_8888);
        new Canvas(b).drawColor(0xFFFFFFFF);
        int[] px = new int[720 * 1600];
        b.getPixels(px, 0, 720, 0, 0, 720, 1600);
        assertFalse(Eye.look(px, 720, 1600, null).found);
        assertNull(Eye.Pieces.load("испорчено"));
    }

    @Test
    public void sessionRemembersPiecesPerAppAndFindsMate() throws Exception {
        // фигуры этого приложения ещё не знакомы — просим показать начальную позицию
        String mate = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR";
        try {
            Session.chess(c, screen(mate, true, "g8", "f6"));
            fail("без начальной позиции фигуры не узнать");
        } catch (Brain.Failure e) {
            assertTrue(e.getMessage(), e.getMessage().contains("начальн"));
        }

        Session.Chess first = Session.chess(c, screen(START, true, null, null));
        assertNotNull("сказали, что запомнили фигуры", first.note);
        assertTrue(first.hint.whiteToMove());

        Session.Chess r = Session.chess(c, screen(mate, true, "g8", "f6"));
        assertNull(r.note);
        assertTrue(r.hint.headline, r.hint.headline.contains("f7"));
        assertTrue(r.hint.details, r.hint.details.contains("мат"));

        // доску по ошибке поняли наоборот — кнопка «Доска наоборот» пересчитывает
        assertTrue(Session.rotate(Session.rotate(r.hint)).whiteBottom);
    }

    @Test
    public void notABoard() {
        Bitmap b = Bitmap.createBitmap(1080, 2400, Bitmap.Config.ARGB_8888);
        new Canvas(b).drawColor(0xFF0E1621);
        Shot s = new Shot(Shot.jpeg(b, 1600), null, "org.telegram.messenger", "Telegram", Apps.Kind.MESSENGER, null, null, 0);
        s.pixels = Shot.pixels(b, 1600);
        try {
            Session.chess(c, s);
            fail();
        } catch (Brain.Failure e) {
            assertTrue(e.getMessage(), e.getMessage().startsWith("Не нашёл"));
        }
    }
}
