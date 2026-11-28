package com.yebee.agesignals;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.agesignals.AgeSignalsException;
import com.google.android.play.agesignals.AgeSignalsManager;
import com.google.android.play.agesignals.AgeSignalsManagerFactory;
import com.google.android.play.agesignals.AgeSignalsRequest;
import com.google.android.play.agesignals.AgeSignalsResult;

/**
 * Asks Google Play for the player's age signal (Play Age Signals API 0.0.6), as California AB 1043 requires
 * from 1 Jan 2027. The game only uses it to decide whether ads must be child-directed / non-personalized;
 * nothing is stored or sent anywhere by this plugin.
 *
 * check() resolves { ok: true, ageLower, ageUpper, ageRangeSource, significantChangeStatus } (each an int or
 * null; both ages null = Play has no age for this user) or, on any API error, { ok: false, error, errorCode }.
 * It never rejects, so the game keeps today's behaviour when Play can't answer.
 * 0.0.6 dropped 0.0.3's userStatus(); the age range is the signal (ageUpper null = 18 or over).
 */
@CapacitorPlugin(name = "PlayAgeSignals")
public class PlayAgeSignalsPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        try {
            AgeSignalsManager manager = AgeSignalsManagerFactory.create(getContext().getApplicationContext());
            manager
                .checkAgeSignals(AgeSignalsRequest.builder().build())
                .addOnSuccessListener(result -> call.resolve(toJs(result)))
                .addOnFailureListener(e -> call.resolve(failure(e)));
        } catch (Throwable t) {
            call.resolve(failure(t));
        }
    }

    private static Object num(Integer v) {
        return v == null ? JSObject.NULL : (Object) v;
    }

    private static JSObject toJs(AgeSignalsResult r) {
        JSObject o = new JSObject();
        o.put("ok", true);
        o.put("ageLower", r == null ? JSObject.NULL : num(r.ageLower()));
        o.put("ageUpper", r == null ? JSObject.NULL : num(r.ageUpper()));
        o.put("ageRangeSource", r == null ? JSObject.NULL : num(r.ageRangeSource()));
        o.put("significantChangeStatus", r == null ? JSObject.NULL : num(r.significantChangeStatus()));
        return o;
    }

    private static JSObject failure(Throwable e) {
        JSObject o = new JSObject();
        o.put("ok", false);
        o.put("error", e == null ? "unknown" : (e.getClass().getSimpleName() + ": " + e.getMessage()));
        if (e instanceof AgeSignalsException) o.put("errorCode", ((AgeSignalsException) e).getErrorCode());
        return o;
    }
}
