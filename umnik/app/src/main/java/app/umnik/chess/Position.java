package app.umnik.chess;

import java.util.List;

/** Доска, которую ИИ переписал со скриншота, → настоящая позиция для движка. */
public final class Position {
    private Position() {
    }

    /**
     * rows — 8 строк сверху вниз, как на экране, в каждой 8 клеток слева направо
     * (K Q R B N P — белые, k q r b n p — чёрные, «.» — пусто; цифры как в FEN тоже понимаем).
     * whiteBottom — белые играют снизу. Возвращает первую часть FEN (расстановку).
     */
    public static String placement(List<String> rows, boolean whiteBottom) {
        if (rows == null || rows.size() != 8) throw new IllegalArgumentException("на доске не 8 горизонталей");
        String[] board = new String[8];
        for (int i = 0; i < 8; i++) {
            String row = normalize(rows.get(i));
            if (row.length() != 8) throw new IllegalArgumentException("в горизонтали «" + rows.get(i) + "» не 8 клеток");
            board[i] = row;
        }
        StringBuilder fen = new StringBuilder();
        for (int i = 0; i < 8; i++) {
            // белые снизу: верхняя строка экрана — 8-я горизонталь, a…h слева направо;
            // чёрные снизу: доска перевёрнута — верхняя строка — 1-я горизонталь, h…a слева направо
            String rank = whiteBottom ? board[i] : new StringBuilder(board[7 - i]).reverse().toString();
            int empty = 0;
            for (char c : rank.toCharArray()) {
                if (c == '.') { empty++; continue; }
                if (empty > 0) { fen.append(empty); empty = 0; }
                fen.append(c);
            }
            if (empty > 0) fen.append(empty);
            if (i < 7) fen.append('/');
        }
        check(fen.toString());
        return fen.toString();
    }

    private static String normalize(String row) {
        StringBuilder s = new StringBuilder();
        for (char c : (row == null ? "" : row).toCharArray()) {
            if (c >= '1' && c <= '8') {
                for (int k = 0; k < c - '0'; k++) s.append('.');
            } else if (Board.pieceOf(c) > 0) {
                s.append(c);
            } else if (c == '.' || c == '-' || c == '_' || c == '0' || c == '·' || c == '*') {
                s.append('.');
            }
            // пробелы, запятые и прочее — разделители, пропускаем
        }
        return s.toString();
    }

    /** Похоже ли это на настоящую партию: по королю, не больше 8 пешек, пешки не на крайних горизонталях. */
    private static void check(String placement) {
        int[] count = new int[15];
        String[] ranks = placement.split("/");
        for (int i = 0; i < 8; i++) {
            for (char c : ranks[i].toCharArray()) {
                int p = Board.pieceOf(c);
                if (p < 0) continue;
                count[p]++;
                if ((p & 7) == Board.PAWN && (i == 0 || i == 7)) {
                    throw new IllegalArgumentException("пешка на крайней горизонтали — доска распознана неточно");
                }
            }
        }
        if (count[Board.WHITE | Board.KING] != 1 || count[Board.BLACK | Board.KING] != 1) {
            throw new IllegalArgumentException("не нашёл обоих королей");
        }
        if (count[Board.WHITE | Board.PAWN] > 8 || count[Board.BLACK | Board.PAWN] > 8) {
            throw new IllegalArgumentException("слишком много пешек — доска распознана неточно");
        }
        int white = 0, black = 0;
        for (int t = Board.PAWN; t <= Board.KING; t++) {
            white += count[t];
            black += count[t | Board.BLACK];
        }
        if (white > 16 || black > 16) throw new IllegalArgumentException("слишком много фигур — доска распознана неточно");
    }

    /** Позиция с заданной очередью хода; права на рокировку — если король и ладья стоят на своих местах. */
    public static Board build(String placement, boolean whiteToMove) {
        Board probe = Board.fromFen(placement + " w - - 0 1");
        StringBuilder castle = new StringBuilder();
        if (probe.sq[4] == (Board.WHITE | Board.KING)) {
            if (probe.sq[7] == (Board.WHITE | Board.ROOK)) castle.append('K');
            if (probe.sq[0] == (Board.WHITE | Board.ROOK)) castle.append('Q');
        }
        if (probe.sq[116] == (Board.BLACK | Board.KING)) {
            if (probe.sq[119] == (Board.BLACK | Board.ROOK)) castle.append('k');
            if (probe.sq[112] == (Board.BLACK | Board.ROOK)) castle.append('q');
        }
        return Board.fromFen(placement + (whiteToMove ? " w " : " b ")
                + (castle.length() == 0 ? "-" : castle) + " - 0 1");
    }
}
