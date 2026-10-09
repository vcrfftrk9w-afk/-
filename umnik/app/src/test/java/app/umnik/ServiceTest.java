package app.umnik;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.Intent;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.shadow.api.Shadow;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowLooper;
import org.robolectric.shadows.ShadowWindowManagerImpl;

/** Служба включается, показывает кнопку, узнаёт шахматы, считает время и аккуратно выключается. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class ServiceTest {
    private static int overlays(UmnikService s) {
        WindowManager wm = (WindowManager) s.getSystemService(Context.WINDOW_SERVICE);
        return ((ShadowWindowManagerImpl) Shadow.extract(wm)).getViews().size();
    }

    private static void open(UmnikService s, String pkg) {
        AccessibilityEvent e = new AccessibilityEvent(AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED);
        e.setPackageName(pkg);
        s.onAccessibilityEvent(e);
        ShadowLooper.idleMainLooper();
    }

    @Test
    public void lifecycle() {
        Prefs.of(RuntimeEnvironment.getApplication()).edit().clear().commit();
        UmnikService s = Robolectric.buildService(UmnikService.class).create().get();
        s.onServiceConnected();
        ShadowLooper.idleMainLooper();
        assertSame(s, UmnikService.instance);
        assertEquals("видна одна кнопка", 1, overlays(s));

        open(s, "org.telegram.messenger");
        assertEquals("org.telegram.messenger", s.time.app());
        assertEquals(1, overlays(s));

        open(s, "com.chess");
        assertEquals("в шахматах рядом кнопка ♟", 2, overlays(s));

        open(s, "app.umnik");                        // своё окно не считается приложением
        assertEquals("com.chess", s.time.app());

        UmnikService.sheetVisible(true);
        ShadowLooper.idleMainLooper();
        assertEquals("пока открыто окно помощника — кнопки спрятаны", 0, overlays(s));
        UmnikService.sheetVisible(false);
        ShadowLooper.idleMainLooper();
        assertEquals(2, overlays(s));

        Prefs.put(s, "hidden_until", System.currentTimeMillis() + 60_000L);
        ShadowLooper.idleMainLooper();
        assertEquals("долгое нажатие прячет кнопку", 0, overlays(s));
        Prefs.put(s, "hidden_until", 0L);
        ShadowLooper.idleMainLooper();
        assertEquals(2, overlays(s));

        s.sendBroadcast(new Intent(Intent.ACTION_SCREEN_OFF));
        ShadowLooper.idleMainLooper();
        assertEquals("экран погас — кнопки нет", 0, overlays(s));
        s.sendBroadcast(new Intent(Intent.ACTION_SCREEN_ON));
        ShadowLooper.idleMainLooper();
        assertEquals(2, overlays(s));

        assertTrue(UmnikService.statsText(s).startsWith("Сегодня в телефоне:"));
        s.onUnbind(new Intent());
        ShadowLooper.idleMainLooper();
        assertNull(UmnikService.instance);
        assertEquals(0, overlays(s));
    }
}
