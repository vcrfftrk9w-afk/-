package app.umnik;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.inputmethod.EditorInfo;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import app.umnik.chess.BoardView;
import app.umnik.chess.Hint;

/**
 * Окно помощника снизу поверх любого приложения: снимок экрана, быстрые кнопки под то, что открыто,
 * беседа с ИИ (ответ печатается по мере прихода), голосовой вопрос и чтение ответа вслух.
 */
public final class AssistantActivity extends Activity {
    static final String MODE = "mode";
    static final String CHESS = "chess";
    static final String EXPLAIN = "explain";
    static final String REFRESHED = "refreshed";

    private static final int VOICE = 7;
    private static final String DO_CHESS = "\u0001chess";
    private static final String DO_TIME = "\u0001time";
    private static final String TRANSLATE = "Переведи текст с экрана на русский (если он уже на русском — на английский).";

    // не одна очередь: новая беседа не должна ждать, пока доотменяется старая
    private final ExecutorService work = Executors.newCachedThreadPool();
    private LinearLayout list;
    private LinearLayout chips;
    private ScrollView scroll;
    private EditText input;
    private ImageView thumb;
    private TextView shotText;
    private TextView speakToggle;
    private TextView send;
    private View spacer;
    private LinearLayout sheet;
    private Speaker speaker;
    private boolean busy;
    private boolean visible;
    /** беседа, которая сейчас на экране */
    private Brain.Chat shown;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        speaker = new Speaker(this);
        setContentView(build());
        handle(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handle(intent);
    }

    @Override
    protected void onStart() {
        super.onStart();
        visible = true;
        UmnikService.sheetVisible(true);
    }

    @Override
    protected void onStop() {
        super.onStop();
        visible = false;
        UmnikService.sheetVisible(false);
        speaker.stop();
    }

    @Override
    protected void onDestroy() {
        speaker.shutdown();
        work.shutdown();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        close();
    }

    private void close() {
        if (Session.chat != null) Session.chat.cancel();
        finish();
    }

    /* ---------- что показать при открытии ---------- */

    private void handle(Intent intent) {
        if (Session.chat != shown) {
            shown = Session.chat;
            setBusy(false);
        }
        list.removeAllViews();
        for (Session.Line l : Session.lines) addView(l);
        showShot();
        fillChips();
        String mode = intent.getStringExtra(MODE);
        intent.removeExtra(MODE);
        if (CHESS.equals(mode)) {
            runChess();
        } else if (EXPLAIN.equals(mode) && Session.hint != null) {
            add(new Session.Line(false, Session.hint.headline, Session.hint));
            ask("Почему этот ход лучший? Объясни простыми словами.");
        } else if (REFRESHED.equals(mode)) {
            add(new Session.Line(false, "📸 Новый снимок экрана — спрашивай.", null));
        } else if (Session.lines.isEmpty() && !Prefs.ready(this)) {
            needMind();
        }
        // бесплатный ИИ начинает загружаться в память, пока человек читает и печатает вопрос
        if (Prefs.free(this) && Prefs.ready(this)) LocalMind.get(this).warmUp();
    }

    /* ---------- разметка ---------- */

    private View build() {
        LinearLayout root = Ui.column(this);
        root.setBackgroundColor(Ui.color(this, R.color.dim));

        spacer = new View(this);
        spacer.setOnClickListener(v -> close());
        root.addView(spacer, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 0.3f));

        sheet = Ui.column(this);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Ui.color(this, R.color.bg));
        float r = Ui.dp(this, 22);
        bg.setCornerRadii(new float[]{r, r, r, r, 0, 0, 0, 0});
        sheet.setBackground(bg);
        int pad = Ui.dp(this, 14);
        sheet.setPadding(pad, Ui.dp(this, 10), pad, pad);
        sheet.setClickable(true);
        root.addView(sheet, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 0.7f));

        // ручка и заголовок
        View handle = new View(this);
        handle.setBackground(Ui.round(this, Ui.color(this, R.color.line), 3));
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(Ui.dp(this, 40), Ui.dp(this, 5));
        hp.gravity = Gravity.CENTER_HORIZONTAL;
        hp.bottomMargin = Ui.dp(this, 8);
        sheet.addView(handle, hp);

        LinearLayout header = Ui.row(this);
        TextView title = Ui.title(this, "🧠 Умник", 19);
        header.addView(title);
        TextView model = Ui.text(this, "  " + Prefs.engineTitle(this), 13, R.color.text_secondary);
        header.addView(model, Ui.weight());
        speakToggle = Ui.chip(this, "", v -> {
            Prefs.put(this, "speak", !Prefs.speak(this));
            if (!Prefs.speak(this)) speaker.stop();
            updateSpeak();
        });
        updateSpeak();
        header.addView(speakToggle, Ui.margins(Ui.wrap(), this, 0, 0, 8, 0));
        TextView x = Ui.chip(this, "✕", v -> close());
        x.setContentDescription("Закрыть");
        header.addView(x);
        sheet.addView(header);

        // снимок экрана
        LinearLayout shotRow = Ui.row(this);
        thumb = new ImageView(this);
        thumb.setScaleType(ImageView.ScaleType.CENTER_CROP);
        thumb.setBackground(Ui.round(this, Ui.color(this, R.color.chip), 8));
        thumb.setClipToOutline(true);
        shotRow.addView(thumb, new LinearLayout.LayoutParams(Ui.dp(this, 30), Ui.dp(this, 52)));
        shotText = Ui.text(this, "", 13, R.color.text_secondary);
        shotRow.addView(shotText, Ui.margins(Ui.weight(), this, 10, 0, 8, 0));
        TextView again = Ui.chip(this, "📸 Новый снимок", v -> refreshShot());
        shotRow.addView(again);
        sheet.addView(shotRow, Ui.margins(Ui.fill(), this, 0, 10, 0, 6));

        // беседа
        scroll = new ScrollView(this);
        list = Ui.column(this);
        list.setPadding(0, Ui.dp(this, 4), 0, Ui.dp(this, 8));
        scroll.addView(list);
        sheet.addView(scroll, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        // быстрые кнопки
        HorizontalScrollView hs = new HorizontalScrollView(this);
        hs.setHorizontalScrollBarEnabled(false);
        chips = Ui.row(this);
        hs.addView(chips);
        sheet.addView(hs, Ui.margins(Ui.fill(), this, 0, 6, 0, 8));

        // поле вопроса
        LinearLayout ask = Ui.row(this);
        input = new EditText(this);
        input.setHint("Спроси что угодно…");
        input.setTextSize(16);
        input.setTextColor(Ui.color(this, R.color.text));
        input.setHintTextColor(Ui.color(this, R.color.text_secondary));
        input.setBackground(Ui.outlined(this, Ui.color(this, R.color.card), Ui.color(this, R.color.line), 22));
        input.setPadding(Ui.dp(this, 16), Ui.dp(this, 10), Ui.dp(this, 16), Ui.dp(this, 10));
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        input.setMaxLines(4);
        input.setImeOptions(EditorInfo.IME_ACTION_SEND);
        input.setOnEditorActionListener((v, id, e) -> {
            if (id != EditorInfo.IME_ACTION_SEND) return false;
            sendTyped();
            return true;
        });
        ask.addView(input, Ui.weight());
        TextView mic = round("🎤", v -> voice());
        mic.setContentDescription("Спросить голосом");
        ask.addView(mic, Ui.margins(new LinearLayout.LayoutParams(Ui.dp(this, 46), Ui.dp(this, 46)), this, 8, 0, 0, 0));
        send = round("➤", v -> sendTyped());
        send.setContentDescription("Отправить");
        ask.addView(send, Ui.margins(new LinearLayout.LayoutParams(Ui.dp(this, 46), Ui.dp(this, 46)), this, 8, 0, 0, 0));
        sheet.addView(ask, Ui.fill());

        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(0, bars.top, 0, 0);
                sheet.setPadding(pad, Ui.dp(this, 10), pad, pad + Math.max(bars.bottom, ime.bottom));
                // клавиатура открыта — окну нужно больше места
                ((LinearLayout.LayoutParams) spacer.getLayoutParams()).weight = ime.bottom > 0 ? 0.04f : 0.3f;
                spacer.requestLayout();
                return WindowInsets.CONSUMED;
            });
        }
        return root;
    }

    private TextView round(String s, View.OnClickListener click) {
        TextView t = Ui.text(this, s, 19, R.color.on_accent);
        t.setGravity(Gravity.CENTER);
        GradientDrawable d = new GradientDrawable();
        d.setShape(GradientDrawable.OVAL);
        d.setColor(Ui.color(this, R.color.accent));
        t.setBackground(Ui.pressable(this, d));
        t.setOnClickListener(click);
        return t;
    }

    private void updateSpeak() {
        boolean on = Prefs.speak(this);
        speakToggle.setText(on ? "🔊" : "🔇");
        speakToggle.setContentDescription(on ? "Читать ответы вслух: включено" : "Читать ответы вслух: выключено");
    }

    private void showShot() {
        Shot s = Session.shot;
        if (s != null && s.preview != null) {
            thumb.setImageBitmap(s.preview);
            thumb.setVisibility(View.VISIBLE);
            shotText.setText(s.app == null || s.app.isEmpty() ? "Вижу твой экран" : "Вижу экран «" + s.app + "»");
        } else {
            thumb.setVisibility(View.GONE);
            if (s == null) shotText.setText("Без снимка экрана — просто спрашивай");
            else shotText.setText("Снимка нет: " + s.why);
        }
    }

    /* ---------- быстрые кнопки под открытое приложение ---------- */

    private void fillChips() {
        chips.removeAllViews();
        Shot s = Session.shot;
        for (String[] q : quick(s == null ? Apps.Kind.OTHER : s.kind)) {
            TextView c = Ui.chip(this, q[0], v -> {
                if (DO_CHESS.equals(q[1])) runChess();
                else if (DO_TIME.equals(q[1])) showTime(q[0]);
                else ask(q[1]);
            });
            chips.addView(c, Ui.margins(Ui.wrap(), this, 0, 0, 8, 0));
        }
    }

    private static String[][] quick(Apps.Kind kind) {
        switch (kind) {
            case CHESS:
                return new String[][]{{"♟ Лучший ход", DO_CHESS},
                        {"📚 Как играть сильнее?", "Посмотри на позицию и дай 2–3 совета, как мне играть сильнее в таких позициях."},
                        {"👀 Что на экране?", "Что у меня на экране? Коротко объясни."}};
            case MESSENGER:
                return new String[][]{{"✍️ Помоги ответить", "Помоги ответить на последнее сообщение в переписке: дай 2–3 варианта ответа, коротко и по-человечески."},
                        {"🧐 Это не развод?", "Проверь, не похоже ли это на мошенничество или развод. На что обратить внимание?"},
                        {"🌐 Переведи", TRANSLATE}};
            case BROWSER:
                return new String[][]{{"📝 Кратко", "Перескажи кратко, о чём эта страница: 3–5 пунктов."},
                        {"✅ Это правда?", "Проверь главное утверждение на экране: это правда? Что известно на самом деле?"},
                        {"🌐 Переведи", TRANSLATE}, {"♟ Лучший ход", DO_CHESS}};
            case VIDEO:
                return new String[][]{{"📝 О чём это?", "О чём это видео или пост? Коротко."},
                        {"✅ Это правда?", "Проверь, правда ли то, что утверждается на экране."},
                        {"⏰ Сколько я тут?", DO_TIME}};
            case GAME:
                return new String[][]{{"💡 Подсказка", "Дай подсказку к тому, что у меня на экране, но не решай всё за меня."},
                        {"🎯 Как пройти?", "Как пройти этот момент в игре? Дай конкретный совет."},
                        {"⏰ Сколько я тут?", DO_TIME}};
            case STUDY:
                return new String[][]{{"🧮 Реши с объяснением", "Реши задачу с экрана по шагам и объясни каждый шаг."},
                        {"💡 Только подсказка", "Дай подсказку к задаче на экране, но не решай её целиком."},
                        {"🌐 Переведи", TRANSLATE}};
            default:
                return new String[][]{{"👀 Что на экране?", "Что у меня на экране? Коротко объясни, что тут происходит и что можно сделать."},
                        {"💡 Что делать?", "Подскажи, что мне тут делать дальше."},
                        {"🌐 Переведи", TRANSLATE}, {"♟ Лучший ход", DO_CHESS}, {"⏰ Сколько я тут?", DO_TIME}};
        }
    }

    /* ---------- строчки беседы ---------- */

    private TextView add(Session.Line line) {
        Session.lines.add(line);
        return addView(line);
    }

    private TextView addView(Session.Line line) {
        if (line.hint != null) {
            View card = hintCard(line.hint);
            list.addView(card, Ui.margins(Ui.fill(), this, 0, 4, 0, 4));
            reveal(card);
            return null;
        }
        TextView t = Ui.text(this, line.text, 15.5f, R.color.text);
        t.setPadding(Ui.dp(this, 14), Ui.dp(this, 10), Ui.dp(this, 14), Ui.dp(this, 10));
        LinearLayout.LayoutParams lp;
        if (line.mine) {
            t.setBackground(Ui.round(this, Ui.color(this, R.color.bubble_mine), 18));
            t.setMaxWidth(getResources().getDisplayMetrics().widthPixels * 4 / 5);
            lp = Ui.wrap();
            lp.gravity = Gravity.END;
        } else {
            t.setBackground(Ui.round(this, Ui.color(this, R.color.card), 18));
            t.setTextIsSelectable(true);
            lp = Ui.fill();
        }
        list.addView(t, Ui.margins(lp, this, 0, 4, 0, 4));
        reveal(t);
        return t;
    }

    private View hintCard(Hint h) {
        LinearLayout c = Ui.column(this);
        c.setBackground(Ui.round(this, Ui.color(this, R.color.card), 18));
        int pad = Ui.dp(this, 14);
        c.setPadding(pad, pad, pad, pad);
        TextView head = Ui.text(this, h.headline, 16, R.color.text);
        head.setTypeface(Typeface.DEFAULT_BOLD);
        c.addView(head);
        if (!h.details.isEmpty()) c.addView(Ui.text(this, h.details, 14, R.color.text_secondary), Ui.margins(Ui.fill(), this, 0, 4, 0, 0));
        BoardView board = new BoardView(this);
        board.show(h.board, h.whiteBottom, h.result.move);
        int size = Math.min(Ui.dp(this, 240), getResources().getDisplayMetrics().widthPixels - Ui.dp(this, 80));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(size, size);
        lp.gravity = Gravity.CENTER_HORIZONTAL;
        lp.topMargin = Ui.dp(this, 10);
        c.addView(board, lp);
        ViewGroup buttons = Ui.flow(this);
        if (h.result.move != 0) buttons.addView(Ui.chip(this, "🤔 Почему?", v -> ask("Почему этот ход лучший? Объясни простыми словами.")));
        buttons.addView(Ui.chip(this, h.whiteToMove() ? "⇄ Ход чёрных" : "⇄ Ход белых", v -> recount(h, false)));
        buttons.addView(Ui.chip(this, "🔃 Доска наоборот", v -> recount(h, true)));
        c.addView(buttons, Ui.margins(Ui.fill(), this, 0, 10, 0, 0));
        return c;
    }

    /** Прокрутить к строчке: короткая видна целиком внизу, у длинной видно начало — читать сверху вниз. */
    private void reveal(View v) {
        scroll.post(() -> {
            int bottom = list.getHeight() - scroll.getHeight();
            int top = v.getTop() - Ui.dp(this, 8);
            scroll.smoothScrollTo(0, Math.max(0, Math.min(bottom, top)));
        });
    }

    private void setBusy(boolean b) {
        busy = b;
        send.setAlpha(b ? 0.4f : 1f);
        chips.setAlpha(b ? 0.4f : 1f);
    }

    /** спрашивать пока нечем: бесплатный ИИ не скачан или нет ключа Claude */
    private void needMind() {
        String text;
        if (Prefs.free(this)) {
            ModelStore.Status st = ModelStore.status(this);
            if (st.state == ModelStore.State.DOWNLOADING) {
                text = "Бесплатный ИИ ещё качается: " + st.percent() + "%" + (st.error == null ? "" : " (" + st.error + ")")
                        + ". Как докачается — спрашивай! Шахматные подсказки ♟ работают уже сейчас.";
            } else if (st.state == ModelStore.State.CHECKING) {
                text = "Бесплатный ИИ скачан, проверяю файл — это меньше минуты.";
            } else {
                text = "Чтобы я мог отвечать, скачай бесплатный ИИ — один раз, 2,6 ГБ (лучше по Wi-Fi). Он работает прямо "
                        + "в телефоне, без интернета. Шахматные подсказки ♟ работают и без него.";
            }
        } else {
            text = "Чтобы я мог отвечать, нужен ключ Claude API — или выбери бесплатный ИИ в телефоне. Всё это в настройках Умника.";
        }
        add(new Session.Line(false, text, null));
        TextView open = Ui.button(this, "Открыть настройки", v -> {
            startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            finish();
        });
        list.addView(open, Ui.margins(Ui.wrap(), this, 0, 6, 0, 6));
    }

    /* ---------- вопросы ---------- */

    private void sendTyped() {
        String q = input.getText().toString().trim();
        if (q.isEmpty() || busy) return;
        input.setText("");
        ask(q);
    }

    private void ask(String question) {
        if (busy) return;
        if (!Prefs.ready(this)) {
            needMind();
            return;
        }
        Brain.Chat chat = Session.chat;
        if (chat == null || chat.isLocal() != Prefs.free(this)) {
            // «мозг» сменили посреди беседы — новая беседа с тем же снимком
            if (chat != null) {
                chat.cancel();
                chat.dropLocal();
                if (Session.shot != null) Session.shotFresh = true;
            }
            chat = Session.newChat(this);
            Session.chat = chat;
            shown = chat;
        }
        Shot shot = Session.shot;
        boolean fresh = Session.shotFresh;
        UmnikService svc = UmnikService.instance;
        String context = fresh ? Session.context(shot, svc == null ? null : svc.time) : "";
        String note = Session.takeNote();
        if (!note.isEmpty()) context = context.isEmpty() ? note : context + "\n\n" + note;
        byte[] jpeg = fresh && shot != null ? shot.jpeg : null;
        Session.shotFresh = false;

        add(new Session.Line(true, question, null));
        boolean loading = chat.isLocal() && !LocalMind.loaded();
        Session.Line answer = new Session.Line(false, loading ? "⏳ Запускаю ИИ в телефоне — в первый раз это до полуминуты…" : "…", null);
        TextView view = add(answer);
        setBusy(true);
        Brain.Chat c = chat;
        String ctx = context;
        work.execute(() -> {
            try {
                String text = Session.mind(this, c).ask(c, question, jpeg, ctx, soFar -> runOnUiThread(() -> {
                    if (c != shown) return;
                    answer.text = soFar;
                    view.setText(soFar);
                    reveal(view);
                }));
                runOnUiThread(() -> {
                    if (c != shown) return;
                    answer.text = text.isEmpty() ? "…" : text;
                    view.setText(answer.text);
                    setBusy(false);
                    if (visible && Prefs.speak(this)) speaker.say(text);
                });
            } catch (Brain.Failure e) {
                runOnUiThread(() -> {
                    if (c != shown) return;
                    if (fresh) Session.shotFresh = true;     // снимок не дошёл — уйдёт со следующим вопросом
                    if (!note.isEmpty() && Session.note == null) Session.note = note;
                    answer.text = "⚠️ " + e.getMessage();
                    view.setText(answer.text);
                    setBusy(false);
                });
            }
        });
    }

    private void runChess() {
        if (busy) return;
        Shot shot = Session.shot;
        if (shot == null || shot.jpeg == null) {
            add(new Session.Line(false, "♟ Нужен снимок экрана с доской: закрой это окно, открой партию и нажми кнопку ♟ или кнопку Умника.", null));
            return;
        }
        add(new Session.Line(true, "♟ Лучший ход", null));
        Session.Line wait = new Session.Line(false, "Смотрю на доску и считаю ходы…", null);
        TextView view = add(wait);
        setBusy(true);
        Brain.Chat c = shown;
        work.execute(() -> {
            try {
                Session.Chess r = Session.chess(this, shot);
                runOnUiThread(() -> {
                    if (c != shown) return;
                    Session.lines.remove(wait);
                    list.removeView(view);
                    if (r.note != null) add(new Session.Line(false, r.note, null));
                    add(new Session.Line(false, r.hint.headline, r.hint));
                    setBusy(false);
                    if (visible && Prefs.speak(this)) speaker.say(r.hint.headline);
                });
            } catch (Brain.Failure e) {
                runOnUiThread(() -> {
                    if (c != shown) return;
                    wait.text = "⚠️ " + e.getMessage();
                    view.setText(wait.text);
                    setBusy(false);
                });
            }
        });
    }

    /** пересчитать: ходит другая сторона (rotate = false) или доска на экране стоит наоборот (rotate = true) */
    private void recount(Hint h, boolean rotate) {
        if (busy) return;
        setBusy(true);
        Brain.Chat c = shown;
        work.execute(() -> {
            try {
                Hint f = rotate ? Session.rotate(h) : Session.flip(h);
                runOnUiThread(() -> {
                    if (c != shown) return;
                    add(new Session.Line(false, f.headline, f));
                    setBusy(false);
                });
            } catch (Brain.Failure e) {
                runOnUiThread(() -> {
                    if (c != shown) return;
                    add(new Session.Line(false, "⚠️ " + e.getMessage(), null));
                    setBusy(false);
                });
            }
        });
    }

    private void showTime(String label) {
        UmnikService s = UmnikService.instance;
        add(new Session.Line(true, label, null));
        if (s == null) {
            add(new Session.Line(false, "Время в телефоне я считаю, только когда включён доступ к экрану (спецвозможности).", null));
            return;
        }
        long now = System.currentTimeMillis();
        StringBuilder t = new StringBuilder("Без перерыва: ").append(ScreenTime.format(s.time.session(now)))
                .append(".\nСегодня в телефоне всего: ").append(ScreenTime.format(s.time.total())).append('.');
        Shot shot = Session.shot;
        if (shot != null && shot.pkg != null) {
            t.append("\nИз них в «").append(shot.app).append("»: ").append(ScreenTime.format(s.time.of(shot.pkg))).append('.');
        }
        add(new Session.Line(false, t.toString(), null));
    }

    /** закрыть окно, сделать новый снимок того, что под ним, и открыть снова — беседа продолжается */
    private void refreshShot() {
        UmnikService s = UmnikService.instance;
        if (s == null) {
            Toast.makeText(this, "Включи для Умника доступ к экрану в настройках спецвозможностей.", Toast.LENGTH_LONG).show();
            return;
        }
        finish();
        overridePendingTransition(0, 0);
        s.recapture();
    }

    /* ---------- голос ---------- */

    private void voice() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
                .putExtra(RecognizerIntent.EXTRA_PROMPT, "Спроси Умника");
        try {
            startActivityForResult(i, VOICE);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "На телефоне нет голосового ввода — напиши вопрос текстом.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != VOICE || result != RESULT_OK || data == null) return;
        ArrayList<String> said = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
        if (said != null && !said.isEmpty()) ask(said.get(0));
    }
}
