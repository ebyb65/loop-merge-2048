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

  // --- Play Age Signals (California AB 1043 / Brazil, Jan 2027) ---
  // On every launch, before ads start, ask Google Play for the player's age signal
  // (plugins/play-age-signals). An age range under 18 means child-directed, non-personalized ads
  // (LevelPlay COPPA + "do not sell"). No signal (most regions), an error or a timeout: today's
  // behaviour. The same ads show either way; the age itself is not stored or sent anywhere.
  ageTimeoutMs: 4000,
  ageRetryMs: 1500,
  ageGroup: 'none', // minor | adult | none
  ageResult: null,

  getAgePlugin() {
    const capacitor = window.Capacitor;
    if (!capacitor || (capacitor.isNativePlatform && !capacitor.isNativePlatform())) return null;
    return (capacitor.Plugins && capacitor.Plugins.PlayAgeSignals) || null;
  },

  // Play 0.0.6 answers with an age range: ageUpper null with an ageLower means 18 or over;
  // both null means Play has no age for this user.
  classifyAge(r) {
    if (!r || !r.ok) return 'none';
    if (typeof r.ageUpper === 'number' && r.ageUpper < 18) return 'minor';
    if (typeof r.ageLower === 'number' && r.ageLower < 18 && typeof r.ageUpper !== 'number') return 'minor'; // open range from a child age: play safe
    if (typeof r.ageLower === 'number') return 'adult';
    return 'none';
  },

  async askAgeOnce(agePlugin) {
    let timer;
    try {
      return await Promise.race([
        agePlugin.check(),
        new Promise(r => { timer = setTimeout(() => r({ ok: false, error: 'timeout' }), this.ageTimeoutMs); })
      ]);
    } catch (error) {
      return { ok: false, error: error && error.message ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  },

  async checkAge() {
    const agePlugin = this.getAgePlugin();
    if (!agePlugin) return { group: 'none', result: { ok: false, error: 'no plugin' } };
    let r = await this.askAgeOnce(agePlugin);
    if (!r || (!r.ok && r.error !== 'timeout')) { // transient Play errors: one retry
      await new Promise(res => setTimeout(res, this.ageRetryMs));
      r = await this.askAgeOnce(agePlugin);
    }
    return { group: this.classifyAge(r), result: r };
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
        // Until a consent manager exists, do not signal consent to personalized ads.
        const consent = { gdprConsent: false };
        const age = await this.checkAge();
        this.ageGroup = age.group;
        this.ageResult = age.result;
        if (age.group === 'minor') { consent.coppa = true; consent.ccpaDoNotSell = true; }
        if (age.result && !age.result.ok && age.result.error !== 'no plugin') logToScreen('Age signal unavailable: ' + age.result.error);
        await plugin.initialize({ appKey: this.appKey, consent });
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
