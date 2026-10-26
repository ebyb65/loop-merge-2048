# Unity Ads loading diagnosis

The screenshot reports successful SDK initialization followed by:

`adMarkup is missing; objectId is missing`

The build installs `capacitor-unity-ads@1.0.0`. Its Android implementation calls
`UnityAds.load(placementId, listener)` directly. It does not run a LevelPlay
auction or supply bidding markup. Unity documents the reported error as a
bidding placement being requested without the required auction parameters.

## Configuration needed before ads can work

In the Unity Monetization dashboard, select the Android app for package
`com.games.drop2048`. Verify the Android Game ID against `800409725` in
`ads-controller.js`, and inspect the mediation partner and placement types for
`Rewarded_Android` and `Interstitial_Android`.

- If the project already has usable **waterfall** placements, confirm their
  exact Android IDs and use those IDs in `ads-controller.js`. Confirm the
  dashboard mediation setup matches the direct SDK integration.
- If the placements are **bidding** placements, the current direct SDK plugin
  cannot load them. The recommended path for Unity-only monetization is a
  **LevelPlay integration with Unity Ads configured as a bidder**. This requires
  a native bridge/SDK change, the LevelPlay Android app key and ad unit IDs,
  and the matching dashboard setup. A LevelPlay app key is not a Unity Game ID;
  its ad unit IDs are not interchangeable with Unity placement IDs.
- Unity's current documentation says new waterfall placements can no longer
  be created. Do not archive existing placements or create a replacement
  Unity project as an attempted workaround.

The next information needed is a screenshot of the Android project's mediation
setting and placement list/types. If migrating to LevelPlay, also supply the
Android app key and rewarded/interstitial ad unit IDs. Do not share passwords,
API secret keys, keystores or signing credentials.

Do not invent `adMarkup` or `objectId`, repeatedly increase delays, or expect
SDK test mode to convert a bidding placement into a waterfall placement.
GitHub access alone does not provide access to the Unity dashboard.

## Changes in this patch

- Uses only the installed plugin's actual methods. Version 1.0.0 has no banner
  API; the previous banner call could not display an ad.
- Shares in-flight initialization and load operations, waits for readiness,
  and honors the configured `testMode` value.
- Grants a reward only when `showRewardedVideo()` returns `success: true`.
  Missing bridge, failed load/show, and skipped videos no longer grant lives
  or clear rows. Concurrent taps cannot claim the same reward twice.
- Reports bidding configuration errors and stops retrying that placement
  until app restart. Other placements can still load.
- Checks native readiness again before each show. The plugin resolves the
  interstitial show promise at show start, so the code does not claim it closed
  or immediately reload it while playing.
- Pins the inspected plugin version and copies the controller into the APK's
  web assets. PR checks run the lifecycle tests without accessing signing secrets.

## Verification

Run `node --test tests/ads-controller.test.cjs` (Node 22). Tests use mocked
native callbacks, not the Unity network, and cannot verify live ad delivery.

After the dashboard/integration mismatch is resolved:

1. Keep `testMode: true` and build/install the Android test APK.
2. Confirm initialization and successful loads for the configured Android IDs.
3. Finish a test rewarded video: gain exactly one life (up to the existing cap),
   or clear the top two rows when using the board revive action.
4. Skip or fail a video: no reward. Tap repeatedly: only one ad/reward attempt.
5. Confirm a second rewarded video loads and that interstitials show during play.
6. Check no-fill/offline behavior without changing the board or blocking play.
7. Before publishing, complete Unity monetization/account requirements, consent
   configuration and physical-device testing. Switch test mode only after that.

This patch fixes the verified app-side bugs. It does not claim to resolve
bidding configuration, migrate to LevelPlay, or prove production ad delivery.

## Sources

- [Unity: troubleshooting bidding placements](https://docs.unity.com/en-us/grow/dashboard/bidding/levelplay)
- [Unity: waterfall transition](https://docs.unity.com/en-us/grow/ads/waterfall-strategy)
- [Installed plugin source](https://github.com/eliazv/capacitor-unity-ads)
