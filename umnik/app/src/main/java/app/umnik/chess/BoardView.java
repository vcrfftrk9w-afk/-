package app.umnik.chess;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.view.View;

/** Мини-доска: распознанная позиция, подсвеченный лучший ход и стрелка. Низ доски — как на экране у игрока. */
public final class BoardView extends View {
    private static final String SOLID = " ♟♞♝♜♛♚";
    private static final int LIGHT = 0xFFEEEED2, DARK = 0xFF769656, MARK = 0xAAF6F669, ARROW = 0xCCFF7A00;

    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint piece = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint coord = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path arrow = new Path();
    private Board board;
    private boolean whiteBottom = true;
    private int from = -1, to = -1;

    public BoardView(Context c) {
        super(c);
        piece.setTextAlign(Paint.Align.CENTER);
        piece.setTypeface(Typeface.DEFAULT);
        coord.setTypeface(Typeface.DEFAULT_BOLD);
    }

    public void show(Board b, boolean whiteBottom, int move) {
        this.board = b;
        this.whiteBottom = whiteBottom;
        this.from = move == 0 ? -1 : Board.from(move);
        this.to = move == 0 ? -1 : Board.to(move);
        setContentDescription(b.fen());
        invalidate();
    }

    @Override
    protected void onMeasure(int w, int h) {
        int size = MeasureSpec.getSize(w);
        if (MeasureSpec.getMode(h) != MeasureSpec.UNSPECIFIED) size = Math.min(size, MeasureSpec.getSize(h));
        setMeasuredDimension(size, size);
    }

    /** где на экране поле: колонка и строка 0..7 с учётом того, кто снизу */
    private int col(int s) {
        return whiteBottom ? (s & 7) : 7 - (s & 7);
    }

    private int row(int s) {
        return whiteBottom ? 7 - (s >> 4) : (s >> 4);
    }

    @Override
    protected void onDraw(Canvas c) {
        if (board == null) return;
        float cell = getWidth() / 8f;
        for (int s = 0; s < 128; s++) {
            if ((s & 0x88) != 0) { s += 7; continue; }
            float x = col(s) * cell, y = row(s) * cell;
            boolean light = ((s & 7) + (s >> 4)) % 2 == 1;
            fill.setColor(light ? LIGHT : DARK);
            c.drawRect(x, y, x + cell, y + cell, fill);
            if (s == from || s == to) {
                fill.setColor(MARK);
                c.drawRect(x, y, x + cell, y + cell, fill);
            }
        }
        // подписи a–h и 1–8 мелко по краю
        coord.setTextSize(cell * 0.22f);
        for (int i = 0; i < 8; i++) {
            int file = whiteBottom ? i : 7 - i, rank = whiteBottom ? 7 - i : i;
            coord.setColor(i % 2 == 0 ? DARK : LIGHT);
            c.drawText(String.valueOf((char) ('a' + file)), i * cell + cell * 0.78f, 8 * cell - cell * 0.06f, coord);
            coord.setColor(i % 2 == 0 ? LIGHT : DARK);
            c.drawText(String.valueOf((char) ('1' + rank)), cell * 0.05f, i * cell + cell * 0.25f, coord);
        }
        piece.setTextSize(cell * 0.82f);
        Paint.FontMetrics fm = piece.getFontMetrics();
        float shift = -(fm.ascent + fm.descent) / 2;
        for (int s = 0; s < 128; s++) {
            if ((s & 0x88) != 0) { s += 7; continue; }
            int p = board.sq[s];
            if (p == 0) continue;
            String glyph = SOLID.charAt(p & 7) + "︎";
            float x = col(s) * cell + cell / 2, y = row(s) * cell + cell / 2 + shift;
            boolean white = (p & Board.BLACK) == 0;
            piece.setStyle(Paint.Style.FILL);
            piece.setColor(white ? 0xFFFFFFFF : 0xFF202020);
            c.drawText(glyph, x, y, piece);
            piece.setStyle(Paint.Style.STROKE);
            piece.setStrokeWidth(cell * (white ? 0.035f : 0.02f));
            piece.setColor(white ? 0xFF202020 : 0xFF000000);
            c.drawText(glyph, x, y, piece);
        }
        if (from >= 0) drawArrow(c, cell);
    }

    private void drawArrow(Canvas c, float cell) {
        float x1 = col(from) * cell + cell / 2, y1 = row(from) * cell + cell / 2;
        float x2 = col(to) * cell + cell / 2, y2 = row(to) * cell + cell / 2;
        float dx = x2 - x1, dy = y2 - y1, len = (float) Math.hypot(dx, dy);
        if (len < 1) return;
        float ux = dx / len, uy = dy / len, head = cell * 0.42f, shaft = cell * 0.11f;
        float bx = x2 - ux * head, by = y2 - uy * head;
        arrow.reset();
        arrow.moveTo(x1 - uy * shaft, y1 + ux * shaft);
        arrow.lineTo(bx - uy * shaft, by + ux * shaft);
        arrow.lineTo(bx - uy * head * 0.6f, by + ux * head * 0.6f);
        arrow.lineTo(x2, y2);
        arrow.lineTo(bx + uy * head * 0.6f, by - ux * head * 0.6f);
        arrow.lineTo(bx + uy * shaft, by - ux * shaft);
        arrow.lineTo(x1 + uy * shaft, y1 - ux * shaft);
        arrow.close();
        fill.setColor(ARROW);
        c.drawPath(arrow, fill);
    }
}
