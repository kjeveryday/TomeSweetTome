// UI: renders from GameState and dispatches intents. Never writes state.
// Icon-first, for young players. All copy and icons come from content.json;
// all visual geometry lives in style.css (CSS is exempt from the no-tuning rule).

import { moodOf } from './state.js';
import { EventTypes } from './events.js';
import { stageDef, nextStageDef } from './systems/growth.js';
import { currentRelationshipResponse, relationshipLevel } from './systems/relationship.js';
import { DEFAULT_THEME, THEMES } from './systems/theme.js';
import { iconMarkup } from './icons.js';
import { spriteLookFor, layoutFor, MINI_SCALE, defaultSpriteLook } from './systems/sprite-map.js';

const SPRITE_BASE = 'assets/creatures/';

export function createUI(root, content, handlers) {
  const copy = content.copy;
  const icons = content.ui.icons;
  const interpolate = (template, values) => Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );

  root.dataset.hatched = 'false';
  root.innerHTML = `
    <div class="page page-discover" id="page-discover" role="tabpanel" aria-labelledby="tab-discover" hidden>
      <div class="tome" data-open="false">
        <button class="tome-cover" type="button">
          <span class="tome-cover-flourish">&#10087;</span>
          <h2 class="tome-cover-title"></h2>
          <span class="tome-cover-rule"></span>
          <span class="tome-cover-hint"></span>
        </button>

        <div class="tome-spread">
          <div class="tome-page tome-page-left">
            <h3 class="tome-guide-title"></h3>
            <ol class="tome-guide">
              <li class="tome-guide-item"><span class="tome-guide-num">1</span><span class="tome-guide-body"><b class="tome-scan-name"></b><span class="tome-scan-desc"></span></span></li>
              <li class="tome-guide-item"><span class="tome-guide-num">2</span><span class="tome-guide-body"><b class="tome-isbn-name"></b><span class="tome-isbn-desc"></span></span></li>
              <li class="tome-guide-item"><span class="tome-guide-num">3</span><span class="tome-guide-body"><b class="tome-search-name"></b><span class="tome-search-desc"></span></span></li>
            </ol>
            <button class="tome-close" type="button"></button>
          </div>

          <div class="tome-page tome-page-right">
            <label class="photo-btn tome-btn tome-btn-lg">
              <span class="tome-btn-ic" aria-hidden="true"></span>
              <span class="tome-btn-label photo-label"></span>
              <input class="photo-input visually-hidden" type="file" accept="image/*" capture="environment" />
            </label>

            <div class="tome-action" data-open="false">
              <button class="tome-btn tome-action-toggle" type="button">
                <span class="tome-btn-label isbn-name"></span>
                <span class="tome-caret" aria-hidden="true">&#9662;</span>
              </button>
              <form class="isbn-form tome-panel" novalidate>
                <label class="isbn-label" for="book-isbn"></label>
                <div class="isbn-row">
                  <input id="book-isbn" class="isbn-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" />
                  <button class="isbn-submit" type="submit"></button>
                </div>
              </form>
            </div>

            <div class="tome-action" data-open="false">
              <button class="tome-btn tome-action-toggle" type="button">
                <span class="tome-btn-label search-name"></span>
                <span class="tome-caret" aria-hidden="true">&#9662;</span>
              </button>
              <form class="book-search-form tome-panel" novalidate>
                <div class="book-search-grid">
                  <label class="isbn-label" for="book-search-title"></label>
                  <input id="book-search-title" class="isbn-input book-search-title" type="text" autocomplete="off" maxlength="200" />
                  <label class="isbn-label" for="book-search-author"></label>
                  <input id="book-search-author" class="isbn-input book-search-author" type="text" autocomplete="off" maxlength="200" />
                </div>
                <button class="isbn-submit book-search-submit" type="submit"></button>
              </form>
            </div>

            <p class="book-privacy tome-note"></p>
          </div>
        </div>
      </div>

      <p class="scan-status" role="status" aria-live="polite"></p>

      <section class="book-result" aria-label="" hidden>
        <button class="preview-debug" type="button"><span aria-hidden="true">⚙️</span></button>
        <div class="book-orb" aria-hidden="true">
          <span class="mini-mark mm1"></span><span class="mini-mark mm2"></span>
          <span class="mini-mark mm3"></span><span class="mini-mark mm4"></span>
          <span class="mini-face">•ᴗ•</span>
        </div>
        <div class="book-result-copy">
          <h3 class="book-name"></h3>
          <p class="book-line"></p>
          <p class="book-details"></p>
          <p class="book-birthmark"></p>
          <p class="book-isbn-line"></p>
        </div>
        <div class="book-actions">
          <button class="book-use" type="button"></button>
          <button class="book-add" type="button" hidden></button>
        </div>
      </section>
    </div>

    <div class="page page-care" id="page-care" role="tabpanel" aria-labelledby="tab-care">
      <section class="scene">
        <span class="sun"></span>
        <span class="cloud c1"></span>
        <span class="cloud c2"></span>
        <div class="shelf" role="list"></div>
        <div class="stage-area">
          <button class="creature-debug" type="button"><span aria-hidden="true">⚙️</span></button>
          <button class="egg" type="button">
            <span class="egg-shell"></span>
            <span class="crack k1"></span><span class="crack k2"></span><span class="crack k3"></span>
          </button>
          <div class="creature">
            <span class="sprout"></span>
            <span class="wing wl"></span><span class="wing wr"></span>
            <span class="feature f1"></span><span class="feature f2"></span>
            <div class="body">
              <span class="mark m1"></span><span class="mark m2"></span>
              <span class="mark m3"></span><span class="mark m4"></span>
              <span class="birthmark"></span>
              <span class="eye el"></span><span class="eye er"></span>
              <span class="cheek chl"></span><span class="cheek chr"></span>
              <span class="mouth"></span>
            </div>
            <span class="shadow"></span>
            <span class="zzz"></span>
          </div>
          <div class="fx"></div>
          <div class="burst-layer"></div>
        </div>
        <p class="egg-hint"></p>
        <div class="nameplate">
          <span class="name-pill"></span><span class="mood-chip"></span><span class="stage-tag"></span><span class="grow-chip" title=""></span>
        </div>
        <p class="relationship-line" role="status" hidden></p>
        <div class="tuck-veil" aria-hidden="true">
          <span class="tuck-text"></span>
          <span class="star"></span><span class="star"></span><span class="star"></span><span class="star"></span>
        </div>
      </section>
      <section class="meters"></section>
      <section class="actions"></section>
      <div class="care-buttons">
        <button class="reading-open" type="button">
          <span class="ro-icon" aria-hidden="true"></span><span class="ro-label"></span>
        </button>
        <button class="tuck-btn" type="button">
          <span class="a-icon"></span><span class="t-label"></span>
        </button>
      </div>
    </div>

    <div class="page page-habitat" id="page-habitat" role="tabpanel" aria-labelledby="tab-habitat" hidden>
      <h2 class="habitat-page-title"></h2>
      <section class="habitat-window">
        <span class="hb-lamp" aria-hidden="true"></span>
        <span class="hb-plant" aria-hidden="true"></span>
        <div class="habitat-shelf" aria-hidden="true"></div>
        <div class="habitat-stage" role="img"></div>
        <p class="habitat-empty" hidden></p>
      </section>
      <div class="habitat-tools">
        <button class="habitat-edit-btn habitat-tool-btn" type="button"></button>
        <button class="visitor-ask habitat-tool-btn" type="button" hidden></button>
      </div>
      <div class="visitor-card" hidden>
        <p class="visitor-greeting"></p>
        <p class="visitor-reason"></p>
        <p class="visitor-sample-note"></p>
        <ul class="visitor-books"></ul>
        <div class="visitor-card-actions">
          <button class="visitor-save" type="button"></button>
          <span class="visitor-saved" hidden></span>
          <button class="visitor-dismiss" type="button"></button>
        </div>
        <button class="visitor-reset" type="button"></button>
      </div>
      <section class="collection" aria-labelledby="collection-title">
        <h2 id="collection-title" class="collection-title"></h2>
        <div class="collection-list" role="list"></div>
      </section>
    </div>

    <div class="page page-progress" id="page-progress" role="tabpanel" aria-labelledby="tab-progress" hidden>
      <h2 class="progress-title"></h2>
      <p class="progress-status" role="status"></p>
      <section class="progress-history">
        <h3 class="progress-history-title"></h3>
        <ul class="progress-history-list"></ul>
        <p class="progress-history-empty" hidden></p>
      </section>
      <section class="progress-books">
        <h3 class="progress-books-title"></h3>
        <ul class="progress-books-list"></ul>
      </section>
      <section class="progress-events under-construction">
        <h3 class="events-title"></h3>
        <p class="events-note"></p>
      </section>
    </div>

    <div class="page page-books" id="page-books" role="tabpanel" aria-labelledby="tab-books" hidden>
      <section class="books-placeholder under-construction">
        <h2 class="books-title"></h2>
        <p class="books-note"></p>
      </section>
    </div>

    <div class="page page-settings" id="page-settings" role="tabpanel" aria-labelledby="tab-settings" hidden>
      <div class="settings-card">
        <h2 class="settings-title"></h2>
        <section class="settings-section settings-appearance">
          <h3 class="settings-appearance-title"></h3>
          <div class="theme-picker" role="radiogroup" aria-label="Theme"></div>
        </section>
        <section class="settings-section settings-account">
          <h3 class="settings-account-title"></h3>
          <p class="settings-account-status"></p>
          <p class="settings-library-status"></p>
          <p class="settings-guest-note" hidden></p>
        </section>
        <section class="settings-section settings-service">
          <h3 class="settings-service-title"></h3>
          <ul class="settings-provider-list"></ul>
        </section>
        <section class="settings-section settings-data">
          <h3 class="settings-data-title"></h3>
          <button class="settings-export" type="button"></button>
          <p class="settings-export-hint"></p>
          <div class="settings-export-panel" hidden>
            <textarea class="settings-export-text" readonly rows="6"></textarea>
            <button class="settings-download" type="button"></button>
          </div>
          <button class="settings-clear-suggestions" type="button"></button>
          <div class="settings-delete-wrap">
            <button class="settings-delete" type="button"></button>
            <div class="settings-delete-confirm" hidden>
              <p></p>
              <button class="settings-delete-yes" type="button"></button>
              <button class="settings-delete-cancel" type="button"></button>
            </div>
          </div>
        </section>
        <section class="settings-section settings-research" hidden>
          <h3 class="settings-research-title"></h3>
          <p class="settings-research-disclaimer"></p>
          <div class="settings-research-entries"></div>
        </section>
        <section class="settings-section settings-credits">
          <h3 class="settings-credits-title"></h3>
          <p class="settings-credits-intro"></p>
          <ul class="settings-credits-list"></ul>
        </section>
      </div>
    </div>

    <nav class="tabbar" role="tablist">
      <button class="tab tab-discover" id="tab-discover" data-page="discover" role="tab" type="button" aria-selected="false" aria-controls="page-discover">
        <span class="tab-icon" aria-hidden="true">🔍</span><span class="tab-label"></span>
      </button>
      <button class="tab tab-care" id="tab-care" data-page="care" role="tab" type="button" aria-selected="true" aria-controls="page-care">
        <span class="tab-icon" aria-hidden="true">🐾</span><span class="tab-label"></span>
      </button>
      <button class="tab tab-habitat" id="tab-habitat" data-page="habitat" role="tab" type="button" aria-selected="false" aria-controls="page-habitat">
        <span class="tab-icon" aria-hidden="true">🏡</span><span class="tab-label"></span>
      </button>
      <button class="tab tab-progress" id="tab-progress" data-page="progress" role="tab" type="button" aria-selected="false" aria-controls="page-progress">
        <span class="tab-icon" aria-hidden="true">📈</span><span class="tab-label"></span>
      </button>
      <button class="tab tab-books" id="tab-books" data-page="books" role="tab" type="button" aria-selected="false" aria-controls="page-books">
        <span class="tab-icon" aria-hidden="true">📚</span><span class="tab-label"></span>
      </button>
      <button class="tab tab-settings" id="tab-settings" data-page="settings" role="tab" type="button" aria-selected="false" aria-controls="page-settings">
        <span class="tab-icon" aria-hidden="true">⚙️</span><span class="tab-label"></span>
      </button>
    </nav>

    <div class="toast" role="status"></div>
    <div class="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-body gift-line" hidden>
      <div class="welcome-card">
        <h2 class="welcome-title" id="welcome-title"></h2>
        <p class="welcome-body" id="welcome-body"></p>
        <div class="gift-stack"></div>
        <p class="gift-line" id="gift-line"></p>
        <button class="welcome-btn" type="button"></button>
      </div>
    </div>
    <div class="debug-modal" role="dialog" aria-modal="true" aria-labelledby="debug-title" hidden>
      <div class="debug-card">
        <button class="debug-close" type="button"></button>
        <h2 id="debug-title" class="debug-title"></h2>
        <p class="debug-note"></p>
        <section class="debug-section">
          <h3 class="debug-captured-title"></h3>
          <dl class="debug-captured-values"></dl>
        </section>
        <section class="debug-section">
          <h3 class="debug-book-title"></h3>
          <dl class="debug-book-values"></dl>
        </section>
        <section class="debug-section">
          <h3 class="debug-mapping-title"></h3>
          <div class="debug-mapping-values"></div>
        </section>
        <section class="debug-section">
          <h3 class="debug-derived-title"></h3>
          <dl class="debug-derived-values"></dl>
        </section>
        <details class="debug-json-wrap">
          <summary class="debug-json-label"></summary>
          <pre class="debug-json"></pre>
        </details>
      </div>
    </div>
    <div class="reading-modal" role="dialog" aria-modal="true" aria-labelledby="reading-title" hidden>
      <div class="reading-modal-card">
        <button class="reading-close" type="button"></button>
        <section class="reading-panel" aria-labelledby="reading-title">
          <h2 id="reading-title" class="reading-title"></h2>
          <div class="reading-start-view">
            <p class="reading-intro"></p>
            <button class="reading-start" type="button"></button>
          </div>
          <div class="reading-active-view" hidden>
            <p class="reading-progress" role="status"></p>
            <div class="reading-grid">
              <label for="reading-book" class="reading-label reading-book-label"></label>
              <select id="reading-book" class="reading-book"></select>
              <label for="reading-mode" class="reading-label reading-mode-label"></label>
              <select id="reading-mode" class="reading-mode"></select>
              <button class="reading-record" type="button"></button>
              <div class="reading-timer" hidden>
                <button class="timer-start" type="button"></button>
                <p class="timer-running" role="timer" hidden></p>
                <div class="timer-actions" hidden>
                  <button class="timer-stop" type="button"></button>
                  <button class="timer-cancel" type="button"></button>
                </div>
                <div class="timer-confirm" hidden>
                  <p></p>
                  <button class="timer-confirm-yes" type="button"></button>
                  <button class="timer-confirm-no" type="button"></button>
                </div>
              </div>
              <label for="reading-status" class="reading-label reading-status-label"></label>
              <select id="reading-status" class="reading-status"></select>
            </div>
            <p class="reading-empty" hidden></p>
          </div>
        </section>
      </div>
    </div>
    <div class="reading-recovery" role="dialog" aria-modal="true" aria-labelledby="reading-recovery-title" hidden>
      <div class="reading-recovery-card">
        <h2 id="reading-recovery-title"></h2>
        <p class="reading-recovery-book"></p>
        <div>
          <button class="reading-recovery-yes" type="button"></button>
          <button class="reading-recovery-no" type="button"></button>
        </div>
      </div>
    </div>
  `;

  const q = (sel) => root.querySelector(sel);
  const el = {
    readingPanel: q('.reading-panel'),
    readingModal: q('.reading-modal'),
    readingOpen: q('.reading-open'),
    readingClose: q('.reading-close'),
    readingTitle: q('.reading-title'),
    readingStartView: q('.reading-start-view'),
    readingIntro: q('.reading-intro'),
    readingStart: q('.reading-start'),
    readingActiveView: q('.reading-active-view'),
    readingProgress: q('.reading-progress'),
    readingBook: q('.reading-book'),
    readingBookLabel: q('.reading-book-label'),
    readingMode: q('.reading-mode'),
    readingModeLabel: q('.reading-mode-label'),
    readingRecord: q('.reading-record'),
    readingTimer: q('.reading-timer'),
    timerStart: q('.timer-start'),
    timerRunning: q('.timer-running'),
    timerActions: q('.timer-actions'),
    timerStop: q('.timer-stop'),
    timerCancel: q('.timer-cancel'),
    timerConfirm: q('.timer-confirm'),
    timerConfirmYes: q('.timer-confirm-yes'),
    timerConfirmNo: q('.timer-confirm-no'),
    readingStatus: q('.reading-status'),
    readingStatusLabel: q('.reading-status-label'),
    readingEmpty: q('.reading-empty'),
    readingRecovery: q('.reading-recovery'),
    readingRecoveryBook: q('.reading-recovery-book'),
    readingRecoveryYes: q('.reading-recovery-yes'),
    readingRecoveryNo: q('.reading-recovery-no'),
    scene: q('.scene'),
    creatureDebug: q('.creature-debug'),
    egg: q('.egg'),
    eggHint: q('.egg-hint'),
    creature: q('.creature'),
    creatureBody: q('.creature .body'),
    zzz: q('.zzz'),
    fx: q('.fx'),
    burstLayer: q('.burst-layer'),
    namePill: q('.name-pill'),
    moodChip: q('.mood-chip'),
    stageTag: q('.stage-tag'),
    relationshipLine: q('.relationship-line'),
    growChip: q('.grow-chip'),
    meters: q('.meters'),
    actions: q('.actions'),
    tuckBtn: q('.tuck-btn'),
    tuckVeil: q('.tuck-veil'),
    tuckText: q('.tuck-text'),
    toast: q('.toast'),
    shelf: q('.shelf'),
    habitatTitle: q('.habitat-page-title'),
    habitatWindow: q('.habitat-window'),
    habitatStage: q('.habitat-stage'),
    habitatEmpty: q('.habitat-empty'),
    habitatEditBtn: q('.habitat-edit-btn'),
    collection: q('.collection'),
    collectionTitle: q('.collection-title'),
    collectionList: q('.collection-list'),
    visitorAsk: q('.visitor-ask'),
    visitorCard: q('.visitor-card'),
    visitorGreeting: q('.visitor-greeting'),
    visitorReason: q('.visitor-reason'),
    visitorSampleNote: q('.visitor-sample-note'),
    visitorBooks: q('.visitor-books'),
    visitorSave: q('.visitor-save'),
    visitorSaved: q('.visitor-saved'),
    visitorDismiss: q('.visitor-dismiss'),
    visitorReset: q('.visitor-reset'),
    welcome: q('.welcome'),
    welcomeTitle: q('.welcome-title'),
    welcomeBody: q('.welcome-body'),
    giftStack: q('.gift-stack'),
    giftLine: q('.gift-line'),
    welcomeBtn: q('.welcome-btn'),
    discoverPage: q('#page-discover'),
    tome: q('.tome'),
    tomeCover: q('.tome-cover'),
    tomeClose: q('.tome-close'),
    bookPrivacy: q('.book-privacy'),
    photoInput: q('.photo-input'),
    photoLabel: q('.photo-label'),
    isbnForm: q('.isbn-form'),
    isbnLabel: q('.isbn-label'),
    isbnInput: q('.isbn-input'),
    isbnSubmit: q('.isbn-submit'),
    bookSearchForm: q('.book-search-form'),
    bookSearchTitle: q('.book-search-title'),
    bookSearchAuthor: q('.book-search-author'),
    bookSearchSubmit: q('.book-search-submit'),
    scanStatus: q('.scan-status'),
    bookResult: q('.book-result'),
    bookOrb: q('.book-orb'),
    bookName: q('.book-name'),
    bookLine: q('.book-line'),
    bookDetails: q('.book-details'),
    bookBirthmark: q('.book-birthmark'),
    bookIsbnLine: q('.book-isbn-line'),
    bookUse: q('.book-use'),
    bookAdd: q('.book-add'),
    previewDebug: q('.preview-debug'),
    debugModal: q('.debug-modal'),
    debugCard: q('.debug-card'),
    debugClose: q('.debug-close'),
    debugTitle: q('.debug-title'),
    debugNote: q('.debug-note'),
    debugCapturedTitle: q('.debug-captured-title'),
    debugCapturedValues: q('.debug-captured-values'),
    debugBookTitle: q('.debug-book-title'),
    debugBookValues: q('.debug-book-values'),
    debugMappingTitle: q('.debug-mapping-title'),
    debugMappingValues: q('.debug-mapping-values'),
    debugDerivedTitle: q('.debug-derived-title'),
    debugDerivedValues: q('.debug-derived-values'),
    debugJsonLabel: q('.debug-json-label'),
    debugJson: q('.debug-json'),
    settingsPage: q('#page-settings'),
    settingsCard: q('.settings-card'),
    settingsTitle: q('.settings-title'),
    settingsAppearanceTitle: q('.settings-appearance-title'),
    themePicker: q('.theme-picker'),
    settingsAccountTitle: q('.settings-account-title'),
    settingsAccountStatus: q('.settings-account-status'),
    settingsLibraryStatus: q('.settings-library-status'),
    settingsGuestNote: q('.settings-guest-note'),
    settingsServiceTitle: q('.settings-service-title'),
    settingsProviderList: q('.settings-provider-list'),
    settingsDataTitle: q('.settings-data-title'),
    settingsExport: q('.settings-export'),
    settingsExportHint: q('.settings-export-hint'),
    settingsExportPanel: q('.settings-export-panel'),
    settingsExportText: q('.settings-export-text'),
    settingsDownload: q('.settings-download'),
    settingsClearSuggestions: q('.settings-clear-suggestions'),
    settingsDelete: q('.settings-delete'),
    settingsDeleteConfirm: q('.settings-delete-confirm'),
    settingsDeleteYes: q('.settings-delete-yes'),
    settingsDeleteCancel: q('.settings-delete-cancel'),
    settingsResearch: q('.settings-research'),
    settingsResearchTitle: q('.settings-research-title'),
    settingsResearchDisclaimer: q('.settings-research-disclaimer'),
    settingsResearchEntries: q('.settings-research-entries'),
    settingsCreditsTitle: q('.settings-credits-title'),
    settingsCreditsIntro: q('.settings-credits-intro'),
    settingsCreditsList: q('.settings-credits-list'),
    birthmark: q('.birthmark'),
    marks: [...root.querySelectorAll('.creature .mark')],
    progressTitle: q('.progress-title'),
    progressStatus: q('.progress-status'),
    progressHistoryTitle: q('.progress-history-title'),
    progressHistoryList: q('.progress-history-list'),
    progressHistoryEmpty: q('.progress-history-empty'),
    progressBooksTitle: q('.progress-books-title'),
    progressBooksList: q('.progress-books-list'),
    eventsTitle: q('.events-title'),
    eventsNote: q('.events-note'),
    booksTitle: q('.books-title'),
    booksNote: q('.books-note'),
    tabbar: q('.tabbar'),
    tabs: {
      discover: q('.tab-discover'),
      care: q('.tab-care'),
      habitat: q('.tab-habitat'),
      progress: q('.tab-progress'),
      books: q('.tab-books'),
      settings: q('.tab-settings')
    },
    pages: {
      discover: q('#page-discover'),
      care: q('#page-care'),
      habitat: q('#page-habitat'),
      progress: q('#page-progress'),
      books: q('#page-books'),
      settings: q('#page-settings')
    }
  };

  el.readingOpen.querySelector('.ro-icon').textContent = copy.readingOpenIcon;
  el.readingOpen.querySelector('.ro-label').textContent = copy.readingOpen;
  el.readingClose.textContent = copy.readingClose;
  el.readingTitle.textContent = copy.readingTitle;
  el.readingIntro.textContent = copy.readingIntro;
  el.readingStart.textContent = copy.readingStart;
  el.readingBookLabel.textContent = copy.readingBookLabel;
  el.readingModeLabel.textContent = copy.readingModeLabel;
  el.readingRecord.textContent = copy.readingRecord;
  el.readingStatusLabel.textContent = copy.readingStatusLabel;
  el.readingEmpty.textContent = copy.readingNoBooks;
  el.timerStart.textContent = copy.timerStart;
  el.timerStop.textContent = copy.timerStop;
  el.timerCancel.textContent = copy.timerCancel;
  el.timerConfirm.querySelector('p').textContent = copy.timerConfirm;
  el.timerConfirmYes.textContent = copy.timerConfirmYes;
  el.timerConfirmNo.textContent = copy.timerConfirmNo;
  el.readingRecovery.querySelector('h2').textContent = copy.timerRecovery;
  el.readingRecoveryYes.textContent = copy.timerConfirmYes;
  el.readingRecoveryNo.textContent = copy.timerConfirmNo;
  for (const [value, label] of Object.entries(content.reading.modes)) {
    el.readingMode.add(new Option(label, value));
  }
  for (const [value, label] of Object.entries(content.reading.statuses)) {
    el.readingStatus.add(new Option(label, value));
  }
  let timerDisplayInterval = null;
  let timerDisplayStartedAt = 0;
  let interruptedWorkId = null;

  function selectedReadingWorkId() {
    return el.readingBook.value || null;
  }

  function formatTimer(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  }

  function updateTimerDisplay() {
    const elapsedSeconds = Math.max(0, Math.floor((performance.now() - timerDisplayStartedAt) / 1000));
    el.timerRunning.textContent = interpolate(copy.timerRunning, { time: formatTimer(elapsedSeconds) });
  }

  function resetTimerDisplay() {
    if (timerDisplayInterval !== null) window.clearInterval(timerDisplayInterval);
    timerDisplayInterval = null;
    el.timerStart.hidden = false;
    el.timerRunning.hidden = true;
    el.timerActions.hidden = true;
    el.timerConfirm.hidden = true;
  }

  function openReadingModal() {
    el.readingModal.hidden = false;
    (el.readingStartView.hidden ? el.readingRecord : el.readingStart).focus();
  }
  function closeReadingModal() {
    el.readingModal.hidden = true;
    el.readingOpen.focus();
  }
  el.readingOpen.addEventListener('click', openReadingModal);
  el.readingClose.addEventListener('click', closeReadingModal);
  el.readingModal.addEventListener('click', (event) => {
    if (event.target === el.readingModal) closeReadingModal();
  });
  el.readingModal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeReadingModal();
  });
  el.readingStart.addEventListener('click', () => handlers.onStartReadingChallenge());
  el.readingRecord.addEventListener('click', () => {
    const workId = selectedReadingWorkId();
    if (workId) handlers.onRecordReading({ workId, mode: el.readingMode.value });
  });
  el.readingBook.addEventListener('change', () => {
    const status = latestState?.reading?.bookStatuses?.[selectedReadingWorkId()] ?? 'reading';
    el.readingStatus.value = status;
  });
  el.readingStatus.addEventListener('change', () => {
    const workId = selectedReadingWorkId();
    if (workId) handlers.onBookStatusChange(workId, el.readingStatus.value);
  });
  el.timerStart.addEventListener('click', () => {
    const workId = selectedReadingWorkId();
    if (!workId || !handlers.onTimerStart(workId)) return;
    timerDisplayStartedAt = performance.now();
    updateTimerDisplay();
    timerDisplayInterval = window.setInterval(updateTimerDisplay, 1000);
    el.timerStart.hidden = true;
    el.timerRunning.hidden = false;
    el.timerActions.hidden = false;
  });
  el.timerStop.addEventListener('click', () => {
    if (!handlers.onTimerStop()) return;
    if (timerDisplayInterval !== null) window.clearInterval(timerDisplayInterval);
    timerDisplayInterval = null;
    el.timerRunning.hidden = true;
    el.timerActions.hidden = true;
    el.timerConfirm.hidden = false;
  });
  el.timerCancel.addEventListener('click', () => {
    handlers.onTimerCancel();
    resetTimerDisplay();
  });
  el.timerConfirmYes.addEventListener('click', () => {
    handlers.onTimerConfirm(el.readingMode.value);
    resetTimerDisplay();
  });
  el.timerConfirmNo.addEventListener('click', () => {
    handlers.onTimerCancel();
    resetTimerDisplay();
  });
  function closeInterruptedPrompt(record) {
    el.readingRecovery.hidden = true;
    handlers.onInterruptedReadingDecision({ record, workId: interruptedWorkId });
    interruptedWorkId = null;
  }
  el.readingRecoveryYes.addEventListener('click', () => closeInterruptedPrompt(true));
  el.readingRecoveryNo.addEventListener('click', () => closeInterruptedPrompt(false));

  function offerInterruptedReading(workId) {
    const work = latestState?.books?.works?.[workId];
    if (!work) return false;
    interruptedWorkId = workId;
    el.readingRecoveryBook.textContent = work.title || copy.readingBookLabel;
    el.readingRecovery.hidden = false;
    el.readingRecoveryYes.focus();
    return true;
  }
  el.eggHint.textContent = copy.tapEgg;
  el.egg.setAttribute('aria-label', `${copy.eggLabel} — ${copy.tapEgg}`);
  el.zzz.innerHTML = iconMarkup('sleep');
  el.tuckText.textContent = copy.tuckInLine;
  el.tuckBtn.querySelector('.a-icon').textContent = copy.tuckInIcon;
  el.tuckBtn.querySelector('.t-label').textContent = copy.tuckInButton;
  el.tuckBtn.addEventListener('click', () => handlers.onTuckIn());
  for (const star of el.tuckVeil.querySelectorAll('.star')) {
    star.innerHTML = iconMarkup('sparkle');
  }
  el.shelf.setAttribute('aria-label', copy.shelfLabel);
  el.habitatTitle.textContent = interpolate(copy.habitatTitle, { owner: copy.habitatOwnerName });
  el.habitatWindow.setAttribute('aria-label', copy.habitatWindowLabel);
  el.habitatEmpty.textContent = copy.habitatEmpty;
  el.habitatEmpty.hidden = false;
  el.habitatEditBtn.textContent = copy.habitatEditButton;
  el.habitatEditBtn.addEventListener('click', () => toast(copy.habitatEditUnderConstructionNote));
  el.collectionTitle.textContent = copy.collectionTitle;
  el.visitorAsk.textContent = copy.habitatVisitorButton;
  el.visitorSave.textContent = copy.visitorSave;
  el.visitorSaved.textContent = copy.visitorSaved;
  el.visitorDismiss.textContent = copy.visitorDismiss;
  el.visitorReset.textContent = copy.visitorReset;

  // ----- book buddy visitor: fixture recommendation card (flag-gated) -----
  let visitorRecommendationId = null;

  function renderVisitorBooks(books) {
    el.visitorBooks.replaceChildren();
    for (const book of Array.isArray(books) ? books : []) {
      const item = document.createElement('li');
      item.className = 'visitor-book';
      const title = document.createElement('span');
      title.className = 'visitor-book-title';
      title.textContent = book?.title ?? '';
      const authors = document.createElement('span');
      authors.className = 'visitor-book-authors';
      authors.textContent = Array.isArray(book?.authors) ? book.authors.join(', ') : '';
      item.append(title, authors);
      el.visitorBooks.append(item);
    }
  }

  function renderVisitor(state) {
    if (!handlers.isRecommendationVisitorsEnabled()) {
      el.visitorAsk.hidden = true;
      el.visitorCard.hidden = true;
      return;
    }
    el.visitorAsk.hidden = false;

    const dismissedIds = Array.isArray(state?.recommendations?.dismissedIds)
      ? state.recommendations.dismissedIds
      : [];
    const savedIds = Array.isArray(state?.recommendations?.savedIds)
      ? state.recommendations.savedIds
      : [];
    const entry = visitorRecommendationId
      ? content.recommendations?.entries?.[visitorRecommendationId]
      : null;
    const showCard = Boolean(entry) && !dismissedIds.includes(visitorRecommendationId);

    if (!showCard) {
      el.visitorCard.hidden = true;
      el.visitorBooks.replaceChildren();
      return;
    }

    el.visitorCard.hidden = false;
    el.visitorGreeting.textContent = interpolate(copy.visitorGreeting, {
      name: content.recommendations?.visitorName ?? ''
    });
    el.visitorReason.textContent = entry.reason ?? '';
    el.visitorSampleNote.textContent = copy.visitorSampleNote;
    renderVisitorBooks(entry.books);

    const isSaved = savedIds.includes(visitorRecommendationId);
    el.visitorSave.hidden = isSaved;
    el.visitorSaved.hidden = !isSaved;
  }

  el.visitorAsk.addEventListener('click', () => {
    const outcome = handlers.onRequestRecommendation();
    if (outcome.ok) {
      visitorRecommendationId = outcome.recommendationId;
      toast(interpolate(copy.visitorArrivedToast, { name: content.recommendations?.visitorName ?? '' }));
      spawnSparks(icons.sparkle);
    } else {
      visitorRecommendationId = null;
      toast(copy.visitorNone);
    }
    renderVisitor(latestState);
  });
  el.visitorSave.addEventListener('click', () => {
    if (visitorRecommendationId) handlers.onSaveRecommendation(visitorRecommendationId);
  });
  el.visitorDismiss.addEventListener('click', () => {
    const id = visitorRecommendationId;
    visitorRecommendationId = null;
    if (id) handlers.onDismissRecommendation(id);
    renderVisitor(latestState);
  });
  el.visitorReset.addEventListener('click', () => {
    visitorRecommendationId = null;
    handlers.onResetRecommendations();
    renderVisitor(latestState);
  });
  el.welcomeTitle.textContent = copy.welcomeTitle;
  el.giftLine.textContent = copy.giftLine;
  el.welcomeBtn.textContent = copy.giftButton;
  el.welcomeBtn.addEventListener('click', () => {
    el.welcome.hidden = true;
    const newestId = el.welcome.dataset.stickerId;
    const newest = newestId
      ? el.shelf.querySelector(`[data-sticker-id="${newestId}"]`)
      : null;
    if (newest) flash(newest, 'just-got', 'sticker-pop');
    const firstAction = el.actions.querySelector('.action-btn:not(:disabled)');
    if (firstAction) firstAction.focus();
  });

  // ----- local book scanner + deterministic preview -----
  let latestState = null;
  let pendingReveals = [];
  let revealFlushScheduled = false;
  let pendingCreature = null;
  let pendingBookRecords = null;
  let scanRequest = 0;
  let debugReturnFocus = null;

  el.discoverPage.setAttribute('aria-label', copy.discoverTitle);
  el.bookPrivacy.textContent = copy.bookPrivacy;
  el.photoLabel.textContent = copy.discoverScanName;
  el.isbnLabel.textContent = copy.isbnLabel;
  el.isbnInput.placeholder = copy.isbnPlaceholder;
  el.isbnSubmit.textContent = copy.makeCreature;

  // ----- magic tome (Discover): copy + open/close + per-action reveal -----
  root.querySelector('.tome-cover-title').textContent = copy.discoverTomeTitle;
  root.querySelector('.tome-cover-hint').textContent = copy.discoverTomeHint;
  root.querySelector('.tome-guide-title').textContent = copy.discoverGuideTitle;
  root.querySelector('.tome-scan-name').textContent = copy.discoverScanName;
  root.querySelector('.tome-scan-desc').textContent = copy.discoverScanDesc;
  root.querySelector('.tome-isbn-name').textContent = copy.discoverIsbnName;
  root.querySelector('.tome-isbn-desc').textContent = copy.discoverIsbnDesc;
  root.querySelector('.tome-search-name').textContent = copy.discoverSearchName;
  root.querySelector('.tome-search-desc').textContent = copy.discoverSearchDesc;
  root.querySelector('.isbn-name').textContent = copy.discoverIsbnName;
  root.querySelector('.search-name').textContent = copy.discoverSearchName;
  root.querySelector('.tome-btn-ic').innerHTML = iconMarkup('camera');
  el.tomeClose.textContent = copy.discoverClose;
  el.tomeCover.addEventListener('click', () => { el.tome.dataset.open = 'true'; });
  el.tomeClose.addEventListener('click', () => {
    el.tome.dataset.open = 'false';
    for (const a of root.querySelectorAll('.tome-action')) a.dataset.open = 'false';
  });
  for (const toggle of root.querySelectorAll('.tome-action-toggle')) {
    toggle.addEventListener('click', () => {
      const action = toggle.closest('.tome-action');
      const willOpen = action.dataset.open !== 'true';
      for (const a of root.querySelectorAll('.tome-action')) a.dataset.open = 'false';
      action.dataset.open = String(willOpen);
      if (willOpen) action.querySelector('input')?.focus();
    });
  }
  el.bookSearchTitle.previousElementSibling.textContent = copy.searchTitleLabel;
  el.bookSearchTitle.placeholder = copy.searchTitlePlaceholder;
  el.bookSearchAuthor.previousElementSibling.textContent = copy.searchAuthorLabel;
  el.bookSearchAuthor.placeholder = copy.searchAuthorPlaceholder;
  el.bookSearchSubmit.textContent = copy.searchButton;
  el.bookResult.setAttribute('aria-label', copy.bookReady);
  el.creatureDebug.setAttribute('aria-label', copy.debugGear);
  el.previewDebug.setAttribute('aria-label', copy.debugGear);
  el.debugTitle.textContent = copy.debugTitle;
  el.debugNote.textContent = copy.debugNoPhoto;
  el.debugCapturedTitle.textContent = copy.debugCaptured;
  el.debugBookTitle.textContent = copy.debugBook;
  el.debugMappingTitle.textContent = copy.debugMapping;
  el.debugDerivedTitle.textContent = copy.debugDerived;
  el.debugJsonLabel.textContent = copy.debugRawJson;
  el.debugClose.textContent = '×';
  el.debugClose.setAttribute('aria-label', copy.debugClose);
  el.settingsPage.setAttribute('aria-label', copy.settingsTitle);
  el.settingsTitle.textContent = copy.settingsTitle;
  el.settingsAccountTitle.textContent = copy.settingsAccountTitle;
  el.settingsGuestNote.textContent = copy.settingsGuestNote;
  el.settingsServiceTitle.textContent = copy.settingsServiceTitle;
  el.settingsDataTitle.textContent = copy.settingsDataTitle;
  el.settingsExport.textContent = copy.settingsExport;
  el.settingsExportHint.textContent = copy.settingsExportHint;
  el.settingsDownload.textContent = copy.settingsDownload;
  el.settingsClearSuggestions.textContent = copy.settingsClearSuggestions;
  el.settingsDelete.textContent = copy.settingsDelete;
  el.settingsDeleteConfirm.querySelector('p').textContent = copy.settingsDeleteConfirm;
  el.settingsDeleteYes.textContent = copy.settingsDeleteYes;
  el.settingsDeleteCancel.textContent = copy.settingsDeleteCancel;
  el.settingsResearchTitle.textContent = copy.settingsResearchTitle;
  el.settingsCreditsTitle.textContent = copy.settingsCreditsTitle;
  el.settingsCreditsIntro.textContent = copy.settingsCreditsIntro;
  el.settingsCreditsList.replaceChildren(...(content.credits ?? []).map((credit) => {
    const item = document.createElement('li');
    item.className = 'settings-credit';
    const source = document.createElement('a');
    source.className = 'settings-credits-link';
    source.href = credit.url;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = credit.by ? `${credit.name} by ${credit.by}` : credit.name;
    const license = document.createElement('a');
    license.className = 'settings-credits-link';
    license.href = credit.licenseUrl;
    license.target = '_blank';
    license.rel = 'noopener noreferrer';
    license.textContent = credit.license;
    item.append(source, document.createTextNode(' — '), license);
    return item;
  }));

  // ----- theme picker (Settings) -----
  // Static: theme metadata never changes at runtime, so this is built once here
  // (not inside the per-render settings function) and works even pre-hatch.
  el.settingsAppearanceTitle.textContent = copy.settingsAppearanceTitle;

  function markSelectedTheme(id) {
    for (const btn of el.themePicker.querySelectorAll('.theme-opt')) {
      const selected = btn.dataset.themeId === id;
      btn.classList.toggle('selected', selected);
      btn.setAttribute('aria-checked', String(selected));
      btn.setAttribute('tabindex', selected ? '0' : '-1');
    }
  }

  for (const theme of THEMES) {
    const btn = document.createElement('button');
    btn.className = 'theme-opt';
    btn.dataset.themeId = theme.id;
    btn.setAttribute('role', 'radio');
    btn.type = 'button';

    const swatch = document.createElement('span');
    swatch.className = 'theme-swatch';
    swatch.style.setProperty('--sw1', theme.swatch[0]);
    swatch.style.setProperty('--sw2', theme.swatch[1]);
    swatch.style.setProperty('--sw3', theme.swatch[2]);

    const name = document.createElement('span');
    name.className = 'theme-opt-name';
    name.textContent = theme.name;

    btn.append(swatch, name);
    btn.addEventListener('click', () => {
      const applied = handlers.onSelectTheme(theme.id);
      markSelectedTheme(applied);
    });
    el.themePicker.append(btn);
  }

  markSelectedTheme(document.documentElement.dataset.theme || DEFAULT_THEME);

  // ----- under-construction placeholders (static, kid-friendly notes) -----
  el.progressTitle.textContent = copy.progressTitle;
  el.progressHistoryTitle.textContent = copy.progressHistoryTitle;
  el.progressHistoryEmpty.textContent = copy.progressHistoryEmpty;
  el.progressBooksTitle.textContent = copy.progressBooksTitle;
  el.eventsTitle.textContent = copy.eventsTitle;
  el.eventsNote.textContent = copy.eventsUnderConstructionNote;
  el.booksTitle.textContent = copy.underConstruction;
  el.booksNote.textContent = copy.booksUnderConstructionNote;

  // ----- bottom tab bar: 6 pages, one visible at a time -----
  const tabLabelKeys = {
    discover: 'navDiscover',
    care: 'navCare',
    habitat: 'navHabitat',
    progress: 'navProgress',
    books: 'navBooks',
    settings: 'navSettings'
  };
  const pageIds = Object.keys(el.pages);
  let currentPage = 'care';

  for (const pageId of pageIds) {
    const tab = el.tabs[pageId];
    if (!tab) continue;
    tab.querySelector('.tab-label').textContent = copy[tabLabelKeys[pageId]] ?? pageId;
    const tabIcon = tab.querySelector('.tab-icon');
    // Overwrite the emoji fallback in the template with a themed inline SVG.
    if (tabIcon) tabIcon.innerHTML = iconMarkup(pageId);
  }

  function showPage(pageId) {
    if (!pageIds.includes(pageId)) return;
    currentPage = pageId;
    for (const id of pageIds) {
      const page = el.pages[id];
      if (page) page.hidden = id !== pageId;
      const tab = el.tabs[id];
      if (!tab) continue;
      tab.setAttribute('aria-selected', String(id === pageId));
      tab.classList.toggle('active', id === pageId);
    }
    if (pageId === 'settings') renderSettings();
  }

  for (const pageId of pageIds) {
    const tab = el.tabs[pageId];
    if (tab) tab.addEventListener('click', () => showPage(pageId));
  }

  function renderDebugRows(target, definitions, values) {
    target.replaceChildren();
    for (const field of definitions) {
      const row = document.createElement('div');
      row.className = 'debug-row';
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = field.label;
      description.textContent = values[field.key] ?? '—';
      row.append(term, description);
      target.append(row);
    }
  }

  function openCreatureDebug(creature, returnFocus) {
    if (!creature) return;
    const capture = creature.capture ?? {};
    const size = capture.imageWidth && capture.imageHeight
      ? `${capture.imageWidth} × ${capture.imageHeight}`
      : '—';
    renderDebugRows(el.debugCapturedValues, content.generation.debugFields.captured, {
      source: capture.source ?? copy.debugLegacy,
      decoder: capture.decoder ?? copy.debugNotRecorded,
      rawValues: capture.rawValues?.join(', ') ?? '—',
      formats: capture.formats?.join(', ') ?? '—',
      imageType: capture.imageType ?? '—',
      imageSize: size,
      isbn: creature.isbn ?? '—'
    });
    const book = creature.book ?? {};
    renderDebugRows(el.debugBookValues, content.generation.debugFields.book, {
      lookupStatus: `${book.status ?? 'not recorded'} · ${book.source ?? 'unknown source'}`,
      title: book.title,
      authors: book.authors?.join(', '),
      publishers: book.publishers?.join(', '),
      years: [book.publishYear && `first ${book.publishYear}`, book.editionYear && `edition ${book.editionYear}`].filter(Boolean).join(' · '),
      pageCount: book.pageCount ? `${book.pageCount} pages` : null,
      format: book.format,
      genres: book.genres?.join(', '),
      subjects: book.subjects?.join(', '),
      series: book.series
    });
    el.debugMappingValues.replaceChildren();
    for (const mapping of creature.bookMapping ?? []) {
      const card = document.createElement('article');
      card.className = 'debug-map-row';
      const heading = document.createElement('h4');
      heading.textContent = `${mapping.source}: ${mapping.value}`;
      const result = document.createElement('p');
      result.textContent = `→ ${mapping.result}`;
      const rule = document.createElement('small');
      rule.textContent = `${mapping.rule} · ${mapping.affects}`;
      card.append(heading, result, rule);
      el.debugMappingValues.append(card);
    }
    if (!creature.bookMapping?.length) {
      el.debugMappingValues.textContent = copy.debugMetadataLegacy;
    }
    renderDebugRows(el.debugDerivedValues, content.generation.debugFields.derived, {
      seedVersion: creature.seedVersion,
      hashAlgorithm: creature.hashAlgorithm,
      seed: creature.seed,
      name: creature.name,
      family: `${creature.family.label} (${creature.family.id})`,
      body: creature.family.body,
      appendage: creature.family.appendage,
      palette: `${creature.palette.label} (${creature.palette.id})`,
      hues: `${creature.palette.hue} / ${creature.palette.accentHue}`,
      pattern: `${creature.pattern.label} (${creature.pattern.id})`,
      patternBits: `0x${creature.pattern.bits.toString(16).padStart(4, '0')}`,
      placements: creature.pattern.placements.join(', '),
      voice: `${creature.voice.label} (${creature.voice.id})`,
      idle: `${creature.idle.label} (${creature.idle.id})`,
      quirk: `${creature.quirk.label} (${creature.quirk.id})`,
      rarity: `${creature.rarity.label} · ${creature.rarity.roll}`,
      publisher: `${creature.publisher.icon} ${creature.publisher.label}`,
      language: creature.languageGroup.label
    });
    el.debugJson.textContent = JSON.stringify(creature, null, 2);
    debugReturnFocus = returnFocus;
    el.debugModal.hidden = false;
    el.debugClose.focus();
  }

  function closeCreatureDebug() {
    el.debugModal.hidden = true;
    if (debugReturnFocus) debugReturnFocus.focus();
  }

  el.creatureDebug.addEventListener('click', () =>
    openCreatureDebug(latestState?.creature, el.creatureDebug));
  el.previewDebug.addEventListener('click', () =>
    openCreatureDebug(pendingCreature, el.previewDebug));
  el.debugClose.addEventListener('click', closeCreatureDebug);
  el.debugModal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCreatureDebug();
  });

  // ----- settings & evidence modal -----
  // Defensive by design: handlers may be missing or throw (older/partial wiring,
  // future providers); every read goes through safeCall so a bad handler never
  // breaks the rest of the settings surface.
  function safeCall(fn, fallback) {
    try {
      const result = fn();
      return result === undefined ? fallback : result;
    } catch {
      return fallback;
    }
  }

  const providerLabelKeys = {
    storage: 'settingsProviderStorage',
    recommendations: 'settingsProviderRecommendations'
  };

  let lastExportedSave = null;

  function renderSettingsAccount() {
    const account = safeCall(() => handlers.getAccountExplanation(), {});
    const isGuest = account?.accountStatus !== 'signed_in';
    el.settingsAccountStatus.textContent = isGuest ? copy.settingsGuest : copy.settingsSignedIn;
    el.settingsLibraryStatus.textContent = interpolate(copy.settingsLibrary, {
      status: account?.libraryStatus === 'connected'
        ? copy.settingsLibraryConnected
        : copy.settingsLibraryDisconnected
    });
    el.settingsGuestNote.hidden = !account?.guestOnlyThisBrowser;
  }

  function renderSettingsProviders() {
    el.settingsProviderList.replaceChildren();
    const statuses = safeCall(() => handlers.getProviderStatuses(), []);
    for (const status of Array.isArray(statuses) ? statuses : []) {
      if (!status || typeof status.id !== 'string') continue;
      const item = document.createElement('li');
      item.className = 'settings-provider-item';
      const label = document.createElement('span');
      label.className = 'settings-provider-label';
      label.textContent = copy[providerLabelKeys[status.id]] ?? status.id;
      const state = document.createElement('span');
      state.className = 'settings-provider-state';
      const available = status.available === true;
      state.dataset.available = String(available);
      state.textContent = available ? copy.settingsAvailable : copy.settingsUnavailable;
      item.append(label, state);
      if (status.sample === true) {
        const pill = document.createElement('span');
        pill.className = 'settings-sample-pill';
        pill.textContent = copy.settingsSample;
        item.append(pill);
      }
      el.settingsProviderList.append(item);
    }
  }

  function renderSettingsResearch() {
    const research = safeCall(() => handlers.getResearchSection(), { enabled: false, disclaimer: null, entries: [] });
    const enabled = research?.enabled === true;
    el.settingsResearch.hidden = !enabled;
    el.settingsResearchDisclaimer.textContent = '';
    el.settingsResearchEntries.replaceChildren();
    if (!enabled) return;
    el.settingsResearchDisclaimer.textContent = research.disclaimer ?? '';
    for (const entry of Array.isArray(research.entries) ? research.entries : []) {
      if (!entry) continue;
      const card = document.createElement('article');
      card.className = 'settings-research-entry';
      const heading = document.createElement('h4');
      heading.textContent = entry.title ?? '';
      const summary = document.createElement('p');
      summary.textContent = entry.summary ?? '';
      const link = document.createElement('a');
      link.className = 'settings-research-link';
      link.href = entry.sourceUrl ?? '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = entry.sourceLabel ?? entry.sourceUrl ?? '';
      const reviewed = document.createElement('p');
      reviewed.className = 'settings-research-reviewed';
      reviewed.textContent = interpolate(copy.settingsResearchReviewed, { date: entry.lastReviewedAt ?? '' });
      card.append(heading, summary, link, reviewed);
      el.settingsResearchEntries.append(card);
    }
  }

  function resetSettingsDeleteConfirm() {
    el.settingsDelete.hidden = false;
    el.settingsDeleteConfirm.hidden = true;
  }

  function resetSettingsExportPanel() {
    lastExportedSave = null;
    el.settingsExportPanel.hidden = true;
    el.settingsExportText.value = '';
  }

  // Refreshed on every render(): informational only, never clobbers a
  // mid-interaction export panel or delete confirmation.
  function renderSettingsContent() {
    renderSettingsAccount();
    renderSettingsProviders();
    renderSettingsResearch();
  }

  // Full reset + refresh: run once at boot and each time the Settings tab
  // is opened, mirroring the old "fresh state every time you open settings" feel.
  function renderSettings() {
    resetSettingsDeleteConfirm();
    resetSettingsExportPanel();
    renderSettingsContent();
  }

  el.settingsExport.addEventListener('click', () => {
    const json = safeCall(() => handlers.onExportSave(), null);
    if (typeof json !== 'string') return;
    lastExportedSave = json;
    el.settingsExportText.value = json;
    el.settingsExportPanel.hidden = false;
    el.settingsExportText.focus();
    el.settingsExportText.select();
  });

  el.settingsDownload.addEventListener('click', () => {
    if (typeof lastExportedSave !== 'string') return;
    const blob = new Blob([lastExportedSave], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tome-sweet-tome-save.json';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  el.settingsClearSuggestions.addEventListener('click', () => {
    safeCall(() => handlers.onDeleteRecommendationData(), null);
    toast(copy.settingsSuggestionsCleared);
    renderSettingsProviders();
  });

  el.settingsDelete.addEventListener('click', () => {
    el.settingsDelete.hidden = true;
    el.settingsDeleteConfirm.hidden = false;
    el.settingsDeleteYes.focus();
  });
  el.settingsDeleteCancel.addEventListener('click', () => {
    resetSettingsDeleteConfirm();
    el.settingsDelete.focus();
  });
  el.settingsDeleteYes.addEventListener('click', () => {
    safeCall(() => handlers.onDeleteSave(), null);
  });

  function setScanBusy(busy) {
    el.discoverPage.dataset.busy = String(busy);
    el.photoInput.disabled = busy;
    el.isbnInput.disabled = busy;
    el.isbnSubmit.disabled = busy;
    el.bookSearchTitle.disabled = busy;
    el.bookSearchAuthor.disabled = busy;
    el.bookSearchSubmit.disabled = busy;
  }

  const errorCopy = {
    empty: copy.scanInvalid,
    invalidCharacters: copy.scanInvalid,
    wrongLength: copy.scanInvalid,
    invalidChecksum: copy.scanInvalid,
    notBookBarcode: copy.scanNotBook,
    noBarcode: copy.scanNoBarcode,
    detectorUnavailable: copy.scanUnavailable,
    notImage: copy.scanNotImage,
    scanFailed: copy.scanFailed,
    hashUnavailable: copy.scanHashFailed,
    missingTitle: copy.searchInvalid,
    missingAuthor: copy.searchInvalid,
    invalidQuery: copy.searchInvalid,
    invalidBookSearch: copy.searchInvalid,
    metadataUnavailable: copy.searchUnavailable,
    notFound: copy.searchUnavailable,
    not_found: copy.searchUnavailable,
    malformed_result: copy.searchUnavailable,
    provider_unavailable: copy.searchUnavailable
  };

  function showScanStatus(text, isError = false) {
    el.scanStatus.textContent = text;
    el.scanStatus.setAttribute('role', isError ? 'alert' : 'status');
  }

  function positionMarks(markElements, placements) {
    const layout = content.generation.markingLayout;
    markElements.forEach((mark, index) => {
      const value = placements[index] ?? 0;
      const column = value & 3;
      const row = value >>> 2;
      mark.style.setProperty('--mx', `${layout.bases[index].x + column * layout.positionStep}%`);
      mark.style.setProperty('--my', `${layout.bases[index].y + row * layout.positionStep}%`);
      mark.style.setProperty('--mr', `${(column - row) * layout.rotationStep}deg`);
    });
  }

  // Paint sprite <img> layers (from systems/sprite-map.js's spriteLookFor/
  // layoutFor) into `frameEl`. Clears and rebuilds every call — renders are
  // event-driven, not a tight loop, so this stays cheap and always correct.
  // `cssScale: true` (hero) positions via calc(var(--scale) * Npx) so the
  // existing --scale-driven growth animation keeps working unchanged;
  // `cssScale: false` (mini) writes plain px pre-multiplied by `factor`.
  function paintSpriteLayers(frameEl, look, { includeIds, cssScale, factor = 1 } = {}) {
    frameEl.querySelectorAll(':scope > img.sl-part').forEach((img) => img.remove());
    const { parts } = layoutFor(look);
    const px = (n) => {
      const scaled = n * factor;
      return cssScale ? `calc(var(--scale) * ${scaled}px)` : `${scaled}px`;
    };
    for (const part of parts) {
      if (includeIds && !includeIds.has(part.id)) continue;
      const img = document.createElement('img');
      img.className = `sl-part sl-${part.id}${part.mirror ? ' sl-mirror' : ''}`;
      img.alt = '';
      img.src = `${SPRITE_BASE}${part.file}`;
      img.style.zIndex = String(part.z);
      img.style.left = px(part.left);
      img.style.top = px(part.top);
      img.style.width = px(part.w);
      img.style.height = px(part.h);
      frameEl.append(img);
    }
  }

  const MINI_PART_IDS = new Set(['body', 'eye', 'eyeL', 'eyeR', 'nose', 'mouth']);

  // Paint an existing .book-orb element from a creature look (baseTraits shape).
  // Reused by the book preview AND the collection chips so they share one look.
  function paintMiniOrb(orb, creature, { wild = false } = {}) {
    if (!orb || !creature || !creature.family || !creature.pattern || !creature.palette) return;
    orb.dataset.body = creature.family.body;
    orb.dataset.pattern = creature.pattern.id;
    orb.style.setProperty('--hue', String(creature.palette.hue));
    orb.style.setProperty('--accent', String(creature.palette.accentHue));
    positionMarks([...orb.querySelectorAll('.mini-mark')], creature.pattern.placements ?? []);

    const generated = creature.kind === 'book';
    // Habitat/collection orbs are built by buildMiniOrb() (which adds the
    // .mini-sprite wrapper), but the book-PREVIEW orb is static template markup
    // that lacks it — create it on demand so previews sprite too (was the cause
    // of scanned-book previews still showing the old glyph).
    let miniSprite = orb.querySelector('.mini-sprite');
    if (generated && !miniSprite) {
      miniSprite = document.createElement('div');
      miniSprite.className = 'mini-sprite';
      orb.append(miniSprite);
    }
    const miniFace = orb.querySelector('.mini-face');
    if (!generated || !miniSprite) {
      delete orb.dataset.shape;
      if (miniFace) miniFace.style.display = '';
      if (miniSprite) miniSprite.replaceChildren();
      return;
    }
    if (miniFace) miniFace.style.display = 'none'; // hide the old glyph beneath the sprite
    // Mini orbs never grow with stage and never show mood overlays (the old
    // static mini-face glyph didn't either) - a neutral fixed stage/mood
    // gives a stable body+eye+mouth+nose look, same for every render.
    const look = spriteLookFor(creature, 3, wild ? 'wild' : 'content');
    const { shape } = look.body;
    const factor = MINI_SCALE[shape] ?? 0.3;
    const { frame } = layoutFor(look);
    orb.dataset.shape = shape;
    miniSprite.style.width = `${frame.w * factor}px`;
    miniSprite.style.height = `${frame.h * factor}px`;
    paintSpriteLayers(miniSprite, look, { includeIds: MINI_PART_IDS, cssScale: false, factor });
  }

  // Build a fresh .book-orb mini-creature element (same markup as the preview orb).
  function buildMiniOrb() {
    const orb = document.createElement('div');
    orb.className = 'book-orb';
    orb.setAttribute('aria-hidden', 'true');
    for (const n of [1, 2, 3, 4]) {
      const mark = document.createElement('span');
      mark.className = `mini-mark mm${n}`;
      orb.append(mark);
    }
    const sprite = document.createElement('div');
    sprite.className = 'mini-sprite';
    orb.append(sprite);
    return orb;
  }

  function showCreaturePreview(creature) {
    pendingCreature = creature;
    el.bookResult.hidden = false;
    el.bookName.textContent = creature.name;
    el.bookLine.textContent = interpolate(copy.bookPreviewLine, {
      family: creature.family.label,
      palette: creature.palette.label,
      rarity: creature.rarity.label
    });
    el.bookDetails.textContent = interpolate(copy.bookPreviewDetails, {
      quirk: creature.quirk.label,
      voice: creature.voice.label
    });
    el.bookBirthmark.textContent = interpolate(copy.bookBirthmarkLine, {
      icon: creature.publisher.icon,
      publisher: creature.publisher.label
    });
    el.bookIsbnLine.textContent = creature.isbn
      ? interpolate(copy.bookEditionLine, { isbn: creature.isbn })
      : copy.bookSearchEditionLine;
    if (latestState?.hatched) {
      el.bookUse.textContent = interpolate(copy.takeCareButton, { name: creature.name });
      el.bookAdd.textContent = copy.addToHabitatButton;
      el.bookAdd.hidden = false;
    } else {
      el.bookUse.textContent = copy.useEgg;
      el.bookAdd.hidden = true;
    }
    paintMiniOrb(el.bookOrb, creature, { wild: true });
    showScanStatus(copy.bookReady);
    el.bookUse.focus();
  }

  async function runScan(task) {
    const request = ++scanRequest;
    setScanBusy(true);
    el.bookResult.hidden = true;
    pendingCreature = null;
    showScanStatus(copy.scanReading);
    try {
      const result = await task();
      if (request !== scanRequest) return;
      if (result.ok) {
        pendingBookRecords = result.bookRecords;
        showCreaturePreview(result.creature);
      }
      else showScanStatus(errorCopy[result.reason] ?? copy.scanFailed, true);
    } catch {
      if (request === scanRequest) showScanStatus(copy.scanFailed, true);
    } finally {
      if (request === scanRequest) setScanBusy(false);
    }
  }

  el.photoInput.addEventListener('change', () => {
    const [file] = el.photoInput.files;
    if (file) runScan(() => handlers.onScanFile(file));
    el.photoInput.value = '';
  });

  el.isbnForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runScan(() => handlers.onManualIsbn(el.isbnInput.value));
  });

  el.bookSearchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runScan(() => handlers.onTitleAuthorSearch({
      title: el.bookSearchTitle.value,
      author: el.bookSearchAuthor.value
    }));
  });

  function catchCreature({ takeCare }) {
    if (!pendingCreature) return;
    const wasHatched = Boolean(latestState?.hatched);
    // Scanning CATCHES the creature into the habitat (still WILD until you read its
    // book). "Take care" also makes it your active creature straight away.
    const creatureId = handlers.onUseCreature(pendingCreature, pendingBookRecords);
    if (takeCare && creatureId) handlers.onActivateCreature(creatureId);
    pendingCreature = null;
    pendingBookRecords = null;
    // Discover is a permanent page now (no "open" event resets it for next time),
    // so clear the just-used preview here rather than leaving it stale on screen.
    el.bookResult.hidden = true;
    showScanStatus('');
    if (takeCare || !wasHatched) {
      // Taking care (or hatching your first) → the hero scene on Pet Care.
      showPage('care');
      if (!wasHatched) el.egg.focus();
    } else {
      // Just caught it → go see it land in the habitat.
      showPage('habitat');
    }
  }
  el.bookUse.addEventListener('click', () => catchCreature({ takeCare: true }));
  el.bookAdd.addEventListener('click', () => catchCreature({ takeCare: false }));

  // ----- meters (built once from content) -----
  const meterEls = {};
  el.meters.setAttribute('role', 'group');
  for (const meter of content.stats.meters) {
    const row = document.createElement('div');
    row.className = `meter m-${meter.id}`;
    const icon = document.createElement('span');
    icon.className = 'm-icon';
    icon.textContent = meter.icon;
    const track = document.createElement('div');
    track.className = 'track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', meter.label);
    track.setAttribute('aria-valuemin', String(content.stats.min));
    track.setAttribute('aria-valuemax', String(content.stats.max));
    const fill = document.createElement('div');
    fill.className = 'fill';
    track.append(fill);
    row.append(icon, track);
    el.meters.append(row);
    meterEls[meter.id] = { track, fill };
  }

  // ----- action buttons (built once from content) -----
  const actionEls = {};
  el.actions.setAttribute('aria-label', copy.actionsLabel);
  for (const action of content.care.actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `action-btn b-${action.id}`;
    const icon = document.createElement('span');
    icon.className = 'a-icon';
    icon.textContent = action.icon;
    const label = document.createElement('span');
    label.className = 'a-label';
    label.textContent = action.label;
    const sub = document.createElement('span');
    sub.className = 'a-sub';
    btn.append(icon, label, sub);
    btn.addEventListener('click', () => handlers.onAction(action.id));
    el.actions.append(btn);
    actionEls[action.id] = { btn, sub };
  }

  // ----- egg hatch flow: crack animation first, then the Hatched intent -----
  let cracking = false;
  el.egg.addEventListener('click', () => {
    if (cracking) return;
    cracking = true;
    el.egg.classList.add('cracking');
  });
  el.egg.addEventListener('animationend', (e) => {
    if (e.animationName === 'egg-crack') handlers.onHatch();
  });

  // ----- animation helpers (no timers: cleanup rides on animationend) -----
  function flash(target, cls, animName) {
    target.classList.remove(cls);
    void target.offsetWidth; // restart the animation
    target.classList.add(cls);
    const onEnd = (e) => {
      if (e.animationName !== animName) return;
      target.classList.remove(cls);
      target.removeEventListener('animationend', onEnd);
    };
    target.addEventListener('animationend', onEnd);
  }

  function spawnSparks(iconChar) {
    for (let i = 0; i < content.ui.sparkleCount; i += 1) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.textContent = iconChar;
      s.addEventListener('animationend', () => s.remove(), { once: true });
      el.fx.append(s);
    }
  }

  function burstWord(text) {
    const w = document.createElement('span');
    w.className = 'burst-word';
    w.textContent = text;
    w.addEventListener('animationend', () => w.remove(), { once: true });
    el.burstLayer.append(w);
  }

  function toast(text) {
    el.toast.textContent = text;
    flash(el.toast, 'show', 'toast-life');
  }

  // Grouped reveal celebration: several CreatureRevealed events fire in one
  // synchronous burst; buffer them and present a single cozy celebration.
  function flushReveals() {
    revealFlushScheduled = false;
    const revealed = pendingReveals;
    pendingReveals = [];
    if (revealed.length === 0) return;
    spawnSparks(icons.sparkle);
    if (revealed.length === 1) {
      const name = revealed[0]?.baseTraits?.name ?? '';
      toast(interpolate(copy.creatureRevealedOne, { name }));
    } else {
      toast(interpolate(copy.creatureRevealedMany, { count: revealed.length }));
    }
  }

  const fill = (template, state) => interpolate(template, {
    name: state.name ?? content.species.name
  });

  function applyCreatureLook(state, stage) {
    const creature = state.creature;
    const generated = creature?.kind === 'book';
    root.dataset.bookCreature = String(generated);
    el.creature.dataset.generated = String(generated);
    el.egg.dataset.generated = String(generated);
    el.creature.style.setProperty('--scale', stage.theme.scale);

    if (!generated) {
      el.creature.style.setProperty('--hue', stage.theme.hue);
      el.creature.style.removeProperty('--accent');
      el.creature.style.removeProperty('--body-radius');
      delete el.creature.dataset.body;
      delete el.creature.dataset.appendage;
      delete el.creature.dataset.pattern;
      delete el.creature.dataset.idle;
      delete el.creature.dataset.rarity;
      el.birthmark.textContent = '';
      el.egg.style.removeProperty('--egg-hue');
      el.egg.style.removeProperty('--egg-accent');
      el.eggHint.textContent = copy.tapEgg;
      el.egg.setAttribute('aria-label', `${copy.eggLabel} — ${copy.tapEgg}`);

      // A hatched plain starter (no book yet) still gets a sprite — a fixed warm
      // default look — so the very first monster is never a bare CSS blob. The
      // pre-hatch egg state (not hatched) shows no creature, so skip it there.
      if (state.hatched && el.creatureBody) {
        const mood = state.tuckedIn ? 'sleepy' : moodOf(state);
        const look = defaultSpriteLook(stage.stage, mood);
        el.creature.dataset.generated = 'true';
        el.creature.dataset.shape = look.body.shape;
        positionMarks(el.marks, []);
        const { frame } = layoutFor(look);
        el.creature.style.setProperty('--body-width', `${frame.w}px`);
        el.creature.style.setProperty('--body-height', `${frame.h}px`);
        const includeIds = new Set(['body', 'eye', 'eyeL', 'eyeR', 'nose', 'mouth']);
        if (look.partsVisible.legs) { includeIds.add('legL'); includeIds.add('legR'); }
        if (look.partsVisible.arms) { includeIds.add('armL'); includeIds.add('armR'); }
        if (look.partsVisible.detail) { includeIds.add('detailL'); includeIds.add('detailR'); }
        paintSpriteLayers(el.creatureBody, look, { includeIds, cssScale: true, factor: 1 });
      } else {
        delete el.creature.dataset.shape;
        el.creature.style.removeProperty('--body-width');
        el.creature.style.removeProperty('--body-height');
        if (el.creatureBody) el.creatureBody.replaceChildren();
      }
      return;
    }

    const hue = (Number(creature.palette.hue) + Number(stage.theme.hueShift ?? 0)) % 360;
    el.creature.style.setProperty('--hue', String(hue));
    el.creature.style.setProperty('--accent', String(creature.palette.accentHue));
    el.creature.style.setProperty('--body-radius', creature.family.radius);
    el.creature.dataset.body = creature.family.body;
    el.creature.dataset.appendage = creature.family.appendage;
    el.creature.dataset.pattern = creature.pattern.id;
    el.creature.dataset.idle = creature.idle.id;
    el.creature.dataset.rarity = creature.rarity.id;
    el.birthmark.textContent = creature.publisher.icon;
    el.birthmark.title = `${creature.publisher.label} birthmark`;
    positionMarks(el.marks, creature.pattern.placements);
    el.egg.style.setProperty('--egg-hue', String(hue));
    el.egg.style.setProperty('--egg-accent', String(creature.palette.accentHue));
    el.eggHint.textContent = interpolate(copy.bookEggHint, { name: creature.name });
    el.egg.setAttribute('aria-label', `${copy.eggLabel} — ${el.eggHint.textContent}`);

    // Monster Builder sprite assembly, painted inside .creature .body. Mood
    // folds in tuckedIn here (both are already-deterministic derived state)
    // so sprite-map.js's spriteLookFor() only ever sees one effective mood.
    // A caught-but-unread creature is WILD (angry) until reading tames it.
    const activeRecord = state.collection?.creatures?.[state.collection?.activeCreatureId];
    const wild = activeRecord?.revealed === false;
    const mood = state.tuckedIn ? 'sleepy' : (wild ? 'wild' : moodOf(state));
    const look = spriteLookFor(creature, stage.stage, mood);
    el.creature.dataset.shape = look.body.shape;
    if (el.creatureBody) {
      const { frame } = layoutFor(look);
      el.creature.style.setProperty('--body-width', `${frame.w}px`);
      el.creature.style.setProperty('--body-height', `${frame.h}px`);
      const includeIds = new Set(['body', 'eye', 'eyeL', 'eyeR', 'nose', 'mouth']);
      if (look.partsVisible.legs) { includeIds.add('legL'); includeIds.add('legR'); }
      if (look.partsVisible.arms) { includeIds.add('armL'); includeIds.add('armR'); }
      if (look.partsVisible.detail) { includeIds.add('detailL'); includeIds.add('detailR'); }
      paintSpriteLayers(el.creatureBody, look, { includeIds, cssScale: true, factor: 1 });
    }
  }

  // ----- render: state -> DOM (idempotent) -----
  function render(state) {
    latestState = state;
    root.dataset.hatched = String(state.hatched);
    const stage = stageDef(state.stage);
    applyCreatureLook(state, stage);
    renderReading(state);
    // These pages are always reachable (even pre-hatch), so their renderers run
    // unconditionally, above the early return below.
    renderProgress(state);
    renderSettingsContent();
    if (!state.hatched) return;

    el.scene.dataset.stage = String(state.stage);

    el.scene.dataset.tucked = String(state.tuckedIn);
    el.tuckBtn.disabled = state.tuckedIn;

    const mood = moodOf(state);
    el.scene.dataset.mood = mood;
    const moodDef = content.mood.moods[mood];
    el.namePill.textContent = state.name;
    // A wild (caught-but-unread) active creature reads as fierce, not its stat mood.
    const activeRec = state.collection?.creatures?.[state.collection?.activeCreatureId];
    el.moodChip.textContent = activeRec?.revealed === false
      ? copy.moodWildChip
      : `${moodDef.icon} ${moodDef.label}`;
    renderDailyCare(state, stage);
    renderRelationship(state);

    renderGrowth(state, stage);

    renderShelf(state);
    renderHabitat(state);
    renderCollection(state);
    renderVisitor(state);

    for (const meter of content.stats.meters) {
      const value = state.stats[meter.id];
      const { track, fill: bar } = meterEls[meter.id];
      bar.style.setProperty('--v', String(value / content.stats.max));
      track.setAttribute('aria-valuenow', String(Math.round(value)));
    }

    for (const action of content.care.actions) {
      const { btn, sub } = actionEls[action.id];
      const check = handlers.canPerform(action.id);
      const resting = !check.ok && check.reason === 'lowEnergy';
      btn.classList.toggle('resting', resting);
      btn.disabled = resting;
      sub.textContent = resting ? copy.restingLabel : '';
    }
  }

  function renderReading(state) {
    const registered = state.reading.challenge.registeredAt !== null;
    el.readingStartView.hidden = registered;
    el.readingActiveView.hidden = !registered;
    if (!registered) return;

    const progress = handlers.getReadingProgress(state.reading);
    const progressTemplates = {
      registered: copy.readingRegistered,
      active: copy.readingActive,
      halfway: copy.readingHalfway,
      completed: copy.readingCompleted
    };
    el.readingProgress.textContent = interpolate(progressTemplates[progress.status], {
      days: progress.readingDayCount,
      goal: progress.goalDayCount
    });

    const previous = selectedReadingWorkId();
    el.readingBook.replaceChildren();
    const works = Object.values(state.books.works);
    for (const work of works) el.readingBook.add(new Option(work.title || 'Untitled book', work.id));
    if (works.some(({ id }) => id === previous)) el.readingBook.value = previous;
    const hasBooks = works.length > 0;
    el.readingEmpty.hidden = hasBooks;
    for (const control of [el.readingBook, el.readingMode, el.readingRecord, el.readingStatus]) {
      control.disabled = !hasBooks;
    }
    const workId = selectedReadingWorkId();
    el.readingStatus.value = state.reading.bookStatuses[workId] ?? 'reading';
    el.readingTimer.hidden = !handlers.isTimerEnabled();
    el.timerStart.disabled = !hasBooks;
  }

  // ----- Progress & Events page: program status, full history, your books -----
  // Independent of the Pet Care reading-progress echo — reads the same handler
  // and templates, but never touches the Care page's own elements. Entirely
  // defensive: a malformed record or missing work never throws.
  function renderProgress(state) {
    try {
      const reading = state?.reading ?? {};
      const registered = reading?.challenge?.registeredAt != null;
      let statusText = copy.readingIntro;
      if (registered) {
        const progress = safeCall(() => handlers.getReadingProgress(reading), null);
        const progressTemplates = {
          registered: copy.readingRegistered,
          active: copy.readingActive,
          halfway: copy.readingHalfway,
          completed: copy.readingCompleted
        };
        const template = progress ? progressTemplates[progress.status] : null;
        if (template) {
          statusText = interpolate(template, {
            days: progress.readingDayCount,
            goal: progress.goalDayCount
          });
        }
      }
      el.progressStatus.textContent = statusText;
    } catch {
      el.progressStatus.textContent = copy.readingIntro;
    }

    // Full reading history, newest first.
    el.progressHistoryList.replaceChildren();
    let records = [];
    try {
      records = Object.values(state?.reading?.records ?? {}).filter(Boolean);
      records.sort((a, b) => {
        const at = Date.parse(a?.occurredAt ?? '') || 0;
        const bt = Date.parse(b?.occurredAt ?? '') || 0;
        if (bt !== at) return bt - at;
        return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
      });
    } catch {
      records = [];
    }
    for (const record of records) {
      try {
        const work = state?.books?.works?.[record.workId];
        const title = work?.title || copy.readingBookLabel || 'Untitled book';
        const modeLabel = content.reading.modes?.[record.mode] ?? '';
        const item = document.createElement('li');
        item.className = 'progress-history-item';
        const titleEl = document.createElement('span');
        titleEl.className = 'progress-history-book';
        titleEl.textContent = title;
        const metaEl = document.createElement('span');
        metaEl.className = 'progress-history-meta';
        metaEl.textContent = [record.localDayKey, modeLabel].filter(Boolean).join(' · ');
        item.append(titleEl, metaEl);
        el.progressHistoryList.append(item);
      } catch {
        // Skip a malformed record rather than breaking the whole list.
      }
    }
    el.progressHistoryEmpty.hidden = records.length > 0;

    // "Your books": a small read-only status list (the changer stays on Pet Care).
    el.progressBooksList.replaceChildren();
    let works = [];
    try {
      works = Object.values(state?.books?.works ?? {}).filter(Boolean);
    } catch {
      works = [];
    }
    for (const work of works) {
      try {
        const statusId = state?.reading?.bookStatuses?.[work.id] ?? 'reading';
        const statusLabel = content.reading.statuses?.[statusId] ?? statusId;
        const item = document.createElement('li');
        item.className = 'progress-books-item';
        const titleEl = document.createElement('span');
        titleEl.className = 'progress-books-book';
        titleEl.textContent = work.title || copy.readingBookLabel || 'Untitled book';
        const statusEl = document.createElement('span');
        statusEl.className = 'progress-books-status';
        statusEl.textContent = statusLabel;
        item.append(titleEl, statusEl);
        el.progressBooksList.append(item);
      } catch {
        // Skip a malformed work rather than breaking the whole list.
      }
    }
  }

  // ----- sticker shelf: the whole collection lives in the scene -----
  function renderShelf(state) {
    el.shelf.replaceChildren();
    const counts = new Map();
    for (const id of state.stickers) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const sticker of content.stickers) {
      const slot = document.createElement('span');
      slot.className = 'slot';
      slot.setAttribute('role', 'listitem');
      slot.dataset.stickerId = sticker.id;
      const owned = counts.get(sticker.id) ?? 0;
      if (owned > 0) {
        slot.classList.add('owned');
        slot.textContent = sticker.icon;
        slot.title = sticker.label;
        slot.setAttribute('aria-label', owned > 1 ? `${sticker.label}, ${owned}` : sticker.label);
        if (owned > 1) {
          const badge = document.createElement('span');
          badge.className = 'count';
          badge.textContent = `×${owned}`;
          slot.append(badge);
        }
      } else {
        slot.setAttribute('aria-label', `${sticker.label}, not collected`);
      }
      el.shelf.append(slot);
    }
  }

  // Ordered revealed creatures: active first, then remaining visible, then
  // archived. Only revealed creatures appear; each is painted from its OWN
  // baseTraits (never state.creature, which only reflects the active creature).
  function revealedOrdered(state) {
    const collection = state?.collection;
    const creatures = collection?.creatures;
    if (!collection || !creatures) return { ordered: [], activeId: null };
    const activeId = collection.activeCreatureId ?? null;
    const visibleIds = Array.isArray(collection.visibleCreatureIds) ? collection.visibleCreatureIds : [];
    const archivedIds = Array.isArray(collection.archivedCreatureIds) ? collection.archivedCreatureIds : [];
    const ordered = [];
    const seen = new Set();
    const push = (id) => {
      if (id == null || seen.has(id)) return;
      const record = creatures[id];
      if (!record) return;
      seen.add(id);
      ordered.push(record);
    };
    push(activeId);
    for (const id of visibleIds) push(id);
    for (const id of archivedIds) push(id);
    // Caught-but-still-WILD creatures (scanned, not yet read/tamed) belong in the
    // habitat too — append any not already placed via active/visible/archived.
    for (const id of Object.keys(creatures)) push(id);
    return { ordered, activeId };
  }

  // Which creatures are placed in the habitat window. Session-local: a creature
  // is shown unless the player has hidden it, and the active buddy is always in.
  // New creatures appear automatically because absence-from-the-set means shown.
  const habitatHidden = new Set();
  const inHabitat = (record, activeId) => record.id === activeId || !habitatHidden.has(record.id);

  // ----- habitat window: the active creatures wander a little library scene.
  // Monsters are the same painted mini-orb as the collection, positioned along a
  // floor line and gently animated (bounce + drift) by CSS. Layout params are
  // derived from the slot index so they stay stable across re-renders.
  function renderHabitat(state) {
    const { ordered, activeId } = revealedOrdered(state);
    el.habitatEmpty.hidden = ordered.length > 0;
    const members = ordered.filter((record) => inHabitat(record, activeId));
    el.habitatStage.replaceChildren();
    const n = members.length;
    members.forEach((record, i) => {
      const monster = document.createElement('div');
      monster.className = 'habitat-monster';
      monster.dataset.creatureId = record.id;
      monster.style.left = `${((i + 1) / (n + 1)) * 100}%`;
      monster.style.setProperty('--drift-x', `${6 + (i % 3) * 5}px`);
      monster.style.setProperty('--drift-dur', `${5 + (i % 4)}s`);
      monster.style.setProperty('--bounce-dur', `${2.2 + (i % 3) * 0.5}s`);
      monster.style.setProperty('--delay', `${(i % 5) * 0.4}s`);
      monster.style.zIndex = String(10 + i);
      const orb = buildMiniOrb();
      paintMiniOrb(orb, record.baseTraits ?? {}, { wild: record.revealed === false });
      monster.append(orb);
      el.habitatStage.append(monster);
    });
    el.habitatStage.setAttribute(
      'aria-label',
      members.map((r) => r.baseTraits?.name).filter(Boolean).join(', ') || copy.habitatEmpty
    );
  }

  // A random monster lets out a "Rawr" every few seconds while the habitat is on
  // screen. One self-rescheduling timer for the app's lifetime; it reads the live
  // DOM each tick, so it needs no wiring to re-renders.
  const rawrBubbles = Array.isArray(content.ui.habitatBubbles) && content.ui.habitatBubbles.length
    ? content.ui.habitatBubbles
    : ['Rawr!'];
  function popRawr() {
    if (el.pages.habitat?.hidden) return;
    const monsters = el.habitatStage.querySelectorAll('.habitat-monster');
    if (!monsters.length) return;
    const pick = monsters[Math.floor(Math.random() * monsters.length)];
    if (pick.querySelector('.rawr-bubble')) return;
    const bubble = document.createElement('span');
    bubble.className = 'rawr-bubble';
    bubble.textContent = rawrBubbles[Math.floor(Math.random() * rawrBubbles.length)];
    pick.append(bubble);
    window.setTimeout(() => bubble.remove(), 1800);
  }
  function scheduleRawr() {
    window.setTimeout(() => { popRawr(); scheduleRawr(); }, 3000 + Math.random() * 4000);
  }
  scheduleRawr();

  // ----- collection list: "Your creatures". Tapping a chip shows/hides that
  // creature in the habitat window; a separate "Care" button switches which
  // creature you're caring for on the Pet Care page. Scrolls internally.
  function renderCollection(state) {
    el.collectionList.replaceChildren();
    const { ordered, activeId } = revealedOrdered(state);

    for (const record of ordered) {
      const traits = record.baseTraits ?? {};
      const isActive = record.id === activeId;
      const name = traits.name ?? '';
      const shown = inHabitat(record, activeId);

      const item = document.createElement('div');
      item.className = 'collection-item';
      item.setAttribute('role', 'listitem');
      item.dataset.inHabitat = String(shown);

      const chip = document.createElement(isActive ? 'div' : 'button');
      chip.className = 'collection-chip';
      chip.dataset.creatureId = record.id;
      chip.dataset.active = String(isActive);
      if (isActive) {
        chip.setAttribute('aria-current', 'true');
      } else {
        chip.type = 'button';
        chip.setAttribute('aria-pressed', String(shown));
        chip.setAttribute('aria-label', shown ? copy.collectionInHabitatOn : copy.collectionInHabitatOff);
        chip.addEventListener('click', () => {
          if (habitatHidden.has(record.id)) habitatHidden.delete(record.id);
          else habitatHidden.add(record.id);
          renderHabitat(latestState);
          renderCollection(latestState);
        });
      }

      const orb = buildMiniOrb();
      paintMiniOrb(orb, traits, { wild: record.revealed === false });
      chip.append(orb);

      const meta = document.createElement('div');
      meta.className = 'collection-meta';
      const nameEl = document.createElement('span');
      nameEl.className = 'collection-name';
      nameEl.textContent = name;
      const subEl = document.createElement('span');
      subEl.className = 'collection-sub';
      subEl.textContent = [traits.rarity?.label, traits.quirk?.label].filter(Boolean).join(' · ');
      meta.append(nameEl, subEl);
      // A caught-but-unread creature is still WILD — tag it until reading tames it.
      if (record.revealed !== true) {
        const wild = document.createElement('span');
        wild.className = 'collection-wild';
        wild.textContent = copy.collectionWild;
        meta.append(wild);
      }
      chip.append(meta);

      if (isActive) {
        const badge = document.createElement('span');
        badge.className = 'collection-badge';
        badge.innerHTML = iconMarkup('check');
        badge.setAttribute('aria-label', copy.collectionActiveBadge);
        chip.append(badge);
      }

      // Finishing a book is a permanent, non-ranked completion marker.
      if (record.finished === true) {
        const finishedBadge = document.createElement('span');
        finishedBadge.className = 'collection-finished';
        finishedBadge.textContent = content.relationship.finishedResponse.icon;
        finishedBadge.title = copy.finishedBadge;
        finishedBadge.setAttribute('aria-label', copy.finishedBadge);
        chip.append(finishedBadge);
      }

      item.append(chip);

      if (!isActive) {
        const care = document.createElement('button');
        care.type = 'button';
        care.className = 'collection-care';
        care.textContent = copy.collectionCare;
        care.setAttribute('aria-label', interpolate(copy.collectionActivateLabel, { name }));
        care.addEventListener('click', () => handlers.onActivateCreature(record.id));
        item.append(care);
      }

      el.collectionList.append(item);
    }

    el.collection.hidden = ordered.length === 0;
  }

  // ----- relationship line: the active creature's current non-ranked response -----
  // Shows the response for the creature's most recent relationship day plus how many
  // distinct reading days you've shared. Non-ranked flavor only — never a power meter.
  function renderRelationship(state) {
    const activeId = state.collection?.activeCreatureId ?? null;
    const creature = activeId ? state.collection.creatures?.[activeId] : null;
    const response = creature ? currentRelationshipResponse(creature) : null;
    if (!creature || !response) {
      el.relationshipLine.hidden = true;
      el.relationshipLine.textContent = '';
      return;
    }
    const days = relationshipLevel(creature);
    const finishedSuffix = creature.finished === true
      ? ` ${content.relationship.finishedResponse.icon}`
      : '';
    el.relationshipLine.textContent = interpolate(copy.relationshipLine, {
      icon: response.icon,
      name: state.name,
      text: response.text,
      days
    }) + finishedSuffix;
    el.relationshipLine.hidden = false;
  }

  // The stage pill doubles as the gentle daily stopping point: three small
  // stars fill up, while extra 0-CP care remains available just for fun.
  function renderDailyCare(state, stage) {
    const total = content.care.dailyCpCap;
    const done = Math.min(state.actionsToday, total);
    el.stageTag.replaceChildren(document.createTextNode(`${stage.label} · `));
    for (let i = 0; i < total; i += 1) {
      const pip = document.createElement('span');
      pip.className = i < done ? 'pip filled' : 'pip';
      pip.innerHTML = iconMarkup('star');
      el.stageTag.append(pip);
    }
    el.stageTag.setAttribute(
      'aria-label',
      copy.dailyCareLabel.replace('{done}', String(done)).replace('{total}', String(total))
    );
  }

  // ----- growth marker: a tiny 3-pip meter tucked into the nameplate. The
  // underlying requirement is 12-18 CP, too many to show as literal pips, so the
  // chip fills proportionally toward the next stage and becomes a heart at full.
  const GROW_PIPS = 3;
  function renderGrowth(state, stage) {
    const next = nextStageDef(state.stage);
    el.growChip.replaceChildren();
    if (!next) {
      const heart = document.createElement('span');
      heart.className = 'st filled';
      heart.innerHTML = iconMarkup('heart');
      el.growChip.append(heart);
      el.growChip.title = copy.allGrown;
      el.growChip.setAttribute('aria-label', copy.allGrown);
      return;
    }
    const span = next.cpRequired - stage.cpRequired;
    const into = Math.min(Math.max(state.cp - stage.cpRequired, 0), span);
    const filled = span > 0 ? Math.round((into / span) * GROW_PIPS) : 0;
    const lead = document.createElement('span');
    lead.className = 'grow-lead';
    lead.innerHTML = iconMarkup('sprout');
    el.growChip.append(lead);
    for (let i = 0; i < GROW_PIPS; i += 1) {
      const star = document.createElement('span');
      star.className = i < filled ? 'st filled' : 'st';
      star.innerHTML = iconMarkup('star');
      el.growChip.append(star);
    }
    const label = fill(copy.growLabel, state);
    el.growChip.title = label;
    el.growChip.setAttribute('aria-label', label);
  }

  function pulseNewestStar() {
    const filledStars = el.growChip.querySelectorAll('.st.filled');
    const newest = filledStars[filledStars.length - 1];
    if (newest) flash(newest, 'just-earned', 'star-earn');
  }

  // ----- react: one-shot feedback per event -----
  const creatureAnims = { feed: 'nom', play: 'hop', tidy: 'sway' };

  function react(event, state) {
    switch (event.type) {
      case EventTypes.Hatched: {
        flash(el.creature, 'pop-in', 'pop-in');
        spawnSparks(icons.sparkle);
        toast(fill(copy.hatchedToast, state));
        break;
      }
      case EventTypes.CareActionPerformed: {
        const def = content.care.actions.find((a) => a.id === event.actionId);
        if (!def) break;
        flash(el.creature, `anim-${def.id}`, creatureAnims[def.id]);
        spawnSparks(def.icon);
        burstWord(def.burst);
        if (event.cpGranted > 0) pulseNewestStar();
        if (event.cpGranted > 0 && state.actionsToday === content.care.dailyCpCap) {
          toast(copy.dailyCareDone);
        }
        break;
      }
      case EventTypes.ResourceGranted: {
        pulseNewestStar();
        break;
      }
      case EventTypes.CreatureStateChanged: {
        flash(el.creature, 'poof', 'poof');
        spawnSparks(icons.star);
        toast(fill(copy.grewToast, state));
        break;
      }
      case EventTypes.TimeElapsed: {
        // Coming back from being away: a gentle stretch-and-wake.
        flash(el.creature, 'wake', 'wake');
        break;
      }
      case EventTypes.GiftGranted: {
        // Wake-up scene: welcome-back overlay with the gift reveal.
        const sticker = content.stickers.find((s) => s.id === event.stickerId);
        el.welcomeBody.textContent = fill(copy.welcomeBody, state);
        el.giftStack.replaceChildren();
        const box = document.createElement('span');
        box.className = 'gift-box';
        box.innerHTML = iconMarkup('gift');
        const reveal = document.createElement('span');
        reveal.className = 'gift-sticker';
        reveal.textContent = sticker ? sticker.icon : icons.star;
        el.giftStack.append(box, reveal);
        el.welcome.dataset.stickerId = event.stickerId;
        el.welcome.hidden = false;
        el.welcomeBtn.focus();
        spawnSparks(icons.sparkle);
        break;
      }
      case EventTypes.CreatureGenerated: {
        const message = state.hatched ? fill(copy.bookApplied, state) : copy.bookReady;
        if (state.hatched) flash(el.creature, 'poof', 'poof');
        else flash(el.egg, 'book-charged', 'book-charged');
        spawnSparks(icons.sparkle);
        toast(message);
        break;
      }
      case EventTypes.TuckedIn: {
        spawnSparks(icons.moon);
        break;
      }
      case EventTypes.CreatureRevealed: {
        const creatureId = event.payload?.creatureId ?? event.creatureId;
        const record = state.collection?.creatures?.[creatureId];
        if (record) pendingReveals.push(record);
        if (!revealFlushScheduled) {
          revealFlushScheduled = true;
          queueMicrotask(flushReveals);
        }
        break;
      }
      case EventTypes.ActiveCreatureChanged: {
        const creatureId = event.payload?.creatureId ?? event.creatureId;
        const record = state.collection?.creatures?.[creatureId];
        // The hero swaps to the newly active creature — a gentle poof sells the change.
        if (state.hatched) flash(el.creature, 'poof', 'poof');
        spawnSparks(icons.sparkle);
        toast(interpolate(copy.activeSwitched, { name: record?.baseTraits?.name ?? '' }));
        break;
      }
      case EventTypes.CreatureRelationshipChanged: {
        // A distinct new reading day with this book — a warm, non-ranked moment.
        const creatureId = event.payload?.creatureId ?? event.creatureId;
        const record = state.collection?.creatures?.[creatureId];
        const response = record ? currentRelationshipResponse(record) : null;
        if (response) {
          if (state.collection?.activeCreatureId === creatureId) flash(el.creature, 'anim-play', 'hop');
          toast(interpolate(copy.relationshipToast, {
            icon: response.icon,
            name: record?.baseTraits?.name ?? '',
            text: response.text
          }));
        }
        break;
      }
      default:
        break;
    }
  }

  // Boot: Settings starts fresh (mirrors the old "open" reset), Pet Care is
  // the default visible page.
  renderSettings();
  showPage('care');

  return { render, react, toast, offerInterruptedReading };
}
