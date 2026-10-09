package app.umnik;

import android.content.Context;

import app.umnik.chess.Board;
import app.umnik.chess.Eye;
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

    /** Что увидели на доске и что сказать сверху («запомнил фигуры»). */
    static final class Chess {
        final Hint hint;
        final String note;

        Chess(Hint hint, String note) {
            this.hint = hint;
            this.note = note;
        }
    }

    private static Brain brain;
    private static String brainKey, brainModel;

    private Session() {
    }

    /** один клиент Claude на всё приложение; новый — если сменился ключ или модель */
    static synchronized Brain brain(Context c) {
        String key = Prefs.apiKey(c), model = Prefs.model(c);
        if (brain == null || !key.equals(brainKey) || !model.equals(brainModel)) {
            brain = new Brain(key, model);
            brainKey = key;
            brainModel = model;
        }
        return brain;
    }

    /** чем Умник думает сейчас: бесплатный ИИ в телефоне или Claude */
    static Mind mind(Context c) {
        return Prefs.free(c) ? LocalMind.get(c) : brain(c);
    }

    /** чем отвечать в этой беседе (она могла начаться до того, как сменили «мозг») */
    static Mind mind(Context c, Brain.Chat chat) {
        return chat.isLocal() ? LocalMind.get(c) : brain(c);
    }

    static Brain.Chat newChat(Context c) {
        return new Brain.Chat(Prefs.free(c) ? Brain.LOCAL : Prefs.model(c), Prefs.about(c));
    }

    /** Новый снимок — новая беседа. Старая прерывается и освобождает память модели. */
    static synchronized void start(Shot s, Brain.Chat c) {
        Brain.Chat old = chat;
        if (old != null && old != c) {
            old.cancel();
            old.dropLocal();
        }
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

    /**
     * Лучший ход по снимку. Доску узнаёт своё «зрение» — бесплатно и без интернета; фигуры каждого приложения
     * оно один раз запоминает по начальной расстановке. Не вышло, а выбран Claude, — доску читает Claude.
     */
    static Chess chess(Context c, Shot s) throws Brain.Failure {
        if (s == null || (s.pixels == null && s.jpeg == null)) {
            throw new Brain.Failure("Нужен снимок экрана с доской.", null);
        }
        String problem = "Не нашёл на экране шахматную доску. Я узнаю обычные плоские доски 8×8 — как в chess.com, "
                + "lichess и шахматных приложениях. Доска должна быть видна целиком.";
        if (s.pixels != null) {
            String key = "eye_" + (s.pkg == null ? "" : s.pkg);
            Eye.Pieces known = Eye.Pieces.load(Prefs.of(c).getString(key, null));
            Eye.Result r = Eye.look(s.pixels.px, s.pixels.w, s.pixels.h, known);
            if (r.learned != null) Prefs.put(c, key, r.learned.save());
            if (r.rows != null) {
                try {
                    Hint h = Hint.analyze(r.rows, r.whiteBottom, r.start ? "white" : r.turn, 2000);
                    setHint(h);
                    String note = r.learned != null && known == null
                            ? "✅ Запомнил, как выглядят фигуры в этом приложении. Теперь подсказываю в любой позиции." : null;
                    return new Chess(h, note);
                } catch (IllegalArgumentException e) {
                    problem = "Похоже, я неточно узнал фигуры (" + e.getMessage() + "). Открой новую партию и нажми ♟, "
                            + "пока фигуры стоят на начальных местах, — я заново запомню, как они выглядят в этом приложении.";
                }
            } else if (r.found) {
                problem = "Доску вижу, но фигуры этого приложения ещё не знаю. Открой новую партию и нажми ♟, пока фигуры "
                        + "стоят на начальных местах, — я один раз их запомню и дальше буду подсказывать в любой позиции.";
            }
        }
        if (!Prefs.free(c) && Prefs.hasKey(c) && s.jpeg != null) {
            return new Chess(chessByClaude(brain(c), Prefs.model(c), s.jpeg), null);
        }
        throw new Brain.Failure(problem, null);
    }

    /** Доску переписывает Claude. Если позиция вышла невозможной — вторая, внимательная попытка. */
    static Hint chessByClaude(Brain brain, String model, byte[] jpeg) throws Brain.Failure {
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

    /** Доска на экране стоит наоборот: внизу на самом деле другой цвет. Ходит тот, кто теперь снизу. */
    static Hint rotate(Hint h) throws Brain.Failure {
        try {
            boolean whiteBottom = !h.whiteBottom;
            Hint r = Hint.analyze(h.screenRows(), whiteBottom, whiteBottom ? "white" : "black", 2000);
            setHint(r);
            return r;
        } catch (IllegalArgumentException e) {
            throw new Brain.Failure("Наоборот так фигуры стоять не могут: " + e.getMessage() + ".", null);
        }
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
