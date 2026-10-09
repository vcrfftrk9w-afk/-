package app.umnik;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.ContextThemeWrapper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import app.umnik.chess.BoardView;
import app.umnik.chess.Hint;

/**
 * Всё, что Умник рисует поверх других приложений: круглая кнопка (её можно таскать), кнопка ♟ в шахматах
 * и карточки с подсказками. Окна спецвозможностей — отдельного разрешения «поверх других окон» не нужно.
 */
final class Overlay {
    interface Actions {
        void onBubbleTap();

        void onChessTap();

        void onBubbleLongPress();

        void onAskAbout(String text);

        void onFlip();

        void onRotate();

        void onExplain();
    }

    private static final long CARD_TIMEOUT = 25_000L;

    private final Context ctx;
    private final WindowManager wm;
    private final Actions actions;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoHide = this::hideCard;

    private View bubble;
    private WindowManager.LayoutParams bubbleLp;
    private View chess;
    private WindowManager.LayoutParams chessLp;
    private View card;
    private WindowManager.LayoutParams cardLp;
    private boolean bubbleShown, chessWanted, chessShown, capturing;

    Overlay(Context service, Actions actions) {
        this.ctx = new ContextThemeWrapper(service, R.style.Umnik);
        this.wm = (WindowManager) service.getSystemService(Context.WINDOW_SERVICE);
        this.actions = actions;
    }

    private WindowManager.LayoutParams params(int w, int h) {
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(w, h,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        return lp;
    }

    private Point screen() {
        Point p = new Point();
        try {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Rect r = wm.getCurrentWindowMetrics().getBounds();
                p.set(r.width(), r.height());
            } else {
                wm.getDefaultDisplay().getRealSize(p);
            }
        } catch (RuntimeException e) {
            p.set(ctx.getResources().getDisplayMetrics().widthPixels, ctx.getResources().getDisplayMetrics().heightPixels);
        }
        return p;
    }

    /* ---------- круглая кнопка ---------- */

    void showBubble() {
        if (bubbleShown) return;
        if (bubble == null) createBubble();
        bubble.setScaleX(1f);
        bubble.setScaleY(1f);
        try {
            wm.addView(bubble, bubbleLp);
            bubbleShown = true;
        } catch (RuntimeException e) {
            bubbleShown = false;
        }
        updateChess();
    }

    void hideBubble() {
        if (bubbleShown) {
            try {
                wm.removeView(bubble);
            } catch (RuntimeException ignored) {
            }
            bubbleShown = false;
        }
        updateChess();
    }

    boolean bubbleVisible() {
        return bubbleShown;
    }

    private void createBubble() {
        bubble = bubbleView();
        int size = Ui.dp(ctx, 56);
        Point s = screen();
        bubbleLp = params(size, size);
        boolean left = Prefs.of(ctx).getBoolean("bubble_left", false);
        bubbleLp.x = left ? Ui.dp(ctx, 4) : s.x - size - Ui.dp(ctx, 4);
        bubbleLp.y = Prefs.of(ctx).getInt("bubble_y", s.y / 3);
        bubble.setOnTouchListener(new Drag());
    }

    View bubbleView() {
        int size = Ui.dp(ctx, 56);
        FrameLayout f = new FrameLayout(ctx);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{Ui.color(ctx, R.color.bubble_top), Ui.color(ctx, R.color.bubble_bottom)});
        bg.setShape(GradientDrawable.OVAL);
        f.setBackground(bg);
        f.setElevation(Ui.dp(ctx, 6));
        ImageView icon = new ImageView(ctx);
        icon.setImageResource(R.drawable.ic_bubble);
        int pad = Ui.dp(ctx, 12);
        icon.setPadding(pad, pad, pad, pad);
        f.addView(icon, new FrameLayout.LayoutParams(size, size));
        f.setContentDescription("Умник: спросить про экран");
        return f;
    }

    /** таскать пальцем, короткое нажатие — открыть помощника, долгое — спрятать */
    private final class Drag implements View.OnTouchListener {
        private float downX, downY;
        private int startX, startY;
        private boolean dragging, longPressed;
        private final int slop = ViewConfiguration.get(ctx).getScaledTouchSlop();
        private final Runnable longPress = () -> {
            longPressed = true;
            actions.onBubbleLongPress();
        };

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downX = e.getRawX();
                    downY = e.getRawY();
                    startX = bubbleLp.x;
                    startY = bubbleLp.y;
                    dragging = false;
                    longPressed = false;
                    handler.postDelayed(longPress, 700);
                    v.animate().scaleX(0.9f).scaleY(0.9f).setDuration(80).start();
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = e.getRawX() - downX, dy = e.getRawY() - downY;
                    if (!dragging && Math.hypot(dx, dy) > slop) {
                        dragging = true;
                        handler.removeCallbacks(longPress);
                    }
                    if (dragging) {
                        Point s = screen();
                        bubbleLp.x = clamp(startX + (int) dx, 0, s.x - v.getWidth());
                        bubbleLp.y = clamp(startY + (int) dy, Ui.dp(ctx, 24), s.y - v.getHeight() - Ui.dp(ctx, 24));
                        update(bubble, bubbleLp);
                        updateChess();
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    handler.removeCallbacks(longPress);
                    v.animate().scaleX(1f).scaleY(1f).setDuration(80).start();
                    if (dragging) snapToEdge();
                    else if (!longPressed && e.getActionMasked() == MotionEvent.ACTION_UP) {
                        v.performClick();
                        actions.onBubbleTap();
                    }
                    return true;
                default:
                    return false;
            }
        }
    }

    /** экран повернулся — кнопку к краю, чтобы не уехала за него */
    void reposition() {
        if (!bubbleShown || bubble == null) return;
        Point s = screen();
        int size = Ui.dp(ctx, 56);
        boolean left = Prefs.of(ctx).getBoolean("bubble_left", false);
        bubbleLp.x = left ? Ui.dp(ctx, 4) : s.x - size - Ui.dp(ctx, 4);
        bubbleLp.y = clamp(bubbleLp.y, Ui.dp(ctx, 24), s.y - size - Ui.dp(ctx, 24));
        update(bubble, bubbleLp);
        updateChess();
        hideCard();
    }

    boolean capturing() {
        return capturing;
    }

    private void snapToEdge() {
        Point s = screen();
        int size = bubble.getWidth();
        boolean left = bubbleLp.x + size / 2 < s.x / 2;
        int target = left ? Ui.dp(ctx, 4) : s.x - size - Ui.dp(ctx, 4);
        ValueAnimator a = ValueAnimator.ofInt(bubbleLp.x, target);
        a.setDuration(180);
        a.addUpdateListener(an -> {
            bubbleLp.x = (int) an.getAnimatedValue();
            update(bubble, bubbleLp);
            updateChess();
        });
        a.start();
        Prefs.put(ctx, "bubble_left", left);
        Prefs.put(ctx, "bubble_y", bubbleLp.y);
    }

    /* ---------- кнопка ♟ ---------- */

    void setChessWanted(boolean wanted) {
        chessWanted = wanted;
        updateChess();
    }

    private void updateChess() {
        boolean show = chessWanted && bubbleShown && !capturing;
        if (show && chess == null) createChess();
        if (show) {
            Point s = screen();
            int size = Ui.dp(ctx, 44), big = Ui.dp(ctx, 56);
            chessLp.x = bubbleLp.x + (big - size) / 2;
            boolean below = bubbleLp.y + big + size + Ui.dp(ctx, 40) < s.y;
            chessLp.y = below ? bubbleLp.y + big + Ui.dp(ctx, 8) : bubbleLp.y - size - Ui.dp(ctx, 8);
            if (!chessShown) {
                try {
                    wm.addView(chess, chessLp);
                    chessShown = true;
                } catch (RuntimeException ignored) {
                }
            } else {
                update(chess, chessLp);
            }
        } else if (chessShown) {
            try {
                wm.removeView(chess);
            } catch (RuntimeException ignored) {
            }
            chessShown = false;
        }
    }

    private void createChess() {
        int size = Ui.dp(ctx, 44);
        TextView t = new TextView(ctx);
        t.setText("♟︎");
        t.setTextSize(22);
        t.setGravity(Gravity.CENTER);
        t.setTextColor(Ui.color(ctx, R.color.accent));
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Ui.color(ctx, R.color.card));
        bg.setStroke(Ui.dp(ctx, 2), Ui.color(ctx, R.color.accent));
        t.setBackground(bg);
        t.setElevation(Ui.dp(ctx, 5));
        t.setContentDescription("Подсказать шахматный ход");
        t.setOnClickListener(v -> actions.onChessTap());
        chess = t;
        chessLp = params(size, size);
    }

    /* ---------- спрятать всё на время снимка экрана ---------- */

    void hideForCapture() {
        capturing = true;
        if (bubble != null) bubble.setAlpha(0f);
        if (card != null) card.setAlpha(0f);
        updateChess();
    }

    void restoreAfterCapture() {
        capturing = false;
        if (bubble != null) bubble.setAlpha(1f);
        if (card != null) card.setAlpha(1f);
        updateChess();
    }

    /* ---------- карточки ---------- */

    /** Сообщение: напоминание, подсказка, ошибка. ask — кнопка «Спросить подробнее». */
    void showMessage(String title, String text, boolean ask) {
        showCard(messageCard(title, text, ask), true);
    }

    LinearLayout messageCard(String title, String text, boolean ask) {
        LinearLayout c = cardBase(title, false);
        c.addView(Ui.text(ctx, text, 15, R.color.text), Ui.margins(Ui.fill(), ctx, 0, 6, 0, 0));
        ViewGroup buttons = Ui.flow(ctx);
        if (ask) {
            buttons.addView(Ui.chip(ctx, "💬 Подробнее", v -> {
                hideCard();
                actions.onAskAbout(text);
            }));
        }
        buttons.addView(Ui.chip(ctx, "👍 Понятно", v -> hideCard()));
        c.addView(buttons, Ui.margins(Ui.fill(), ctx, 0, 10, 0, 0));
        return c;
    }

    void showProgress(String text) {
        showCard(progressCard(text), false);
    }

    LinearLayout progressCard(String text) {
        return cardBase(text, true);
    }

    void showChess(Hint h, String note) {
        showCard(chessCard(h, note), false);
    }

    /** note — строчка сверху, например «запомнил фигуры» */
    LinearLayout chessCard(Hint h, String note) {
        LinearLayout c = cardBase("♟ Подсказка хода", false);
        if (note != null) c.addView(Ui.text(ctx, note, 13, R.color.text_secondary), Ui.margins(Ui.fill(), ctx, 0, 4, 0, 0));
        TextView head = Ui.text(ctx, h.headline, 16, R.color.text);
        head.setTypeface(Typeface.DEFAULT_BOLD);
        c.addView(head, Ui.margins(Ui.fill(), ctx, 0, 6, 0, 0));
        if (!h.details.isEmpty()) c.addView(Ui.text(ctx, h.details, 14, R.color.text_secondary), Ui.margins(Ui.fill(), ctx, 0, 4, 0, 0));
        BoardView board = new BoardView(ctx);
        board.show(h.board, h.whiteBottom, h.result.move);
        int size = Ui.dp(ctx, 176);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(size, size);
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        lp.topMargin = Ui.dp(ctx, 10);
        c.addView(board, lp);
        ViewGroup buttons = Ui.flow(ctx);
        if (h.result.move != 0) buttons.addView(Ui.chip(ctx, "🤔 Почему?", v -> actions.onExplain()));
        buttons.addView(Ui.chip(ctx, h.whiteToMove() ? "⇄ Ход чёрных" : "⇄ Ход белых", v -> actions.onFlip()));
        buttons.addView(Ui.chip(ctx, "🔃 Доска наоборот", v -> actions.onRotate()));
        c.addView(buttons, Ui.margins(Ui.fill(), ctx, 0, 10, 0, 0));
        return c;
    }

    boolean cardVisible() {
        return card != null;
    }

    void hideCard() {
        handler.removeCallbacks(autoHide);
        if (card != null) {
            try {
                wm.removeView(card);
            } catch (RuntimeException ignored) {
            }
            card = null;
        }
    }

    /** карточка с заголовком и крестиком; spinner — крутилка «думаю» перед заголовком */
    private LinearLayout cardBase(String title, boolean spinner) {
        LinearLayout c = Ui.column(ctx);
        int pad = Ui.dp(ctx, 14);
        c.setPadding(pad, Ui.dp(ctx, 10), pad, spinner ? Ui.dp(ctx, 10) : pad);
        // рамка — чтобы белая карточка не терялась на белом приложении
        c.setBackground(Ui.outlined(ctx, Ui.color(ctx, R.color.card), Ui.color(ctx, R.color.line), 18));
        c.setElevation(Ui.dp(ctx, 8));
        LinearLayout header = Ui.row(ctx);
        if (spinner) {
            header.addView(new ProgressBar(ctx), Ui.margins(new LinearLayout.LayoutParams(Ui.dp(ctx, 24), Ui.dp(ctx, 24)), ctx, 0, 0, 10, 0));
        }
        header.addView(Ui.title(ctx, title, 15), Ui.weight());
        TextView close = Ui.text(ctx, "✕", 18, R.color.text_secondary);
        close.setPadding(Ui.dp(ctx, 10), Ui.dp(ctx, 2), Ui.dp(ctx, 2), Ui.dp(ctx, 2));
        close.setContentDescription("Закрыть");
        close.setOnClickListener(v -> hideCard());
        header.addView(close);
        c.addView(header);
        c.setOnTouchListener((v, e) -> {
            handler.removeCallbacks(autoHide); // человек читает — не прячем
            return false;
        });
        return c;
    }

    private void showCard(LinearLayout c, boolean autoClose) {
        hideCard();
        Point s = screen();
        int margin = Ui.dp(ctx, 10);
        int width = Math.min(s.x - 2 * margin, Ui.dp(ctx, 420));
        c.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(s.y, View.MeasureSpec.AT_MOST));
        int h = c.getMeasuredHeight();
        cardLp = params(width, WindowManager.LayoutParams.WRAP_CONTENT);
        cardLp.x = (s.x - width) / 2;
        int big = Ui.dp(ctx, 56);
        int anchor = bubbleLp != null ? bubbleLp.y : s.y / 3;
        if (anchor + big / 2 > s.y / 2) cardLp.y = Math.max(Ui.dp(ctx, 30), anchor - h - margin);
        else cardLp.y = Math.min(s.y - h - Ui.dp(ctx, 30), anchor + big + margin);
        card = c;
        if (capturing) c.setAlpha(0f);
        try {
            wm.addView(c, cardLp);
        } catch (RuntimeException e) {
            card = null;
            return;
        }
        if (autoClose) handler.postDelayed(autoHide, CARD_TIMEOUT);
    }

    void removeAll() {
        hideCard();
        hideBubble();
        chessWanted = false;
        updateChess();
    }

    private void update(View v, WindowManager.LayoutParams lp) {
        try {
            wm.updateViewLayout(v, lp);
        } catch (RuntimeException ignored) {
            // окно уже убрано
        }
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}
