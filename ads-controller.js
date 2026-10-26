// capacitor-unity-ads 1.0.0: direct Unity Ads, not LevelPlay mediation.
// Bidding placements require a mediator; see docs/UNITY_ADS_SETUP.md.
const UnityAdsManager = {
  gameId: '800409725',
  testMode: true,
  interstitialId: 'Interstitial_Android',
  rewardedId: 'Rewarded_Android',
  initialized: false,
  initialization: null,
  loads: {},
  configurationErrors: new Set(),
  rewardInProgress: false,
  timerInterval: null,
  continuousSeconds: 0,

  getPlugin() {
    const capacitor = window.Capacitor;
    if (!capacitor || (capacitor.isNativePlatform && !capacitor.isNativePlatform())) return null;
    return capacitor.Plugins && capacitor.Plugins.Unityads;
  },

  reportError(context, error, placementId) {
    const message = error && error.message ? error.message : String(error);
    logToScreen(context + ': ' + message);
    if (/adMarkup.*missing|objectId.*missing/i.test(message)) {
      if (placementId) this.configurationErrors.add(placementId);
      logToScreen('CONFIGURATION: bidding placement requested through the direct Unity Ads SDK. ' +
        'Use an existing waterfall placement, or integrate LevelPlay and configure Unity Ads bidding. ' +
        'Delays and fabricated adMarkup/objectId values cannot fix this. See docs/UNITY_ADS_SETUP.md.');
    }
  },

  async init() {
    if (this.initialized) return true;
    if (this.initialization) return this.initialization;
    const plugin = this.getPlugin();
    if (!plugin) {
      logToScreen('Unity Ads is unavailable outside the native Android app.');
      return false;
    }
    this.initialization = (async () => {
      try {
        logToScreen('Initializing Unity SDK (testMode=' + this.testMode + ')...');
        await plugin.initialize({ gameId: this.gameId, testMode: this.testMode });
        this.initialized = true;
        logToScreen('Unity SDK initialized. Loading ads...');
        // This plugin has no banner API. Do not probe Capacitor proxies for methods.
        void this.preloadAds();
        return true;
      } catch (error) {
        this.reportError('Unity initialization failed', error);
        return false;
      } finally {
        this.initialization = null;
      }
    })();
    return this.initialization;
  },

  async loadAd(kind) {
    const plugin = this.getPlugin();
    const placementId = kind === 'rewarded' ? this.rewardedId : this.interstitialId;
    if (!plugin || !this.initialized || this.configurationErrors.has(placementId)) return false;
    if (this.loads[kind]) return this.loads[kind];
    this.loads[kind] = (async () => {
      try {
        const status = kind === 'rewarded'
          ? await plugin.isRewardedVideoLoaded()
          : await plugin.isInterstitialLoaded();
        if (status.loaded) return true;
        logToScreen('Loading: ' + placementId);
        if (kind === 'rewarded') await plugin.loadRewardedVideo({ placementId });
        else await plugin.loadInterstitial({ placementId });
        logToScreen('Ready: ' + placementId);
        return true;
      } catch (error) {
        this.reportError('Failed to load ' + placementId, error, placementId);
        return false;
      } finally {
        delete this.loads[kind];
      }
    })();
    return this.loads[kind];
  },

  async preloadAds() {
    // Load formats independently so a rewarded failure cannot block interstitials.
    await Promise.all([this.loadAd('rewarded'), this.loadAd('interstitial')]);
  },

  async showInterstitial() {
    if (this.rewardInProgress || !(await this.init())) return;
    if (!(await this.loadAd('interstitial'))) return;
    try {
      await this.getPlugin().showInterstitial();
      // This plugin resolves on SHOW START, not close. Reload on the next
      // scheduled request, after querying the native loaded state.
      logToScreen('Interstitial started.');
    } catch (error) {
      this.reportError('Interstitial failed', error, this.interstitialId);
    }
  },

  async showRewarded(onSuccess) {
    if (this.rewardInProgress) return;
    this.rewardInProgress = true;
    try {
      if (!(await this.init()) || !(await this.loadAd('rewarded'))) {
        window.alert('No ad is available right now. Please try again later.');
        return;
      }
      const result = await this.getPlugin().showRewardedVideo();
      // Native plugin returns success:false for a skipped/incomplete video.
      if (result && result.success === true) {
        logToScreen('Rewarded video completed.');
        onSuccess();
      } else {
        logToScreen('Video closed without completion; no reward granted.');
      }
      // The next request queries native readiness and loads a fresh ad if needed.
    } catch (error) {
      this.reportError('Rewarded video failed', error, this.rewardedId);
      window.alert('The ad could not play. Please try again later.');
    } finally {
      this.rewardInProgress = false;
    }
  },

  startLoopTimer() {
    clearInterval(this.timerInterval);
    this.continuousSeconds = 0;
    this.timerInterval = setInterval(() => {
      this.continuousSeconds++;
      if (this.continuousSeconds === 132) {
        const toast = document.getElementById('ad-toast');
        if (toast) toast.style.display = 'block';
      }
      if (this.continuousSeconds >= 135) {
        this.continuousSeconds = 0;
        const toast = document.getElementById('ad-toast');
        if (toast) toast.style.display = 'none';
        void this.showInterstitial();
      }
    }, 1000);
  },

  pauseLoopTimer() {
    clearInterval(this.timerInterval);
  }
};
