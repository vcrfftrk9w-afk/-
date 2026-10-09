package app.umnik.chess;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.Arrays;
import java.util.List;

import org.junit.Test;

public class ChessTest {
    private static final String START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    private static final String KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

    /** число всех ходов на глубину d — эталон для проверки правил (рокировки, на проходе, превращения) */
    private static long perft(Board b, int d, boolean checkHash) {
        if (checkHash) assertEquals("хэш разошёлся в " + b.fen(), b.computeHash(), b.hash);
        if (d == 0) return 1;
        int[] moves = new int[256];
        int n = b.pseudo(moves, false);
        long total = 0;
        for (int i = 0; i < n; i++) {
            b.make(moves[i]);
            if (!b.leftKingInCheck()) total += perft(b, d - 1, checkHash);
            b.unmake(moves[i]);
        }
        return total;
    }

    private static void perftIs(String fen, long... expected) {
        Board b = Board.fromFen(fen);
        for (int d = 1; d <= expected.length; d++) {
            assertEquals(fen + " глубина " + d, expected[d - 1], perft(b, d, false));
            assertEquals("позиция испортилась после перебора", fen, b.fen());
        }
    }

    @Test
    public void perftStart() {
        perftIs(START, 20, 400, 8902, 197281, 4865609);
    }

    @Test
    public void perftKiwipete() {
        perftIs(KIWIPETE, 48, 2039, 97862, 4085603);
    }

    @Test
    public void perftEndgameAndPromotions() {
        perftIs("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 14, 191, 2812, 43238, 674624);
        perftIs("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", 6, 264, 9467, 422333);
        perftIs("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", 44, 1486, 62379, 2103487);
        perftIs("r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", 46, 2079, 89890, 3894594);
    }

    @Test
    public void hashFollowsMoves() {
        perft(Board.fromFen(KIWIPETE), 3, true);
        perft(Board.fromFen("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8"), 3, true);
    }

    @Test
    public void fenRoundTrip() {
        for (String fen : new String[]{START, KIWIPETE, "8/8/8/3pP3/8/8/8/4K2k w - d6 0 3"}) {
            assertEquals(fen, Board.fromFen(fen).fen());
        }
    }

    @Test
    public void sanInBothLanguages() {
        Board b = Board.fromFen(START);
        assertEquals("Nf3", b.san(b.parseUci("g1f3"), false));
        assertEquals("Кf3", b.san(b.parseUci("g1f3"), true));
        assertEquals("e4", b.san(b.parseUci("e2e4"), true));

        Board castle = Board.fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
        assertEquals("O-O", castle.san(castle.parseUci("e1g1"), false));
        assertEquals("O-O-O", castle.san(castle.parseUci("e1c1"), false));

        Board twoKnights = Board.fromFen("4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1");
        assertEquals("Nbd2", twoKnights.san(twoKnights.parseUci("b1d2"), false));

        Board promo = Board.fromFen("8/4P2k/8/8/8/8/8/4K3 w - - 0 1");
        assertEquals("e8=Q", promo.san(promo.parseUci("e7e8q"), false));
        assertEquals("e8=Ф", promo.san(promo.parseUci("e7e8q"), true));
    }

    @Test
    public void findsMateInOne() {
        Board b = Board.fromFen("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4");
        Engine.Result r = new Engine().think(b, 2000);
        assertEquals("h5f7", Board.uci(r.move));
        assertEquals(1, r.mateIn());
        assertEquals("Фxf7#", b.san(r.move, true));

        Board back = Board.fromFen("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1");
        assertEquals("d1d8", Board.uci(new Engine().think(back, 2000).move));
    }

    @Test
    public void findsMateInTwo() {
        Board b = Board.fromFen("r1b2k1r/ppp1bppp/8/1B1Q4/5q2/2P5/PPP2PPP/R3R1K1 w - - 1 1");
        Engine.Result r = new Engine().think(b, 3000);
        assertEquals(2, r.mateIn());
        assertEquals("d5d8", Board.uci(r.move));
    }

    @Test
    public void takesHangingQueen() {
        // чёрный ферзь d4 никем не защищён, конь f3 его бьёт
        Board b = Board.fromFen("rnb1kbnr/pppp1ppp/8/8/3qP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1");
        assertEquals("f3d4", Board.uci(new Engine().think(b, 1500).move));
    }

    @Test
    public void engineIsQuickAndDeep() {
        Board b = Board.fromFen(KIWIPETE);
        long t = System.currentTimeMillis();
        Engine.Result r = new Engine().think(b, 1000);
        long spent = System.currentTimeMillis() - t;
        assertTrue("думал слишком долго: " + spent, spent < 1600);
        assertTrue("слишком мелко: " + r.depth, r.depth >= 5);
        assertEquals("позиция испортилась после поиска", KIWIPETE, b.fen());
        System.out.println("kiwipete: " + Board.uci(r.move) + " глубина " + r.depth + ", позиций " + r.nodes + ", оценка " + r.score);
    }

    @Test
    public void readsBoardWithWhiteBelow() {
        List<String> rows = Arrays.asList("rnbqkbnr", "pppppppp", "........", "........",
                "........", "........", "PPPPPPPP", "RNBQKBNR");
        assertEquals("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", Position.placement(rows, true));
    }

    @Test
    public void readsBoardWithBlackBelow() {
        // доска перевёрнута: сверху 1-я горизонталь, слева направо h…a
        List<String> rows = Arrays.asList("RNBKQBNR", "PPPPPPPP", "8", "........",
                ". . . . . . . .", "........", "pppppppp", "rnbkqbnr");
        assertEquals("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", Position.placement(rows, false));
    }

    @Test
    public void rejectsBrokenBoards() {
        List<String> noKing = Arrays.asList("rnbq.bnr", "pppppppp", "........", "........",
                "........", "........", "PPPPPPPP", "RNBQKBNR");
        List<String> pawnOnEdge = Arrays.asList("rnbqkbnP", "pppppppp", "........", "........",
                "........", "........", "PPPPPPP.", "RNBQKBNR");
        List<String> shortRow = Arrays.asList("rnbqkbnr", "ppppppp", "........", "........",
                "........", "........", "PPPPPPPP", "RNBQKBNR");
        for (List<String> rows : Arrays.asList(noKing, pawnOnEdge, shortRow)) {
            try {
                Position.placement(rows, true);
                fail("должно не пройти проверку: " + rows);
            } catch (IllegalArgumentException expected) {
                // ок
            }
        }
    }

    @Test
    public void castlingRightsGuessedFromBoard() {
        assertEquals(START, Position.build("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", true).fen());
        assertEquals("4k3/8/8/8/8/8/8/R3K3 b Q - 0 1", Position.build("4k3/8/8/8/8/8/8/R3K3", false).fen());
    }

    @Test
    public void hintSpeaksRussian() {
        List<String> rows = Arrays.asList("rnbqkbnr", "pppppppp", "........", "........",
                "........", "........", "PPPPPPPP", "RNBQKBNR");
        Hint h = Hint.analyze(rows, true, "unknown", 800);
        assertTrue(h.headline, h.headline.startsWith("Ход белых: "));
        assertTrue(h.details, h.details.contains("—"));
        System.out.println(h.headline + " | " + h.details.replace('\n', ' '));
    }

    @Test
    public void hintFixesWhoseTurnByCheck() {
        // чёрный король под шахом от ферзя, а «ход белых» — так не бывает, значит ходят чёрные
        List<String> rows = Arrays.asList("....k...", "........", "........", "........",
                "........", "........", "....Q...", "....K...");
        Hint h = Hint.analyze(rows, true, "white", 500);
        assertTrue(h.headline, h.headline.startsWith("Ход чёрных"));
    }

    @Test
    public void hintDescribesCapturesAndMate() {
        Board b = Board.fromFen("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4");
        Hint h = Hint.analyze(b, true, 1500);
        assertEquals("Ход белых: Ферзь h5 бьёт пешку на f7 — мат!", h.headline);
        assertTrue(h.details, h.details.contains("мат в 1 ход!"));
    }

    @Test
    public void russianPlurals() {
        assertEquals("ход", Hint.plural(1, "ход", "хода", "ходов"));
        assertEquals("хода", Hint.plural(3, "ход", "хода", "ходов"));
        assertEquals("ходов", Hint.plural(5, "ход", "хода", "ходов"));
        assertEquals("ходов", Hint.plural(12, "ход", "хода", "ходов"));
        assertEquals("ход", Hint.plural(21, "ход", "хода", "ходов"));
    }
}
