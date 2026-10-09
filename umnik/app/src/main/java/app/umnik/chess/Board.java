package app.umnik.chess;

import java.util.Random;

/**
 * Шахматная позиция на доске 0x88 со всеми правилами: рокировки, взятие на проходе, превращение пешки.
 * Поле = горизонталь * 16 + вертикаль (a1 = 0, h1 = 7, a8 = 112, h8 = 119).
 * Фигура = цвет | тип: белые 1..6, чёрные 9..14. Ход упакован в int: откуда, куда, превращение, флаги.
 */
public final class Board {
    public static final int PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
    public static final int WHITE = 0, BLACK = 8;

    static final int CAPTURE = 1, EN_PASSANT = 2, CASTLING = 4, DOUBLE_PUSH = 8;

    static final int[] KNIGHT_STEPS = {33, 31, 18, 14, -33, -31, -18, -14};
    static final int[] KING_STEPS = {1, -1, 16, -16, 15, 17, -15, -17};
    static final int[] DIAGONAL = {15, 17, -15, -17};
    static final int[] STRAIGHT = {1, -1, 16, -16};

    /** после хода с поля или на поле остаются только эти права на рокировку */
    private static final int[] CASTLE_MASK = new int[128];
    static final long[][] Z_PIECE = new long[15][128];
    static final long[] Z_CASTLE = new long[16];
    static final long[] Z_EP = new long[128];
    static final long Z_SIDE;

    static {
        java.util.Arrays.fill(CASTLE_MASK, 15);
        CASTLE_MASK[0] = 15 & ~2;
        CASTLE_MASK[4] = 15 & ~3;
        CASTLE_MASK[7] = 15 & ~1;
        CASTLE_MASK[112] = 15 & ~8;
        CASTLE_MASK[116] = 15 & ~12;
        CASTLE_MASK[119] = 15 & ~4;
        Random r = new Random(20261009L);
        for (long[] row : Z_PIECE) for (int i = 0; i < 128; i++) row[i] = r.nextLong();
        for (int i = 0; i < 16; i++) Z_CASTLE[i] = r.nextLong();
        for (int i = 0; i < 128; i++) Z_EP[i] = r.nextLong();
        Z_SIDE = r.nextLong();
    }

    public final int[] sq = new int[128];
    public int side = WHITE;
    /** 1 — белые O-O, 2 — белые O-O-O, 4 — чёрные O-O, 8 — чёрные O-O-O */
    public int castle;
    /** поле, на которое можно взять на проходе, или -1 */
    public int ep = -1;
    public int halfmove;
    public int fullmove = 1;
    final int[] kingAt = new int[2];
    public long hash;

    private static final int UNDO = 512;
    private final int[] undoCaptured = new int[UNDO];
    private final int[] undoCastle = new int[UNDO];
    private final int[] undoEp = new int[UNDO];
    private final int[] undoHalf = new int[UNDO];
    private final long[] undoHash = new long[UNDO];
    private int depth;

    /* ---------- ход как число ---------- */

    static int move(int from, int to, int promo, int flags) {
        return from | (to << 7) | (promo << 14) | (flags << 17);
    }

    public static int from(int m) {
        return m & 127;
    }

    public static int to(int m) {
        return (m >> 7) & 127;
    }

    public static int promo(int m) {
        return (m >> 14) & 7;
    }

    static int flags(int m) {
        return m >>> 17;
    }

    public static boolean isCapture(int m) {
        return (flags(m) & CAPTURE) != 0;
    }

    public static boolean isCastling(int m) {
        return (flags(m) & CASTLING) != 0;
    }

    public static boolean isEnPassant(int m) {
        return (flags(m) & EN_PASSANT) != 0;
    }

    public static String square(int s) {
        return "" + (char) ('a' + (s & 7)) + (char) ('1' + (s >> 4));
    }

    /** «e2e4», «e7e8q» */
    public static String uci(int m) {
        String s = square(from(m)) + square(to(m));
        return promo(m) == 0 ? s : s + "  nbrq".charAt(promo(m));
    }

    /* ---------- FEN ---------- */

    public static Board fromFen(String fen) {
        Board b = new Board();
        String[] parts = fen.trim().split("\\s+");
        String[] ranks = parts[0].split("/");
        if (ranks.length != 8) throw new IllegalArgumentException("в позиции должно быть 8 горизонталей");
        for (int i = 0; i < 8; i++) {
            int rank = 7 - i, file = 0;
            for (char c : ranks[i].toCharArray()) {
                if (c >= '1' && c <= '8') {
                    file += c - '0';
                } else {
                    int p = pieceOf(c);
                    if (p < 0 || file > 7) throw new IllegalArgumentException("непонятная горизонталь «" + ranks[i] + "»");
                    b.sq[rank * 16 + file++] = p;
                }
            }
            if (file != 8) throw new IllegalArgumentException("в горизонтали «" + ranks[i] + "» не 8 клеток");
        }
        b.side = parts.length > 1 && parts[1].equals("b") ? BLACK : WHITE;
        if (parts.length > 2) {
            for (char c : parts[2].toCharArray()) {
                if (c == 'K') b.castle |= 1;
                if (c == 'Q') b.castle |= 2;
                if (c == 'k') b.castle |= 4;
                if (c == 'q') b.castle |= 8;
            }
        }
        if (parts.length > 3 && parts[3].length() == 2) {
            int f = parts[3].charAt(0) - 'a', r = parts[3].charAt(1) - '1';
            if (f >= 0 && f < 8 && r >= 0 && r < 8) b.ep = r * 16 + f;
        }
        if (parts.length > 4) b.halfmove = parseInt(parts[4], 0);
        if (parts.length > 5) b.fullmove = Math.max(1, parseInt(parts[5], 1));
        int whiteKings = 0, blackKings = 0;
        for (int s = 0; s < 128; s++) {
            if (b.sq[s] == (WHITE | KING)) { b.kingAt[0] = s; whiteKings++; }
            if (b.sq[s] == (BLACK | KING)) { b.kingAt[1] = s; blackKings++; }
        }
        if (whiteKings != 1 || blackKings != 1) throw new IllegalArgumentException("на доске должно быть по одному королю");
        b.hash = b.computeHash();
        return b;
    }

    private static int parseInt(String s, int fallback) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    /** «P» → белая пешка, «k» → чёрный король, иначе -1 */
    public static int pieceOf(char c) {
        int t = "PNBRQK".indexOf(Character.toUpperCase(c));
        if (t < 0) return -1;
        return (t + 1) | (Character.isLowerCase(c) ? BLACK : WHITE);
    }

    public static char letterOf(int p) {
        char c = " PNBRQK".charAt(p & 7);
        return (p & BLACK) != 0 ? Character.toLowerCase(c) : c;
    }

    public String fen() {
        StringBuilder s = new StringBuilder();
        for (int rank = 7; rank >= 0; rank--) {
            int empty = 0;
            for (int file = 0; file < 8; file++) {
                int p = sq[rank * 16 + file];
                if (p == 0) { empty++; continue; }
                if (empty > 0) { s.append(empty); empty = 0; }
                s.append(letterOf(p));
            }
            if (empty > 0) s.append(empty);
            if (rank > 0) s.append('/');
        }
        s.append(side == WHITE ? " w " : " b ");
        String c = ((castle & 1) != 0 ? "K" : "") + ((castle & 2) != 0 ? "Q" : "")
                + ((castle & 4) != 0 ? "k" : "") + ((castle & 8) != 0 ? "q" : "");
        s.append(c.isEmpty() ? "-" : c).append(' ');
        s.append(ep < 0 ? "-" : square(ep)).append(' ').append(halfmove).append(' ').append(fullmove);
        return s.toString();
    }

    long computeHash() {
        long h = 0;
        for (int s = 0; s < 128; s++) if ((s & 0x88) == 0 && sq[s] != 0) h ^= Z_PIECE[sq[s]][s];
        h ^= Z_CASTLE[castle];
        if (ep >= 0) h ^= Z_EP[ep];
        if (side == BLACK) h ^= Z_SIDE;
        return h;
    }

    /* ---------- атаки и шахи ---------- */

    /** бьёт ли сторона by поле s */
    public boolean attacked(int s, int by) {
        if (by == WHITE) {
            int a = s - 15, b = s - 17;
            if ((a & 0x88) == 0 && sq[a] == (WHITE | PAWN)) return true;
            if ((b & 0x88) == 0 && sq[b] == (WHITE | PAWN)) return true;
        } else {
            int a = s + 15, b = s + 17;
            if ((a & 0x88) == 0 && sq[a] == (BLACK | PAWN)) return true;
            if ((b & 0x88) == 0 && sq[b] == (BLACK | PAWN)) return true;
        }
        for (int d : KNIGHT_STEPS) {
            int t = s + d;
            if ((t & 0x88) == 0 && sq[t] == (by | KNIGHT)) return true;
        }
        for (int d : KING_STEPS) {
            int t = s + d;
            if ((t & 0x88) == 0 && sq[t] == (by | KING)) return true;
        }
        for (int d : DIAGONAL) {
            for (int t = s + d; (t & 0x88) == 0; t += d) {
                int q = sq[t];
                if (q == 0) continue;
                if (q == (by | BISHOP) || q == (by | QUEEN)) return true;
                break;
            }
        }
        for (int d : STRAIGHT) {
            for (int t = s + d; (t & 0x88) == 0; t += d) {
                int q = sq[t];
                if (q == 0) continue;
                if (q == (by | ROOK) || q == (by | QUEEN)) return true;
                break;
            }
        }
        return false;
    }

    public boolean inCheck() {
        return attacked(kingAt[side >> 3], side ^ BLACK);
    }

    /** под шахом ли стоит король, который только что сходил (вызывать сразу после make) */
    boolean leftKingInCheck() {
        return attacked(kingAt[(side ^ BLACK) >> 3], side);
    }

    public boolean inCheck(int color) {
        return attacked(kingAt[color >> 3], color ^ BLACK);
    }

    /* ---------- генерация ходов ---------- */

    /** Ходы по правилам фигур, но король может остаться под шахом. captures — только взятия и превращения. */
    public int pseudo(int[] out, boolean captures) {
        int n = 0;
        for (int s = 0; s < 128; s++) {
            if ((s & 0x88) != 0) { s += 7; continue; }
            int p = sq[s];
            if (p == 0 || (p & BLACK) != side) continue;
            switch (p & 7) {
                case PAWN: n = pawnMoves(s, out, n, captures); break;
                case KNIGHT: n = steps(s, KNIGHT_STEPS, out, n, captures); break;
                case BISHOP: n = slides(s, DIAGONAL, out, n, captures); break;
                case ROOK: n = slides(s, STRAIGHT, out, n, captures); break;
                case QUEEN:
                    n = slides(s, DIAGONAL, out, n, captures);
                    n = slides(s, STRAIGHT, out, n, captures);
                    break;
                case KING:
                    n = steps(s, KING_STEPS, out, n, captures);
                    if (!captures) n = castling(s, out, n);
                    break;
                default:
            }
        }
        return n;
    }

    /** Все законные ходы. */
    public int legal(int[] out) {
        int[] all = new int[256];
        int n = pseudo(all, false), k = 0;
        for (int i = 0; i < n; i++) {
            make(all[i]);
            boolean ok = !leftKingInCheck();
            unmake(all[i]);
            if (ok) out[k++] = all[i];
        }
        return k;
    }

    private int pawnMoves(int s, int[] out, int n, boolean captures) {
        int dir = side == WHITE ? 16 : -16;
        int t = s + dir;
        boolean promotes = (t >> 4) == (side == WHITE ? 7 : 0);
        if ((t & 0x88) == 0 && sq[t] == 0 && (!captures || promotes)) {
            n = addPawn(s, t, 0, out, n);
            int start = side == WHITE ? 1 : 6;
            if (!captures && (s >> 4) == start && sq[t + dir] == 0) out[n++] = move(s, t + dir, 0, DOUBLE_PUSH);
        }
        for (int c = t - 1; c <= t + 1; c += 2) {
            if ((c & 0x88) != 0) continue;
            int q = sq[c];
            if (q != 0 && (q & BLACK) != side) n = addPawn(s, c, CAPTURE, out, n);
            else if (q == 0 && c == ep) out[n++] = move(s, c, 0, CAPTURE | EN_PASSANT);
        }
        return n;
    }

    private static int addPawn(int f, int t, int flags, int[] out, int n) {
        int rank = t >> 4;
        if (rank == 0 || rank == 7) {
            for (int p = QUEEN; p >= KNIGHT; p--) out[n++] = move(f, t, p, flags);
        } else {
            out[n++] = move(f, t, 0, flags);
        }
        return n;
    }

    private int steps(int s, int[] dirs, int[] out, int n, boolean captures) {
        for (int d : dirs) {
            int t = s + d;
            if ((t & 0x88) != 0) continue;
            int q = sq[t];
            if (q == 0) {
                if (!captures) out[n++] = move(s, t, 0, 0);
            } else if ((q & BLACK) != side) {
                out[n++] = move(s, t, 0, CAPTURE);
            }
        }
        return n;
    }

    private int slides(int s, int[] dirs, int[] out, int n, boolean captures) {
        for (int d : dirs) {
            for (int t = s + d; (t & 0x88) == 0; t += d) {
                int q = sq[t];
                if (q == 0) {
                    if (!captures) out[n++] = move(s, t, 0, 0);
                    continue;
                }
                if ((q & BLACK) != side) out[n++] = move(s, t, 0, CAPTURE);
                break;
            }
        }
        return n;
    }

    private int castling(int s, int[] out, int n) {
        int them = side ^ BLACK;
        if (side == WHITE && s == 4) {
            if ((castle & 1) != 0 && sq[5] == 0 && sq[6] == 0 && sq[7] == (WHITE | ROOK)
                    && !attacked(4, them) && !attacked(5, them) && !attacked(6, them)) out[n++] = move(4, 6, 0, CASTLING);
            if ((castle & 2) != 0 && sq[3] == 0 && sq[2] == 0 && sq[1] == 0 && sq[0] == (WHITE | ROOK)
                    && !attacked(4, them) && !attacked(3, them) && !attacked(2, them)) out[n++] = move(4, 2, 0, CASTLING);
        } else if (side == BLACK && s == 116) {
            if ((castle & 4) != 0 && sq[117] == 0 && sq[118] == 0 && sq[119] == (BLACK | ROOK)
                    && !attacked(116, them) && !attacked(117, them) && !attacked(118, them)) out[n++] = move(116, 118, 0, CASTLING);
            if ((castle & 8) != 0 && sq[115] == 0 && sq[114] == 0 && sq[113] == 0 && sq[112] == (BLACK | ROOK)
                    && !attacked(116, them) && !attacked(115, them) && !attacked(114, them)) out[n++] = move(116, 114, 0, CASTLING);
        }
        return n;
    }

    /* ---------- сделать и отменить ход ---------- */

    public void make(int m) {
        int f = from(m), t = to(m), pr = promo(m), fl = flags(m);
        int p = sq[f];
        int cap = sq[t];
        undoCastle[depth] = castle;
        undoEp[depth] = ep;
        undoHalf[depth] = halfmove;
        undoHash[depth] = hash;

        long h = hash ^ Z_CASTLE[castle];
        if (ep >= 0) h ^= Z_EP[ep];
        if ((fl & EN_PASSANT) != 0) {
            int capSq = side == WHITE ? t - 16 : t + 16;
            cap = sq[capSq];
            sq[capSq] = 0;
            h ^= Z_PIECE[cap][capSq];
        } else if (cap != 0) {
            h ^= Z_PIECE[cap][t];
        }
        undoCaptured[depth++] = cap;

        int placed = pr != 0 ? side | pr : p;
        sq[f] = 0;
        sq[t] = placed;
        h ^= Z_PIECE[p][f] ^ Z_PIECE[placed][t];

        if ((fl & CASTLING) != 0) {
            int rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1;
            int rook = sq[rf];
            sq[rf] = 0;
            sq[rt] = rook;
            h ^= Z_PIECE[rook][rf] ^ Z_PIECE[rook][rt];
        }
        if ((p & 7) == KING) kingAt[side >> 3] = t;

        castle &= CASTLE_MASK[f] & CASTLE_MASK[t];
        h ^= Z_CASTLE[castle];
        ep = (fl & DOUBLE_PUSH) != 0 ? (f + t) >> 1 : -1;
        if (ep >= 0) h ^= Z_EP[ep];
        halfmove = (p & 7) == PAWN || cap != 0 ? 0 : halfmove + 1;
        if (side == BLACK) fullmove++;
        side ^= BLACK;
        hash = h ^ Z_SIDE;
    }

    public void unmake(int m) {
        depth--;
        side ^= BLACK;
        if (side == BLACK) fullmove--;
        int f = from(m), t = to(m), fl = flags(m);
        int placed = sq[t];
        int p = promo(m) != 0 ? side | PAWN : placed;
        sq[f] = p;
        if ((fl & EN_PASSANT) != 0) {
            sq[t] = 0;
            sq[side == WHITE ? t - 16 : t + 16] = undoCaptured[depth];
        } else {
            sq[t] = undoCaptured[depth];
        }
        if ((fl & CASTLING) != 0) {
            int rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1;
            sq[rf] = sq[rt];
            sq[rt] = 0;
        }
        if ((p & 7) == KING) kingAt[side >> 3] = f;
        castle = undoCastle[depth];
        ep = undoEp[depth];
        halfmove = undoHalf[depth];
        hash = undoHash[depth];
    }

    /** «пропуск хода» для перебора с нулевым ходом */
    void makeNull() {
        undoCastle[depth] = castle;
        undoEp[depth] = ep;
        undoHalf[depth] = halfmove;
        undoHash[depth] = hash;
        undoCaptured[depth++] = 0;
        if (ep >= 0) hash ^= Z_EP[ep];
        ep = -1;
        halfmove = 0;
        side ^= BLACK;
        hash ^= Z_SIDE;
    }

    void unmakeNull() {
        depth--;
        side ^= BLACK;
        ep = undoEp[depth];
        halfmove = undoHalf[depth];
        hash = undoHash[depth];
    }

    /* ---------- запись ходов ---------- */

    private static final String[] LETTER_EN = {"", "", "N", "B", "R", "Q", "K"};
    private static final String[] LETTER_RU = {"", "", "К", "С", "Л", "Ф", "Кр"};

    /** Короткая алгебраическая запись: «Nf3», «exd5», «O-O», «e8=Q+»; russian — «Кf3», «Фh5#». */
    public String san(int m, boolean russian) {
        String[] letters = russian ? LETTER_RU : LETTER_EN;
        int f = from(m), t = to(m), p = sq[f] & 7;
        StringBuilder s = new StringBuilder();
        if (isCastling(m)) {
            s.append(t > f ? "O-O" : "O-O-O");
        } else if (p == PAWN) {
            if (isCapture(m)) s.append((char) ('a' + (f & 7))).append('x');
            s.append(square(t));
            if (promo(m) != 0) s.append('=').append(letters[promo(m)]);
        } else {
            s.append(letters[p]);
            int[] moves = new int[256];
            int n = legal(moves);
            boolean ambiguous = false, sameFile = false, sameRank = false;
            for (int i = 0; i < n; i++) {
                int o = moves[i];
                if (to(o) != t || from(o) == f || (sq[from(o)] & 7) != p) continue;
                ambiguous = true;
                if ((from(o) & 7) == (f & 7)) sameFile = true;
                if ((from(o) >> 4) == (f >> 4)) sameRank = true;
            }
            if (ambiguous) {
                if (!sameFile) s.append((char) ('a' + (f & 7)));
                else if (!sameRank) s.append((char) ('1' + (f >> 4)));
                else s.append(square(f));
            }
            if (isCapture(m)) s.append('x');
            s.append(square(t));
        }
        make(m);
        if (inCheck()) s.append(legal(new int[256]) == 0 ? '#' : '+');
        unmake(m);
        return s.toString();
    }

    /** найти законный ход по записи «e2e4» / «e7e8q»; 0 — такого нет */
    public int parseUci(String uci) {
        int[] moves = new int[256];
        int n = legal(moves);
        for (int i = 0; i < n; i++) if (uci(moves[i]).equals(uci.trim().toLowerCase(java.util.Locale.ROOT))) return moves[i];
        return 0;
    }

    public Board copy() {
        return fromFen(fen());
    }
}
