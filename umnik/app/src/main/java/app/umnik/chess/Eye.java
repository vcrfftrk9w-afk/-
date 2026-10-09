package app.umnik.chess;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;

/**
 * Шахматное «зрение» без ИИ: находит на скриншоте плоскую доску 8×8 и узнаёт фигуры по образцам,
 * которые один раз запоминает по начальной позиции в том же приложении. Бесплатно, без интернета,
 * за доли секунды. Работает с пикселями ARGB, без Android — так его можно проверять тестами.
 */
public final class Eye {
    /** силуэт фигуры уменьшается до сетки GRID×GRID */
    static final int GRID = 16;
    /** на каждую клетку сетки два числа: доля силуэта и доля тёмного внутри */
    static final int SHAPE = 2 * GRID * GRID;
    private static final String BACK_RANK = "RNBQKBNR";
    private static final int VERSION = 3;

    /** Образцы фигур одного приложения. */
    public static final class Pieces {
        /** [0 — белые, 1 — чёрные][тип 1..6] */
        final float[][][] shape = new float[2][7][];
        /** насколько в среднем образец отличается от своих фигур — мерка «похоже ли это вообще на фигуру» */
        float spread;

        /** в строку для хранения в настройках */
        public String save() {
            byte[] out = new byte[2 + 12 * SHAPE];
            out[0] = VERSION;
            out[1] = (byte) Math.min(255, Math.round(spread * 10));
            int k = 2;
            for (int c = 0; c < 2; c++) {
                for (int t = Board.PAWN; t <= Board.KING; t++) {
                    for (float v : shape[c][t]) out[k++] = (byte) Math.round(v * 255);
                }
            }
            return Base64.getEncoder().encodeToString(out);
        }

        public static Pieces load(String s) {
            if (s == null || s.isEmpty()) return null;
            try {
                byte[] in = Base64.getDecoder().decode(s);
                if (in.length != 2 + 12 * SHAPE || in[0] != VERSION) return null;
                Pieces p = new Pieces();
                p.spread = (in[1] & 0xFF) / 10f;
                int k = 2;
                for (int c = 0; c < 2; c++) {
                    for (int t = Board.PAWN; t <= Board.KING; t++) {
                        float[] v = new float[SHAPE];
                        for (int i = 0; i < SHAPE; i++) v[i] = (in[k++] & 0xFF) / 255f;
                        p.shape[c][t] = v;
                    }
                }
                return p;
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
    }

    /** Что увидел. */
    public static final class Result {
        /** доска найдена */
        public boolean found;
        /** это начальная позиция — по ней и выучены фигуры (learned) */
        public boolean start;
        public Pieces learned;
        /** 8 строк сверху вниз, как на экране: K Q R B N P / k q r b n p / «.» */
        public List<String> rows;
        public boolean whiteBottom = true;
        /** white / black / unknown — по подсветке последнего хода */
        public String turn = "unknown";
        /** где доска на снимке */
        public int left, top, size;
    }

    private Eye() {
    }

    /** Посмотреть на снимок. known — выученные фигуры этого приложения (или null). */
    public static Result look(int[] px, int w, int h, Pieces known) {
        Result r = new Result();
        int[] g = findBoard(px, w, h);
        if (g == null) return r;
        r.found = true;
        r.left = g[0];
        r.top = g[1];
        r.size = g[2];
        float cell = g[2] / 8f;

        Square[][] sq = new Square[8][8];
        for (int row = 0; row < 8; row++) {
            for (int col = 0; col < 8; col++) {
                sq[row][col] = square(px, w, g[0] + col * cell, g[1] + row * cell, cell, g[3], g[4]);
            }
        }

        Pieces learned = learn(sq);
        if (learned != null) {
            r.start = true;
            r.learned = learned;
            known = learned;
        }
        if (known == null) return r; // доска есть, но фигуры этого приложения ещё не знакомы

        char[][] board = new char[8][8];
        int whiteRows = 0, blackRows = 0, whiteCount = 0, blackCount = 0;
        for (int row = 0; row < 8; row++) {
            for (int col = 0; col < 8; col++) {
                Square s = sq[row][col];
                if (!s.occupied) {
                    board[row][col] = '.';
                    continue;
                }
                int piece = classify(s, known);
                if (piece == 0) { // не похоже ни на одну фигуру (стрелка, точка хода) — считаем пустой
                    board[row][col] = '.';
                    continue;
                }
                int type = piece & 7;
                s.white = (piece & Board.BLACK) == 0;
                board[row][col] = Board.letterOf(piece);
                int weight = type == Board.PAWN ? 2 : type == Board.KING ? 3 : 1;
                if (s.white) {
                    whiteRows += row * weight;
                    whiteCount += weight;
                } else {
                    blackRows += row * weight;
                    blackCount += weight;
                }
            }
        }
        r.rows = new ArrayList<>();
        for (char[] line : board) r.rows.add(new String(line));
        if (r.start) {
            r.whiteBottom = sq[7][0].white;
        } else {
            // белые фигуры в среднем ниже чёрных — значит, белые играют снизу
            double white = whiteCount == 0 ? 3.5 : whiteRows / (double) whiteCount;
            double black = blackCount == 0 ? 3.5 : blackRows / (double) blackCount;
            r.whiteBottom = white >= black;
        }
        r.turn = turnFromHighlight(sq);
        return r;
    }

    /* ---------- где доска ---------- */

    /** {left, top, size, colorA, colorB} или null; цвет a — на клетках, где сумма строки и столбца чётная */
    static int[] findBoard(int[] px, int w, int h) {
        int[] colors = flatColors(px, w, h, 8);
        int[] best = null;
        double bestScore = 0;
        for (int i = 0; i < colors.length; i++) {
            for (int j = i + 1; j < colors.length; j++) {
                int[] cand = fit(px, w, h, colors[i], colors[j]);
                if (cand == null) continue;
                double score = cand[5] + cand[2] / 10000.0; // при равной точности — доска побольше
                if (score > bestScore) {
                    bestScore = score;
                    best = cand;
                }
            }
        }
        if (best == null || best[5] < 52) return null;
        return refine(px, w, h, best);
    }

    /** самые частые «плоские» цвета (пиксель такой же, как сосед справа) */
    private static int[] flatColors(int[] px, int w, int h, int k) {
        int[] count = new int[4096];
        long[] r = new long[4096], gr = new long[4096], b = new long[4096];
        for (int y = 0; y < h; y += 2) {
            for (int x = 0; x + 1 < w; x += 2) {
                int p = px[y * w + x];
                if (p != px[y * w + x + 1]) continue;
                int bin = ((p >> 20) & 0xF) << 8 | ((p >> 12) & 0xF) << 4 | ((p >> 4) & 0xF);
                count[bin]++;
                r[bin] += (p >> 16) & 0xFF;
                gr[bin] += (p >> 8) & 0xFF;
                b[bin] += p & 0xFF;
            }
        }
        Integer[] bins = new Integer[4096];
        for (int i = 0; i < 4096; i++) bins[i] = i;
        Arrays.sort(bins, (x, y) -> count[y] - count[x]);
        int n = 0;
        int[] out = new int[k];
        for (int i = 0; i < 4096 && n < k; i++) {
            int bin = bins[i];
            if (count[bin] < 50) break;
            out[n++] = rgb((int) (r[bin] / count[bin]), (int) (gr[bin] / count[bin]), (int) (b[bin] / count[bin]));
        }
        return Arrays.copyOf(out, n);
    }

    /**
     * Попробовать пару цветов как клетки доски (на сетке через пиксель): {left, top, size, a, b,
     * совпавших клеток из 64, 1 — цвет a на клетках с чётной суммой строки и столбца} или null.
     */
    private static int[] fit(int[] px, int w, int h, int a, int b) {
        int step = 2, gw = w / step, gh = h / step;
        byte[] label = new byte[gw * gh];
        int[] colCount = new int[gw];
        for (int y = 0; y < gh; y++) {
            for (int x = 0; x < gw; x++) {
                int p = px[(y * step) * w + x * step];
                byte l = near(p, a, 14) ? (byte) 1 : near(p, b, 14) ? (byte) 2 : 0;
                label[y * gw + x] = l;
                if (l != 0) colCount[x]++;
            }
        }
        // ширина: столбцы с цветами доски (даже если на вертикали 7 фигур, между ними видна клетка)
        int[] xs = run(colCount, max(colCount) * 0.1, 2);
        if (xs == null) return null;
        int x0 = xs[0], size = xs[1] - xs[0] + 1;
        if (size < 24) return null;
        // высота: строки с цветами доски внутри этих столбцов; строки сквозь основания фигур прощаем
        int[] rowCount = new int[gh];
        for (int y = 0; y < gh; y++) {
            for (int x = x0; x < x0 + size; x++) if (label[y * gw + x] != 0) rowCount[y]++;
        }
        int[] ys = run(rowCount, size * 0.1, Math.max(2, size / 16));
        if (ys == null || ys[1] - ys[0] + 1 < size * 0.85) return null;
        // сдвигаем сетку 8×8 по высоте полосы и ищем, где клетки чередуются лучше всего;
        // одинаково хорошо подходит целый промежуток сдвигов — берём его середину
        int bestTop = ys[0], bestHits = -1, bestEven = 1, plateauEnd = ys[0];
        for (int top = Math.max(0, ys[0] - 2); top <= ys[1] - size + 3 && top + size < gh; top++) {
            int[] p = parity(label, gw, x0, top, size);
            if (p[0] > bestHits) {
                bestHits = p[0];
                bestTop = top;
                plateauEnd = top;
                bestEven = p[1];
            } else if (p[0] == bestHits && top == plateauEnd + 1) {
                plateauEnd = top;
            }
        }
        if (bestHits < 0) return null;
        return new int[]{x0 * step, (bestTop + plateauEnd) / 2 * step, size * step, a, b, bestHits, bestEven};
    }

    /** самая длинная полоса значений не меньше порога; провалы не длиннее gap прощаются */
    private static int[] run(int[] v, double min, int gap) {
        int from = -1, last = 0, bestFrom = -1, bestTo = -1;
        for (int i = 0; i < v.length; i++) {
            if (v[i] == 0 || v[i] < min) continue;
            if (from < 0 || i - last > gap + 1) from = i;
            last = i;
            if (bestFrom < 0 || last - from > bestTo - bestFrom) {
                bestFrom = from;
                bestTo = last;
            }
        }
        return bestFrom < 0 ? null : new int[]{bestFrom, bestTo};
    }

    private static int max(int[] v) {
        int m = 0;
        for (int x : v) m = Math.max(m, x);
        return m;
    }

    /** {сколько из 64 клеток своим цветом в углах подходят под шахматный порядок, 1 — цвет a на чётных клетках} */
    private static int[] parity(byte[] label, int gw, int x0, int y0, int size) {
        float cell = size / 8f;
        int even = 0, odd = 0;
        for (int row = 0; row < 8; row++) {
            for (int col = 0; col < 8; col++) {
                int ones = 0, twos = 0;
                for (int k = 0; k < 4; k++) {
                    float fx = (k % 2 == 0 ? 0.15f : 0.85f), fy = (k < 2 ? 0.15f : 0.85f);
                    int i = (y0 + (int) ((row + fy) * cell)) * gw + x0 + (int) ((col + fx) * cell);
                    if (i >= label.length) continue;
                    if (label[i] == 1) ones++;
                    if (label[i] == 2) twos++;
                }
                int l = ones > twos ? 1 : twos > ones ? 2 : 0;
                if (l == 0) continue;
                if ((l == 1) == ((row + col) % 2 == 0)) even++;
                else odd++;
            }
        }
        return new int[]{Math.max(even, odd), even >= odd ? 1 : 0};
    }

    /**
     * Уточнить края доски по полному разрешению: на каждой границе между клетками слева (сверху) должен быть
     * цвет одной клетки, справа (снизу) — другой. Сдвиг даже на пиксель это ломает, так что максимум острый.
     */
    private static int[] refine(int[] px, int w, int h, int[] g) {
        int a = g[6] == 1 ? g[3] : g[4], b = g[6] == 1 ? g[4] : g[3];
        int dt = Math.max(3, g[2] / 40), bestScore = -1;
        long sumL = 0, sumT = 0, sumS = 0, ties = 0;
        for (int s = g[2] - 4; s <= g[2] + 4; s++) {
            for (int l = g[0] - 3; l <= g[0] + 3; l++) {
                for (int t = g[1] - dt; t <= g[1] + dt; t++) {
                    if (l < 0 || t < 0 || l + s > w || t + s > h || s < 16) continue;
                    int score = edges(px, w, l, t, s, a, b);
                    if (score > bestScore) {
                        bestScore = score;
                        sumL = sumT = sumS = ties = 0;
                    }
                    if (score == bestScore) {
                        sumL += l;
                        sumT += t;
                        sumS += s;
                        ties++;
                    }
                }
            }
        }
        if (ties == 0) return new int[]{g[0], g[1], g[2], a, b};
        return new int[]{Math.round(sumL / (float) ties), Math.round(sumT / (float) ties), Math.round(sumS / (float) ties), a, b};
    }

    /** сколько границ между клетками на своих местах (по два замера на каждую сторону клетки) */
    private static int edges(int[] px, int w, int l, int t, int s, int a, int b) {
        float cell = s / 8f;
        int score = 0;
        for (int i = 0; i < 8; i++) {
            for (float f : new float[]{0.15f, 0.85f}) {
                int across = Math.round((i + f) * cell);
                for (int k = 1; k < 8; k++) {
                    int edge = Math.round(k * cell);
                    // вертикальная граница между столбцами k-1 и k в строке i
                    int y = t + across, x = l + edge;
                    int left = (i + k - 1) % 2 == 0 ? a : b, right = left == a ? b : a;
                    if (near(px[y * w + x - 2], left, 24) && near(px[y * w + x + 1], right, 24)) score++;
                    // горизонтальная граница между строками k-1 и k в столбце i
                    x = l + across;
                    y = t + edge;
                    if (near(px[(y - 2) * w + x], left, 24) && near(px[(y + 1) * w + x], right, 24)) score++;
                }
            }
        }
        return score;
    }

    /* ---------- что в клетке ---------- */

    static final class Square {
        boolean occupied, white, marked;
        /** средняя яркость фигуры 0..255 */
        float score;
        float[] shape;
    }

    /**
     * Фон клетки — самый частый цвет в её углах (подсвеченные клетки тоже так видны). Всё, до чего от краёв
     * не дойти по фону, — фигура: так белая заливка внутри контура остаётся фигурой, даже если она цвета клетки.
     */
    private static Square square(int[] px, int w, float left, float top, float cell, int a, int b) {
        Square s = new Square();
        int x0 = Math.round(left), y0 = Math.round(top);
        int sw = Math.round(left + cell) - x0, sh = Math.round(top + cell) - y0;
        int bg = background(px, w, x0, y0, sw, sh);
        s.marked = !near(bg, a, 24) && !near(bg, b, 24);

        boolean[] outside = new boolean[sw * sh];
        int[] stack = new int[sw * sh];
        int sp = 0;
        for (int y = 0; y < sh; y++) {
            for (int x = 0; x < sw; x++) {
                if (x != 0 && y != 0 && x != sw - 1 && y != sh - 1) continue;
                int i = y * sw + x;
                if (passable(px[(y0 + y) * w + x0 + x], bg, a, b)) {
                    outside[i] = true;
                    stack[sp++] = i;
                }
            }
        }
        while (sp > 0) {
            int i = stack[--sp], x = i % sw, y = i / sw;
            for (int k = 0; k < 4; k++) {
                int nx = x + (k == 0 ? 1 : k == 1 ? -1 : 0), ny = y + (k == 2 ? 1 : k == 3 ? -1 : 0);
                if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
                int j = ny * sw + nx;
                if (outside[j] || !passable(px[(y0 + ny) * w + x0 + nx], bg, a, b)) continue;
                outside[j] = true;
                stack[sp++] = j;
            }
        }

        // края клетки (подписи a–h, 1–8 и рамки подсветки) не считаем
        int from = Math.round(Math.min(sw, sh) * 0.06f), toX = sw - from, toY = sh - from;
        int spanX = toX - from, spanY = toY - from;
        float[] shape = new float[SHAPE];
        int[] cells = new int[GRID * GRID];
        int piece = 0, total = 0;
        long lum = 0;
        for (int y = from; y < toY; y++) {
            for (int x = from; x < toX; x++) {
                int gi = ((y - from) * GRID / spanY) * GRID + (x - from) * GRID / spanX;
                cells[gi]++;
                total++;
                if (outside[y * sw + x]) continue;
                int l = lum(px[(y0 + y) * w + x0 + x]);
                piece++;
                lum += l;
                shape[gi]++;
                if (l < 110) shape[GRID * GRID + gi]++;
            }
        }
        s.occupied = piece > total * 0.07;
        if (s.occupied) {
            for (int i = 0; i < GRID * GRID; i++) {
                if (cells[i] == 0) continue;
                shape[i] /= cells[i];
                shape[GRID * GRID + i] /= cells[i];
            }
            s.shape = shape;
            s.score = lum / (float) piece;
        }
        return s;
    }

    /**
     * Фон, подсветка, подписи цветом соседней клетки, яркие пятна и красный ореол шаха — не фигура.
     * Фигуры чёрно-белые: их края, смешанные с клеткой, не ярче самой клетки.
     */
    private static boolean passable(int p, int bg, int a, int b) {
        if (near(p, bg, 24) || near(p, a, 24) || near(p, b, 24)) return true;
        int r = (p >> 16) & 0xFF, g = (p >> 8) & 0xFF, bl = p & 0xFF;
        return Math.max(r, Math.max(g, bl)) - Math.min(r, Math.min(g, bl)) > 90 || r > Math.max(g, bl) + 40;
    }

    /** самый частый цвет в четырёх углах клетки: фигуры и ореол шаха до углов обычно не достают */
    private static int background(int[] px, int w, int x0, int y0, int sw, int sh) {
        int patch = Math.max(2, Math.round(Math.min(sw, sh) * 0.12f));
        int[] corners = new int[4 * patch * patch];
        int n = 0;
        for (int k = 0; k < 4; k++) {
            int cx = k % 2 == 0 ? 1 : sw - 1 - patch, cy = k < 2 ? 1 : sh - 1 - patch;
            for (int y = cy; y < cy + patch; y++) {
                for (int x = cx; x < cx + patch; x++) corners[n++] = px[(y0 + y) * w + x0 + x];
            }
        }
        Arrays.sort(corners, 0, n);
        int best = corners[0], bestRun = 0;
        for (int i = 0, j; i < n; i = j) {
            j = i;
            while (j < n && corners[j] == corners[i]) j++;
            if (j - i > bestRun) {
                bestRun = j - i;
                best = corners[i];
            }
        }
        return best;
    }

    /* ---------- начальная позиция и обучение ---------- */

    /** Если это начальная расстановка — выучить по ней фигуры (какая где стоит, известно заранее). */
    private static Pieces learn(Square[][] sq) {
        float top = 0, bottom = 0;
        for (int row = 0; row < 8; row++) {
            for (int col = 0; col < 8; col++) {
                Square s = sq[row][col];
                boolean shouldBe = row <= 1 || row >= 6;
                if (s.occupied != shouldBe) return null;
                if (row <= 1) top += s.score;
                if (row >= 6) bottom += s.score;
            }
        }
        // светлее в среднем — белые; если разницы почти нет, это не похоже на шахматы
        if (Math.abs(top - bottom) / 16 < 25) return null;
        boolean whiteBottom = bottom > top;
        for (int row = 0; row < 8; row++) {
            for (Square s : sq[row]) if (s.occupied) s.white = (row >= 6) == whiteBottom;
        }
        String back = whiteBottom ? BACK_RANK : new StringBuilder(BACK_RANK).reverse().toString();
        int[][] layout = new int[8][8];
        for (int col = 0; col < 8; col++) {
            int type = Board.pieceOf(back.charAt(col)) & 7;
            layout[0][col] = layout[7][col] = type;
            layout[1][col] = layout[6][col] = Board.PAWN;
        }
        float[][][] sum = new float[2][7][SHAPE];
        int[][] count = new int[2][7];
        for (int row : new int[]{0, 1, 6, 7}) {
            for (int col = 0; col < 8; col++) {
                Square s = sq[row][col];
                int c = s.white ? 0 : 1, t = layout[row][col];
                for (int i = 0; i < SHAPE; i++) sum[c][t][i] += s.shape[i];
                count[c][t]++;
            }
        }
        Pieces p = new Pieces();
        for (int c = 0; c < 2; c++) {
            for (int t = Board.PAWN; t <= Board.KING; t++) {
                for (int i = 0; i < SHAPE; i++) sum[c][t][i] /= Math.max(1, count[c][t]);
                p.shape[c][t] = sum[c][t];
            }
        }
        // насколько свои фигуры отличаются от своего образца
        double spread = 0;
        for (int row : new int[]{0, 1, 6, 7}) {
            for (int col = 0; col < 8; col++) {
                Square s = sq[row][col];
                spread += Math.sqrt(distance(s.shape, p.shape[s.white ? 0 : 1][layout[row][col]]));
            }
        }
        p.spread = (float) (spread / 32);
        return p;
    }

    /** ближайший образец среди всех двенадцати: и тип, и цвет; 0 — ни на что не похоже (стрелка, точка хода) */
    private static int classify(Square s, Pieces known) {
        int best = 0;
        double bestD = Double.MAX_VALUE, limit = Math.max(6.0, 3 * known.spread);
        for (int c = 0; c < 2; c++) {
            for (int t = Board.PAWN; t <= Board.KING; t++) {
                double d = distance(s.shape, known.shape[c][t]);
                if (d < bestD) {
                    bestD = d;
                    best = t | (c == 0 ? Board.WHITE : Board.BLACK);
                }
            }
        }
        return Math.sqrt(bestD) > limit ? 0 : best;
    }

    private static double distance(float[] a, float[] b) {
        double d = 0;
        for (int i = 0; i < a.length; i++) {
            double e = a[i] - b[i];
            d += e * e;
        }
        return d;
    }

    /** подсвечены две клетки — последний ход: фигура на одной из них ходила, значит, ход у соперника */
    private static String turnFromHighlight(Square[][] sq) {
        int marked = 0;
        Square to = null;
        for (Square[] row : sq) {
            for (Square s : row) {
                if (!s.marked) continue;
                marked++;
                if (s.occupied) to = s;
            }
        }
        if (marked != 2 || to == null) return "unknown";
        return to.white ? "black" : "white";
    }

    /* ---------- цвета ---------- */

    static int rgb(int r, int g, int b) {
        return 0xFF000000 | r << 16 | g << 8 | b;
    }

    static boolean near(int p, int q, int tol) {
        return Math.abs(((p >> 16) & 0xFF) - ((q >> 16) & 0xFF)) <= tol
                && Math.abs(((p >> 8) & 0xFF) - ((q >> 8) & 0xFF)) <= tol
                && Math.abs((p & 0xFF) - (q & 0xFF)) <= tol;
    }

    private static int lum(int p) {
        return (((p >> 16) & 0xFF) * 299 + ((p >> 8) & 0xFF) * 587 + (p & 0xFF) * 114) / 1000;
    }
}
