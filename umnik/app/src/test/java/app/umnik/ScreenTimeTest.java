package app.umnik;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Calendar;

import org.junit.Test;

public class ScreenTimeTest {
    private static final long MIN = 60_000L;

    private static long at(int hour, int minute) {
        Calendar c = Calendar.getInstance();
        c.set(2026, Calendar.OCTOBER, 9, hour, minute, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    @Test
    public void countsAppsAndSession() {
        ScreenTime st = new ScreenTime();
        long t = at(14, 0);
        st.screenOn(t);
        st.app("org.telegram.messenger", t);
        st.tick(t + 10 * MIN);
        st.app("com.zhiliaoapp.musically", t + 10 * MIN);
        st.tick(t + 35 * MIN);
        assertEquals(10 * MIN, st.of("org.telegram.messenger"));
        assertEquals(25 * MIN, st.of("com.zhiliaoapp.musically"));
        assertEquals(35 * MIN, st.total());
        assertEquals(35 * MIN, st.session(t + 35 * MIN));
        assertEquals("com.zhiliaoapp.musically", st.top(1).get(0).getKey());
    }

    @Test
    public void shortScreenOffIsNotABreak() {
        ScreenTime st = new ScreenTime();
        long t = at(14, 0);
        st.screenOn(t);
        st.app("a", t);
        st.screenOff(t + 20 * MIN);
        st.screenOn(t + 21 * MIN);                   // минута с погасшим экраном
        assertEquals(22 * MIN, st.session(t + 22 * MIN));
        st.screenOff(t + 30 * MIN);
        assertEquals(0, st.session(t + 31 * MIN));
        st.screenOn(t + 40 * MIN);                   // 10 минут без экрана — это перерыв
        assertEquals(MIN, st.session(t + 41 * MIN));
        // пока экран не горел, время приложению не шло
        assertEquals(29 * MIN, st.of("a"));
    }

    @Test
    public void remindsAtThresholdThenEveryQuarterHour() {
        ScreenTime st = new ScreenTime();
        long t = at(15, 0);
        st.screenOn(t);
        assertFalse(st.breakDue(t + 44 * MIN, 45));
        assertTrue(st.breakDue(t + 45 * MIN, 45));
        assertFalse(st.breakDue(t + 50 * MIN, 45));
        assertTrue(st.breakDue(t + 60 * MIN, 45));
        assertFalse(st.breakDue(t + 61 * MIN, 0));
        // перерыв сбрасывает счёт
        st.screenOff(t + 61 * MIN);
        st.screenOn(t + 70 * MIN);
        assertFalse(st.breakDue(t + 100 * MIN, 45));
        assertTrue(st.breakDue(t + 115 * MIN, 45));
    }

    @Test
    public void nightReminderOncePerNight() {
        ScreenTime st = new ScreenTime();
        long t = at(23, 10);
        st.screenOn(t);
        assertFalse("ещё мало сидит", st.nightDue(t + 5 * MIN));
        assertTrue(st.nightDue(t + 12 * MIN));
        assertFalse(st.nightDue(t + 40 * MIN));
        assertFalse("после полуночи — та же ночь", st.nightDue(at(23, 59) + 30 * MIN));
        ScreenTime day = new ScreenTime();
        day.screenOn(at(13, 0));
        assertFalse(day.nightDue(at(13, 0) + 60 * MIN));
    }

    @Test
    public void formatsDurations() {
        assertEquals("меньше минуты", ScreenTime.format(30_000));
        assertEquals("40 мин", ScreenTime.format(40 * MIN));
        assertEquals("1 ч 5 мин", ScreenTime.format(65 * MIN));
        assertEquals("2 ч", ScreenTime.format(120 * MIN));
    }
}
