package app.umnik;

import android.content.Context;

import app.umnik.chess.Board;
import app.umnik.chess.Hint;
import app.umnik.chess.Position;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Общее между кнопкой поверх экрана (служба) и окном помощника: свежий снимок, текущая беседа,
 * последняя шахматная подсказка. Живёт, пока жив процесс.
 */
final class Session {
    /** одна строчка в окне помощника */
    static final class Line {
        final boolean mine;
        String text;
        final Hint hint;

        Line(boolean mine, String text, Hint hint) {
            this.mine = mine;
            this.text = text;
            this.hint = hint;
        }
    }

    static volatile Shot shot;
    /** снимок ещё не отправлен в беседу */
    static volatile boolean shotFresh;
    static Brain.Chat chat;
    static final List<Line> lines = new ArrayList<>();
    static volatile Hint hint;
    /** что добавить к следующему вопросу: подсказка движка или совет, который Умник показал сам */
    static volatile String note;
    static volatile boolean sheetOpen;

    private static Brain brain;
    private static String brainKey;

    private Session() {
    }

    /** один клиент Claude на всё приложение; новый — если сменился ключ */
    static synchronized Brain brain(Context c) {
        String key = Prefs.apiKey(c);
        if (brain == null || !key.equals(brainKey)) {
            brain = new Brain(key);
            brainKey = key;
        }
        return brain;
    }

    /** Новый снимок — новая беседа. */
    static synchronized void start(Shot s, Brain.Chat c) {
        if (chat != null) chat.cancel();
        shot = s;
        shotFresh = true;
        chat = c;
        lines.clear();
        hint = null;
        note = null;
    }

    static void setHint(Hint h) {
        hint = h;
        note = "Подсказка шахматного движка (ей можно доверять):\n" + h.forAi;
    }

    /** забрать заметку для вопроса (один раз) */
    static synchronized String takeNote() {
        String n = note;
        note = null;
        return n == null ? "" : n;
    }

    /** Новый снимок в той же беседе (кнопка «обновить снимок»). */
    static synchronized void refresh(Shot s) {
        shot = s;
        shotFresh = true;
    }

    /** Строка «что сейчас происходит» к вопросу: время, приложение, сколько без перерыва. */
    static String context(Shot s, ScreenTime st) {
        StringBuilder c = new StringBuilder("Сейчас ");
        c.append(new SimpleDateFormat("EEEE, d MMMM, HH:mm", new Locale("ru")).format(new Date()));
        if (s != null && s.app != null && !s.app.isEmpty()) {
            c.append(". Открыто приложение «").append(s.app).append('»');
            String kind = Apps.kindName(s.kind);
            if (!kind.isEmpty()) c.append(" (").append(kind).append(')');
        }
        if (st != null) {
            long now = System.currentTimeMillis();
            c.append(". В телефоне без перерыва ").append(ScreenTime.format(st.session(now)))
                    .append(", за сегодня — ").append(ScreenTime.format(st.total()));
        }
        c.append('.');
        if (s != null && s.jpeg == null && s.screenText != null && !s.screenText.isEmpty()) {
            c.append("\nСнимка экрана нет (").append(s.why).append("). Текст с экрана:\n").append(s.screenText);
        }
        return c.toString();
    }

    /** Прочитать доску со снимка и найти лучший ход. Если позиция вышла невозможной — вторая, внимательная попытка. */
    static Hint chess(Brain brain, String model, byte[] jpeg) throws Brain.Failure {
        String error = null;
        for (int attempt = 0; attempt < 2; attempt++) {
            Brain.BoardRead read = brain.readBoard(model, jpeg, error);
            if (!read.found) throw new Brain.Failure("Не вижу на экране шахматной доски.", null);
            try {
                Hint h = Hint.analyze(read.rows, read.whiteBottom, read.turn, 2000);
                setHint(h);
                return h;
            } catch (IllegalArgumentException e) {
                error = e.getMessage();
            }
        }
        throw new Brain.Failure("Не получилось разобрать доску (" + error + "). Попробуй ещё раз.", null);
    }

    /** Та же позиция, но ходит другая сторона. */
    static Hint flip(Hint h) throws Brain.Failure {
        String placement = h.board.fen().split(" ")[0];
        Board b = Position.build(placement, !h.whiteToMove());
        if (b.inCheck(b.side ^ Board.BLACK)) {
            throw new Brain.Failure("Так не бывает: у " + (b.side == Board.WHITE ? "чёрных" : "белых")
                    + " король под шахом, значит, ход именно их.", null);
        }
        Hint flipped = Hint.analyze(b, h.whiteBottom, 2000);
        setHint(flipped);
        return flipped;
    }
}
