package app.umnik.chess;

import java.util.List;
import java.util.Locale;

/** Подсказка хода человеческими словами: «Ход белых: конь g1 → f3», оценка и продолжение. */
public final class Hint {
    private static final String[] NAME = {"", "пешка", "конь", "слон", "ладья", "ферзь", "король"};
    private static final String[] NAME_ACC = {"", "пешку", "коня", "слона", "ладью", "ферзя", "короля"};
    private static final Locale RU = new Locale("ru");

    /** позиция до хода — для мини-доски */
    public final Board board;
    public final boolean whiteBottom;
    public final Engine.Result result;
    /** «Ход белых: конь g1 → f3» */
    public final String headline;
    /** «Кf3 · +0,4 — лучше у белых · дальше: … » */
    public final String details;
    /** для ИИ-объяснения: FEN, ход, оценка, продолжение */
    public final String forAi;

    private Hint(Board board, boolean whiteBottom, Engine.Result result, String headline, String details, String forAi) {
        this.board = board;
        this.whiteBottom = whiteBottom;
        this.result = result;
        this.headline = headline;
        this.details = details;
        this.forAi = forAi;
    }

    public boolean whiteToMove() {
        return board.side == Board.WHITE;
    }

    /**
     * rows / whiteBottom — что ИИ увидел на экране; turn — «white», «black» или «unknown»
     * (не понятно — ходит тот, кто снизу: подсказку обычно просят в свой ход).
     */
    public static Hint analyze(List<String> rows, boolean whiteBottom, String turn, long millis) {
        String placement = Position.placement(rows, whiteBottom);
        boolean whiteToMove = "white".equals(turn) || (!"black".equals(turn) && whiteBottom);
        Board b = Position.build(placement, whiteToMove);
        if (b.inCheck(b.side ^ Board.BLACK)) {
            // шах объявлен тому, кто сейчас не ходит, — так не бывает: значит, ход как раз его
            b = Position.build(placement, !whiteToMove);
            if (b.inCheck(b.side ^ Board.BLACK)) throw new IllegalArgumentException("шах обоим королям — доска распознана неточно");
        }
        return analyze(b, whiteBottom, millis);
    }

    public static Hint analyze(Board b, boolean whiteBottom, long millis) {
        Board start = b.copy();
        Engine.Result r = new Engine().think(b, millis);
        String color = b.side == Board.WHITE ? "белых" : "чёрных";
        if (r.move == 0) {
            String end = b.inCheck() ? "мат, партия окончена" : "пат — ничья";
            return new Hint(start, whiteBottom, r, "Ходов у " + color + " нет: " + end, "", "Позиция " + b.fen() + ": " + end);
        }
        String san = b.san(r.move, true);
        String headline = "Ход " + color + ": " + describe(b, r.move, san);

        StringBuilder details = new StringBuilder(san).append(" · ").append(evaluation(r, b.side));
        String line = continuation(b, r.pv);
        if (!line.isEmpty()) details.append("\nДальше: ").append(line);

        String forAi = "Позиция (FEN): " + b.fen()
                + "\nХодят " + color + ". Лучший ход по движку: " + b.san(r.move, false) + " (" + Board.uci(r.move) + ")"
                + "\nОценка: " + evaluation(r, b.side)
                + (line.isEmpty() ? "" : "\nВероятное продолжение: " + continuationEnglish(b, r.pv));
        return new Hint(start, whiteBottom, r, headline, details.toString(), forAi);
    }

    /** «Конь g1 → f3», «Слон c4 бьёт пешку на f7 — шах!», «Рокировка в короткую сторону» */
    static String describe(Board b, int m, String san) {
        int from = Board.from(m), to = Board.to(m), piece = b.sq[from] & 7;
        String text;
        if (Board.isCastling(m)) {
            text = to > from ? "Рокировка в короткую сторону (O-O)" : "Рокировка в длинную сторону (O-O-O)";
        } else if (Board.isEnPassant(m)) {
            text = "Пешка " + Board.square(from) + " бьёт на проходе: → " + Board.square(to);
        } else {
            text = capital(NAME[piece]) + " " + Board.square(from);
            if (Board.isCapture(m)) text += " бьёт " + NAME_ACC[b.sq[to] & 7] + " на " + Board.square(to);
            else text += " → " + Board.square(to);
            if (Board.promo(m) != 0) text += " и превращается в " + NAME_ACC[Board.promo(m)];
        }
        if (san.endsWith("#")) text += " — мат!";
        else if (san.endsWith("+")) text += " — шах!";
        return text;
    }

    /** «+0,4 — лучше у белых», «мат в 2 хода!» */
    static String evaluation(Engine.Result r, int sideToMove) {
        if (r.isMate()) {
            int n = Math.abs(r.mateIn());
            String moves = n + " " + plural(n, "ход", "хода", "ходов");
            return r.mateIn() > 0 ? "мат в " + moves + "!" : "соперник ставит мат за " + moves;
        }
        int white = sideToMove == Board.WHITE ? r.score : -r.score;
        String number = String.format(RU, "%+.1f", white / 100.0);
        int a = Math.abs(white);
        String who = white > 0 ? "белых" : "чёрных";
        if (a < 30) return number + " — примерно равно";
        if (a < 120) return number + " — чуть лучше у " + who;
        if (a < 300) return number + " — лучше у " + who;
        return number + " — у " + who + " большой перевес";
    }

    private static String continuation(Board b, int[] pv) {
        return line(b, pv, true);
    }

    private static String continuationEnglish(Board b, int[] pv) {
        return line(b, pv, false);
    }

    /** продолжение после лучшего хода, до 4 полуходов */
    private static String line(Board b, int[] pv, boolean russian) {
        Board c = b.copy();
        StringBuilder s = new StringBuilder();
        int[] legal = new int[256];
        for (int i = 0; i < pv.length && i < 5; i++) {
            int n = c.legal(legal);
            boolean ok = false;
            for (int k = 0; k < n; k++) if (legal[k] == pv[i]) ok = true;
            if (!ok) break;
            if (i > 0) s.append(s.length() > 0 ? " " : "").append(c.san(pv[i], russian));
            c.make(pv[i]);
        }
        return s.toString();
    }

    static String plural(int n, String one, String few, String many) {
        int m10 = n % 10, m100 = n % 100;
        if (m10 == 1 && m100 != 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
        return many;
    }

    private static String capital(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
