package app.umnik;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.core.http.StreamResponse;
import com.anthropic.errors.AnthropicIoException;
import com.anthropic.errors.AnthropicServiceException;
import com.anthropic.errors.InternalServerException;
import com.anthropic.errors.NotFoundException;
import com.anthropic.errors.PermissionDeniedException;
import com.anthropic.errors.RateLimitException;
import com.anthropic.errors.UnauthorizedException;
import com.anthropic.helpers.BetaMessageAccumulator;
import com.anthropic.models.ErrorType;
import com.anthropic.models.beta.messages.BetaBase64ImageSource;
import com.anthropic.models.beta.messages.BetaCacheControlEphemeral;
import com.anthropic.models.beta.messages.BetaContentBlock;
import com.anthropic.models.beta.messages.BetaContentBlockParam;
import com.anthropic.models.beta.messages.BetaFallbacksParam;
import com.anthropic.models.beta.messages.BetaImageBlockParam;
import com.anthropic.models.beta.messages.BetaJsonOutputFormat;
import com.anthropic.models.beta.messages.BetaMessage;
import com.anthropic.models.beta.messages.BetaMessageParam;
import com.anthropic.models.beta.messages.BetaOutputConfig;
import com.anthropic.models.beta.messages.BetaRawMessageStreamEvent;
import com.anthropic.models.beta.messages.BetaStopReason;
import com.anthropic.models.beta.messages.MessageCreateParams;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;

/**
 * Связь с Claude через официальный Java SDK: вопросы со снимком экрана (ответ приходит по кусочкам),
 * чтение шахматной доски со скриншота, короткие подсказки и напоминания.
 * Методы блокирующие — вызывать не из главного потока.
 */
public final class Brain {
    public static final String OPUS = "claude-opus-5-5";
    public static final String SONNET = "claude-sonnet-5-5";
    public static final String HAIKU = "claude-haiku-5-5";

    /** если классификаторы безопасности отклонят запрос, сервер сам повторит его на подходящей модели */
    private static final String FALLBACK_BETA = "server-side-fallback-2026-07-01";
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Ошибка, которую можно показать человеку как есть. */
    public static final class Failure extends Exception {
        Failure(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public interface Listener {
        /** весь текст ответа, полученный к этому моменту (вызывается из рабочего потока) */
        void onText(String soFar);
    }

    /**
     * Беседа. История только дописывается и не правится задним числом: так модель помнит свои рассуждения,
     * а повторные запросы берут начало беседы из кэша.
     */
    public static final class Chat {
        final String model;
        final String system;
        final List<BetaMessageParam> history = new ArrayList<>();
        volatile boolean cancelled;

        public Chat(String model, String aboutUser) {
            this.model = model;
            this.system = Prompts.assistant(aboutUser);
        }

        public int turns() {
            return history.size() / 2;
        }

        /** прервать ответ, который сейчас печатается */
        public void cancel() {
            cancelled = true;
        }
    }

    /** Что ИИ увидел на доске. */
    public static final class BoardRead {
        public final boolean found;
        public final boolean whiteBottom;
        public final String turn;
        public final List<String> rows;

        BoardRead(boolean found, boolean whiteBottom, String turn, List<String> rows) {
            this.found = found;
            this.whiteBottom = whiteBottom;
            this.turn = turn;
            this.rows = rows;
        }
    }

    private final AnthropicClient client;

    public Brain(String apiKey) {
        this(AnthropicOkHttpClient.builder().apiKey(apiKey).maxRetries(2).build());
    }

    /** для тестов — клиент с подставным сервером */
    Brain(AnthropicClient client) {
        this.client = client;
    }

    /* ---------- беседа ---------- */

    /**
     * Задать вопрос в беседе. jpeg — снимок экрана или null, context — строка «что сейчас происходит».
     * Текст ответа по мере прихода отдаётся в listener. Ответ дописывается в историю беседы.
     */
    public String ask(Chat chat, String question, byte[] jpeg, String context, Listener listener) throws Failure {
        List<BetaContentBlockParam> content = new ArrayList<>();
        if (jpeg != null) content.add(image(jpeg));
        String text = (context == null || context.isEmpty() ? "" : context + "\n\n") + question;
        content.add(BetaContentBlockParam.ofText(text));
        chat.cancelled = false;
        chat.history.add(BetaMessageParam.builder()
                .role(BetaMessageParam.Role.USER)
                .contentOfBetaContentBlockParams(content)
                .build());
        try {
            MessageCreateParams params = base(chat.model, chat.system, BetaOutputConfig.Effort.MEDIUM, 16_000)
                    .messages(chat.history)
                    .cacheControl(BetaCacheControlEphemeral.builder().build())
                    .build();
            BetaMessage reply = stream(params, chat, listener);
            String answer = answer(reply);
            chat.history.add(forHistory(reply));
            return answer;
        } catch (Failure | RuntimeException e) {
            // вопрос без ответа в истории не оставляем — следующий вопрос пойдёт как будто этого не было
            chat.history.remove(chat.history.size() - 1);
            if (e instanceof CancellationException) throw new Failure("Остановлено.", e);
            throw e instanceof Failure ? (Failure) e : explain(e);
        }
    }

    /* ---------- разовые запросы ---------- */

    /** Короткий ответ без беседы: подсказка-наблюдение, напоминание о перерыве, объяснение хода. */
    public String once(String model, String system, String text, byte[] jpeg, BetaOutputConfig.Effort effort,
                       long maxTokens) throws Failure {
        List<BetaContentBlockParam> content = new ArrayList<>();
        if (jpeg != null) content.add(image(jpeg));
        content.add(BetaContentBlockParam.ofText(text));
        try {
            BetaMessage reply = client.beta().messages().create(base(model, system, effort, maxTokens)
                    .addUserMessageOfBetaContentBlockParams(content)
                    .build());
            return answer(reply);
        } catch (Failure e) {
            throw e;
        } catch (RuntimeException e) {
            throw explain(e);
        }
    }

    /** Переписать шахматную доску со снимка экрана. previousError — что было не так в прошлой попытке. */
    public BoardRead readBoard(String model, byte[] jpeg, String previousError) throws Failure {
        BetaOutputConfig.Effort effort = previousError == null ? BetaOutputConfig.Effort.LOW : BetaOutputConfig.Effort.MEDIUM;
        try {
            BetaMessage reply = client.beta().messages().create(base(model, Prompts.BOARD_SYSTEM, effort, 8_000)
                    .outputConfig(BetaOutputConfig.builder().effort(effort).format(boardFormat()).build())
                    .addUserMessageOfBetaContentBlockParams(Arrays.asList(image(jpeg),
                            BetaContentBlockParam.ofText(Prompts.board(previousError))))
                    .build());
            return parseBoard(answer(reply));
        } catch (Failure e) {
            throw e;
        } catch (RuntimeException e) {
            throw explain(e);
        }
    }

    static BoardRead parseBoard(String json) throws Failure {
        try {
            JsonNode n = JSON.readTree(json);
            List<String> rows = new ArrayList<>();
            for (JsonNode row : n.path("rows")) rows.add(row.asText());
            return new BoardRead(n.path("found").asBoolean(false), !"black".equals(n.path("bottom").asText()),
                    n.path("turn").asText("unknown"), rows);
        } catch (Exception e) {
            throw new Failure("ИИ ответил непонятно — попробуй ещё раз.", e);
        }
    }

    /* ---------- общее ---------- */

    private static MessageCreateParams.Builder base(String model, String system, BetaOutputConfig.Effort effort, long maxTokens) {
        MessageCreateParams.Builder b = MessageCreateParams.builder()
                .model(model)
                .maxTokens(maxTokens)
                .system(system)
                .outputConfig(BetaOutputConfig.builder().effort(effort).build());
        // у Haiku серверной подстраховки нет; у Opus и Sonnet при отказе классификатора ответит другая модель
        if (!model.startsWith("claude-haiku")) b.addBeta(FALLBACK_BETA).fallbacks(BetaFallbacksParam.ofDefault());
        return b;
    }

    private BetaMessage stream(MessageCreateParams params, Chat chat, Listener listener) {
        BetaMessageAccumulator acc = BetaMessageAccumulator.create();
        StringBuilder text = new StringBuilder();
        try (StreamResponse<BetaRawMessageStreamEvent> s = client.beta().messages().createStreaming(params)) {
            s.stream().forEach(event -> {
                if (chat.cancelled) throw new CancellationException();
                acc.accumulate(event);
                event.contentBlockDelta().flatMap(d -> d.delta().text()).ifPresent(t -> {
                    text.append(t.text());
                    if (listener != null) listener.onText(text.toString());
                });
            });
        }
        return acc.message();
    }

    static BetaContentBlockParam image(byte[] jpeg) {
        return BetaContentBlockParam.ofImage(BetaImageBlockParam.builder()
                .source(BetaBase64ImageSource.builder()
                        .mediaType(BetaBase64ImageSource.MediaType.IMAGE_JPEG)
                        .data(Base64.getEncoder().encodeToString(jpeg))
                        .build())
                .build());
    }

    /** текст ответа; отказ модели — понятная ошибка */
    private static String answer(BetaMessage m) throws Failure {
        BetaStopReason stop = m.stopReason().orElse(null);
        if (BetaStopReason.REFUSAL.equals(stop)) {
            throw new Failure("Claude не стал на это отвечать. Попробуй спросить по-другому.", null);
        }
        StringBuilder s = new StringBuilder();
        for (BetaContentBlock b : m.content()) b.text().ifPresent(t -> s.append(t.text()));
        String text = s.toString().trim();
        if (BetaStopReason.MAX_TOKENS.equals(stop)) text += "…";
        return text;
    }

    /**
     * Ответ для истории беседы. Если по ходу ответа сработала подстраховка и продолжила другая модель,
     * размышления до точки переключения назад не отправляем — так требует API.
     */
    static BetaMessageParam forHistory(BetaMessage m) {
        List<BetaContentBlock> blocks = m.content();
        int lastFallback = -1;
        for (int i = 0; i < blocks.size(); i++) if (blocks.get(i).isFallback()) lastFallback = i;
        if (lastFallback < 0) return m.toParam();
        List<BetaContentBlockParam> kept = new ArrayList<>();
        for (int i = 0; i < blocks.size(); i++) {
            BetaContentBlock b = blocks.get(i);
            if (b.isFallback()) continue;
            if (i < lastFallback && (b.isThinking() || b.isRedactedThinking() || b.isToolUse())) continue;
            kept.add(b.toParam());
        }
        return BetaMessageParam.builder()
                .role(BetaMessageParam.Role.ASSISTANT)
                .contentOfBetaContentBlockParams(kept)
                .build();
    }

    private static BetaJsonOutputFormat boardFormat() {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("found", prop("boolean", null, "есть ли на экране шахматная доска с фигурами"));
        props.put("bottom", prop("string", Arrays.asList("white", "black"), "чьи фигуры играют снизу доски"));
        props.put("turn", prop("string", Arrays.asList("white", "black", "unknown"), "чей ход, если это видно"));
        Map<String, Object> rows = prop("array", null, "8 горизонталей сверху вниз, по 8 клеток слева направо");
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("type", "string");
        rows.put("items", item);
        props.put("rows", rows);
        BetaJsonOutputFormat.Schema schema = BetaJsonOutputFormat.Schema.builder()
                .putAdditionalProperty("type", JsonValue.from("object"))
                .putAdditionalProperty("properties", JsonValue.from(props))
                .putAdditionalProperty("required", JsonValue.from(Arrays.asList("found", "bottom", "turn", "rows")))
                .putAdditionalProperty("additionalProperties", JsonValue.from(false))
                .build();
        return BetaJsonOutputFormat.builder().schema(schema).build();
    }

    private static Map<String, Object> prop(String type, List<String> values, String description) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("type", type);
        if (values != null) p.put("enum", values);
        p.put("description", description);
        return p;
    }

    /** Ошибка SDK → понятная фраза. Порядок — от частного к общему. */
    static Failure explain(Throwable e) {
        if (e instanceof UnauthorizedException) {
            return new Failure("Ключ API не подошёл. Проверь его в настройках Умника.", e);
        }
        if (e instanceof PermissionDeniedException) {
            return new Failure("Этому ключу недоступна выбранная модель. Выбери другую в настройках.", e);
        }
        if (e instanceof NotFoundException) {
            return new Failure("Модель не найдена. Выбери другую в настройках.", e);
        }
        if (e instanceof RateLimitException) {
            return new Failure("Слишком много запросов подряд. Подожди минутку и попробуй снова.", e);
        }
        if (e instanceof InternalServerException) {
            return new Failure("Серверы Claude сейчас перегружены. Попробуй ещё раз чуть позже.", e);
        }
        if (e instanceof AnthropicServiceException) {
            AnthropicServiceException s = (AnthropicServiceException) e;
            String message = errorMessage(s);
            if (ErrorType.BILLING_ERROR.equals(s.errorType().orElse(null)) || message.contains("credit balance")) {
                return new Failure("На счёте Anthropic закончились деньги. Пополни баланс на console.anthropic.com.", e);
            }
            return new Failure("Claude не принял запрос (" + s.statusCode() + "): " + message, e);
        }
        if (e instanceof AnthropicIoException) {
            return new Failure("Нет связи с Claude. Проверь интернет.", e);
        }
        return new Failure("Что-то пошло не так: " + e.getMessage(), e);
    }

    private static String errorMessage(AnthropicServiceException s) {
        try {
            String m = s.body().convert(JsonNode.class).path("error").path("message").asText("");
            if (!m.isEmpty()) return m;
        } catch (Exception ignored) {
            // тело ошибки не JSON — берём текст исключения
        }
        return String.valueOf(s.getMessage());
    }
}
