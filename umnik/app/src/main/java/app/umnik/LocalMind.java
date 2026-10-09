package app.umnik;

import android.annotation.SuppressLint;
import android.content.Context;

import com.google.ai.edge.litertlm.Backend;
import com.google.ai.edge.litertlm.Content;
import com.google.ai.edge.litertlm.Contents;
import com.google.ai.edge.litertlm.Conversation;
import com.google.ai.edge.litertlm.ConversationConfig;
import com.google.ai.edge.litertlm.Engine;
import com.google.ai.edge.litertlm.EngineConfig;
import com.google.ai.edge.litertlm.LogSeverity;
import com.google.ai.edge.litertlm.Message;
import com.google.ai.edge.litertlm.MessageCallback;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CancellationException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.BooleanSupplier;

/**
 * Бесплатный ИИ прямо в телефоне: Gemma 4 E2B через LiteRT-LM от Google. Видит снимки экрана и работает
 * без интернета. Модель занимает 1–2 ГБ памяти, поэтому загружается при первом вопросе (сначала пробуем
 * видеокарту, потом процессор) и выгружается после 5 минут без вопросов.
 * Отвечает по одному: вопрос человека важнее фоновой сам-подсказки — та уступает.
 */
final class LocalMind implements Mind {
    static final String TITLE = "Gemma 4 · бесплатно";
    private static final long IDLE = 5 * 60_000L;
    @SuppressLint("StaticFieldLeak") // держит только контекст приложения
    private static volatile LocalMind instance;

    private final Context app;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "umnik-ai-idle");
        t.setDaemon(true);
        return t;
    });
    private final ReentrantLock turn = new ReentrantLock(true);
    /** все открытые беседы — перед выгрузкой модели их надо закрыть */
    private final Set<Conversation> open = new HashSet<>();
    private volatile Engine engine;
    private volatile boolean gpu;
    /** беседа, в которой сейчас печатается ответ, и просьба закрыть её, когда допечатается */
    private Conversation busy;
    private boolean dropBusy;
    /** выгрузить модель, как только освободится */
    private boolean unload;
    /** человек задал вопрос — фоновый разовый ответ прерывается */
    private volatile boolean yield;
    private volatile long lastUse;

    private LocalMind(Context app) {
        this.app = app;
        timer.scheduleWithFixedDelay(this::closeIfIdle, 60, 60, TimeUnit.SECONDS);
    }

    static LocalMind get(Context c) {
        LocalMind m = instance;
        if (m != null) return m;
        synchronized (LocalMind.class) {
            if (instance == null) instance = new LocalMind(c.getApplicationContext());
            return instance;
        }
    }

    /** модель сейчас в памяти — ответ начнётся сразу, без загрузки */
    static boolean loaded() {
        LocalMind m = instance;
        return m != null && m.engine != null;
    }

    static boolean onGpu() {
        LocalMind m = instance;
        return m != null && m.engine != null && m.gpu;
    }

    /** выгрузить модель из памяти (файл удаляют) — сразу или как только допечатается ответ */
    static void release() {
        LocalMind m = instance;
        if (m == null) return;
        synchronized (m) {
            m.unload = true;
        }
        m.unloadIfFree();
    }

    /** закрыть беседу внутри модели (беседа Умника закончилась) */
    static void forget(Object conversation) {
        LocalMind m = instance;
        if (m != null && conversation instanceof Conversation) m.drop((Conversation) conversation);
    }

    @Override
    public String title() {
        return TITLE;
    }

    /** загрузить модель заранее, пока человек читает и печатает вопрос */
    void warmUp() {
        if (engine != null || !ModelStore.ready(app)) return;
        timer.execute(() -> {
            if (!turn.tryLock()) return; // уже кто-то загружает или спрашивает
            try {
                engine();
            } catch (Brain.Failure ignored) {
                // ошибку человек увидит, когда спросит
            } finally {
                turn.unlock();
            }
        });
    }

    /* ---------- вопросы ---------- */

    @Override
    public String ask(Brain.Chat chat, String question, byte[] jpeg, String context, Brain.Listener listener) throws Brain.Failure {
        chat.cancelled = false;
        yield = true;
        turn.lock();
        yield = false;
        try {
            if (chat.cancelled) throw new Brain.Failure("Остановлено.", null);
            // загрузка модели — под очередью ответов, но не под монитором: главный поток не должен её ждать
            Engine e = engine();
            Conversation conv = (Conversation) chat.local;
            if (conv == null || !conv.isAlive()) {
                conv = newConversation(e, chat.system);
                chat.local = conv;
            }
            List<Content> parts = new ArrayList<>();
            if (jpeg != null) parts.add(new Content.ImageBytes(jpeg));
            parts.add(new Content.Text((context == null || context.isEmpty() ? "" : context + "\n\n") + question));
            try {
                return run(conv, Contents.Companion.of(parts), () -> chat.cancelled, listener, null);
            } catch (Brain.Failure f) {
                chat.dropLocal(); // после отмены или ошибки беседа в модели не продолжается — следующий вопрос начнёт новую
                throw f;
            }
        } finally {
            turn.unlock();
            unloadIfFree();
        }
    }

    /** Разовый ответ (сам-подсказка, напоминание): если модель занята вопросом человека — не ждём. */
    @Override
    public String once(String system, String text, byte[] jpeg, int maxTokens) throws Brain.Failure {
        if (!turn.tryLock()) throw new Brain.Failure("ИИ сейчас занят.", null);
        try {
            Conversation conv = newConversation(engine(), system);
            try {
                List<Content> parts = new ArrayList<>();
                if (jpeg != null) parts.add(new Content.ImageBytes(jpeg));
                parts.add(new Content.Text(text));
                return run(conv, Contents.Companion.of(parts), () -> yield, null, Math.min(maxTokens, 400));
            } finally {
                drop(conv);
            }
        } finally {
            turn.unlock();
            unloadIfFree();
        }
    }

    /* ---------- модель в памяти ---------- */

    /** модель в памяти; загружает её только тот, кто держит очередь ответов (turn) */
    @SuppressLint("ApplySharedPref") // флаг должен лечь на диск до запуска видеокарты — вдруг она уронит процесс
    private Engine engine() throws Brain.Failure {
        lastUse = System.currentTimeMillis();
        Engine e = engine;
        if (e != null) return e;
        if (!ModelStore.ready(app)) {
            throw new Brain.Failure("Бесплатный ИИ ещё не скачан. Открой приложение «Умник» и нажми «Скачать бесплатный ИИ».", null);
        }
        Engine.Companion.setNativeMinLogSeverity(LogSeverity.ERROR);
        String path = ModelStore.file(app).getAbsolutePath();
        boolean useGpu = !Prefs.of(app).getBoolean("gpu_failed", false);
        e = null;
        if (useGpu) {
            // если драйвер видеокарты уронит приложение прямо при запуске, флаг останется — дальше только процессор
            Prefs.of(app).edit().putBoolean("gpu_failed", true).commit();
            try {
                e = open(path, new Backend.GPU());
                Prefs.of(app).edit().putBoolean("gpu_failed", false).apply();
            } catch (Throwable onGpu) {
                e = null; // флаг оставляем: на этом телефоне видеокарта ИИ не берёт
            }
        }
        boolean onGpu = e != null;
        if (e == null) {
            try {
                e = open(path, new Backend.CPU());
            } catch (OutOfMemoryError oom) {
                throw new Brain.Failure("Телефону не хватает памяти для ИИ. Закрой другие приложения и попробуй снова.", oom);
            } catch (Throwable t) {
                throw new Brain.Failure("Бесплатный ИИ не запустился на этом телефоне: " + t.getMessage(), t);
            }
        }
        synchronized (this) {
            gpu = onGpu;
            unload = false;
            engine = e;
        }
        return e;
    }

    private Conversation newConversation(Engine e, String system) {
        Conversation c = e.createConversation(new ConversationConfig(Contents.Companion.of(system)));
        synchronized (this) {
            open.add(c);
        }
        return c;
    }

    private Engine open(String path, Backend backend) {
        // снимки экрана разбирает тот же вычислитель; кэш ускоряет повторный запуск
        Engine e = new Engine(new EngineConfig(path, backend, backend, null, 4096, null, app.getCacheDir().getAbsolutePath()));
        e.initialize();
        return e;
    }

    private void closeIfIdle() {
        synchronized (this) {
            if (engine == null || System.currentTimeMillis() - lastUse < IDLE || Session.sheetOpen) return;
            unload = true;
        }
        unloadIfFree();
    }

    /** выгрузить, если просили и никто сейчас не спрашивает */
    private void unloadIfFree() {
        if (!turn.tryLock()) return; // допечатается — выгрузит тот, кто спрашивал
        try {
            synchronized (this) {
                if (!unload || engine == null) return;
                for (Conversation c : open) closeQuietly(c);
                open.clear();
                try {
                    engine.close();
                } catch (RuntimeException ignored) {
                }
                engine = null;
                unload = false;
            }
        } finally {
            turn.unlock();
        }
    }

    private synchronized void drop(Conversation conv) {
        if (conv == busy) {
            dropBusy = true; // закрывать беседу посреди ответа нельзя — закроем, когда допечатается
            return;
        }
        if (open.remove(conv)) closeQuietly(conv);
    }

    private static void closeQuietly(Conversation c) {
        try {
            if (c.isAlive()) c.close();
        } catch (RuntimeException ignored) {
        }
    }

    /* ---------- один ответ ---------- */

    private String run(Conversation conv, Contents contents, BooleanSupplier stop, Brain.Listener listener, Integer maxTokens)
            throws Brain.Failure {
        synchronized (this) {
            busy = conv;
            dropBusy = false;
        }
        try {
            return generate(conv, contents, stop, listener, maxTokens);
        } finally {
            synchronized (this) {
                busy = null;
                if (dropBusy && open.remove(conv)) closeQuietly(conv);
                dropBusy = false;
                lastUse = System.currentTimeMillis();
            }
        }
    }

    private String generate(Conversation conv, Contents contents, BooleanSupplier stop, Brain.Listener listener, Integer maxTokens)
            throws Brain.Failure {
        CountDownLatch done = new CountDownLatch(1);
        StringBuilder text = new StringBuilder();
        Throwable[] error = {null};
        try {
            conv.sendMessageAsync(contents, new MessageCallback() {
                @Override
                public void onMessage(Message m) {
                    lastUse = System.currentTimeMillis();
                    String soFar;
                    synchronized (text) {
                        text.append(m.toString());
                        soFar = text.toString();
                    }
                    if (listener != null) listener.onText(clean(soFar));
                }

                @Override
                public void onDone() {
                    done.countDown();
                }

                @Override
                public void onError(Throwable t) {
                    error[0] = t;
                    done.countDown();
                }
            }, Collections.emptyMap(), null, null, null, maxTokens);
        } catch (RuntimeException e) {
            throw new Brain.Failure("ИИ в телефоне не смог ответить: " + e.getMessage(), e);
        }
        try {
            while (!done.await(200, TimeUnit.MILLISECONDS)) {
                if (stop.getAsBoolean()) {
                    cancel(conv);
                    done.await(10, TimeUnit.SECONDS);
                    throw new Brain.Failure("Остановлено.", null);
                }
            }
        } catch (InterruptedException e) {
            cancel(conv);
            Thread.currentThread().interrupt();
            throw new Brain.Failure("Остановлено.", e);
        }
        if (error[0] != null) {
            if (error[0] instanceof CancellationException) throw new Brain.Failure("Остановлено.", error[0]);
            throw new Brain.Failure("ИИ в телефоне ошибся: " + error[0].getMessage(), error[0]);
        }
        synchronized (text) {
            return clean(text.toString());
        }
    }

    private static void cancel(Conversation conv) {
        try {
            conv.cancelProcess();
        } catch (RuntimeException ignored) {
        }
    }

    /** маленькая модель любит Markdown — в окне и вслух он только мешает */
    static String clean(String s) {
        return s.replace("**", "").replace("__", "")
                .replaceAll("(?m)^#{1,6}\\s*", "")
                .replaceAll("(?m)^\\s*[*-]\\s+", "• ")
                .trim();
    }
}
