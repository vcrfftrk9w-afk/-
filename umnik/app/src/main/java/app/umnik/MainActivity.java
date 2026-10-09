package app.umnik;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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

import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Главный экран: выбрать «мозг» (бесплатный ИИ в телефоне или Claude), доступ к экрану, настройки, статистика. */
public final class MainActivity extends Activity {
    private static final ExecutorService BACKGROUND = Executors.newSingleThreadExecutor();
    private static final long GB = 1L << 30;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable poll = this::pollModel;
    private LinearLayout content;
    /** карточка «Подключение» — при загрузке модели обновляется только она */
    private LinearLayout setupBox;
    private TextView modelStatus;
    private ModelStore.State shownState;

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

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(poll);
    }

    private void render() {
        content.removeAllViews();
        header();
        setupBox = Ui.column(this);
        content.addView(setupBox, Ui.fill());
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
        handler.removeCallbacks(poll);
        setupBox.removeAllViews();
        modelStatus = null;
        LinearLayout c = card("Подключение");
        boolean free = Prefs.free(this), access = accessOn(), notify = notifyOn();

        c.addView(step(Prefs.ready(this), "1. Чем думает Умник", free
                ? "Бесплатный ИИ Gemma 4 от Google работает прямо в телефоне: без интернета, без ключей и денег. "
                + "Видит снимки экрана и отвечает по-русски. Нужно один раз скачать 2,6 ГБ."
                : "Claude от Anthropic — самый умный, но платный: нужен ключ API и деньги на счёте."));
        ViewGroup pick = Ui.flow(this);
        pick.addView(option("📱 Бесплатно, в телефоне", free, v -> {
            Prefs.put(this, "engine", Prefs.FREE);
            render();
        }));
        pick.addView(option("🔑 Claude по ключу", !free, v -> {
            Prefs.put(this, "engine", Prefs.CLAUDE);
            render();
        }));
        c.addView(pick, Ui.margins(Ui.fill(), this, 0, 8, 0, 0));
        if (free) freeModel(c);
        else claudeKey(c);

        c.addView(step(access, "2. Доступ к экрану", access
                ? "Включено: кнопка Умника видна поверх приложений."
                : "В «Спецвозможностях» найди «Умник» и включи. Так Умник видит, какое приложение открыто, делает снимок "
                + "экрана, когда ты нажимаешь его кнопку, и считает время в телефоне. Сам он ничего не нажимает и снимки не хранит."),
                Ui.margins(Ui.fill(), this, 0, 14, 0, 0));
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
        setupBox.addView(c, Ui.margins(Ui.fill(), this, 0, 0, 0, 12));
    }

    /** выбор из двух: выбранный — залит цветом */
    private TextView option(String label, boolean selected, View.OnClickListener click) {
        TextView t = Ui.chip(this, label, click);
        if (selected) {
            t.setBackground(Ui.pressable(this, Ui.round(this, Ui.color(this, R.color.accent), 18)));
            t.setTextColor(Ui.color(this, R.color.on_accent));
        }
        return t;
    }

    /* ---------- бесплатный ИИ: скачать, проверить, удалить ---------- */

    private void freeModel(LinearLayout c) {
        ModelStore.Status st = ModelStore.status(this);
        shownState = st.state;
        modelStatus = Ui.text(this, modelText(st), 14, st.state == ModelStore.State.FAILED ? R.color.danger : R.color.text);
        c.addView(modelStatus, Ui.margins(Ui.fill(), this, 0, 10, 0, 0));
        ViewGroup buttons = Ui.flow(this);
        switch (st.state) {
            case NONE:
                buttons.addView(Ui.button(this, "⬇️ Скачать бесплатный ИИ (2,6 ГБ)", v -> download(false)));
                break;
            case FAILED:
                buttons.addView(Ui.button(this, "Скачать заново", v -> download(false)));
                buttons.addView(Ui.chip(this, "Скачать с зеркала", v -> download(true)));
                break;
            case DOWNLOADING:
                buttons.addView(Ui.chip(this, "Отменить загрузку", v -> {
                    ModelStore.cancel(this);
                    setup();
                }));
                break;
            case READY:
                buttons.addView(Ui.chip(this, "Проверить", v -> checkFree()));
                buttons.addView(Ui.chip(this, "Удалить из телефона", v -> new AlertDialog.Builder(this)
                        .setMessage("Удалить бесплатный ИИ из телефона? Освободится 3–4 ГБ. Чтобы снова им пользоваться, его придётся скачать заново.")
                        .setPositiveButton("Удалить", (d, w) -> {
                            ModelStore.delete(this);
                            setup();
                        })
                        .setNegativeButton("Отмена", null)
                        .show()));
                break;
            default:
                break;
        }
        if (buttons.getChildCount() > 0) c.addView(buttons, Ui.margins(Ui.fill(), this, 0, 8, 0, 0));
        long ram = totalRam();
        if (ram > 0 && ram < 5_500L << 20) {
            c.addView(Ui.text(this, String.format(Locale.ROOT, "⚠️ В телефоне %.1f ГБ оперативной памяти. Бесплатному ИИ нужно "
                    + "хотя бы 4 ГБ, лучше 6 и больше — иначе он может отвечать медленно или не запуститься. Тогда выбери Claude.",
                    ram / (double) GB).replace('.', ','), 13, R.color.danger), Ui.margins(Ui.fill(), this, 0, 8, 0, 0));
        }
        if (st.state == ModelStore.State.DOWNLOADING || st.state == ModelStore.State.CHECKING) handler.postDelayed(poll, 1000);
    }

    private static String modelText(ModelStore.Status st) {
        switch (st.state) {
            case READY:
                return "✅ Бесплатный ИИ скачан. Отвечает прямо в телефоне — даже без интернета.";
            case DOWNLOADING:
                return "⬇️ Качаю: " + gb(st.done) + " из " + gb(ModelStore.SIZE) + " ГБ (" + st.percent() + "%)"
                        + (st.error == null ? "" : " — " + st.error)
                        + ".\nМожно закрыть приложение — загрузка идёт сама, прогресс в уведомлениях.";
            case CHECKING:
                return "🔎 Скачалось! Проверяю файл — это меньше минуты…";
            case FAILED:
                return "⚠️ Не скачалось: " + st.error + ".";
            default:
                return "Файл модели — 2,6 ГБ, качается один раз, лучше по Wi-Fi. Всего нужно около 4 ГБ свободного места.";
        }
    }

    private static String gb(long bytes) {
        return String.format(Locale.ROOT, "%.1f", bytes / (double) GB).replace('.', ',');
    }

    /** раз в секунду — прогресс загрузки; поменялось состояние — перерисовать карточку */
    private void pollModel() {
        ModelStore.Status st = ModelStore.status(this);
        if (st.state != shownState || modelStatus == null) {
            setup();
            return;
        }
        modelStatus.setText(modelText(st));
        handler.postDelayed(poll, 1000);
    }

    private void download(boolean mirror) {
        long need = ModelStore.NEED;
        long free = ModelStore.freeSpace(this);
        if (free < need) {
            new AlertDialog.Builder(this)
                    .setMessage("Не хватает места: нужно около " + gb(need) + " ГБ свободных (модель и её кэш для быстрого "
                            + "запуска), а сейчас свободно " + gb(free) + " ГБ. Удали ненужные видео или приложения и попробуй снова.")
                    .setPositiveButton("Ок", null)
                    .show();
            return;
        }
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        if (cm != null && !cm.isActiveNetworkMetered()) {
            ModelStore.start(this, false, mirror);
            setup();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("Сейчас нет Wi-Fi")
                .setMessage("Файл большой — 2,6 ГБ. По мобильному интернету уйдёт столько же трафика. Подождать Wi-Fi?")
                .setPositiveButton("Подождать Wi-Fi", (d, w) -> {
                    ModelStore.start(this, false, mirror);
                    setup();
                })
                .setNegativeButton("Качать сейчас", (d, w) -> {
                    ModelStore.start(this, true, mirror);
                    setup();
                })
                .setNeutralButton("Отмена", null)
                .show();
    }

    private void checkFree() {
        Toast.makeText(this, "Запускаю ИИ — в первый раз это до минуты…", Toast.LENGTH_LONG).show();
        BACKGROUND.execute(() -> {
            long t0 = System.currentTimeMillis();
            String result;
            try {
                String a = LocalMind.get(this).once("Отвечай очень коротко, по-русски.", "Скажи одним словом: работает?", null, 16);
                double secs = (System.currentTimeMillis() - t0) / 1000.0;
                result = "✅ Бесплатный ИИ работает " + (LocalMind.onGpu() ? "на видеокарте" : "на процессоре")
                        + String.format(Locale.ROOT, " — запуск и ответ за %.1f с.", secs).replace('.', ',')
                        + "\nОн ответил: «" + a + "»";
            } catch (Brain.Failure e) {
                result = "⚠️ " + e.getMessage();
            }
            String r = result;
            runOnUiThread(() -> {
                if (!isFinishing()) new AlertDialog.Builder(this).setMessage(r).setPositiveButton("Ок", null).show();
            });
        });
    }

    private long totalRam() {
        ActivityManager am = getSystemService(ActivityManager.class);
        if (am == null) return 0;
        ActivityManager.MemoryInfo m = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(m);
        return m.totalMem;
    }

    /* ---------- Claude: ключ ---------- */

    private void claudeKey(LinearLayout c) {
        boolean key = Prefs.hasKey(this);
        c.addView(Ui.text(this, key
                ? "Ключ сохранён (…" + tail(Prefs.apiKey(this)) + "). Можно проверить или вставить новый."
                : "Возьми ключ на platform.claude.com → Settings → API keys → Create key и вставь сюда. На счёте нужны "
                + "деньги — нескольких долларов хватит надолго. Claude работает не во всех странах: например, в России и "
                + "Беларуси его API недоступен — там выбирай бесплатный ИИ.", 14, R.color.text_secondary), Ui.margins(Ui.fill(), this, 0, 10, 0, 0));
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
        buttons.addView(Ui.chip(this, "Где взять ключ?", v -> open("https://platform.claude.com/settings/keys")));
        c.addView(buttons, Ui.margins(Ui.fill(), this, 0, 6, 0, 0));
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
                Session.brain(this).once("Отвечай одним словом.", "Скажи «работает».", null, 1000);
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
                + "Доску он узнаёт сам, а ход считает встроенный шахматный движок — бесплатно и без интернета. В новом "
                + "приложении один раз нажми ♟ в начале партии: Умник запомнит, как там выглядят фигуры.\n"
                + "• Кнопку можно перетащить пальцем. Долгое нажатие — спрятать на 30 минут.\n"
                + "• Если долго сидишь в телефоне, Умник напомнит сделать перерыв.";
        c.addView(Ui.text(this, text, 14.5f, R.color.text));
        ViewGroup row = Ui.flow(this);
        row.addView(Ui.button(this, "💬 Спросить без снимка", v -> {
            Session.start(null, Session.newChat(this));
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
        boolean free = Prefs.free(this);
        if (!free) {
            c.addView(choice("Модель Claude", Prefs.modelName(this), Prefs.MODEL_NAMES, indexOf(Prefs.MODELS, Prefs.model(this)),
                    i -> Prefs.put(this, "model", Prefs.MODELS[i])));
        }
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
                + "похожее на развод сообщение, подсказку в задаче. " + (free
                ? "Бесплатный ИИ думает прямо в телефоне — частые взгляды заметно тратят заряд батареи."
                : "Каждый взгляд — это запрос к Claude, он стоит денег (на Opus примерно 1–2 цента, на Haiku — в десятки "
                + "раз дешевле).") + " В банках и при вводе пароля не смотрит.",
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
        TextView t = Ui.text(this, (Prefs.free(this)
                ? "🔒 Бесплатный ИИ разбирает снимки экрана прямо в телефоне — они никуда не отправляются и не сохраняются. "
                : "🔒 Снимок экрана уходит в Claude (Anthropic) только вместе с вопросом — когда ты нажал кнопку "
                + "или включил «Сам подсказывать». В телефоне снимки не сохраняются. ")
                + "Приложения банков и кино снимать экран не дают — там Умник видит только название приложения.\n\n"
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
