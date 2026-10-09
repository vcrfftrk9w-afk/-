package app.umnik;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

import com.anthropic.models.beta.messages.BetaOutputConfig;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Главный экран: подключить ключ и доступ к экрану, настройки, статистика за сегодня. */
public final class MainActivity extends Activity {
    private static final ExecutorService BACKGROUND = Executors.newSingleThreadExecutor();
    private LinearLayout content;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Ui.color(this, R.color.bg));
        scroll.setFillViewport(true);
        content = Ui.column(this);
        int pad = Ui.dp(this, 16);
        content.setPadding(pad, pad, pad, pad);
        scroll.addView(content);
        if (Build.VERSION.SDK_INT >= 30) {
            scroll.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        render();
    }

    private void render() {
        content.removeAllViews();
        header();
        setup();
        howTo();
        settings();
        stats();
        notes();
    }

    /* ---------- заголовок ---------- */

    private void header() {
        LinearLayout row = Ui.row(this);
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.mipmap.ic_launcher);
        row.addView(icon, new LinearLayout.LayoutParams(Ui.dp(this, 56), Ui.dp(this, 56)));
        LinearLayout titles = Ui.column(this);
        titles.addView(Ui.title(this, "Умник", 26));
        titles.addView(Ui.text(this, "ИИ-помощник, который видит твой экран", 14, R.color.text_secondary));
        row.addView(titles, Ui.margins(Ui.weight(), this, 12, 0, 0, 0));
        content.addView(row, Ui.margins(Ui.fill(), this, 0, 8, 0, 14));
    }

    /* ---------- три шага подключения ---------- */

    private void setup() {
        LinearLayout c = card("Подключение");
        boolean key = Prefs.hasKey(this), access = accessOn(), notify = notifyOn();

        c.addView(step(key, "1. Ключ Claude API", key
                ? "Ключ сохранён (…" + tail(Prefs.apiKey(this)) + "). Можно проверить или вставить новый."
                : "Умник думает с помощью Claude. Возьми ключ на console.anthropic.com → API Keys → Create Key "
                + "(на счёте нужны деньги — нескольких долларов хватит надолго) и вставь сюда."));
        EditText field = new EditText(this);
        field.setHint(key ? "новый ключ sk-ant-…" : "sk-ant-…");
        field.setSingleLine(true);
        field.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD);
        field.setTextColor(Ui.color(this, R.color.text));
        field.setHintTextColor(Ui.color(this, R.color.text_secondary));
        c.addView(field, Ui.margins(Ui.fill(), this, 0, 4, 0, 0));
        ViewGroup buttons = Ui.flow(this);
        buttons.addView(Ui.button(this, "Сохранить", v -> {
            String k = field.getText().toString().trim();
            if (k.isEmpty()) {
                Toast.makeText(this, "Сначала вставь ключ", Toast.LENGTH_SHORT).show();
                return;
            }
            Prefs.put(this, "api_key", k);
            Toast.makeText(this, "Ключ сохранён", Toast.LENGTH_SHORT).show();
            render();
            checkKey();
        }));
        if (key) buttons.addView(Ui.chip(this, "Проверить", v -> checkKey()));
        buttons.addView(Ui.chip(this, "Где взять ключ?", v -> open("https://console.anthropic.com/settings/keys")));
        c.addView(buttons, Ui.margins(Ui.fill(), this, 0, 6, 0, 14));

        c.addView(step(access, "2. Доступ к экрану", access
                ? "Включено: кнопка Умника видна поверх приложений."
                : "В «Спецвозможностях» найди «Умник» и включи. Так Умник видит, какое приложение открыто, делает снимок "
                + "экрана, когда ты нажимаешь его кнопку, и считает время в телефоне. Сам он ничего не нажимает и снимки не хранит."));
        if (!access) {
            c.addView(Ui.button(this, "Включить в спецвозможностях", v -> openAccessibility()), Ui.margins(Ui.wrap(), this, 0, 6, 0, 6));
            if (Build.VERSION.SDK_INT >= 33) {
                c.addView(Ui.text(this, "Переключатель серый или пишет «Настройка заблокирована»? Это защита Android для "
                        + "приложений не из Google Play: открой «О приложении» → ⋮ вверху справа → «Разрешить настройки "
                        + "с ограниченным доступом», потом вернись и включи.", 13, R.color.text_secondary), Ui.margins(Ui.fill(), this, 0, 4, 0, 0));
                c.addView(Ui.chip(this, "О приложении", v -> startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getPackageName())))), Ui.margins(Ui.wrap(), this, 0, 6, 0, 0));
            }
        }
        if (Build.VERSION.SDK_INT >= 33) {
            c.addView(step(notify, "3. Уведомления", notify
                    ? "Разрешены: напоминания о перерыве придут, даже если кнопка спрятана."
                    : "Нужны, чтобы напоминать о перерыве, когда кнопка Умника спрятана."), Ui.margins(Ui.fill(), this, 0, 14, 0, 0));
            if (!notify) {
                c.addView(Ui.button(this, "Разрешить уведомления", v -> requestPermissions(
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1)), Ui.margins(Ui.wrap(), this, 0, 6, 0, 0));
            }
        }
        if (Build.VERSION.SDK_INT < 30) {
            c.addView(Ui.text(this, "На этом телефоне Android ниже 11-й версии: снимки экрана Умнику недоступны, он видит "
                    + "только текст с экрана. Шахматные подсказки работают с Android 11.", 13, R.color.danger), Ui.margins(Ui.fill(), this, 0, 12, 0, 0));
        }
        content.addView(c, Ui.margins(Ui.fill(), this, 0, 0, 0, 12));
    }

    private LinearLayout step(boolean done, String title, String text) {
        LinearLayout s = Ui.column(this);
        LinearLayout row = Ui.row(this);
        row.addView(Ui.text(this, done ? "✅" : "⚪", 16, R.color.text));
        TextView t = Ui.title(this, title, 16);
        row.addView(t, Ui.margins(Ui.weight(), this, 8, 0, 0, 0));
        s.addView(row);
        s.addView(Ui.text(this, text, 14, R.color.text_secondary), Ui.margins(Ui.fill(), this, 0, 4, 0, 0));
        return s;
    }

    private void checkKey() {
        Toast.makeText(this, "Проверяю ключ…", Toast.LENGTH_SHORT).show();
        BACKGROUND.execute(() -> {
            String result;
            try {
                Session.brain(this).once(Prefs.model(this), "Отвечай одним словом.", "Скажи «работает».", null,
                        BetaOutputConfig.Effort.LOW, 1000);
                result = "✅ Ключ работает, Умник готов";
            } catch (Brain.Failure e) {
                result = "⚠️ " + e.getMessage();
            }
            String r = result;
            runOnUiThread(() -> new AlertDialog.Builder(this).setMessage(r).setPositiveButton("Ок", null).show());
        });
    }

    /* ---------- как пользоваться ---------- */

    private void howTo() {
        LinearLayout c = card("Как пользоваться");
        String text = "• Нажми круглую кнопку Умника поверх любого приложения — он сделает снимок экрана и откроет окно: "
                + "быстрые кнопки под то, что открыто, или свой вопрос текстом и голосом 🎤.\n"
                + "• В шахматах рядом появится кнопка ♟ — нажми в свой ход, и Умник покажет лучший ход стрелкой на мини-доске. "
                + "Доску читает ИИ, а ход считает встроенный шахматный движок.\n"
                + "• Кнопку можно перетащить пальцем. Долгое нажатие — спрятать на 30 минут.\n"
                + "• Если долго сидишь в телефоне, Умник напомнит сделать перерыв.";
        c.addView(Ui.text(this, text, 14.5f, R.color.text));
        ViewGroup row = Ui.flow(this);
        row.addView(Ui.button(this, "💬 Спросить без снимка", v -> {
            Session.start(null, new Brain.Chat(Prefs.model(this), Prefs.about(this)));
            startActivity(new Intent(this, AssistantActivity.class));
        }));
        if (Prefs.hiddenUntil(this) > System.currentTimeMillis()) {
            row.addView(Ui.chip(this, "Вернуть кнопку", v -> {
                Prefs.put(this, "hidden_until", 0L);
                render();
            }));
        }
        c.addView(row, Ui.margins(Ui.fill(), this, 0, 12, 0, 0));
        content.addView(c, Ui.margins(Ui.fill(), this, 0, 0, 0, 12));
    }

    /* ---------- настройки ---------- */

    private void settings() {
        LinearLayout c = card("Настройки");
        c.addView(choice("Модель", Prefs.modelName(this), Prefs.MODEL_NAMES, indexOf(Prefs.MODELS, Prefs.model(this)),
                i -> Prefs.put(this, "model", Prefs.MODELS[i])));
        c.addView(toggle("Кнопка поверх приложений", "bubble", Prefs.bubble(this)));
        c.addView(choice("Напоминать о перерыве", minutes(Prefs.breakMinutes(this), "через %d мин без перерыва"),
                labels(Prefs.BREAK_CHOICES, "через %d мин"), indexOf(Prefs.BREAK_CHOICES, Prefs.breakMinutes(this)),
                i -> Prefs.put(this, "break_minutes", Prefs.BREAK_CHOICES[i])));
        c.addView(toggle("Напоминания пишет ИИ (с учётом времени и приложения)", "smart_breaks", Prefs.smartBreaks(this)));
        c.addView(toggle("Ночью напоминать, что пора спать", "night", Prefs.nightReminder(this)));
        c.addView(choice("Сам подсказывать по экрану", minutes(Prefs.watchMinutes(this), "смотрит раз в %d мин"),
                labels(Prefs.WATCH_CHOICES, "раз в %d мин"), indexOf(Prefs.WATCH_CHOICES, Prefs.watchMinutes(this)),
                i -> Prefs.put(this, "watch_minutes", Prefs.WATCH_CHOICES[i])));
        c.addView(Ui.text(this, "Умник сам посмотрит на экран и скажет, только если заметит что-то важное: ошибку в тексте, "
                + "похожее на развод сообщение, подсказку в задаче. Каждый взгляд — это запрос к Claude, он стоит денег "
                + "(на Opus примерно 1–2 цента, на Haiku — в десятки раз дешевле). В банках и при вводе пароля не смотрит.",
                12.5f, R.color.text_secondary), Ui.margins(Ui.fill(), this, 0, 0, 0, 8));
        c.addView(toggle("Читать ответы вслух", "speak", Prefs.speak(this)));

        c.addView(Ui.title(this, "О себе", 15), Ui.margins(Ui.fill(), this, 0, 12, 0, 0));
        c.addView(Ui.text(this, "Чтобы ответы были под тебя: имя, возраст или класс, что любишь, что сейчас учишь.",
                13, R.color.text_secondary));
        EditText about = new EditText(this);
        about.setText(Prefs.about(this));
        about.setHint("Например: Меня зовут Саша, я в 9 классе, люблю шахматы и футбол");
        about.setMinLines(2);
        about.setTextColor(Ui.color(this, R.color.text));
        about.setHintTextColor(Ui.color(this, R.color.text_secondary));
        c.addView(about, Ui.fill());
        c.addView(Ui.chip(this, "Сохранить", v -> {
            Prefs.put(this, "about", about.getText().toString().trim());
            Toast.makeText(this, "Запомнил", Toast.LENGTH_SHORT).show();
        }), Ui.margins(Ui.wrap(), this, 0, 4, 0, 0));
        content.addView(c, Ui.margins(Ui.fill(), this, 0, 0, 0, 12));
    }

    interface Picked {
        void on(int index);
    }

    private View choice(String title, String value, String[] options, int selected, Picked picked) {
        LinearLayout row = Ui.column(this);
        row.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 8));
        row.addView(Ui.text(this, title, 15, R.color.text));
        TextView v = Ui.text(this, value + "  ▾", 14, R.color.accent);
        row.addView(v);
        row.setBackground(Ui.pressable(this, Ui.round(this, 0, 8)));
        row.setOnClickListener(x -> new AlertDialog.Builder(this)
                .setTitle(title)
                .setSingleChoiceItems(options, selected, (d, i) -> {
                    picked.on(i);
                    d.dismiss();
                    render();
                })
                .setNegativeButton("Отмена", null)
                .show());
        return row;
    }

    private View toggle(String title, String key, boolean on) {
        Switch s = new Switch(this);
        s.setText(title);
        s.setTextSize(15);
        s.setTextColor(Ui.color(this, R.color.text));
        s.setChecked(on);
        s.setPadding(0, Ui.dp(this, 8), 0, Ui.dp(this, 8));
        s.setOnCheckedChangeListener((b, checked) -> Prefs.put(this, key, checked));
        return s;
    }

    private static String minutes(int m, String format) {
        return m <= 0 ? "выключено" : String.format(format, m);
    }

    private static String[] labels(int[] values, String format) {
        String[] out = new String[values.length];
        for (int i = 0; i < values.length; i++) out[i] = minutes(values[i], format);
        return out;
    }

    private static int indexOf(int[] values, int v) {
        for (int i = 0; i < values.length; i++) if (values[i] == v) return i;
        return 0;
    }

    private static int indexOf(String[] values, String v) {
        for (int i = 0; i < values.length; i++) if (values[i].equals(v)) return i;
        return 0;
    }

    /* ---------- статистика и заметки ---------- */

    private void stats() {
        LinearLayout c = card("Сегодня");
        c.addView(Ui.text(this, UmnikService.statsText(this), 14.5f, R.color.text));
        content.addView(c, Ui.margins(Ui.fill(), this, 0, 0, 0, 12));
    }

    private void notes() {
        TextView t = Ui.text(this, "🔒 Снимок экрана уходит в Claude (Anthropic) только вместе с вопросом — когда ты нажал кнопку "
                + "или включил «Сам подсказывать». В телефоне снимки не сохраняются. Приложения банков и кино снимать "
                + "экран не дают — там Умник видит только название приложения.\n\n"
                + "♟ Подсказки в рейтинговых партиях против живых людей запрещены правилами chess.com и lichess — за это "
                + "банят аккаунт. Для учёбы, задач и игры с ботом — пожалуйста.", 12.5f, R.color.text_secondary);
        content.addView(t, Ui.margins(Ui.fill(), this, 4, 0, 4, 24));
    }

    private LinearLayout card(String title) {
        LinearLayout c = Ui.column(this);
        int pad = Ui.dp(this, 16);
        c.setPadding(pad, pad, pad, pad);
        c.setBackground(Ui.round(this, Ui.color(this, R.color.card), 20));
        TextView t = Ui.title(this, title, 18);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        c.addView(t, Ui.margins(Ui.fill(), this, 0, 0, 0, 8));
        return c;
    }

    /* ---------- системные переходы ---------- */

    private boolean accessOn() {
        String enabled = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        if (enabled == null) return false;
        ComponentName me = new ComponentName(this, UmnikService.class);
        return enabled.contains(me.flattenToString()) || enabled.contains(me.flattenToShortString());
    }

    private boolean notifyOn() {
        return Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        render();
    }

    private void openAccessibility() {
        try {
            startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
            Toast.makeText(this, "Найди «Умник» в списке и включи", Toast.LENGTH_LONG).show();
        } catch (RuntimeException e) {
            startActivity(new Intent(Settings.ACTION_SETTINGS));
        }
    }

    private void open(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (RuntimeException e) {
            Toast.makeText(this, url, Toast.LENGTH_LONG).show();
        }
    }

    private static String tail(String key) {
        return key.length() <= 4 ? key : key.substring(key.length() - 4);
    }
}
