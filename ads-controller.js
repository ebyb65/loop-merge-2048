// LevelPlay app key and ad unit IDs are public SDK identifiers, not API secrets.
const UnityAdsManager = {
  appKey: '290617fe5',
  rewardedId: '8a5kdqc4fvthlejd',
  interstitialId: 'hyu8d966nd6iuv9n',
  initialized: false,
  initialization: null,
  listenersRegistered: false,
  pendingLoads: {},
  fullscreenBusy: false,
  timerInterval: null,
  continuousSeconds: 0,
  loadTimeoutMs: 30000,

  getPlugin() {
    const capacitor = window.Capacitor;
    if (!capacitor || (capacitor.isNativePlatform && !capacitor.isNativePlatform())) return null;
    return capacitor.Plugins && capacitor.Plugins.LevelPlay;
  },

  reportError(context, error) {
    const message = error && error.message ? error.message : String(error);
    logToScreen(context + ': ' + message);
  },

  async init() {
    if (this.initialized) return true;
    if (this.initialization) return this.initialization;
    const plugin = this.getPlugin();
    if (!plugin) {
      logToScreen('LevelPlay is unavailable outside the native Android app.');
      return false;
    }
    this.initialization = (async () => {
      try {
        // Load methods only start a request: readiness arrives through these events.
        if (!this.listenersRegistered) {
          await plugin.addListener('loaded', e => this.finishLoad(e, true));
          await plugin.addListener('loadFailed', e => this.finishLoad(e, false));
          this.listenersRegistered = true;
        }
        // Until a consent manager exists, do not signal consent to personalized ads.
        await plugin.initialize({ appKey: this.appKey, consent: { gdprConsent: false } });
        this.initialized = true;
        logToScreen('LevelPlay initialized. Loading ads...');
        void this.preloadAds();
        return true;
      } catch (error) {
        this.reportError('LevelPlay initialization failed', error);
        return false;
      } finally {
        this.initialization = null;
      }
    })();
    return this.initialization;
  },

  finishLoad(event, success) {
    if (!event || !['rewarded', 'interstitial'].includes(event.format)) return;
    const expectedId = event.format === 'rewarded' ? this.rewardedId : this.interstitialId;
    if (event.adUnitId !== expectedId) return;
    const pending = this.pendingLoads[event.format];
    if (!pending) return;
    if (!success) this.reportError('Ad load failed', event.error || 'Unknown error');
    pending.finish(success);
  },

  async loadAd(kind) {
    const plugin = this.getPlugin();
    if (!plugin || !this.initialized) return false;
    if (this.pendingLoads[kind]) return this.pendingLoads[kind].promise;
    const adUnitId = kind === 'rewarded' ? this.rewardedId : this.interstitialId;
    let finish;
    const pending = { promise: new Promise(resolve => { finish = resolve; }) };
    pending.finish = success => {
      if (this.pendingLoads[kind] !== pending) return;
      clearTimeout(pending.timer);
      delete this.pendingLoads[kind];
      finish(success);
    };
    this.pendingLoads[kind] = pending;
    pending.timer = setTimeout(() => {
      this.reportError('Ad load timed out', kind);
      pending.finish(false);
    }, this.loadTimeoutMs);
    try {
      const status = await plugin.isReady({ format: kind, adUnitId });
      if (status && status.ready) pending.finish(true);
      else if (kind === 'rewarded') await plugin.loadRewarded({ adUnitId });
      else await plugin.loadInterstitial({ adUnitId });
    } catch (error) {
      this.reportError('Ad load request failed', error);
      pending.finish(false);
    }
    return pending.promise;
  },

  async preloadAds() {
    await Promise.all([this.loadAd('rewarded'), this.loadAd('interstitial')]);
  },

  async showInterstitial() {
    if (this.fullscreenBusy) return;
    this.fullscreenBusy = true;
    try {
      if (!(await this.init()) || !(await this.loadAd('interstitial'))) return;
      const result = await this.getPlugin().showInterstitial({ adUnitId: this.interstitialId });
      if (result && result.error) this.reportError('Interstitial failed', result.error);
      if (result && result.shown) void this.loadAd('interstitial');
    } catch (error) {
      this.reportError('Interstitial failed', error);
    } finally {
      this.fullscreenBusy = false;
    }
  },

  async showRewarded(onSuccess) {
    if (this.fullscreenBusy) return;
    this.fullscreenBusy = true;
    try {
      if (!(await this.init()) || !(await this.loadAd('rewarded'))) {
        window.alert('No ad is available right now. Please try again later.');
        return;
      }
      const result = await this.getPlugin().showRewarded({ adUnitId: this.rewardedId });
      if (result && result.rewarded === true) {
        logToScreen('Rewarded video completed.');
        onSuccess();
      } else if (result && result.error) {
        this.reportError('Rewarded video failed', result.error);
        window.alert('The ad could not play. Please try again later.');
      } else {
        logToScreen('Video closed without completion; no reward granted.');
      }
      if (result && result.shown) void this.loadAd('rewarded');
    } catch (error) {
      this.reportError('Rewarded video failed', error);
      window.alert('The ad could not play. Please try again later.');
    } finally {
      this.fullscreenBusy = false;
    }
  },

  startLoopTimer() {
    clearInterval(this.timerInterval);
    this.continuousSeconds = 0;
    this.timerInterval = setInterval(() => {
      if (this.fullscreenBusy || document.hidden) return;
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
