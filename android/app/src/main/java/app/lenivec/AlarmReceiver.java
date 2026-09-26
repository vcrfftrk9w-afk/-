package app.lenivec;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Будильник сработал / нажали «Встал» или «Ещё 5 минут» в уведомлении. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String action = intent.getAction();
        String title = intent.getStringExtra(Alarms.EXTRA_TITLE);
        String text = intent.getStringExtra(Alarms.EXTRA_TEXT);
        if (Alarms.ACTION_FIRE.equals(action)) {
            Alarms.ring(c, title == null ? "⏰ Будильник" : title, text == null ? "" : text);
            Alarms.scheduleAll(c); // этот прозвенел — ставим на следующую неделю
        } else if (Alarms.ACTION_SNOOZE.equals(action)) {
            Alarms.stopRinging(c);
            Alarms.snooze(c, title, text, Alarms.SNOOZE_MIN);
        } else if (Alarms.ACTION_DISMISS.equals(action)) {
            Alarms.stopRinging(c);
        }
    }
}
