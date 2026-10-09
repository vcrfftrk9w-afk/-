package app.umnik.chess;

/**
 * Шахматный движок: альфа-бета с итеративным углублением, таблицей позиций, нулевым ходом,
 * сокращениями поздних ходов и форсированными вариантами (взятия). Оценка — таблицы PeSTO
 * (материал и положение фигур отдельно для миттельшпиля и эндшпиля).
 */
public final class Engine {
    public static final int MATE = 30000;
    static final int INF = 32000;
    static final int MAX_PLY = 64;
    private static final int EXACT = 0, LOWER = 1, UPPER = 2;
    private static final int TT_BITS = 18;
    private static final int TT_MASK = (1 << TT_BITS) - 1;

    /** Что придумал движок. */
    public static final class Result {
        /** лучший ход; 0 — ходов нет (мат или пат) */
        public int move;
        /** оценка в сотых долях пешки для той стороны, чей ход */
        public int score;
        public int depth;
        public long nodes;
        public int[] pv = new int[0];

        public boolean isMate() {
            return Math.abs(score) > MATE - 1000;
        }

        /** через сколько ходов мат: больше нуля — ставим мы, меньше — ставят нам */
        public int mateIn() {
            if (!isMate()) return 0;
            int plies = MATE - Math.abs(score);
            return score > 0 ? (plies + 1) / 2 : -(plies + 1) / 2;
        }
    }

    private final long[] ttKey = new long[1 << TT_BITS];
    private final int[] ttMove = new int[1 << TT_BITS];
    private final int[] ttScore = new int[1 << TT_BITS];
    private final byte[] ttDepth = new byte[1 << TT_BITS];
    private final byte[] ttFlag = new byte[1 << TT_BITS];
    private final int[][] killers = new int[MAX_PLY * 2][2];
    private final int[][] history = new int[16][128];
    private final int[][] moveBuf = new int[MAX_PLY * 2][256];
    private final int[][] scoreBuf = new int[MAX_PLY * 2][256];
    private final long[] path = new long[MAX_PLY * 2 + 2];
    private final int[][] pvTable = new int[MAX_PLY * 2][MAX_PLY * 2];
    private final int[] pvLen = new int[MAX_PLY * 2];

    private Board b;
    private long deadline;
    private long nodes;
    private boolean stop;

    /** Найти лучший ход, думая не дольше millis миллисекунд. Позиция после поиска та же. */
    public Result think(Board board, long millis) {
        b = board;
        long start = System.nanoTime();
        deadline = start + millis * 1_000_000L;
        stop = false;
        nodes = 0;
        for (int[] k : killers) { k[0] = 0; k[1] = 0; }
        for (int[] h : history) for (int i = 0; i < h.length; i++) h[i] >>= 3;

        Result r = new Result();
        int[] rootMoves = new int[256];
        int n = b.legal(rootMoves);
        if (n == 0) {
            r.score = b.inCheck() ? -MATE : 0;
            return r;
        }
        r.move = rootMoves[0];
        r.pv = new int[]{r.move};
        path[0] = b.hash;
        for (int depth = 1; depth < MAX_PLY - 4; depth++) {
            int score = search(depth, -INF, INF, 0, false);
            if (stop) break;
            r.score = score;
            r.depth = depth;
            if (pvLen[0] > 0) {
                r.move = pvTable[0][0];
                r.pv = java.util.Arrays.copyOf(pvTable[0], pvLen[0]);
            }
            if (n == 1 && depth >= 4) break;                                   // ход единственный
            if (r.isMate() && depth > 2 * Math.abs(r.mateIn()) + 2) break;      // мат уже найден
            if (System.nanoTime() - start > millis * 600_000L) break;           // следующую глубину не успеем
        }
        r.nodes = nodes;
        return r;
    }

    private int search(int depth, int alpha, int beta, int ply, boolean allowNull) {
        pvLen[ply] = ply;
        if ((++nodes & 2047) == 0 && System.nanoTime() > deadline) stop = true;
        if (stop) return 0;
        if (ply > 0) {
            if (b.halfmove >= 100 || repeated(ply)) return 0;
            alpha = Math.max(alpha, -MATE + ply);
            beta = Math.min(beta, MATE - ply - 1);
            if (alpha >= beta) return alpha;
        }
        boolean inCheck = b.inCheck();
        if (inCheck) depth++;
        if (depth <= 0) return quiesce(alpha, beta, ply);
        if (ply >= MAX_PLY - 1) return evaluate();

        boolean pvNode = beta - alpha > 1;
        int idx = (int) (b.hash & TT_MASK);
        int ttm = 0;
        if (ttKey[idx] == b.hash) {
            ttm = ttMove[idx];
            if (!pvNode && ttDepth[idx] >= depth) {
                int s = fromTT(ttScore[idx], ply);
                int flag = ttFlag[idx];
                if (flag == EXACT || (flag == LOWER && s >= beta) || (flag == UPPER && s <= alpha)) return s;
            }
        }

        if (allowNull && !pvNode && !inCheck && depth >= 3 && hasPieces() && evaluate() >= beta) {
            b.makeNull();
            path[ply + 1] = b.hash;
            int s = -search(depth - 1 - (depth > 6 ? 3 : 2), -beta, -beta + 1, ply + 1, false);
            b.unmakeNull();
            if (stop) return 0;
            if (s >= beta) return s > MATE - 1000 ? beta : s;
        }

        int[] moves = moveBuf[ply];
        int[] scores = scoreBuf[ply];
        int n = b.pseudo(moves, false);
        scoreMoves(moves, scores, n, ttm, ply);
        int best = -INF, bestMove = 0, legal = 0, oldAlpha = alpha;
        for (int i = 0; i < n; i++) {
            pickNext(moves, scores, i, n);
            int m = moves[i];
            b.make(m);
            if (b.leftKingInCheck()) {
                b.unmake(m);
                continue;
            }
            legal++;
            path[ply + 1] = b.hash;
            boolean quiet = !Board.isCapture(m) && Board.promo(m) == 0;
            int s;
            if (legal == 1) {
                s = -search(depth - 1, -beta, -alpha, ply + 1, true);
            } else {
                int reduce = 0;
                if (depth >= 3 && quiet && !inCheck && legal > 3 && m != killers[ply][0] && m != killers[ply][1]
                        && !b.inCheck()) reduce = legal > 8 ? 2 : 1;
                s = -search(depth - 1 - reduce, -alpha - 1, -alpha, ply + 1, true);
                if (s > alpha && reduce > 0) s = -search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
                if (s > alpha && s < beta) s = -search(depth - 1, -beta, -alpha, ply + 1, true);
            }
            b.unmake(m);
            if (stop) return 0;
            if (s > best) {
                best = s;
                bestMove = m;
                if (s > alpha) {
                    alpha = s;
                    savePv(ply, m);
                    if (s >= beta) {
                        if (quiet) {
                            if (killers[ply][0] != m) {
                                killers[ply][1] = killers[ply][0];
                                killers[ply][0] = m;
                            }
                            int[] h = history[b.sq[Board.from(m)]];
                            h[Board.to(m)] += depth * depth;
                            if (h[Board.to(m)] > 500_000) for (int[] row : history) for (int j = 0; j < row.length; j++) row[j] >>= 1;
                        }
                        break;
                    }
                }
            }
        }
        if (legal == 0) return inCheck ? -MATE + ply : 0;
        int flag = best >= beta ? LOWER : best > oldAlpha ? EXACT : UPPER;
        ttKey[idx] = b.hash;
        ttMove[idx] = bestMove;
        ttScore[idx] = toTT(best, ply);
        ttDepth[idx] = (byte) Math.min(depth, 127);
        ttFlag[idx] = (byte) flag;
        return best;
    }

    private int quiesce(int alpha, int beta, int ply) {
        pvLen[ply] = ply;
        if ((++nodes & 2047) == 0 && System.nanoTime() > deadline) stop = true;
        if (stop) return 0;
        if (ply >= MAX_PLY * 2 - 2) return evaluate();
        boolean inCheck = b.inCheck();
        int best = -INF;
        if (!inCheck) {
            best = evaluate();
            if (best >= beta) return best;
            if (best > alpha) alpha = best;
        }
        int[] moves = moveBuf[ply];
        int[] scores = scoreBuf[ply];
        int n = b.pseudo(moves, !inCheck);
        scoreMoves(moves, scores, n, 0, ply);
        int legal = 0;
        for (int i = 0; i < n; i++) {
            pickNext(moves, scores, i, n);
            int m = moves[i];
            b.make(m);
            if (b.leftKingInCheck()) {
                b.unmake(m);
                continue;
            }
            legal++;
            int s = -quiesce(-beta, -alpha, ply + 1);
            b.unmake(m);
            if (stop) return 0;
            if (s > best) {
                best = s;
                if (s > alpha) {
                    alpha = s;
                    savePv(ply, m);
                    if (s >= beta) break;
                }
            }
        }
        if (inCheck && legal == 0) return -MATE + ply;
        return best;
    }

    private void savePv(int ply, int m) {
        pvTable[ply][ply] = m;
        int len = Math.max(pvLen[ply + 1], ply + 1);
        for (int j = ply + 1; j < len; j++) pvTable[ply][j] = pvTable[ply + 1][j];
        pvLen[ply] = len;
    }

    private boolean repeated(int ply) {
        for (int i = ply - 2; i >= 0 && i >= ply - b.halfmove; i -= 2) if (path[i] == b.hash) return true;
        return false;
    }

    private static int toTT(int s, int ply) {
        if (s > MATE - 1000) return s + ply;
        if (s < -MATE + 1000) return s - ply;
        return s;
    }

    private static int fromTT(int s, int ply) {
        if (s > MATE - 1000) return s - ply;
        if (s < -MATE + 1000) return s + ply;
        return s;
    }

    /** есть ли у ходящей стороны фигуры кроме пешек и короля (без них нулевой ход опасен — цугцванг) */
    private boolean hasPieces() {
        for (int s = 0; s < 128; s++) {
            if ((s & 0x88) != 0) { s += 7; continue; }
            int p = b.sq[s];
            if (p != 0 && (p & Board.BLACK) == b.side && (p & 7) >= Board.KNIGHT && (p & 7) <= Board.QUEEN) return true;
        }
        return false;
    }

    private void scoreMoves(int[] moves, int[] scores, int n, int ttm, int ply) {
        for (int i = 0; i < n; i++) {
            int m = moves[i];
            if (m == ttm) {
                scores[i] = 1 << 30;
            } else if (Board.isCapture(m)) {
                int victim = Board.isEnPassant(m) ? Board.PAWN : b.sq[Board.to(m)] & 7;
                int attacker = b.sq[Board.from(m)] & 7;
                scores[i] = 10_000_000 + victim * 100 - attacker + Board.promo(m) * 1000;
            } else if (Board.promo(m) != 0) {
                scores[i] = 9_000_000 + Board.promo(m);
            } else if (m == killers[ply][0]) {
                scores[i] = 8_000_000;
            } else if (m == killers[ply][1]) {
                scores[i] = 7_000_000;
            } else {
                scores[i] = history[b.sq[Board.from(m)]][Board.to(m)];
            }
        }
    }

    private static void pickNext(int[] moves, int[] scores, int i, int n) {
        int best = i;
        for (int j = i + 1; j < n; j++) if (scores[j] > scores[best]) best = j;
        if (best != i) {
            int m = moves[i]; moves[i] = moves[best]; moves[best] = m;
            int s = scores[i]; scores[i] = scores[best]; scores[best] = s;
        }
    }

    /* ---------- оценка позиции (PeSTO) ---------- */

    private static final int[] PHASE = {0, 0, 1, 1, 2, 4, 0};
    private static final int[] MG_VALUE = {0, 82, 337, 365, 477, 1025, 0};
    private static final int[] EG_VALUE = {0, 94, 281, 297, 512, 936, 0};

    // таблицы с точки зрения белых, первая строка — восьмая горизонталь
    private static final int[][] MG_TABLE = {
            {},
            { // пешка
                    0, 0, 0, 0, 0, 0, 0, 0,
                    98, 134, 61, 95, 68, 126, 34, -11,
                    -6, 7, 26, 31, 65, 56, 25, -20,
                    -14, 13, 6, 21, 23, 12, 17, -23,
                    -27, -2, -5, 12, 17, 6, 10, -25,
                    -26, -4, -4, -10, 3, 3, 33, -12,
                    -35, -1, -20, -23, -15, 24, 38, -22,
                    0, 0, 0, 0, 0, 0, 0, 0},
            { // конь
                    -167, -89, -34, -49, 61, -97, -15, -107,
                    -73, -41, 72, 36, 23, 62, 7, -17,
                    -47, 60, 37, 65, 84, 129, 73, 44,
                    -9, 17, 19, 53, 37, 69, 18, 22,
                    -13, 4, 16, 13, 28, 19, 21, -8,
                    -23, -9, 12, 10, 19, 17, 25, -16,
                    -29, -53, -12, -3, -1, 18, -14, -19,
                    -105, -21, -58, -33, -17, -28, -19, -23},
            { // слон
                    -29, 4, -82, -37, -25, -42, 7, -8,
                    -26, 16, -18, -13, 30, 59, 18, -47,
                    -16, 37, 43, 40, 35, 50, 37, -2,
                    -4, 5, 19, 50, 37, 37, 7, -2,
                    -6, 13, 13, 26, 34, 12, 10, 4,
                    0, 15, 15, 15, 14, 27, 18, 10,
                    4, 15, 16, 0, 7, 21, 33, 1,
                    -33, -3, -14, -21, -13, -12, -39, -21},
            { // ладья
                    32, 42, 32, 51, 63, 9, 31, 43,
                    27, 32, 58, 62, 80, 67, 26, 44,
                    -5, 19, 26, 36, 17, 45, 61, 16,
                    -24, -11, 7, 26, 24, 35, -8, -20,
                    -36, -26, -12, -1, 9, -7, 6, -23,
                    -45, -25, -16, -17, 3, 0, -5, -33,
                    -44, -16, -20, -9, -1, 11, -6, -71,
                    -19, -13, 1, 17, 16, 7, -37, -26},
            { // ферзь
                    -28, 0, 29, 12, 59, 44, 43, 45,
                    -24, -39, -5, 1, -16, 57, 28, 54,
                    -13, -17, 7, 8, 29, 56, 47, 57,
                    -27, -27, -16, -16, -1, 17, -2, 1,
                    -9, -26, -9, -10, -2, -4, 3, -3,
                    -14, 2, -11, -2, -5, 2, 14, 5,
                    -35, -8, 11, 2, 8, 15, -3, 1,
                    -1, -18, -9, 10, -15, -25, -31, -50},
            { // король
                    -65, 23, 16, -15, -56, -34, 2, 13,
                    29, -1, -20, -7, -8, -4, -38, -29,
                    -9, 24, 2, -16, -20, 6, 22, -22,
                    -17, -20, -12, -27, -30, -25, -14, -36,
                    -49, -1, -27, -39, -46, -44, -33, -51,
                    -14, -14, -22, -46, -44, -30, -15, -27,
                    1, 7, -8, -64, -43, -16, 9, 8,
                    -15, 36, 12, -54, 8, -28, 24, 14},
    };

    private static final int[][] EG_TABLE = {
            {},
            {
                    0, 0, 0, 0, 0, 0, 0, 0,
                    178, 173, 158, 134, 147, 132, 165, 187,
                    94, 100, 85, 67, 56, 53, 82, 84,
                    32, 24, 13, 5, -2, 4, 17, 17,
                    13, 9, -3, -7, -7, -8, 3, -1,
                    4, 7, -6, 1, 0, -5, -1, -8,
                    13, 8, 8, 10, 13, 0, 2, -7,
                    0, 0, 0, 0, 0, 0, 0, 0},
            {
                    -58, -38, -13, -28, -31, -27, -63, -99,
                    -25, -8, -25, -2, -9, -25, -24, -52,
                    -24, -20, 10, 9, -1, -9, -19, -41,
                    -17, 3, 22, 22, 22, 11, 8, -18,
                    -18, -6, 16, 25, 16, 17, 4, -18,
                    -23, -3, -1, 15, 10, -3, -20, -22,
                    -42, -20, -10, -5, -2, -20, -23, -44,
                    -29, -51, -23, -15, -22, -18, -50, -64},
            {
                    -14, -21, -11, -8, -7, -9, -17, -24,
                    -8, -4, 7, -12, -3, -13, -4, -14,
                    2, -8, 0, -1, -2, 6, 0, 4,
                    -3, 9, 12, 9, 14, 10, 3, 2,
                    -6, 3, 13, 19, 7, 10, -3, -9,
                    -12, -3, 8, 10, 13, 3, -7, -15,
                    -14, -18, -7, -1, 4, -9, -15, -27,
                    -23, -9, -23, -5, -9, -16, -5, -17},
            {
                    13, 10, 18, 15, 12, 12, 8, 5,
                    11, 13, 13, 11, -3, 3, 8, 3,
                    7, 7, 7, 5, 4, -3, -5, -3,
                    4, 3, 13, 1, 2, 1, -1, 2,
                    3, 5, 8, 4, -5, -6, -8, -11,
                    -4, 0, -5, -1, -7, -12, -8, -16,
                    -6, -6, 0, 2, -9, -9, -11, -3,
                    -9, 2, 3, -1, -5, -13, 4, -20},
            {
                    -9, 22, 22, 27, 27, 19, 10, 20,
                    -17, 20, 32, 41, 58, 25, 30, 0,
                    -20, 6, 9, 49, 47, 35, 19, 9,
                    3, 22, 24, 45, 57, 40, 57, 36,
                    -18, 28, 19, 47, 31, 34, 39, 23,
                    -16, -27, 15, 6, 9, 17, 10, 5,
                    -22, -23, -30, -16, -16, -23, -36, -32,
                    -33, -28, -22, -43, -5, -32, -20, -41},
            {
                    -74, -35, -18, -18, -11, 15, 4, -17,
                    -12, 17, 14, 17, 17, 38, 23, 11,
                    10, 17, 23, 15, 20, 45, 44, 13,
                    -8, 22, 24, 27, 26, 33, 26, 3,
                    -18, -4, 21, 24, 27, 23, 9, -11,
                    -19, -3, 11, 21, 23, 16, 7, -9,
                    -27, -11, 4, 13, 14, 4, -5, -17,
                    -53, -34, -21, -11, -28, -14, -24, -43},
    };

    // [фигура с цветом][поле 0x88] → вклад в оценку белых (у чёрных уже с минусом)
    private static final int[][] MG = new int[15][128];
    private static final int[][] EG = new int[15][128];

    static {
        for (int t = Board.PAWN; t <= Board.KING; t++) {
            for (int s = 0; s < 128; s++) {
                if ((s & 0x88) != 0) continue;
                int file = s & 7, rank = s >> 4;
                int w = (7 - rank) * 8 + file, bl = rank * 8 + file;
                MG[t][s] = MG_VALUE[t] + MG_TABLE[t][w];
                EG[t][s] = EG_VALUE[t] + EG_TABLE[t][w];
                MG[t | Board.BLACK][s] = -(MG_VALUE[t] + MG_TABLE[t][bl]);
                EG[t | Board.BLACK][s] = -(EG_VALUE[t] + EG_TABLE[t][bl]);
            }
        }
    }

    /** оценка для той стороны, чей ход */
    int evaluate() {
        int mg = 0, eg = 0, phase = 0, whiteBishops = 0, blackBishops = 0, heavy = 0, minors = 0;
        for (int s = 0; s < 128; s++) {
            if ((s & 0x88) != 0) { s += 7; continue; }
            int p = b.sq[s];
            if (p == 0) continue;
            mg += MG[p][s];
            eg += EG[p][s];
            int t = p & 7;
            phase += PHASE[t];
            if (t == Board.BISHOP) {
                if ((p & Board.BLACK) == 0) whiteBishops++;
                else blackBishops++;
            }
            if (t == Board.PAWN || t == Board.ROOK || t == Board.QUEEN) heavy++;
            if (t == Board.KNIGHT || t == Board.BISHOP) minors++;
        }
        if (heavy == 0 && minors <= 1) return 0; // мата не поставить — ничья
        if (phase > 24) phase = 24;
        int score = (mg * phase + eg * (24 - phase)) / 24;
        if (whiteBishops >= 2) score += 30;
        if (blackBishops >= 2) score -= 30;
        return b.side == Board.WHITE ? score : -score;
    }
}
