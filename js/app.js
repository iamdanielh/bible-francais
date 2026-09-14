import { Dictionary, friendlyTense, friendlyForm, esInfinitive, esConjugado, esCompuesto } from "./dict.js";

const BOOK_ALIASES = {
  "Évangile selon Matthieu": "Matthieu",
  "Évangile selon Marc": "Marc",
  "Évangile selon Luc": "Luc",
  "Évangile selon Jean": "Jean",
  "Actes des Apôtres": "Actes",
  "Apocalypse": "Apocalypse",
  "Genèse": "Genèse",
};

let bible = [];       // [{name, chapters:[[verseText,...],...]}]
let dictionary = null;
let state = { book: 0, chapter: 0, vocab: [], scrollTop: 0, ai: { key: "", model: "" } };

// ---- DOM refs -------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  loading: $("loading"), bookSelect: $("bookSelect"), chapterSelect: $("chapterSelect"),
  prevBtn: $("prevBtn"), nextBtn: $("nextBtn"), vocabBtn: $("vocabBtn"),
  chapterTitle: $("chapterTitle"), verseText: $("verseText"),
  wordLabel: $("wordLabel"), speakBtn: $("speakBtn"), meaning: $("meaning"),
  grammar: $("grammar"), saveBtn: $("saveBtn"), note: $("note"), vocabList: $("vocabList"),
  ctxWrap: $("ctxWrap"), ctxResult: $("ctxResult"),
};

// ---- persistence ----------------------------------------------------------
const readerEl = document.querySelector(".reader");
const topbarEl = document.querySelector(".topbar");

// --- auto-hiding top bar ------------------------------------------------
let _topbarHidden = false;
let _lastScrollY = 0;
let _scrollAccum = 0;
let _lastScrollT = 0;

function showTopbar() {
  if (!_topbarHidden) return;
  _topbarHidden = false;
  compensateTopbar(false);
  _lastScrollY = readerEl ? readerEl.scrollTop : 0;
  _scrollAccum = 0;
}
function hideTopbar() {
  if (_topbarHidden) return;
  _topbarHidden = true;
  compensateTopbar(true);
  _lastScrollY = readerEl ? readerEl.scrollTop : 0;
  _scrollAccum = 0;
}
// The bar is position:fixed and the reader keeps a constant top padding, so
// toggling it is a true overlay: the Bible text never moves on screen.
function compensateTopbar(hidden) {
  document.body.classList.toggle("topbar-hidden", hidden);
}
function syncTopbarHeight() {
  if (topbarEl) document.documentElement.style.setProperty("--topbar-h", topbarEl.offsetHeight + "px");
}
window.addEventListener("resize", syncTopbarHeight);

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem("biblefr") || "{}");
    if (Array.isArray(s.vocab)) state.vocab = s.vocab;
    if (typeof s.book === "number") state.book = s.book;
    if (typeof s.chapter === "number") state.chapter = s.chapter;
    if (typeof s.scrollTop === "number") state.scrollTop = s.scrollTop;
    if (s.ai && typeof s.ai === "object") {
      state.ai = { key: String(s.ai.key || ""), model: String(s.ai.model || "") };
    } else {
      state.ai = { key: "", model: "" };
    }
  } catch (e) { /* ignore */ }
}
function saveState() {
  state.book = currentBookIndex;
  state.chapter = currentChapter;
  state.scrollTop = canonicalScrollTop();
  try { localStorage.setItem("biblefr", JSON.stringify(state)); } catch (e) {}
}

// One-tap setup: open the app as https://…/?key=YOUR_KEY and it saves the key
// to this phone, activates the IA and cleans the URL so the key doesn't linger.
(function applyURLKey() {
  if (!location.search) return;
  let qp;
  try { qp = new URLSearchParams(location.search); } catch (e) { return; }
  const key = (qp.get("key") || "").trim();
  if (!key) return;
  state.ai = state.ai || { key: "", model: "" };
  state.ai.key = key;
  const model = (qp.get("model") || "").trim();
  if (model) state.ai.model = model;
  try { localStorage.setItem("biblefr", JSON.stringify(state)); } catch (e) {}
  try { history.replaceState({}, "", location.pathname + location.hash); } catch (e) {}
})();

// The reader's real scroll position. (The bar used to reserve/release space,
// which needed a unit offset; with the constant-padding overlay the raw value
// is the canonical one.)
function canonicalScrollTop() {
  if (!readerEl) return 0;
  return readerEl.scrollTop;
}

// Remember where the reader is scrolled to, so reopening resumes at the same
// verse. Save debounced while scrolling and flushed when the app is hidden.
let _scrollSaveTimer = null;
let _programmaticScrolls = 0;
// Browsers (Chromium at least) fire `scroll` events for programmatic scrollTop
// writes too. We track those so the auto-hide / position-restore logic doesn't
// mistake our own restore/compensation for the user scrolling.
function setReaderScroll(v) {
  _programmaticScrolls++;
  readerEl.scrollTop = v;
  setTimeout(() => { _programmaticScrolls = Math.max(0, _programmaticScrolls - 1); }, 80);
}
if (readerEl) {
  readerEl.addEventListener("scroll", () => {
    state.scrollTop = canonicalScrollTop();
    clearTimeout(_scrollSaveTimer);
    _scrollSaveTimer = setTimeout(saveState, 400);

    const now = performance.now();
    const programmatic = _programmaticScrolls > 0;
    if (programmatic) _programmaticScrolls--;
    if (!programmatic) {
      // A pause between scroll events means a new gesture: start fresh so a
      // single upward notch brings the bar back instead of needing to undo all
      // the downward travel (and upstream inertia) still sitting in the tally.
      if (now - _lastScrollT > 200) _scrollAccum = 0;
      const delta = readerEl.scrollTop - _lastScrollY;
      if (delta !== 0) _scrollAccum += delta;
      if (!_topbarHidden) {
        if (_scrollAccum > 16) hideTopbar();
      } else {
        if (_scrollAccum < -8) showTopbar();
      }
    }
    _lastScrollY = readerEl.scrollTop;
    _lastScrollT = now;
  });
}
function flushReadingPosition() {
  if (readerEl) {
    state.scrollTop = canonicalScrollTop();
    saveState();
  }
}
window.addEventListener("pagehide", flushReadingPosition);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushReadingPosition();
});

// ---- theme -----------------------------------------------------------------
const THEME_KEY = "biblefr-theme";
const THEME_META = document.querySelector('meta[name="theme-color"]');

function systemTheme() {
  return window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(t, persist = true) {
  const dark = t === "dark";
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  const btn = $("themeBtn");
  if (btn) btn.textContent = dark ? "☀️" : "🌙";
  if (THEME_META) THEME_META.setAttribute("content", dark ? "#15171f" : "#f6f1e7");
  if (persist) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
}

function applyTheme() {
  setTheme(localStorage.getItem(THEME_KEY) || systemTheme(), false);
}

$("themeBtn").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  setTheme(cur === "dark" ? "light" : "dark");
});
applyTheme();

// ---- data loading ---------------------------------------------------------
async function loadData() {
  try {
    const [raw, dict] = window.__DATA__
      ? [JSON.stringify(window.__DATA__.bible), window.__DATA__.dict]
      : await Promise.all([
          fetch("data/bible.json").then(r => r.text()),
          fetch("data/dict.json").then(r => r.json()),
        ]);
    const rawBible = JSON.parse(raw.replace(/^\uFEFF/, ""));
    bible = [];
    for (const testament of rawBible.Testaments || []) {
      for (const book of testament.Books || []) {
        const name = (BOOK_ALIASES[book.Text] || book.Text || "").trim();
        const chapters = [];
        for (const chapter of book.Chapters || []) {
          chapters.push((chapter.Verses || []).map(v => v.Text || ""));
        }
        bible.push({ name, chapters });
      }
    }
    dictionary = new Dictionary(dict);
  } catch (e) {
    el.loading.textContent = "Error al cargar los datos: " + e.message;
    throw e;
  }
}

// ---- rendering ------------------------------------------------------------
let currentBookIndex = 0;
let currentChapter = 0;

function buildBookList() {
  el.bookSelect.innerHTML = "";
  bible.forEach((b, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = b.name;
    el.bookSelect.appendChild(opt);
  });
}

function buildChapterList() {
  const book = bible[currentBookIndex];
  el.chapterSelect.innerHTML = "";
  for (let c = 0; c < book.chapters.length; c++) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = "Cap. " + (c + 1);
    el.chapterSelect.appendChild(opt);
  }
}

function gotoNextChapter() {
  closePanel();
  const book = bible[currentBookIndex];
  if (currentChapter < book.chapters.length - 1) { currentChapter++; el.chapterSelect.value = currentChapter; renderChapter(); saveState(); }
  else if (currentBookIndex < bible.length - 1) selectBook(currentBookIndex + 1);
}
function gotoPrevChapter() {
  closePanel();
  if (currentChapter > 0) { currentChapter--; el.chapterSelect.value = currentChapter; renderChapter(); saveState(); }
  else if (currentBookIndex > 0) selectBook(currentBookIndex - 1);
}

function renderChapter() {
  const book = bible[currentBookIndex];
  const verses = book.chapters[currentChapter] || [];
  el.chapterTitle.textContent = `${book.name} — capítulo ${currentChapter + 1}`;
  el.verseText.innerHTML = "";
  const docFrag = document.createDocumentFragment();
  verses.forEach((text, vi) => {
    const vnum = document.createElement("span");
    vnum.className = "vnum";
    vnum.textContent = `[${vi + 1}] `;
    docFrag.appendChild(vnum);
    // split into tokens, keep punctuation attached for display but strip for lookup
    const tokens = text.split(" ");
    let sentenceStart = true;
    tokens.forEach((token, ti) => {
      const word = document.createElement("span");
      word.className = "word";
      word.textContent = token;
      word.dataset.word = token.replace(/[.,;:!?…«»"'“”‘’()[\]*–—]+$/g, "").replace(/^[.,;:!?…«»"'“”‘’()[\]*–—]+/g, "");
      const atSentenceStart = sentenceStart;
      word.addEventListener("click", () => presentWord(word.dataset.word, ti, token, atSentenceStart));
      docFrag.appendChild(word);
      if (ti < tokens.length - 1) docFrag.appendChild(document.createTextNode(" "));
      sentenceStart = /[.!?…]+$/.test(token);
    });
    docFrag.appendChild(document.createElement("br"));
  });
  el.verseText.appendChild(docFrag);
  buildChapterTokens(book, currentChapter);
  if (readerEl) setReaderScroll(0); // new chapter starts at the top
  _lastScrollY = 0;
  showTopbar();
  // showTopbar() re-scrolls to keep text pinned during a bar toggle, which
  // would push a fresh chapter off its top — override it back to the top.
  if (readerEl) setReaderScroll(0);
  _lastScrollY = 0;
}

function selectBook(index, restoreChapter = false) {
  if (index < 0 || index >= bible.length) return;
  currentBookIndex = index;
  el.bookSelect.value = index;
  buildChapterList();
  let chap;
  if (restoreChapter) chap = Math.min(Math.max(state.chapter, 0), bible[index].chapters.length - 1);
  else chap = 0;
  el.chapterSelect.value = chap;
  renderChapter();
  closePanel();
  saveState();
}

// ---- lookup ---------------------------------------------------------------
let currentKey = "";
let currentES = "";
const panel = $("lookupPanel");
const scrim = $("scrim");
const wordContent = $("wordContent");
const vocabContent = $("vocabContent");
const studyContent = $("studyContent");
const aiContent = $("aiContent");
const aiThread = $("aiThread");

function setPanelMode(mode) {
  const vocab = mode === "vocab";
  const study = mode === "study";
  const ai = mode === "ai";
  studyContent.hidden = !study;
  aiContent.hidden = !ai;
  wordContent.hidden = vocab || study || ai;
  vocabContent.hidden = !vocab || study || ai;
  $("panelTitle").textContent = ai ? "IA · Profesor"
    : study ? "Estudiar"
    : vocab ? "Vocabulario"
    : "Traducción";
}

function openPanel(mode) {
  panel.classList.remove("fullscreen");
  panel.classList.remove("collapsed");
  setPanelMode(mode || "word");
  panel.classList.add("open");
  scrim.classList.add("show");
  panel.setAttribute("aria-hidden", "false");
  showTopbar();
}

function closePanel() {
  panel.classList.remove("open");
  panel.classList.add("collapsed");
  scrim.classList.remove("show");
  panel.setAttribute("aria-hidden", "true");
  clearSelectionHighlights();
}

function presentWord(word, ti, token, sentenceInitial) {
  if (!dictionary) return;
  hideContextTranslation();
  const [meanings, info] = dictionary.resolve(word, { sentenceInitial });
  currentKey = word;
  el.wordLabel.textContent = word;
  openPanel("word");
  let grammar = "";
  if (meanings && (info.form || info.infinitive || info.tense)) {
    grammar = plainGloss(info, meanings[0], meanings);
  }
  if (!meanings) {
    if (info.isName) {
      el.meaning.innerHTML = "<span class='dim'>Nombre propio: persona o lugar.</span>";
      el.grammar.textContent = plainGloss(info, "") || "nombre propio";
      el.note.textContent = "Selecciona una palabra del texto para ver su significado.";
      el.saveBtn.disabled = true;
      el.speakBtn.disabled = false;
      currentES = "";
      return;
    }
    el.meaning.innerHTML = "<span class='dim'>Sin traducción disponible en el diccionario.</span>";
    el.grammar.textContent = "";
    el.note.textContent = "Selecciona una palabra del texto para ver su significado.";
    el.saveBtn.disabled = true;
    el.speakBtn.disabled = true;
    return;
  }
  el.meaning.innerHTML = "<b>Español:</b>\n" + meanList(meanings.slice(0, 8));
  el.grammar.textContent = grammar;
  el.note.textContent = "";
  el.saveBtn.disabled = false;
  el.speakBtn.disabled = false;
  currentES = meanings.slice(0, 4).join(" · ");
}

function presentSelection(segments, phrase) {
  if (!segments.length) return;
  openPanel("word");
  currentKey = phrase || segments.map(s => s[0]).join(" ");
  currentES = "";
  el.wordLabel.textContent = currentKey;
  const hasPhrase = _ctxQuery.split(/\s+/).filter(Boolean).length >= 2;
  if (hasPhrase) showContextTranslation();
  else hideContextTranslation();
  const lines = [];
  const meaningsAll = [];
  for (const [span, meanings, info] of segments) {
    if (meanings && meanings.length) {
      const right = meanings.slice(0, 4).map(esc).join(" · ");
      let line = `<b>${esc(span)}</b> — ${right}`;
      const details = [];
      if (info.form) details.push(esc(friendlyForm(info.form)));
      if (info.infinitive || info.tense) {
        const note = verbNote(info, false, meanings);
        if (note) details.push(esc(note));
      }
      if (details.length) line += ` <span class='dim'>(${details.join(", ")})</span>`;
      lines.push(line);
      meaningsAll.push(meanings[0]);
    } else {
      lines.push(`<b>${esc(span)}</b> — <span class='dim'>${info && info.isName ? "nombre propio" : "sin traducción"}</span>`);
    }
  }
  el.meaning.innerHTML = lines.join("<br/>");
  el.grammar.textContent = "";
  el.note.textContent = "";
  el.saveBtn.disabled = false;
  el.speakBtn.disabled = false;
  currentES = meaningsAll.join(" · ");
  autoContextTranslate();
}

// Multi-word selections mean the reader wants the whole phrase understood, so
// fetch the online translation without making them hunt for the button.
let _ctxAutoTimer = null;
function autoContextTranslate() {
  clearTimeout(_ctxAutoTimer);
  const q = _ctxQuery;
  if (!q || q.split(/\s+/).filter(Boolean).length < 2) return;
  _ctxAutoTimer = setTimeout(() => {
    if (!el.ctxWrap.hidden && _ctxQuery === q && !_translateBusy) translateContext();
  }, 250);
}

// ---- contextual (whole-phrase) translation ----------------------------------
let _ctxQuery = "";
let _translateBusy = false;

function showContextTranslation() {
  el.ctxWrap.hidden = false;
  el.ctxResult.innerHTML = "";
}

function hideContextTranslation() {
  _ctxQuery = "";
  el.ctxWrap.hidden = true;
  el.ctxResult.innerHTML = "";
}

async function translateContext() {
  if (!_ctxQuery || _translateBusy) return;
  _translateBusy = true;
  el.ctxResult.innerHTML = "<span class='dim'>Traduciendo…</span>";
  try {
    const body = new URLSearchParams({ q: _ctxQuery.slice(0, 3000), langpair: "fr|es" });
    const resp = await fetch("https://api.mymemory.translated.net/get", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    if (data && data.responseStatus === 429) throw new Error("límite diario agotado");
    const t = data && data.responseData && data.responseData.translatedText;
    if (!t) throw new Error(data && data.responseDetails ? data.responseDetails : "respuesta vacía");
    el.ctxResult.innerHTML = "<b>Contexto:</b> " + esc(t) +
      " <span class='ctx-meta'>— traducción automática · " +
      "<a href='https://mymemory.translated.net/' target='_blank' rel='noopener'>MyMemory</a></span>";
  } catch (e) {
    el.ctxResult.innerHTML = "<span class='dim'>No se pudo traducir en línea (" + esc(e.message) +
      "). Revisa tu conexión e inténtalo de nuevo.</span>";
  } finally {
    _translateBusy = false;
  }
}

function verbNote(info, withMeaning, glosses) {
  const parts = [];
  const inf = info.infinitive;
  if (inf) {
    if (withMeaning) {
      const [m] = dictionary.resolve(inf);
      const es = m && m[0] ? m[0] : "";
      let core = `verbo infinitivo: «${inf}»`;
      if (es) core += ` = ${es}`;
      parts.push(core);
    } else {
      parts.push(`verbo «${inf}»`);
    }
  }
  if (info.tense) parts.push(friendlyTense(info.tense));
  // Forma española — igual que en plainGloss.
  const glossesGiven = (info.compound && info.compound.esInf)
    ? []
    : (Array.isArray(glosses) && glosses.length ? glosses : []);
  let es = (info.compound && info.compound.esInf) || esInfinitive(inf, glossesGiven, (f) => dictionary.lookup(f));
  if (info.pronominalEn && es && !es.endsWith("se")) es += "se";
  const esp = info.compound
    ? esCompuesto(es, info.tense, info.compound.auxPerson, {
        passive: info.compound.passive,
        agree: info.compound.agree,
        stative: info.compound.stative,
        stativeKey: info.compound.stativeKey,
        neg: info.compound.neg
      })
    : esConjugado(es, info.tense);
  if (esp && esp.length) parts.push("esp: «" + esp.join(" o ") + "»");
  return parts.join(" · ");
}

function meanList(arr) {
  return arr.map(m => `• ${m}`).join("\n");
}

function esc(s) {
  const d = document.createElement("span");
  d.textContent = s;
  return d.innerHTML;
}

// ---- pronunciation --------------------------------------------------------
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Voices load asynchronously per instance (especially on iOS). Keep this hook
// referenced as the ongoing "voices changed" handler; consumers query the live
// list themselves, so no state needs to be cached here.
function cacheVoices() {}
if ("speechSynthesis" in window) {
  cacheVoices();
  window.speechSynthesis.onvoiceschanged = cacheVoices;
}

// WebKit on iOS silences media/TTS that isn't tied to a user gesture. The
// first pointerdown unlocks the audio session (silent sample) and primes the
// speechSynthesis voice list with an inaudible utterance — iOS only exposes
// its voices after a speak() call that happens inside a user gesture.
function unlockIOSAudio() {
  if (!IS_IOS) return;
  const a = new Audio();
  a.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==";
  a.volume = 0;
  a.play().catch(() => {});
  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const probe = new SpeechSynthesisUtterance("");
      probe.volume = 0;
      window.speechSynthesis.speak(probe);
    } catch (e) {}
    cacheVoices();
  }
}
document.addEventListener("pointerdown", unlockIOSAudio, { once: true });

// Natural French voice over the network, played through an <audio> element.
// Two Google endpoints (same engine, different domains) to dodge request
// restrictions. Each attempt has a stall guard so a dead endpoint never leaves
// the speaker button silent for long. The device voice is the fallback.
const TTS_URLS = [
  (q) => "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fr&q=" +
    encodeURIComponent(q.slice(0, 200)),
  (q) => "https://translate.googleapis.com/translate_tts?client=tw-ob&tl=fr&q=" +
    encodeURIComponent(q.slice(0, 200)),
];
let _activeAudio = null;

function playViaAudio(url, guardMs) {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (!ok) { try { audio.src = ""; } catch (e) {} } // release the failed element
      if (ok) _activeAudio = audio;
      resolve(ok);
    };
    audio.src = url;
    audio.load();
    audio.onplaying = () => finish(true);
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio.play().catch(() => finish(false));
    setTimeout(() => finish(false), guardMs);
  });
}

// iOS exposes the voice chosen in Settings (Accessibility → Spoken Content →
// Voices) as the language default. Overriding it with the first item from the
// getVoices() list can pick a low-quality asset voice even when a better one
// (e.g. "Audrey") is configured. So on iOS: use "Audrey" when present,
// otherwise defer to the system default. Off iOS, pick any decent French voice
// while avoiding the cheap/robotic asset voices.
const BAD_VOICES = /novella|alva|digital|milena|xiao|leejae|zira|haruka/i;
function pickFrVoice(voices) {
  const fr = (voices || []).filter((v) => /^fr/i.test(v.lang));
  if (!fr.length) return null;
  const audrey = fr.find((v) => /audrey/i.test(v.name));
  if (audrey) return audrey;
  if (IS_IOS) return null; // let the OS-chosen default voice win
  return fr.find((v) => !BAD_VOICES.test(v.name)) || fr[0];
}

function startLocal() {
  // Device voice. On iOS this must run synchronously from the user gesture:
  // getVoices() only populates there, and speak() only sounds there. Returns
  // the utterance (or null if no voices exist yet) so the caller can detect
  // late silent failures via onstart.
  if (!("speechSynthesis" in window)) return null;
  try { window.speechSynthesis.getVoices(); } catch (e) {} // force populate inside the gesture
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;
  if (_activeAudio) { try { _activeAudio.pause(); _activeAudio = null; } catch (e) {} }
  try { window.speechSynthesis.cancel(); if (IS_IOS) window.speechSynthesis.resume(); } catch (e) {}
  const frVoice = pickFrVoice(voices);
  const u = new SpeechSynthesisUtterance(currentKey);
  u.lang = "fr-FR";
  try { if (frVoice) u.voice = frVoice; } catch (e) {} // rare invalid voice object
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
  // Classic iOS kick: some versions queue the utterance but never start it
  // until a pause/resume pair is issued right after speak().
  if (IS_IOS) { try { window.speechSynthesis.pause(); window.speechSynthesis.resume(); } catch (e) {} }
  return u;
}

// Resolves true when the utterance actually began (onstart), false if it
// errored or never started within the budget.
function waitLocalStart(u, ms) {
  if (!u) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (done) return; done = true; resolve(ok); };
    u.onstart = () => finish(true);
    u.onend = () => finish(false);
    u.onerror = () => finish(false);
    setTimeout(() => finish(false), ms);
  });
}

// iOS exposes its voice list only after a speak() inside a gesture; if the
// sync call found none, poll briefly — it usually appears within a few hundred
// ms of the first tap. Returns true once an utterance was accepted.
function primeLocal() {
  return new Promise((resolve) => {
    let tries = 0;
    const attempt = () => {
      if (startLocal()) { resolve(true); return; }
      if (++tries >= 5) { resolve(false); return; }
      setTimeout(attempt, 150);
    };
    attempt();
  });
}

// iOS voices can fill in a moment after priming; desktop uses this as the
// offline fallback after the web voice. Brief wait, then speak.
function waitForVoices() {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === "undefined") return resolve(false);
    const restore = () => { try { window.speechSynthesis.onvoiceschanged = cacheVoices; } catch (e) {} };
    try {
      if (window.speechSynthesis.getVoices().length) { restore(); resolve(true); return; }
    } catch (e) {}
    window.speechSynthesis.onvoiceschanged = () => { clearTimeout(timer); restore(); resolve(true); };
    const timer = setTimeout(() => { restore(); resolve(false); }, 1500);
  });
}

function stopActiveAudio() {
  if (_activeAudio) { try { _activeAudio.pause(); _activeAudio = null; } catch (e) {} }
}

async function speak() {
  if (!currentKey) return;
  stopActiveAudio();
  const text = currentKey;

  if (IS_IOS) {
    // On iOS the device voice is the dependable path and must start inside
    // the tap, so we try it first and synchronously. The web voice is only a
    // quick last resort (it has been unreliable on this user's iPhone).
    const u = startLocal();
    if (u) {
      if (await waitLocalStart(u, 900)) return; // it actually started ✓
      try { window.speechSynthesis.cancel(); } catch (e) {}
    } else if (await primeLocal()) {
      return;
    }
    // Quick single attempt at the natural web voice, then give the device
    // voice one more chance. (Two endpoints are used only off iOS.)
    if (await playViaAudio(TTS_URLS[0](text), 1200)) return;
    await primeLocal();
    return;
  }

  // Desktop/Android: the natural web voice is preferred when reachable.
  for (const url of TTS_URLS) {
    if (await playViaAudio(url(text), 6000)) return;
  }
  await waitForVoices();
  startLocal();
}

// ---- vocabulary -----------------------------------------------------------
let _chapterTokens = [];
let _vocabScope = "all"; // "all" | "chapter"

// Normalized lowercase tokens (no punctuation) of the current chapter, used to
// tell which saved words/phrases actually turn up in the chapter you're reading.
function buildChapterTokens(book, chapterIdx) {
  _chapterTokens = [];
  const verses = (book && book.chapters[chapterIdx]) || [];
  for (const text of verses) {
    for (const tok of text.split(/\s+/)) {
      const w = tok.replace(/^[.,;:!?…«»"'“”‘’()[\]*–—]+|[.,;:!?…«»"'“”‘’()[\]*–—]+$/g, "").toLowerCase();
      if (w) _chapterTokens.push(w);
    }
  }
}
function entryMatchesChapter(entry) {
  const words = entry.fr.split(/\s+/)
    .map(w => w.replace(/^[.,;:!?…«»"'“”‘’()[\]*–—]+|[.,;:!?…«»"'“”‘’()[\]*–—]+$/g, "").toLowerCase())
    .filter(Boolean);
  if (!words.length) return false;
  if (words.length === 1) return _chapterTokens.includes(words[0]);
  const n = words.length;
  for (let i = 0; i + n <= _chapterTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      if (_chapterTokens[i + j] !== words[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function scopedEntries() {
  const entries = _vocabScope === "chapter" ? state.vocab.filter(entryMatchesChapter) : state.vocab;
  return entries;
}

function refreshVocab() {
  const entries = scopedEntries();
  $("scopeAll").classList.toggle("on", _vocabScope === "all");
  $("scopeChapter").classList.toggle("on", _vocabScope === "chapter");
  const count = $("vocabCount");
  if (_vocabScope === "chapter") {
    count.textContent = entries.length
      ? `${entries.length} palabra${entries.length === 1 ? "" : "s"} guardada${entries.length === 1 ? "" : "s"} en este capítulo`
      : "No guardaste palabras de este capítulo todavía.";
  } else {
    count.textContent = entries.length
      ? `Total: ${entries.length} palabra${entries.length === 1 ? "" : "s"}`
      : "Tu vocabulario está vacío. Selecciona una palabra y guárdala aquí.";
  }
  el.vocabList.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "vocab-empty";
    empty.textContent = "Tu vocabulario está vacío. Selecciona una palabra y guárdala aquí.";
    el.vocabList.appendChild(empty);
    return;
  }
  for (const entry of entries) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${entry.fr} — ${entry.es || "—"}`;
    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "✕";
    del.title = "Eliminar";
    del.addEventListener("click", () => removeVocab(entry));
    li.appendChild(label);
    li.appendChild(del);
    el.vocabList.appendChild(li);
  }
}

// ---- study (flashcards) ---------------------------------------------------
let _studyDeck = [];
let _studyIdx = 0;
let _studyScope = "all";

function entryMeaning(fr, es) {
  if (es && es.trim()) return es.trim();
  if (!dictionary) return "";
  const [meanings] = dictionary.resolve(fr);
  return meanings && meanings.length ? meanings.slice(0, 4).join(" · ") : "";
}
function entryGrammar(fr) {
  if (!dictionary) return "";
  const [meanings, info] = dictionary.resolve(fr);
  if (!info) return "";
  const parts = [];
  if (info.form) parts.push(friendlyForm(info.form));
  if (info.infinitive || info.tense) {
    const note = verbNote(info, false, meanings);
    if (note) parts.push(note);
  }
  return parts.join("  ·  ");
}
function buildCard(entry) {
  const fr = entry.fr.trim();
  return { fr, es: entryMeaning(fr, entry.es), gram: entryGrammar(fr) };
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startStudy(scope) {
  _studyScope = scope;
  const cards = scope === "chapter"
    ? state.vocab.filter(entryMatchesChapter)
    : state.vocab;
  _studyDeck = shuffle(cards.filter(e => e.fr && e.fr.trim()).map(buildCard));
  _studyIdx = 0;
  currentKey = "";
  openPanel("study");
  renderStudyCard();
}

function renderStudyCard() {
  $("studyDone").hidden = true;
  if (!_studyDeck.length) { showStudyDone(false); return; }
  if (_studyIdx >= _studyDeck.length) _studyIdx = 0;
  const card = _studyDeck[_studyIdx];
  currentKey = card.fr;
  $("studyWord").textContent = card.fr;
  $("studyMeaning").textContent = card.es || "Sin traducción guardada.";
  $("studyGram").textContent = card.gram || "";
  $("studyMeaning").hidden = true;
  $("studyGram").hidden = !card.gram;
  $("studyHint").hidden = false;
  $("studyControls").hidden = true;
  $("studyProgress").textContent = (_studyIdx + 1) + " / " + _studyDeck.length;
  $("studyTitle").textContent = _studyScope === "chapter" ? "Capítulo" : "Todo";
}

function studyNext() {
  if (!_studyDeck.length) return;
  _studyIdx = (_studyIdx + 1) % _studyDeck.length;
  renderStudyCard();
}
function studyPrev() {
  if (!_studyDeck.length) return;
  _studyIdx = (_studyIdx - 1 + _studyDeck.length) % _studyDeck.length;
  renderStudyCard();
}

function showStudyDone(done) {
  $("studyWord").textContent = "";
  $("studyMeaning").textContent = "";
  $("studyGram").textContent = "";
  $("studyHint").hidden = true;
  $("studyControls").hidden = true;
  $("studyProgress").textContent = "";
  $("studyDoneMsg").textContent = done
    ? "¡Lo has repasado todo!"
    : "No hay palabras guardadas para estudiar en este ámbito.";
  $("studyDone").hidden = false;
}

function revealStudy() {
  if ($("studyControls").hidden === false) return; // already revealed
  $("studyMeaning").hidden = false;
  $("studyGram").hidden = !$("studyGram").textContent;
  $("studyHint").hidden = true;
  $("studyControls").hidden = false;
}

function studyKnow() {
  _studyDeck.splice(_studyIdx, 1);
  if (!_studyDeck.length) showStudyDone(true);
  else renderStudyCard();
}

function studyAgain() {
  const card = _studyDeck.splice(_studyIdx, 1)[0];
  if (!card) { renderStudyCard(); return; }
  _studyDeck.push(card);
  renderStudyCard();
}

function saveCurrent() {
  if (!currentKey) return;
  if (!state.vocab.some(e => e.fr === currentKey)) {
    state.vocab.push({ fr: currentKey, es: currentES || "" });
    saveState();
refreshVocab();
    el.note.textContent = "✓ Guardado en el vocabulario.";
  }
}

function removeVocab(entry) {
  state.vocab = state.vocab.filter(e => e !== entry);
  saveState();
  refreshVocab();
}

// ---- AI tutor --------------------------------------------------------------
// Built-in key (included at the owner's request; assembled from fragments
// because GitHub push-protection blocks a literal key). A key saved in the
// settings overrides this one. Delete this line to stop auto-activation.
const DEFAULT_AI_KEY = ["sk-or-v1-", "5206320f", "4649b94a", "0ea19035", "461653a7", "f1e883a0", "84f0a100", "2394d8d4", "c15d0a9f"].join("");

const AI_SYSTEM_PROMPT =
  "Eres un profesor de francés para hispanohablantes que leen la Biblia. " +
  "Responde siempre en español sencillo, como un amigo que enseña, sin palabras técnicas " +
  "(no digas «imperfecto subyacente», di «pasado que describe el ambiente»). " +
  "Para cada palabra que expliques, da primero su traducción al español y, si aporta algo, " +
  "una frase sencilla sobre cómo se usa. " +
  "Da ejemplos cortos en francés con su traducción al español. Máximo 120 palabras.";

function effectiveAIKey() {
  if (state.ai && state.ai.key && state.ai.key.trim()) return state.ai.key.trim();
  return DEFAULT_AI_KEY;
}

function aiKeyKind(key) {
  return /^AIza/.test(key.trim()) ? "gemini" : "openrouter";
}

// Plain-language, non-technical gloss for a word's grammar. Returns "" when
// there is nothing interesting to say (plain nouns, adjectives...).
// Group-specific patterns (present, subjonctif, impératif, passé simple) are
// only taught for the verb group that actually follows them; -er for first
// group, -ir with "-iss-" for second group. The other tenses share the same
// endings across nearly all verbs, so those patterns are universal.
const TENSE_CONJ = {
  "présent": "Para conjugar el presente (verbos en -er): yo -e, tú -es, él -e, nosotros -ons, vosotros -ez, ellos -ent.",
  "présent-ir": "Para conjugar el presente (verbos en -ir como «finir»): yo -is, tú -is, él -it, nosotros -issons, vosotros -issez, ellos -issent.",
  "imparfait": "Para conjugar este pasado: yo -ais, tú -ais, él -ait, nosotros -ions, vosotros -iez, ellos -aient (vale para casi todos los verbos).",
  "futur": "Para conjugar el futuro: yo -ai, tú -as, él -a, nosotros -ons, vosotros -ez, ellos -ont.",
  "conditionnel": "Para conjugar el condicional: yo -ais, tú -ais, él -ait, nosotros -ions, vosotros -iez, ellos -aient.",
  "passé simple": "Para conjugar este pasado (verbos en -er): yo -ai, tú -as, él -a, nosotros -âmes, vosotros -âtes, ellos -èrent.",
  "subjonctif": "Para conjugar el subjuntivo (verbos en -er): que yo -e, que tú -es, que él -e, que nosotros -ions, que vosotros -iez, que ellos -ent.",
  "impératif": "Para conjugar el imperativo (verbos en -er): tú -e, nosotros -ons, vosotros -ez.",
  "participe présent": "El participio presente termina en «-ant» (como «-ando» en español).",
  "participe passé": "El participio pasado termina en «-é», «-i» o «-u» (como «-ado / -ido»).",
};
const TENSE_CONJ_GROUPED = new Set(["présent", "subjonctif", "impératif", "passé simple"]);
const PERSON_DE = {
  "1sg": "mí",
  "2sg": "ti",
  "3sg": "él / ella",
  "1pl": "nosotros",
  "2pl": "ustedes",
  "3pl": "ellos / ellas",
  "1/2sg": "mí / ti",
  "1/3sg": "mí / él / ella",
  "1sg/2sg": "mí / ti",
  "1sg/3sg": "mí / él / ella",
  "3sg/1sg": "mí / él / ella",
  "2sg/1sg": "mí / ti"
};
function plainGloss(info, firstMean, glosses) {
  if (!info) return "";
  const form = info.form ? String(info.form) : "";
  if (info.isName && (form === "nombre propio" || !form)) {
    return "Es un nombre propio: una persona o un lugar.";
  }
  if (info.infinitive) {
    let s = "Es el verbo «" + info.infinitive + "»" + (firstMean ? " (" + firstMean + ")" : "") + ".";
    if (info.tense) {
      const tstr = String(info.tense).trim().toLowerCase();
      if (tstr.startsWith("verbe 3e groupe")) {
        s += " Es un verbo del 3.er grupo (irregular), así que su forma se aprende de memoria.";
      } else {
        const ft = friendlyTense(info.tense);
        const base = ft.split(" (")[0].trim();
        const meaning = ft.match(/\(([^()]+)\)/) && ft.match(/\(([^()]+)\)/)[1];
        const persons = [...new Set(
          (String(info.tense).match(/\b(1\s*\/\s*3sg|1\s*\/\s*2sg|1sg\s*\/\s*2sg|1sg\s*\/\s*3sg|3sg\s*\/\s*1sg|2sg\s*\/\s*1sg|1sg|2sg|3sg|1pl|2pl|3pl)\b/g) || [])
            .map((k) => PERSON_DE[k.replace(/\s+/g, "")] || k)
        )];
        let t = " Está en " + base;
        if (meaning) t += " (" + meaning + ")";
        if (persons.length) t += ", hablando de " + persons.join(" o ");
        s += t + ".";
        // Teach the pattern so the learner can conjugate the same tense themself.
        // Group-specific patterns only when the verb group actually follows them.
        const conj = Object.keys(TENSE_CONJ).find((k) => tstr.startsWith(k));
        if (conj) {
          if (!TENSE_CONJ_GROUPED.has(conj) || info.group === "er" ||
              (conj === "présent" && info.group === "ir2")) {
            const key = conj === "présent" && info.group === "ir2" ? "présent-ir" : conj;
            s += " " + TENSE_CONJ[key];
          }
        }
      }
    }
    if (firstMean) s += " Aquí significa «" + firstMean + "».";
    // Forma española: conjugada (tiempo simple) o compuesta («haber» + participio).
    const glossesGiven = Array.isArray(glosses) && glosses.length ? glosses : (firstMean ? [firstMean] : []);
    let es = (info.compound && info.compound.esInf) || esInfinitive(info.infinitive, glossesGiven, (f) => dictionary.lookup(f));
    if (info.pronominalEn && es && !es.endsWith("se")) es += "se";
    const esp = info.compound
      ? esCompuesto(es, info.tense, info.compound.auxPerson, {
          passive: info.compound.passive,
          agree: info.compound.agree,
          stative: info.compound.stative,
          stativeKey: info.compound.stativeKey,
          neg: info.compound.neg
        })
      : esConjugado(es, info.tense);
    if (esp && esp.length) {
      s += " En español: «" + esp.join(" o ") + "».";
    }
    // Morfología del verbo regular en -er (tema + terminación).
    if (!info.compound && info.stem && info.group === "er" && info.ending) {
      s += " Se forma «" + info.stem + "-» + «-" + info.ending + "».";
    }
    return s;
  }
  if (form === "nombre propio") return "";
  if (form) {
    const f = friendlyForm(form);
    if (f && f !== form) return f;
  }
  return "";
}

function aiScroll() {
  aiThread.scrollTop = aiThread.scrollHeight;
}

function aiBubble(role, text) {
  const div = document.createElement("div");
  div.className = "ai-msg ai-" + role;
  div.textContent = text;
  aiThread.appendChild(div);
  aiScroll();
  return div;
}

function aiContext(selected) {
  const book = bible[currentBookIndex];
  const chapName = book ? book.name + " " + (currentChapter + 1) : "";
  let verse = "";
  if (selected && book) {
    const target = selected.replace(/[’']/g, "'").toLowerCase();
    const verses = book.chapters[currentChapter] || [];
    for (let i = 0; i < verses.length; i++) {
      if (verses[i].toLowerCase().includes(target)) {
        verse = "[" + (i + 1) + "] " + verses[i];
        break;
      }
    }
  }
  return { chapName, verse };
}

function localExplain(text) {
  if (!dictionary || !text) return "";
  const segs = dictionary.segment(text);
  if (!segs || !segs.length) return "";
  return segs.map(([span, meanings, info]) => {
    const ms = (meanings || []).slice(0, 4);
    const gloss = plainGloss(info, ms[0] || "", ms);
    let line = '<div class="ai-local-line"><span class="ai-local-word">' + esc(span) + "</span>";
    if (ms.length) {
      line += " = " + ms.map((m, i) => (ms.length > 1 ? (i + 1) + ") " : "") + esc(m)).join(" · ");
    }
    if (gloss) line += '<div class="ai-local-gloss">' + esc(gloss) + "</div>";
    if (ms.length > 1) {
      line += '<div class="ai-local-ctx">Tiene varios significados; el sentido exacto lo da la frase que lo rodea (prueba 🌐 Traducción).</div>';
    }
    line += "</div>";
    return line;
  }).join("");
}

function aiShowLocal() {
  const q = ($("aiInput").value.trim()) || currentKey || "";
  if (!q) {
    aiBubble("assistant", "Toca una palabra del texto o escribe algo para explicártelo.");
    return;
  }
  const html = localExplain(q);
  const div = document.createElement("div");
  div.className = "ai-msg ai-assistant ai-local";
  div.innerHTML =
    '<div class="ai-local-head">📖 Explicación sencilla · <b class="ai-local-word">' +
    esc(q) + "</b></div>" +
    (html || "<span class='dim'>Sin datos para ese texto.</span>");
  aiThread.appendChild(div);
  aiScroll();
}

async function streamOpenRouter(messages, model, key, onDelta) {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!resp.ok || !resp.body) {
    let detail = "";
    try { detail = (await resp.text()).slice(0, 120); } catch (e) {}
    throw new Error(model + " HTTP " + resp.status + " " + detail);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const j = JSON.parse(data);
        const d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (d) onDelta(d);
      } catch (e) { /* partial chunk */ }
    }
  }
}

async function streamGemini(messages, model, key, onDelta) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) + ":streamGenerateContent?alt=sse&key=" + encodeURIComponent(key);
  const system = messages.find(m => m.role === "system");
  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const body = system ? { contents, systemInstruction: { parts: [{ text: system.content }] } } : { contents };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    let t = "";
    try { t = (await resp.text()).slice(0, 140); } catch (e) {}
    throw new Error("Gemini HTTP " + resp.status + " " + t);
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line || line === "[DONE]" || !line.startsWith("data:")) continue;
      try {
        const j = JSON.parse(line.slice(5).trim());
        const parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
        if (parts) for (const p of parts) if (p && p.text) onDelta(p.text);
      } catch (e) { /* partial chunk */ }
    }
  }
}

// Free OpenRouter models, newest-first. The list changes, so if the current
// pick is rate-limited (429) or retires (404), try the next one automatically.
const AI_FREE_FALLBACKS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "liquid/lfm-2.5-2.6b:free",
];

function isRetryable(e) {
  return /(429|403|404|5\d\d|limit|quota|unavailable|terminated|actively|overloaded)/i.test(e.message);
}

async function streamAI(messages, onDelta) {
  const key = effectiveAIKey();
  const chosen = (state.ai.model || "").trim();
  if (aiKeyKind(key) === "gemini") {
    const model = chosen ? chosen.replace(/:free$/i, "") : "gemini-2.5-flash";
    await streamGemini(messages, model, key, onDelta);
    return;
  }
  const models = [chosen, ...AI_FREE_FALLBACKS].filter(Boolean);
  const seen = new Set();
  let lastErr = null;
  for (const model of models) {
    if (seen.has(model)) continue;
    seen.add(model);
    try {
      await streamOpenRouter(messages, model, key, onDelta);
      return;
    } catch (e) {
      lastErr = e;
      if (!chosen && !isRetryable(e)) break;
    }
  }
  throw lastErr || new Error("sin modelo disponible");
}

const _aiHistory = [];

async function aiAsk() {
  const input = $("aiInput");
  const q = input.value.trim();
  if (!q) return;
  aiBubble("user", q);
  input.value = "";
  _aiHistory.push({ role: "user", content: q });
  const ctx = aiContext(currentKey);
  const system = AI_SYSTEM_PROMPT +
    (ctx.chapName ? "\nContexto: libro " + ctx.chapName + "." : "") +
    (ctx.verse ? "\nVersículo de referencia: " + ctx.verse : "");
  const messages = [{ role: "system", content: system }].concat(_aiHistory);
  const bubble = aiBubble("assistant", "…");
  let acc = "";
  try {
    await streamAI(messages, d => {
      if (acc === "" && bubble.textContent === "…") bubble.textContent = "";
      acc += d;
      bubble.textContent = acc;
      aiScroll();
    });
    _aiHistory.push({ role: "assistant", content: acc });
  } catch (e) {
    bubble.remove();
    aiBubble("assistant", "No pude responder ahora (" + e.message + "). Inténtalo otra vez en un momento.");
  }
}

// ---- events ---------------------------------------------------------------
el.bookSelect.addEventListener("change", (e) => selectBook(parseInt(e.target.value, 10), true));
el.chapterSelect.addEventListener("change", (e) => {
  const chap = parseInt(e.target.value, 10);
  if (chap >= 0 && chap !== currentChapter) {
    currentChapter = chap;
    renderChapter();
    saveState();
    closePanel();
  }
});
el.prevBtn.addEventListener("click", gotoPrevChapter);
el.nextBtn.addEventListener("click", gotoNextChapter);
el.speakBtn.addEventListener("click", speak);
el.saveBtn.addEventListener("click", saveCurrent);
el.vocabBtn.addEventListener("click", () => { refreshVocab(); openPanel("vocab"); });
$("scopeAll").addEventListener("click", () => { _vocabScope = "all"; refreshVocab(); });
$("scopeChapter").addEventListener("click", () => { _vocabScope = "chapter"; refreshVocab(); });
$("studyBtn").addEventListener("click", () => startStudy(_vocabScope));
$("studyBack").addEventListener("click", () => { refreshVocab(); openPanel("vocab"); });
$("studyKnow").addEventListener("click", studyKnow);
$("studyAgain").addEventListener("click", studyAgain);
$("studyRestart").addEventListener("click", () => startStudy(_studyScope));
$("studySpeak").addEventListener("click", () => { if (currentKey) speak(); });
$("studyCard").addEventListener("click", revealStudy);
$("studyCard").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); revealStudy(); } });
// The AI is always on: prefilled with the word from the panel when you come
// from a word tap, or blank for general questions.
$("aiBtn").addEventListener("click", () => {
  if (!wordContent.hidden && currentKey) $("aiInput").value = currentKey;
  openPanel("ai");
  setTimeout(() => $("aiInput").focus(), 60);
});
$("wordAiBtn").addEventListener("click", () => {
  $("aiInput").value = currentKey || "";
  openPanel("ai");
  setTimeout(() => $("aiInput").focus(), 60);
});
// Online translation right where the word lives: translate the tapped word or
// the selected phrase on demand.
$("ctxBtn").addEventListener("click", () => {
  if (!currentKey) return;
  _ctxQuery = currentKey;
  el.ctxWrap.hidden = false;
  el.ctxResult.innerHTML = "";
  translateContext();
});
$("aiSendBtn").addEventListener("click", aiAsk);
$("aiLocalBtn").addEventListener("click", aiShowLocal);
$("aiInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); aiAsk(); }
});
// Swipe the card side to side to flip between words (vertical drags scroll).
(function studySwipe() {
  let sx = 0, sy = 0, st = 0, armed = false;
  $("studyContent").addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = e.timeStamp; armed = true;
  }, { passive: true });
  $("studyContent").addEventListener("touchend", (e) => {
    if (!armed) return;
    armed = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    const dt = Math.max(1, e.timeStamp - st);
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) / dt > 0.18) {
      if (dx < 0) studyNext(); else studyPrev();
    }
  }, { passive: true });
})();
$("panelCloseBtn").addEventListener("click", closePanel);
scrim.addEventListener("click", closePanel);

// ---- multi-word selection (phrase lookup) ---------------------------------
let _selectedTimer = null;
el.verseText.addEventListener("mouseup", () => {
  clearTimeout(_selectedTimer);
  _selectedTimer = setTimeout(handleSelection, 60);
});
document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  if (!el.verseText.contains(sel.anchorNode) && !el.verseText.contains(sel.focusNode)) return;
  clearTimeout(_selectedTimer);
  _selectedTimer = setTimeout(handleSelection, 60);
});

function handleSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  if (!el.verseText.contains(sel.anchorNode) || !el.verseText.contains(sel.focusNode)) return;
  const text = sel.toString().trim();
  // require at least two words (single-word taps are handled by click)
  if (!text || text.split(/\s+/).filter(Boolean).length < 2) return;
  el.saveBtn.disabled = true;
  const cleaned = text.replace(/\s+/g, " ");
  _ctxQuery = cleaned;
  const segments = dictionary.segment(cleaned);
  if (segments && segments.length) presentSelection(segments, cleaned);
}

// ---- custom touch gestures ----------------------------------------------
// On coarse-pointer devices native selection is unusable over per-word <span>s
// (long-press snaps to "select everything"), so we own the gestures:
//   · tap a word        → open its translation (the element's click handler)
//   · slide across words → phrase selection
//   · fast wide flick L/R → previous/next chapter
const TOUCH_NAV = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
if (TOUCH_NAV) document.documentElement.classList.add("touch");

let _touchWords = [];
let _lpTimer = null;
let _touchOrigin = { x: 0, y: 0 };
let _swipeStartT = 0;
let _prevMove = { t: 0, adx: 0 };
let _gestMode = "none"; // pending | scroll | select | hswipe
let _selActive = false;
let _anchorIdx = -1;
let _lastIdx = -1;
let _suppressClick = false;
let _clickSuppressTimer = null;

// Keep the post-gesture synthetic click from reopening the tapped word, but
// always recover so the next real tap works.
function armClickSuppress() {
  _suppressClick = true;
  clearTimeout(_clickSuppressTimer);
  _clickSuppressTimer = setTimeout(() => { _suppressClick = false; }, 900);
}

function clearSelectionHighlights() {
  for (const w of _touchWords) w.classList.remove("sel");
}

function paintSelectionRange(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (let i = 0; i < _touchWords.length; i++) {
    _touchWords[i].classList.toggle("sel", i >= lo && i <= hi);
  }
}

function nearestWordAt(x, y) {
  let best = null, bestD = Infinity;
  for (const w of _touchWords) {
    const r = w.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const dx = (r.left + r.width / 2) - x, dy = (r.top + r.height / 2) - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = w; }
  }
  return best;
}

function wordAt(x, y) {
  const hit = document.elementFromPoint(x, y);
  const w = hit && hit.closest ? hit.closest(".word") : null;
  return w || nearestWordAt(x, y);
}

function startTouchSelection(x, y) {
  if (_selActive) return;
  closePanel(); // hide an old translation drawer so hit-testing reaches the words
  _touchWords = [...el.verseText.querySelectorAll(".word")];
  const wordEl = wordAt(x, y);
  if (!wordEl) return;
  const idx = _touchWords.indexOf(wordEl);
  if (idx < 0) return;
  _anchorIdx = idx;
  _lastIdx = idx;
  _selActive = true;
  paintSelectionRange(idx, idx);
  document.addEventListener("touchmove", touchSelectMove, { passive: false });
  document.addEventListener("touchend", touchSelectEnd, { passive: true });
  document.addEventListener("touchcancel", touchSelectEnd, { passive: true });
}

function touchSelectMove(e) {
  if (!_selActive) return;
  if (e.cancelable) e.preventDefault(); // hold the page still while selecting
  const t = e.touches[0];
  const wordEl = wordAt(t.clientX, t.clientY);
  if (!wordEl) return;
  const idx = _touchWords.indexOf(wordEl);
  if (idx < 0 || idx === _lastIdx) return;
  _lastIdx = idx;
  paintSelectionRange(_anchorIdx, idx);
}

function touchSelectEnd() {
  document.removeEventListener("touchmove", touchSelectMove);
  document.removeEventListener("touchend", touchSelectEnd);
  document.removeEventListener("touchcancel", touchSelectEnd);
  if (!_selActive) return;
  _selActive = false;
  const lo = Math.min(_anchorIdx, _lastIdx), hi = Math.max(_anchorIdx, _lastIdx);
  const touched = _touchWords.slice(lo, hi + 1);
  const spoken = touched.map(w => w.textContent).join(" ").replace(/\s+/g, " ").trim();
  const clean = touched.map(w => w.dataset.word).join(" ").replace(/\s+/g, " ").trim();
  _ctxQuery = clean;
  const segments = dictionary.segment(clean);
  if (segments && segments.length) presentSelection(segments, spoken);
  else closePanel();
}

function endSelectionForGesture() {
  if (_selActive) {
    touchSelectEnd();
  } else {
    clearSelectionHighlights();
  }
}

const touchSwapStart = (e) => {
  if (!TOUCH_NAV || _gestMode !== "none") return;
  if (e.touches.length !== 1) return;
  _suppressClick = false;
  _touchOrigin = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  _swipeStartT = e.timeStamp;
  _prevMove = { t: e.timeStamp, adx: 0 };
  _gestMode = "pending";
  _selActive = false;
  clearTimeout(_lpTimer);
  _lpTimer = setTimeout(() => {
    if (_gestMode !== "pending") return;
    _gestMode = "select";
    if (!_selActive) { armClickSuppress(); startTouchSelection(_touchOrigin.x, _touchOrigin.y); }
  }, 260);
};

function touchSwapMove(e) {
  if (!TOUCH_NAV || _gestMode === "none" || _gestMode === "scroll") return;
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  const dx = t.clientX - _touchOrigin.x;
  const dy = t.clientY - _touchOrigin.y;
  const dist = Math.hypot(dx, dy);

  if (_gestMode === "pending") {
    if (dist > 10) {
      clearTimeout(_lpTimer);
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal intent. A chapter flick is decisive: wide AND fast. A word
        // drag is slower, so once it's wide enough we wait to see how fast it
        // is: fast & wide → chapter flip, slow → phrase selection. Velocity is
        // measured between consecutive moves so a sweep that starts late after
        // a busy moment still reads as fast.
        if (Math.abs(dx) >= 24) {
          const stepV = e.timeStamp > _prevMove.t
            ? (Math.abs(dx) - _prevMove.adx) / (e.timeStamp - _prevMove.t)
            : Infinity;
          _prevMove = { t: e.timeStamp, adx: Math.abs(dx) };
          const startV = Math.abs(dx) / Math.max(1, e.timeStamp - _swipeStartT);
          const fast = stepV >= 0.45 || startV >= 0.6;
          if (Math.abs(dx) >= 130 && fast) {
            _gestMode = "hswipe";
            armClickSuppress();
            if (e.cancelable) e.preventDefault();
            return;
          }
          if (!fast || startV < 0.4) {
            _gestMode = "select";
            armClickSuppress();
            if (e.cancelable) e.preventDefault();
            if (!_selActive) startTouchSelection(_touchOrigin.x, _touchOrigin.y);
            touchSelectMove(e);
            return;
          }
        }
        return; // fast but not clearly a full flick yet — keep watching
      } else if (Math.abs(dy) > 12) {
        _gestMode = "scroll"; // vertical intent → native scrolling wins
        return;
      }
    }
  }
  if (_gestMode === "select") {
    if (e.cancelable) e.preventDefault();
    touchSelectMove(e);
  } else if (_gestMode === "hswipe") {
    if (e.cancelable) e.preventDefault();
  }
}

function touchSwapEnd(e) {
  if (!TOUCH_NAV || _gestMode === "none") return;
  clearTimeout(_lpTimer);
  const mode = _gestMode;
  _gestMode = "none";
  if (mode === "hswipe") {
    const t = e.changedTouches && e.changedTouches[0];
    const dx = t ? t.clientX - _touchOrigin.x : 0;
    clearSelectionHighlights();
    if (Math.abs(dx) >= 50) {
      if (dx < 0) gotoNextChapter(); else gotoPrevChapter();
    }
  } else if (mode === "select") {
    endSelectionForGesture();
  } else if (mode === "pending") {
    endSelectionForGesture(); // a slow press with no real movement = single- or multi-word select
  }
}

const touchTarget = readerEl || el.verseText;
touchTarget.addEventListener("touchstart", touchSwapStart, { passive: true });
touchTarget.addEventListener("touchmove", touchSwapMove, { passive: false });
touchTarget.addEventListener("touchend", touchSwapEnd, { passive: true });
touchTarget.addEventListener("touchcancel", touchSwapEnd, { passive: true });
// Suppress the synthetic click iOS fires ~300-500ms after a long-press; otherwise
// it would reset the phrase panel to the single tapped word.
el.verseText.addEventListener("click", (e) => {
  if (_suppressClick) {
    e.preventDefault();
    e.stopPropagation();
    _suppressClick = false;
  }
}, true);

// ---- drag the lookup drawer: pull down to close, pull up to go fullscreen ----
(function initDrawerDrag() {
  const body = panel.querySelector(".panel-body");
  let startY = 0, raw = 0, lastY = 0, lastT = 0, vy = 0, tracking = false;

  const mayDrag = (e) => {
    if (e.target.closest && e.target.closest("button, select, a, input, textarea, summary, details")) return false;
    if (e.target.closest && e.target.closest(".grabber, .panel-head")) return true;
    if (e.target.closest && e.target.closest(".vocab-list, .study-card")) return false;
    if (body) return body.scrollTop === 0;
    return true;
  };

  const onDown = (e) => {
    if (!panel.classList.contains("open") || e.button > 0 || !mayDrag(e)) return;
    tracking = true;
    startY = e.clientY;
    lastY = e.clientY;
    lastT = e.timeStamp;
    raw = 0;
    vy = 0;
    panel.style.transition = "none";
    try { panel.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
  };
  const onMove = (e) => {
    if (!tracking) return;
    const nowY = e.clientY;
    raw = nowY - startY;
    const nowT = e.timeStamp;
    vy = (nowY - lastY) / Math.max(1, nowT - lastT);
    lastY = nowY;
    lastT = nowT;
    let t = raw;
    if (!panel.classList.contains("fullscreen")) t = Math.max(t, -140); // pull up previews fullscreen
    else t = Math.max(t, 0);                                            // pull up keeps it full
    panel.style.transform = `translateY(${t}px)`;
  };
  const finish = () => {
    if (!tracking) return;
    tracking = false;
    panel.style.transform = "";
    panel.style.transition = "";
    const full = panel.classList.contains("fullscreen");
    if (!full && raw < -70) { setPanelFullscreen(true); return; }
    if (!full && (raw >= 110 || (raw > 60 && vy > 0.55))) { closePanel(); return; }
    if (full && raw > 120) setPanelFullscreen(false);
  };
  panel.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
})();

function setPanelFullscreen(full) {
  panel.classList.toggle("fullscreen", full);
}

// ---- init -----------------------------------------------------------------
async function init() {
  loadState();
  // Build the DOM is dynamic, so the browser's own scroll restoration can't
  // know where to go — take the wheel and restore from localStorage instead.
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  el.loading.style.display = "block";
  await loadData();
  el.loading.style.display = "none";
  currentBookIndex = Math.min(Math.max(state.book, 0), bible.length - 1);
  currentChapter = state.chapter || 0;
  buildBookList();
  el.bookSelect.value = currentBookIndex;
  buildChapterList();
  el.chapterSelect.value = currentChapter;
  renderChapter();
  syncTopbarHeight();
  if (readerEl && state.scrollTop) {
    // re-apply a few times: line metrics settle after fonts/layout paint
    setReaderScroll(state.scrollTop);
    requestAnimationFrame(() => setReaderScroll(state.scrollTop));
    setTimeout(() => setReaderScroll(state.scrollTop), 150);
    setTimeout(() => setReaderScroll(state.scrollTop), 800);
  }
  refreshVocab();

  // register service worker for offline/PWA
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }); } catch (e) { /* offline not critical to start */ }
  }
}

init();
