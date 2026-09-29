package app.lenivec;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Экран звонка поверх блокировки: большое время и две кнопки. */
public class AlarmActivity extends Activity {
    private String title;
    private String text;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        read(getIntent());
        build();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        read(intent);
        build();
    }

    private void read(Intent i) {
        title = i.getStringExtra(Alarms.EXTRA_TITLE);
        text = i.getStringExtra(Alarms.EXTRA_TEXT);
        if (title == null) title = "⏰ Будильник";
        if (text == null) text = "";
    }

    private float dp(float v) {
        return TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private TextView label(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, (int) dp(6), 0, (int) dp(6));
        return t;
    }

    private Button button(String s, int color) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        b.setTextColor(0xFFFFFFFF);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(color);
        bg.setCornerRadius(dp(18));
        b.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int) dp(72));
        lp.topMargin = (int) dp(14);
        b.setLayoutParams(lp);
        return b;
    }

    private void build() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        int pad = (int) dp(28);
        root.setPadding(pad, pad, pad, pad);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{0xFF2A1260, 0xFF0F0E17, 0xFF063A45});
        root.setBackground(bg);

        root.addView(label("🦥", 72, 0xFFFFFFFF, false));
        root.addView(label(new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date()), 64, 0xFFFFFFFF, true));
        root.addView(label(title, 24, 0xFFFFFFFF, true));
        if (!text.isEmpty()) root.addView(label(text, 17, 0xFFC9C6E0, false));

        Button up = button(Alarms.okLabel(title), 0xFF7C3AED);
        up.setOnClickListener(v -> {
            Alarms.stopRinging(this);
            startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            finish();
        });
        Button later = button("😴 Ещё " + Alarms.SNOOZE_MIN + " минут", 0xFF2E2B45);
        later.setOnClickListener(v -> {
            Alarms.stopRinging(this);
            Alarms.snooze(this, title, text, Alarms.SNOOZE_MIN);
            finish();
        });
        root.addView(up);
        root.addView(later);
        setContentView(root);
    }
}
