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
let state = { book: 0, chapter: 0, vocab: [] };

// ---- DOM refs -------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  loading: $("loading"), bookSelect: $("bookSelect"), chapterSelect: $("chapterSelect"),
  prevBtn: $("prevBtn"), nextBtn: $("nextBtn"), vocabBtn: $("vocabBtn"),
  chapterTitle: $("chapterTitle"), verseText: $("verseText"),
  wordLabel: $("wordLabel"), speakBtn: $("speakBtn"), meaning: $("meaning"),
  grammar: $("grammar"), saveBtn: $("saveBtn"), note: $("note"), vocabList: $("vocabList"),
};

// ---- persistence ----------------------------------------------------------
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem("biblefr") || "{}");
    if (Array.isArray(s.vocab)) state.vocab = s.vocab;
    if (typeof s.book === "number") state.book = s.book;
    if (typeof s.chapter === "number") state.chapter = s.chapter;
  } catch (e) { /* ignore */ }
}
function saveState() {
  state.book = currentBookIndex;
  state.chapter = currentChapter;
  try { localStorage.setItem("biblefr", JSON.stringify(state)); } catch (e) {}
}

// ---- data loading ---------------------------------------------------------
async function loadData() {
  try {
    const [raw, dict] = await Promise.all([
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
    tokens.forEach((token, ti) => {
      const word = document.createElement("span");
      word.className = "word";
      word.textContent = token;
      word.dataset.word = token.replace(/[.,;:!?«»"'“”‘’()[\]*–—]+$/g, "").replace(/^[.,;:!?«»"'“”‘’()[\]*–—]+/g, "");
      word.addEventListener("click", () => presentWord(word.dataset.word, ti, token));
      docFrag.appendChild(word);
      if (ti < tokens.length - 1) docFrag.appendChild(document.createTextNode(" "));
    });
    docFrag.appendChild(document.createElement("br"));
  });
  el.verseText.appendChild(docFrag);
  el.verseText.scrollTop = 0;
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
  saveState();
}

// ---- lookup ---------------------------------------------------------------
let currentKey = "";
let currentES = "";

function presentWord(word) {
  if (!dictionary) return;
  const [meanings, info] = dictionary.resolve(word);
  currentKey = word;
  el.wordLabel.textContent = word;
  let grammar = "";
  const parts = [];
  if (info.form) parts.push(friendlyForm(info.form));
  if (info.infinitive || info.tense) {
    const note = verbNote(info, true);
    if (note) parts.push(note);
  }
  grammar = parts.join("  ·  ");
  if (!meanings) {
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
      lines.push(`<b>${esc(span)}</b> — <span class='dim'>sin traducción</span>`);
    }
  }
  el.meaning.innerHTML = lines.join("<br/>");
  el.grammar.textContent = "";
  el.note.textContent = "";
  el.saveBtn.disabled = false;
  el.speakBtn.disabled = false;
  currentES = meaningsAll.join(" · ");
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
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(currentKey);
  u.lang = "fr-FR";
  if (_frVoice) u.voice = _frVoice;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
  return true;
}

async function speak() {
  if (!currentKey) return;
  const ok = await playGoogle();
  if (!ok) speakLocal();
}

// ---- vocabulary -----------------------------------------------------------
function refreshVocab() {
  el.vocabList.innerHTML = "";
  if (!state.vocab.length) return;
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
  }
});
el.prevBtn.addEventListener("click", () => {
  if (currentChapter > 0) { currentChapter--; el.chapterSelect.value = currentChapter; renderChapter(); saveState(); }
  else if (currentBookIndex > 0) selectBook(currentBookIndex - 1);
});
el.nextBtn.addEventListener("click", () => {
  const book = bible[currentBookIndex];
  if (currentChapter < book.chapters.length - 1) { currentChapter++; el.chapterSelect.value = currentChapter; renderChapter(); saveState(); }
  else if (currentBookIndex < bible.length - 1) selectBook(currentBookIndex + 1);
});
el.speakBtn.addEventListener("click", speak);
el.saveBtn.addEventListener("click", saveCurrent);
el.vocabBtn.addEventListener("click", refreshVocab);

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
  const segments = dictionary.segment(text.replace(/\s+/g, " "));
  if (segments && segments.length) presentSelection(segments);
}

// ---- init -----------------------------------------------------------------
async function init() {
  loadState();
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
  refreshVocab();

  // register service worker for offline/PWA
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }); } catch (e) { /* offline not critical to start */ }
  }
}

init();
