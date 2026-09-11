import { Dictionary, friendlyTense, friendlyForm } from "./dict.js";

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
let state = { book: 0, chapter: 0, vocab: [], scrollTop: 0 };

// ---- DOM refs -------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  loading: $("loading"), bookSelect: $("bookSelect"), chapterSelect: $("chapterSelect"),
  prevBtn: $("prevBtn"), nextBtn: $("nextBtn"), vocabBtn: $("vocabBtn"),
  chapterTitle: $("chapterTitle"), verseText: $("verseText"),
  wordLabel: $("wordLabel"), speakBtn: $("speakBtn"), meaning: $("meaning"),
  grammar: $("grammar"), saveBtn: $("saveBtn"), note: $("note"), vocabList: $("vocabList"),
  ctxWrap: $("ctxWrap"), ctxBtn: $("ctxBtn"), ctxResult: $("ctxResult"),
};

// ---- persistence ----------------------------------------------------------
const readerEl = document.querySelector(".reader");

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem("biblefr") || "{}");
    if (Array.isArray(s.vocab)) state.vocab = s.vocab;
    if (typeof s.book === "number") state.book = s.book;
    if (typeof s.chapter === "number") state.chapter = s.chapter;
    if (typeof s.scrollTop === "number") state.scrollTop = s.scrollTop;
  } catch (e) { /* ignore */ }
}
function saveState() {
  state.book = currentBookIndex;
  state.chapter = currentChapter;
  if (readerEl) state.scrollTop = readerEl.scrollTop;
  try { localStorage.setItem("biblefr", JSON.stringify(state)); } catch (e) {}
}

// Remember where the reader is scrolled to, so reopening resumes at the same
// verse. Save debounced while scrolling and flushed when the app is hidden.
let _scrollSaveTimer = null;
if (readerEl) {
  readerEl.addEventListener("scroll", () => {
    state.scrollTop = readerEl.scrollTop;
    clearTimeout(_scrollSaveTimer);
    _scrollSaveTimer = setTimeout(saveState, 400);
  });
}
function flushReadingPosition() {
  if (readerEl) {
    state.scrollTop = readerEl.scrollTop;
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
  if (readerEl) readerEl.scrollTop = 0; // new chapter starts at the top
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

function setPanelMode(mode) {
  if (mode === "vocab") {
    $("panelTitle").textContent = "Vocabulario";
    wordContent.hidden = true;
    vocabContent.hidden = false;
  } else {
    $("panelTitle").textContent = "Traducción";
    vocabContent.hidden = true;
    wordContent.hidden = false;
  }
}

function openPanel(mode) {
  panel.classList.remove("collapsed");
  setPanelMode(mode || "word");
  panel.classList.add("open");
  scrim.classList.add("show");
  panel.setAttribute("aria-hidden", "false");
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
  const parts = [];
  if (info.form) parts.push(friendlyForm(info.form));
  if (info.infinitive || info.tense) {
    const note = verbNote(info, true);
    if (note) parts.push(note);
  }
  grammar = parts.join("  ·  ");
  if (!meanings) {
    if (info.isName) {
      el.meaning.innerHTML = "<span class='dim'>Nombre propio: persona o lugar.</span>";
      el.grammar.textContent = "nombre propio";
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

function presentSelection(segments) {
  if (!segments.length) return;
  openPanel("word");
  showContextTranslation();
  currentKey = segments.map(s => s[0]).join(" ");
  currentES = "";
  el.wordLabel.textContent = currentKey;
  const lines = [];
  const meaningsAll = [];
  for (const [span, meanings, info] of segments) {
    if (meanings && meanings.length) {
      const right = meanings.slice(0, 4).map(esc).join(" · ");
      let line = `<b>${esc(span)}</b> — ${right}`;
      const details = [];
      if (info.form) details.push(esc(friendlyForm(info.form)));
      if (info.infinitive || info.tense) {
        const note = verbNote(info, false);
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
}

// ---- contextual (whole-phrase) translation ----------------------------------
let _ctxQuery = "";
let _translateBusy = false;

function showContextTranslation() {
  el.ctxWrap.hidden = false;
  el.ctxResult.innerHTML = "";
  el.ctxBtn.disabled = false;
}

function hideContextTranslation() {
  _ctxQuery = "";
  el.ctxWrap.hidden = true;
  el.ctxResult.innerHTML = "";
  el.ctxBtn.disabled = true;
}

async function translateContext() {
  if (!_ctxQuery || _translateBusy) return;
  _translateBusy = true;
  el.ctxBtn.disabled = true;
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
    el.ctxBtn.disabled = false;
  }
}

function verbNote(info, withMeaning) {
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
let _frVoice = null;
let _voicesLoaded = false;

function cacheVoices() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return;
  _voicesLoaded = true;
  _frVoice = voices.find(v => /^fr/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window) {
  cacheVoices();
  window.speechSynthesis.onvoiceschanged = cacheVoices;
}

function hasFrenchVoice() {
  return _voicesLoaded && !!_frVoice;
}

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// WebKit on iOS silences media/TTS that isn't tied to a user gesture. The
// first pointerdown plays a silent sample to unlock the page audio session.
function unlockIOSAudio() {
  if (!IS_IOS) return;
  const a = new Audio();
  a.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==";
  a.volume = 0;
  a.play().catch(() => {});
  if ("speechSynthesis" in window) {
    try { window.speechSynthesis.cancel(); window.speechSynthesis.resume(); } catch (e) {}
    cacheVoices();
  }
}
document.addEventListener("pointerdown", unlockIOSAudio, { once: true });

function playGoogle() {
  // Natural French voice via Google TTS (network), played through an <audio>
  // element. This is reliable on every device and sounds natural — preferred
  // over system voices, which on some devices (Chromebooks, Android) are listed
  // by speechSynthesis but produce no sound.
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;
    const finish = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    const url = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fr&q=" +
      encodeURIComponent(currentKey);
    audio.src = url;
    audio.load();
    audio.onplaying = () => finish(true);
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio.play().catch(() => finish(false));
    setTimeout(() => finish(false), 15000); // stall guard
  });
}

function speakLocal() {
  // Offline fallback: system French voice if the browser has one.
  if (!("speechSynthesis" in window) || !hasFrenchVoice()) return false;
  if (IS_IOS) { try { window.speechSynthesis.cancel(); window.speechSynthesis.resume(); } catch (e) {} }
  const u = new SpeechSynthesisUtterance(currentKey);
  u.lang = "fr-FR";
  if (_frVoice) u.voice = _frVoice;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
  return true;
}

async function speak() {
  if (!currentKey) return;
  // On iOS, TTS outside a user gesture is silenced, so use the gesture-safe
  // system voice synchronously instead of the (usually rejected) network call.
  if (IS_IOS && hasFrenchVoice()) { speakLocal(); return; }
  const ok = await playGoogle();
  if (!ok) {
    if (IS_IOS) { await new Promise((r) => setTimeout(r, 300)); cacheVoices(); }
    speakLocal();
  }
}

// ---- vocabulary -----------------------------------------------------------
function refreshVocab() {
  el.vocabList.innerHTML = "";
  if (!state.vocab.length) {
    const empty = document.createElement("li");
    empty.className = "vocab-empty";
    empty.textContent = "Tu vocabulario está vacío. Selecciona una palabra y guárdala aquí.";
    el.vocabList.appendChild(empty);
    return;
  }
  for (const entry of state.vocab) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${entry.fr} — ${entry.es}`;
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
el.prevBtn.addEventListener("click", () => {
  closePanel();
  if (currentChapter > 0) { currentChapter--; el.chapterSelect.value = currentChapter; renderChapter(); saveState(); }
  else if (currentBookIndex > 0) selectBook(currentBookIndex - 1);
});
el.nextBtn.addEventListener("click", () => {
  closePanel();
  const book = bible[currentBookIndex];
  if (currentChapter < book.chapters.length - 1) { currentChapter++; el.chapterSelect.value = currentChapter; renderChapter(); saveState(); }
  else if (currentBookIndex < bible.length - 1) selectBook(currentBookIndex + 1);
});
el.speakBtn.addEventListener("click", speak);
el.saveBtn.addEventListener("click", saveCurrent);
el.ctxBtn.addEventListener("click", translateContext);
el.vocabBtn.addEventListener("click", () => { refreshVocab(); openPanel("vocab"); });
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
  if (segments && segments.length) presentSelection(segments);
}

// ---- custom touch phrase selection -----------------------------------------
// Native selection on touch devices (iOS in particular) breaks when the text
// is split into interactive per-word <span>s: a long-press/undragged selection
// snaps to "select everything". So on coarse-pointer devices we disable native
// selection via CSS (.touch .verse-text) and do long-press + drag ourselves.
const TOUCH_NAV = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
if (TOUCH_NAV) document.documentElement.classList.add("touch");

let _touchWords = [];
let _lpTimer = null;
let _touchOrigin = { x: 0, y: 0 };
let _selActive = false;
let _anchorIdx = -1;
let _lastIdx = -1;
let _suppressClick = false;

function clearSelectionHighlights() {
  for (const w of _touchWords) w.classList.remove("sel");
}

function paintSelectionRange(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (let i = 0; i < _touchWords.length; i++) {
    _touchWords[i].classList.toggle("sel", i >= lo && i <= hi);
  }
}

function startTouchSelection(wordEl) {
  if (_selActive) return;
  closePanel(); // hide an old translation drawer so hit-testing reaches the words
  _suppressClick = true;
  _touchWords = [...el.verseText.querySelectorAll(".word")];
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
  const hit = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
  const wordEl = hit && hit.closest ? hit.closest(".word") : null;
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
  const text = _touchWords.slice(lo, hi + 1).map(w => w.dataset.word).join(" ");
  _ctxQuery = text;
  const segments = dictionary.segment(text.replace(/\s+/g, " "));
  if (segments && segments.length) presentSelection(segments);
}

const touchStartLp = (e) => {
  if (!TOUCH_NAV || _selActive) return;
  if (e.touches.length !== 1) return;
  _suppressClick = false;
  const wordEl = e.target.closest && e.target.closest(".word");
  if (!wordEl) return;
  _touchOrigin = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  clearTimeout(_lpTimer);
  _lpTimer = setTimeout(() => startTouchSelection(wordEl), 420);
};
const touchMoveLp = (e) => {
  if (!TOUCH_NAV || _selActive) return;
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  if (Math.hypot(t.clientX - _touchOrigin.x, t.clientY - _touchOrigin.y) > 12) {
    clearTimeout(_lpTimer); // user is scrolling, not selecting
  }
};
const touchEndLp = () => {
  if (!_selActive) clearTimeout(_lpTimer); // quick tap — cancel the pending long-press
};
el.verseText.addEventListener("touchstart", touchStartLp, { passive: true });
el.verseText.addEventListener("touchmove", touchMoveLp, { passive: true });
el.verseText.addEventListener("touchend", touchEndLp, { passive: true });
el.verseText.addEventListener("touchcancel", touchEndLp, { passive: true });
// Suppress the synthetic click iOS fires ~500ms after a long-press; otherwise
// it would reset the phrase panel to the single tapped word.
el.verseText.addEventListener("click", (e) => {
  if (_suppressClick) {
    e.preventDefault();
    e.stopPropagation();
    _suppressClick = false;
  }
}, true);

// ---- pull-down to close the lookup drawer ----------------------------------
(function initDrawerDrag() {
  const body = panel.querySelector(".panel-body");
  let startY = 0, dy = 0, lastY = 0, lastT = 0, vy = 0, tracking = false;

  const mayDrag = (e) => {
    if (e.target.closest && e.target.closest("button, select, a")) return false;
    if (e.target.closest && e.target.closest(".grabber, .panel-head")) return true;
    if (e.target.closest && e.target.closest(".vocab-list")) return false;
    if (body) return body.scrollTop === 0;
    return true;
  };

  const onDown = (e) => {
    if (!panel.classList.contains("open") || e.button > 0 || !mayDrag(e)) return;
    tracking = true;
    startY = e.clientY;
    lastY = e.clientY;
    lastT = e.timeStamp;
    dy = 0;
    vy = 0;
    panel.style.transition = "none";
  };
  const onMove = (e) => {
    if (!tracking) return;
    const nowY = e.clientY;
    dy = Math.max(0, nowY - startY);
    const nowT = e.timeStamp;
    vy = (nowY - lastY) / Math.max(1, nowT - lastT);
    lastY = nowY;
    lastT = nowT;
    panel.style.transform = `translateY(${dy}px)`;
  };
  const finish = () => {
    if (!tracking) return;
    tracking = false;
    panel.style.transform = "";
    panel.style.transition = "";
    if (dy >= 110 || (dy > 60 && vy > 0.55)) closePanel();
  };
  panel.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
})();

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
  if (readerEl && state.scrollTop) {
    // re-apply a few times: line metrics settle after fonts/layout paint
    readerEl.scrollTop = state.scrollTop;
    requestAnimationFrame(() => { readerEl.scrollTop = state.scrollTop; });
    setTimeout(() => { if (readerEl) readerEl.scrollTop = state.scrollTop; }, 150);
  }
  refreshVocab();

  // register service worker for offline/PWA
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }); } catch (e) { /* offline not critical to start */ }
  }
}

init();
