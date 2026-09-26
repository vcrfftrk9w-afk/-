package app.lenivec;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** После перезагрузки, смены времени или обновления приложения будильники нужно поставить заново. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        Alarms.scheduleAll(c);
    }
}
