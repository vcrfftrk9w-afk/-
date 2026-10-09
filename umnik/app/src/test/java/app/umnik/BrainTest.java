package app.umnik;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.beta.messages.BetaOutputConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/** Brain против подставного сервера: что уходит в API и как разбираются ответы. */
public class BrainTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x01, 0x02};

    private MockWebServer server;
    private final List<JsonNode> requests = new ArrayList<>();
    private final List<String> betaHeaders = new ArrayList<>();
    private Brain brain;

    @Before
    public void start() throws Exception {
        server = new MockWebServer();
        server.start();
        brain = new Brain(AnthropicOkHttpClient.builder()
                .apiKey("sk-ant-test")
                .baseUrl(server.url("/").toString())
                .maxRetries(0)
                .build(), Brain.OPUS);
    }

    @After
    public void stop() throws Exception {
        server.shutdown();
    }

    private void reply(int code, String contentType, String body) {
        server.enqueue(new MockResponse().setResponseCode(code).addHeader("Content-Type", contentType).setBody(body));
    }

    /** запросы, которые дошли до сервера к этому моменту */
    private void collect() throws Exception {
        while (server.getRequestCount() > requests.size()) {
            RecordedRequest r = server.takeRequest();
            requests.add(JSON.readTree(r.getBody().readUtf8()));
            betaHeaders.add(String.valueOf(r.getHeader("anthropic-beta")));
        }
    }

    private static String sse(String... events) {
        StringBuilder s = new StringBuilder();
        for (String e : events) {
            String type = e.replaceAll(".*?\"type\":\"([a-z_]+)\".*", "$1");
            s.append("event: ").append(type).append("\ndata: ").append(e).append("\n\n");
        }
        return s.toString();
    }

    private static String streamed(String model, String... blocks) {
        List<String> ev = new ArrayList<>();
        ev.add("{\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\""
                + model + "\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":10,\"output_tokens\":1}}}");
        ev.addAll(Arrays.asList(blocks));
        ev.add("{\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":7}}");
        ev.add("{\"type\":\"message_stop\"}");
        return sse(ev.toArray(new String[0]));
    }

    private static String[] thinkingBlock(int index, String signature) {
        return new String[]{
                "{\"type\":\"content_block_start\",\"index\":" + index + ",\"content_block\":{\"type\":\"thinking\",\"thinking\":\"\",\"signature\":\"\"}}",
                "{\"type\":\"content_block_delta\",\"index\":" + index + ",\"delta\":{\"type\":\"signature_delta\",\"signature\":\"" + signature + "\"}}",
                "{\"type\":\"content_block_stop\",\"index\":" + index + "}"};
    }

    private static String[] textBlock(int index, String... parts) {
        List<String> ev = new ArrayList<>();
        ev.add("{\"type\":\"content_block_start\",\"index\":" + index + ",\"content_block\":{\"type\":\"text\",\"text\":\"\"}}");
        for (String p : parts) {
            ev.add("{\"type\":\"content_block_delta\",\"index\":" + index + ",\"delta\":{\"type\":\"text_delta\",\"text\":\"" + p + "\"}}");
        }
        ev.add("{\"type\":\"content_block_stop\",\"index\":" + index + "}");
        return ev.toArray(new String[0]);
    }

    private static String[] concat(String[]... parts) {
        List<String> all = new ArrayList<>();
        for (String[] p : parts) all.addAll(Arrays.asList(p));
        return all.toArray(new String[0]);
    }

    private static String message(String model, String stopReason, String text) {
        return "{\"id\":\"msg_2\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"" + model + "\",\"content\":[{\"type\":\"text\",\"text\":"
                + quote(text) + "}],\"stop_reason\":\"" + stopReason + "\",\"stop_sequence\":null,\"usage\":{\"input_tokens\":5,\"output_tokens\":5}}";
    }

    private static String quote(String s) {
        try {
            return JSON.writeValueAsString(s);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    public void chatStreamsAndKeepsHistoryAppendOnly() throws Exception {
        reply(200, "text/event-stream", streamed(Brain.OPUS, concat(thinkingBlock(0, "sig-1"), textBlock(1, "При", "вет", "!"))));
        reply(200, "text/event-stream", streamed(Brain.OPUS, textBlock(0, "Второй ответ")));

        Brain.Chat chat = new Brain.Chat(Brain.OPUS, "учусь в 9 классе");
        List<String> seen = new ArrayList<>();
        String first = brain.ask(chat, "Что на экране?", JPEG, "Открыто «Шахматы»", seen::add);
        assertEquals("Привет!", first);
        assertEquals(Arrays.asList("При", "Привет", "Привет!"), seen);
        assertEquals(1, chat.turns());

        collect();
        JsonNode r = requests.get(0);
        assertEquals(Brain.OPUS, r.path("model").asText());
        assertTrue(r.path("stream").asBoolean());
        assertEquals("default", r.path("fallbacks").asText());
        assertTrue(betaHeaders.get(0), betaHeaders.get(0).contains("server-side-fallback-2026-07-01"));
        assertEquals("medium", r.path("output_config").path("effort").asText());
        assertEquals("ephemeral", r.path("cache_control").path("type").asText());
        assertTrue(r.path("system").asText().contains("учусь в 9 классе"));
        assertFalse("thinking не задаём — у этих моделей он адаптивный сам", r.has("thinking"));
        JsonNode content = r.path("messages").get(0).path("content");
        assertEquals("image", content.get(0).path("type").asText());
        assertEquals("image/jpeg", content.get(0).path("source").path("media_type").asText());
        assertEquals("/9j/AQI=", content.get(0).path("source").path("data").asText());
        assertEquals("Открыто «Шахматы»\n\nЧто на экране?", content.get(1).path("text").asText());

        assertEquals("Второй ответ", brain.ask(chat, "А дальше?", null, "", null));
        collect();
        JsonNode second = requests.get(1).path("messages");
        assertEquals(3, second.size());
        // первый вопрос и ответ ушли без изменений, вместе с подписью размышления
        assertEquals(r.path("messages").get(0), second.get(0));
        assertEquals("thinking", second.get(1).path("content").get(0).path("type").asText());
        assertEquals("sig-1", second.get(1).path("content").get(0).path("signature").asText());
        assertEquals("Привет!", second.get(1).path("content").get(1).path("text").asText());
        assertEquals("А дальше?", second.get(2).path("content").get(0).path("text").asText());
        assertEquals(2, chat.turns());
    }

    @Test
    public void fallbackMidAnswerDropsEarlierThinking() throws Exception {
        String fallback0 = "{\"type\":\"content_block_start\",\"index\":2,\"content_block\":{\"type\":\"fallback\",\"from\":{\"model\":\"claude-opus-5-5\"},\"to\":{\"model\":\"claude-opus-5\"}}}";
        String fallback1 = "{\"type\":\"content_block_stop\",\"index\":2}";
        reply(200, "text/event-stream", streamed("claude-opus-5", concat(thinkingBlock(0, "sig-a"), textBlock(1, "Нача"),
                new String[]{fallback0, fallback1}, thinkingBlock(3, "sig-b"), textBlock(4, "ло"))));
        reply(200, "text/event-stream", streamed("claude-opus-5", textBlock(0, "ok")));

        Brain.Chat chat = new Brain.Chat(Brain.OPUS, "");
        assertEquals("Начало", brain.ask(chat, "вопрос", null, "", null));
        brain.ask(chat, "ещё", null, "", null);
        collect();
        JsonNode assistant = requests.get(1).path("messages").get(1).path("content");
        List<String> types = new ArrayList<>();
        for (JsonNode b : assistant) types.add(b.path("type").asText());
        // размышление до переключения и сам маркер выброшены, после — сохранены
        assertEquals(Arrays.asList("text", "thinking", "text"), types);
        assertEquals("sig-b", assistant.get(1).path("signature").asText());
    }

    @Test
    public void readsBoardWithStructuredOutput() throws Exception {
        String board = "{\"found\":true,\"bottom\":\"black\",\"turn\":\"unknown\",\"rows\":[\"RNBKQBNR\",\"PPPPPPPP\",\"........\",\"........\",\"........\",\"........\",\"pppppppp\",\"rnbkqbnr\"]}";
        reply(200, "application/json", message(Brain.HAIKU, "end_turn", board));
        Brain.BoardRead read = brain.readBoard(Brain.HAIKU, JPEG, null);
        assertTrue(read.found);
        assertFalse(read.whiteBottom);
        assertEquals("unknown", read.turn);
        assertEquals(8, read.rows.size());

        collect();
        JsonNode r = requests.get(0);
        assertEquals("low", r.path("output_config").path("effort").asText());
        JsonNode schema = r.path("output_config").path("format").path("schema");
        assertEquals("json_schema", r.path("output_config").path("format").path("type").asText());
        assertEquals("object", schema.path("type").asText());
        assertEquals(4, schema.path("required").size());
        assertFalse(schema.path("additionalProperties").asBoolean(true));
        assertFalse("у Haiku серверной подстраховки нет", r.has("fallbacks"));
        assertEquals("image", r.path("messages").get(0).path("content").get(0).path("type").asText());
    }

    @Test
    public void secondBoardAttemptIsCareful() throws Exception {
        reply(200, "application/json", message(Brain.SONNET, "end_turn", "{\"found\":false,\"bottom\":\"white\",\"turn\":\"unknown\",\"rows\":[]}"));
        Brain.BoardRead read = brain.readBoard(Brain.SONNET, JPEG, "не нашёл обоих королей");
        assertFalse(read.found);
        collect();
        JsonNode r = requests.get(0);
        assertEquals("medium", r.path("output_config").path("effort").asText());
        assertEquals("default", r.path("fallbacks").asText());
        assertTrue(r.path("messages").get(0).path("content").get(1).path("text").asText().contains("не нашёл обоих королей"));
    }

    @Test
    public void onceSendsTextOnly() throws Exception {
        reply(200, "application/json", message(Brain.OPUS, "end_turn", "SKIP"));
        assertEquals("SKIP", brain.once(Brain.OPUS, Prompts.WATCH, "Открыт браузер", null, BetaOutputConfig.Effort.LOW, 2000));
        collect();
        JsonNode r = requests.get(0);
        assertEquals(1, r.path("messages").get(0).path("content").size());
        assertEquals(2000, r.path("max_tokens").asInt());
        assertTrue(r.path("system").asText().contains("SKIP"));
    }

    @Test
    public void refusalBecomesFriendlyErrorAndLeavesNoTrace() {
        reply(200, "text/event-stream", sse(
                "{\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-opus-5-5\",\"content\":[],\"stop_reason\":null,\"stop_sequence\":null,\"usage\":{\"input_tokens\":10,\"output_tokens\":0}}}",
                "{\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"refusal\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":0}}",
                "{\"type\":\"message_stop\"}"));
        Brain.Chat chat = new Brain.Chat(Brain.OPUS, "");
        try {
            brain.ask(chat, "что-то", null, "", null);
            fail("ожидали отказ");
        } catch (Brain.Failure e) {
            assertTrue(e.getMessage(), e.getMessage().contains("не стал"));
        }
        assertEquals(0, chat.history.size());
    }

    @Test
    public void errorsAreExplainedInRussian() {
        String[][] cases = {
                {"401", "{\"type\":\"error\",\"error\":{\"type\":\"authentication_error\",\"message\":\"invalid x-api-key\"}}", "Ключ API не подошёл"},
                {"400", "{\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"Your credit balance is too low to access the Anthropic API.\"}}", "закончились деньги"},
                {"429", "{\"type\":\"error\",\"error\":{\"type\":\"rate_limit_error\",\"message\":\"slow down\"}}", "Слишком много запросов"},
                {"529", "{\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}", "перегружены"},
                {"404", "{\"type\":\"error\",\"error\":{\"type\":\"not_found_error\",\"message\":\"model: nope\"}}", "Модель не найдена"},
                {"400", "{\"type\":\"error\",\"error\":{\"type\":\"invalid_request_error\",\"message\":\"messages: bad\"}}", "messages: bad"},
        };
        for (String[] c : cases) {
            reply(Integer.parseInt(c[0]), "application/json", c[1]);
            try {
                brain.once(Brain.OPUS, "s", "t", null, BetaOutputConfig.Effort.LOW, 100);
                fail("ожидали ошибку " + c[0]);
            } catch (Brain.Failure e) {
                assertTrue(c[0] + ": " + e.getMessage(), e.getMessage().contains(c[2]));
            }
        }
    }

    @Test
    public void noNetworkIsExplained() {
        Brain offline = new Brain(AnthropicOkHttpClient.builder().apiKey("k").baseUrl("http://127.0.0.1:9").maxRetries(0).build(), Brain.OPUS);
        try {
            offline.once(Brain.OPUS, "s", "t", null, BetaOutputConfig.Effort.LOW, 100);
            fail("ожидали ошибку сети");
        } catch (Brain.Failure e) {
            assertTrue(e.getMessage(), e.getMessage().contains("Нет связи"));
        }
    }
}
