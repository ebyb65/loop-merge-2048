// LevelPlay app key and ad unit IDs are public SDK identifiers, not API secrets.
const UnityAdsManager = {
  appKey: '290617fe5',
  rewardedId: '8a5kdqc4fvthlejd',
  interstitialId: 'hyu8d966nd6iuv9n',
  // LevelPlay banner ad unit ID. Leave empty to disable banners.
  bannerAdUnitId: '3c2do5ad82ulkit9',
  bannerState: 'none', // none | creating | loading | shown | failed
  bannerRetryMs: 30000,
  bannerSpace: 0,
  bannerEverLoaded: false,
  // --- Consent (GDPR) ---
  consentKey: 'drop2048_ads_consent', // 'granted' | 'denied'
  consentPrompt: null, // set by the page: async () => true (agree) / false (decline)
  timeZoneOverride: null, // tests only
  // Interstitial pacing, counted in seconds of active play (pauses and modals do not count).
  interstitialEverySeconds: 135, // mid-game interstitial after this much play since the last one
  breakCooldownSeconds: 60,      // between-games interstitial only if this long since the last one
  firstAdGraceSeconds: 45,       // never before this much play in a session
  retryAfterFailSeconds: 30,
  activeSeconds: 0,
  lastInterstitialAt: 0,
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
          await plugin.addListener('bannerLoaded', e => this.onBannerLoaded(e));
          await plugin.addListener('bannerLoadFailed', e => this.onBannerFailed(e));
          await plugin.addListener('bannerDisplayFailed', e => this.onBannerFailed(e));
          this.listenersRegistered = true;
        }
        // GDPR consent is only signalled for EEA/UK/Swiss players; elsewhere the SDK default applies.
        const consent = await this.resolveConsent();
        const options = { appKey: this.appKey };
        if (consent) options.consent = consent;
        await plugin.initialize(options);
        this.initialized = true;
        logToScreen('LevelPlay initialized. Loading ads...');
        void this.preloadAds();
        void this.setupBanner();
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
    if (!success) this.reportError(event.format + ' ad load failed', event.error || 'Unknown error');
    else logToScreen(event.format + ' ad loaded.');
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
    if (this.fullscreenBusy) return false;
    logToScreen('Attempting interstitial ad.');
    this.fullscreenBusy = true;
    // Until it is shown, allow another attempt only after a short back-off.
    this.lastInterstitialAt = Math.max(this.lastInterstitialAt,
      this.activeSeconds - this.interstitialEverySeconds + this.retryAfterFailSeconds);
    try {
      if (!(await this.init()) || !(await this.loadAd('interstitial'))) return false;
      const result = await this.getPlugin().showInterstitial({ adUnitId: this.interstitialId });
      if (result && result.error) this.reportError('Interstitial failed', result.error);
      if (result && result.shown) {
        logToScreen('Interstitial ad shown.');
        this.lastInterstitialAt = this.activeSeconds;
        void this.loadAd('interstitial');
        return true;
      } else if (!result || !result.error) logToScreen('Interstitial ad was not shown.');
      return false;
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

  secondsSinceInterstitial() {
    return this.activeSeconds - this.lastInterstitialAt;
  },

  // Natural break (new game, restart, game over). Shows an interstitial when enough play has passed.
  onGameBreak(reason) {
    if (this.activeSeconds < this.firstAdGraceSeconds) return false;
    if (this.secondsSinceInterstitial() < this.breakCooldownSeconds) return false;
    logToScreen('Interstitial at game break: ' + reason);
    void this.showInterstitial();
    return true;
  },

  // Counts active play. Play time is kept across restarts so short games still reach the interval.
  startLoopTimer() {
    clearInterval(this.timerInterval);
    logToScreen('Interstitial countdown running (' + this.secondsSinceInterstitial() + 's since last ad).');
    this.timerInterval = setInterval(() => this.tick(), 1000);
  },

  tick() {
    if (this.fullscreenBusy || document.hidden) return;
    this.activeSeconds++;
    const since = this.secondsSinceInterstitial();
    const toast = document.getElementById('ad-toast');
    if (since === this.interstitialEverySeconds - 3 && toast) toast.style.display = 'block';
    if (since >= this.interstitialEverySeconds) {
      if (toast) toast.style.display = 'none';
      void this.showInterstitial();
    }
  },

  pauseLoopTimer() {
    clearInterval(this.timerInterval);
    const toast = document.getElementById('ad-toast');
    if (toast) toast.style.display = 'none';
    logToScreen('Interstitial countdown paused at ' + this.secondsSinceInterstitial() + 's.');
  },

  // --- CONSENT ---
  // EEA, UK and Switzerland are detected from the device time zone (no network, no permissions).
  isGdprRegion() {
    let tz = this.timeZoneOverride;
    if (!tz) {
      try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
    }
    if (/^Europe\//.test(tz)) return true;
    return ['Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Reykjavik',
      'Atlantic/Faroe', 'Africa/Ceuta', 'Arctic/Longyearbyen', 'Asia/Nicosia', 'Asia/Famagusta'].includes(tz);
  },

  getStoredConsent() {
    try {
      const v = window.localStorage.getItem(this.consentKey);
      return v === 'granted' || v === 'denied' ? v : null;
    } catch (e) { return null; }
  },

  storeConsent(granted) {
    try { window.localStorage.setItem(this.consentKey, granted ? 'granted' : 'denied'); } catch (e) {}
  },

  // Returns the consent options for initialize(), or null when no GDPR signal applies.
  async resolveConsent() {
    if (!this.isGdprRegion()) return null;
    let stored = this.getStoredConsent();
    if (!stored && typeof this.consentPrompt === 'function') {
      let granted = false;
      try { granted = !!(await this.consentPrompt()); } catch (e) { granted = false; }
      this.storeConsent(granted);
      stored = granted ? 'granted' : 'denied';
    }
    return { gdprConsent: stored === 'granted' };
  },

  // Called from the "Privacy choices" button.
  async changeConsent(granted) {
    this.storeConsent(granted);
    const plugin = this.getPlugin();
    if (plugin && plugin.setConsent) {
      try { await plugin.setConsent({ gdprConsent: !!granted }); } catch (e) { this.reportError('Consent update failed', e); }
    }
    logToScreen('Ad consent set to ' + (granted ? 'personalised' : 'non-personalised') + '.');
  },

  // --- BANNER ---
  async setupBanner() {
    const plugin = this.getPlugin();
    if (!this.bannerAdUnitId || !plugin || !this.initialized) return false;
    if (this.bannerState !== 'none' && this.bannerState !== 'failed') return true;
    this.bannerState = 'creating';
    try {
      await plugin.destroyBanner({ bannerId: 'main' });
      const created = await plugin.createBanner({
        adUnitId: this.bannerAdUnitId, bannerId: 'main', size: 'BANNER', position: 'bottom'
      });
      this.applyBannerSpace(created && created.frame);
      this.bannerState = 'loading';
      await plugin.loadBanner({ bannerId: 'main' });
      const shown = await plugin.showBanner({ bannerId: 'main' });
      this.applyBannerSpace(shown && shown.frame);
      logToScreen('Banner requested.');
      return true;
    } catch (error) {
      this.reportError('Banner setup failed', error);
      this.bannerState = 'failed';
      this.scheduleBannerRetry();
      return false;
    }
  },

  onBannerLoaded(event) {
    if (!event || event.bannerId !== 'main') return;
    this.bannerState = 'shown';
    this.bannerEverLoaded = true;
    this.applyBannerSpace(event.frame);
    logToScreen('Banner loaded.');
  },

  onBannerFailed(event) {
    if (!event || event.bannerId !== 'main') return;
    if (this.bannerEverLoaded) {
      // Auto-refresh found no new ad: the SDK keeps the current one and retries on the next refresh.
      logToScreen('Banner refresh: no new ad, keeping current banner.');
      return;
    }
    this.reportError('Banner failed', event.error || 'Unknown error');
    this.bannerState = 'failed';
    this.scheduleBannerRetry();
  },

  scheduleBannerRetry() {
    clearTimeout(this.bannerRetryTimer);
    this.bannerRetryTimer = setTimeout(() => { void this.setupBanner(); }, this.bannerRetryMs);
  },

  // Reserve room at the bottom of every screen so the banner never covers the game.
  applyBannerSpace(frame) {
    if (!frame || !frame.height) return;
    this.bannerSpace = Math.ceil(frame.height);
    const root = document.documentElement;
    if (root && root.style && root.style.setProperty) root.style.setProperty('--banner-space', this.bannerSpace + 'px');
  }
};
