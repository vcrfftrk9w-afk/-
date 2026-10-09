package app.umnik;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Мелочи для экранов, собранных кодом: размеры в dp, скруглённые фоны, кнопки и «чипсы». */
final class Ui {
    private Ui() {
    }

    static int dp(Context c, float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics()));
    }

    static int color(Context c, int res) {
        return c.getColor(res);
    }

    static GradientDrawable round(Context c, int color, float radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(dp(c, radiusDp));
        return d;
    }

    static GradientDrawable outlined(Context c, int fill, int stroke, float radiusDp) {
        GradientDrawable d = round(c, fill, radiusDp);
        d.setStroke(dp(c, 1), stroke);
        return d;
    }

    /** фон с откликом на нажатие */
    static RippleDrawable pressable(Context c, GradientDrawable base) {
        return new RippleDrawable(ColorStateList.valueOf(0x33000000), base, null);
    }

    static TextView text(Context c, CharSequence s, float sp, int colorRes) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color(c, colorRes));
        t.setLineSpacing(0, 1.12f);
        return t;
    }

    static TextView title(Context c, CharSequence s, float sp) {
        TextView t = text(c, s, sp, R.color.text);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    /** заметная кнопка (основное действие) */
    static TextView button(Context c, CharSequence s, View.OnClickListener click) {
        TextView b = text(c, s, 15, R.color.on_accent);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(c, 16), dp(c, 10), dp(c, 16), dp(c, 10));
        b.setBackground(pressable(c, round(c, color(c, R.color.accent), 12)));
        b.setOnClickListener(click);
        return b;
    }

    /** тихая кнопка-«чипса» */
    static TextView chip(Context c, CharSequence s, View.OnClickListener click) {
        TextView b = text(c, s, 14, R.color.text);
        b.setGravity(Gravity.CENTER);
        b.setSingleLine(true);
        b.setPadding(dp(c, 12), dp(c, 8), dp(c, 12), dp(c, 8));
        b.setBackground(pressable(c, outlined(c, color(c, R.color.chip), color(c, R.color.line), 18)));
        b.setOnClickListener(click);
        return b;
    }

    static LinearLayout column(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.VERTICAL);
        return l;
    }

    static LinearLayout row(Context c) {
        LinearLayout l = new LinearLayout(c);
        l.setOrientation(LinearLayout.HORIZONTAL);
        l.setGravity(Gravity.CENTER_VERTICAL);
        return l;
    }

    /** кнопки в ряд с переносом на новую строку, если не влезают */
    static Flow flow(Context c) {
        return new Flow(c, dp(c, 8));
    }

    static final class Flow extends ViewGroup {
        private final int gap;

        Flow(Context c, int gap) {
            super(c);
            this.gap = gap;
        }

        @Override
        protected void onMeasure(int widthSpec, int heightSpec) {
            boolean bounded = MeasureSpec.getMode(widthSpec) != MeasureSpec.UNSPECIFIED;
            int max = MeasureSpec.getSize(widthSpec) - getPaddingLeft() - getPaddingRight();
            int x = 0, y = 0, rowHeight = 0, widest = 0;
            for (int i = 0; i < getChildCount(); i++) {
                View v = getChildAt(i);
                if (v.getVisibility() == GONE) continue;
                v.measure(MeasureSpec.makeMeasureSpec(max, bounded ? MeasureSpec.AT_MOST : MeasureSpec.UNSPECIFIED),
                        MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED));
                if (bounded && x > 0 && x + v.getMeasuredWidth() > max) {
                    x = 0;
                    y += rowHeight + gap;
                    rowHeight = 0;
                }
                x += v.getMeasuredWidth() + gap;
                rowHeight = Math.max(rowHeight, v.getMeasuredHeight());
                widest = Math.max(widest, x - gap);
            }
            setMeasuredDimension(resolveSize(widest + getPaddingLeft() + getPaddingRight(), widthSpec),
                    resolveSize(y + rowHeight + getPaddingTop() + getPaddingBottom(), heightSpec));
        }

        @Override
        protected void onLayout(boolean changed, int l, int t, int r, int b) {
            int max = r - l - getPaddingLeft() - getPaddingRight();
            int x = 0, y = 0, rowHeight = 0;
            for (int i = 0; i < getChildCount(); i++) {
                View v = getChildAt(i);
                if (v.getVisibility() == GONE) continue;
                int w = v.getMeasuredWidth(), h = v.getMeasuredHeight();
                if (x > 0 && x + w > max) {
                    x = 0;
                    y += rowHeight + gap;
                    rowHeight = 0;
                }
                v.layout(getPaddingLeft() + x, getPaddingTop() + y, getPaddingLeft() + x + w, getPaddingTop() + y + h);
                x += w + gap;
                rowHeight = Math.max(rowHeight, h);
            }
        }
    }

    static LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    static LinearLayout.LayoutParams fill() {
        return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    static LinearLayout.LayoutParams weight() {
        return new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    }

    static LinearLayout.LayoutParams margins(LinearLayout.LayoutParams p, Context c, int left, int top, int right, int bottom) {
        p.setMargins(dp(c, left), dp(c, top), dp(c, right), dp(c, bottom));
        return p;
    }

    /** убрать эмодзи и разметку — чтобы синтез речи не читал «улыбающееся лицо» */
    static String forSpeech(String s) {
        return s.replaceAll("[\\x{1F000}-\\x{1FAFF}\\x{2600}-\\x{27BF}\\x{2B00}-\\x{2BFF}\\x{FE0F}\\x{200D}]", "")
                .replaceAll("[*#_`•]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
