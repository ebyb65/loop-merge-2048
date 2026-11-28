# Play Age Signals in Drop 2048 (age-api)

Why: California AB 1043 and Google's Play Age Signals rule (California and Brazil, from January 2027). Full reading by Theo: arrow-cube-3d `docs/compliance/2026-11-24-age-signals.md`. Not legal advice.

What the game does (same as Arrow Cube 1.0.15):
- Local Capacitor plugin `plugins/play-age-signals` (Play Age Signals `com.google.android.play:age-signals:0.0.6`), installed by `build.yml`. The build fails if it isn't registered.
- `ads-controller.js` asks Play on every launch, before LevelPlay starts (4 s timeout, one retry on a Play error).
- Age range under 18 (or an open range starting under 18): LevelPlay gets `coppa: true` and `ccpaDoNotSell: true` (capacitor-levelplay 0.3.0 PrivacySettings). No range, an error or a timeout: today's behaviour (`gdprConsent: false` only).
- The same ads show either way; only personalization changes. No gameplay change. The age is not stored or sent anywhere.

Tests: `node --test tests/ads-controller.test.cjs` covers each age range, no plugin, retry, timeout and a throwing plugin.

Release: built on branch `arjun/age-signals` as 1.2.1 (code 15). Merge into develop only after 1.2.0 (code 14) is live, so the 1.2.0 release build stays unchanged.
