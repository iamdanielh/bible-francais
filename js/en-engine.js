// English morphological engine: light stemmer + irregular table for the EN side.
// Mirrors the TrEngine interface (lookup / resolve / segment) so js/app.js can
// drive it the same way: new EnEngine(dict, names).
//
// English morphology is shallow compared to Turkish, so resolve() is:
//   digits → Spanish cardinal / bible reference
//   direct dictionary hit (with possessive-'s and contraction handling)
//   irregular table (went→go, children→child, …)
//   regular suffix strip (-ies/-es/-s, -ied/-ed, -ing, -er/-est), dict-gated
//   capitalized unknown → proper name
//   unknown → [null, {}]

function normalizeEn(str) {
  return String(str).normalize("NFC").toLowerCase();
}

function isCapitalizedEn(word) {
  const c = [...String(word)][0];
  return !!c && c !== c.toLowerCase() && c === c.toUpperCase();
}

function isConsonantEn(c) {
  return "bcdfghjklmnpqrstvwxyz".includes(c);
}

function undoubleEn(stem) {
  if (stem.length >= 2) {
    const a = stem[stem.length - 1], b = stem[stem.length - 2];
    if (a === b && isConsonantEn(a)) return stem.slice(0, -1);
  }
  return stem;
}

// Full-word contractions → base word.
const EN_CONTRACT = {
  "don't": "do", "doesn't": "do", "didn't": "do",
  "can't": "can", "couldn't": "can",
  "won't": "will", "wouldn't": "will",
  "isn't": "be", "aren't": "be", "wasn't": "be", "weren't": "be",
  "haven't": "have", "hasn't": "have", "hadn't": "have",
  "shouldn't": "shall",
};
// Suffix contractions: "he'll" → "will", "i'm" → "be", …
const EN_CONTRACT_SUF = [
  ["'ll", "will"], ["'re", "be"], ["'ve", "have"], ["'m", "be"], ["'d", "would"],
];

// Irregular inflections → dictionary headword. Includes KJV forms
// (hath/doth/saith/spake/smitten/…).
const EN_IRREGULAR = {
  "am": "be", "is": "be", "are": "be", "was": "be", "were": "be", "been": "be",
  "has": "have", "have": "have", "had": "have", "hath": "have",
  "does": "do", "did": "do", "done": "do", "doth": "do",
  "said": "say", "says": "say", "saith": "say",
  "went": "go", "gone": "go", "goes": "go",
  "came": "come",
  "saw": "see", "seen": "see",
  "made": "make",
  "took": "take", "taken": "take",
  "gave": "give", "given": "give",
  "knew": "know", "known": "know",
  "got": "get", "gotten": "get",
  "thought": "think",
  "brought": "bring",
  "bought": "buy",
  "found": "find",
  "told": "tell",
  "felt": "feel",
  "left": "leave",
  "kept": "keep",
  "held": "hold",
  "stood": "stand",
  "sat": "sit",
  "lay": "lie", "lain": "lie", "lying": "lie",
  "dying": "die", "tying": "tie",
  "children": "child", "men": "man", "women": "woman",
  "teeth": "tooth", "feet": "foot", "mice": "mouse", "oxen": "ox",
  "these": "this", "those": "that",
  // KJV / literary past forms
  "spake": "speak", "spoke": "speak", "spoken": "speak",
  "brake": "break", "broken": "break",
  "chose": "choose", "chosen": "choose",
  "drave": "drive", "driven": "drive",
  "forgave": "forgive", "forgiven": "forgive",
  "forsook": "forsake", "forsaken": "forsake",
  "froze": "freeze", "frozen": "freeze",
  "hid": "hide", "hidden": "hide",
  "rode": "ride", "ridden": "ride",
  "rose": "rise", "risen": "rise",
  "smote": "smite", "smitten": "smite",
  "strode": "stride", "stridden": "stride",
  "strove": "strive", "striven": "strive",
  "swore": "swear", "sworn": "swear",
  "tore": "tear", "torn": "tear",
  "wore": "wear", "worn": "wear",
  "wrote": "write", "written": "write",
  "bade": "bid", "bidden": "bid",
  "forbade": "forbid", "forbidden": "forbid",
  "arose": "arise", "arisen": "arise",
  "awoke": "awake", "awaked": "awake", "awoken": "awake",
  "bore": "bear", "born": "bear", "borne": "bear",
  "began": "begin", "begun": "begin",
  "begot": "beget", "begotten": "beget",
  "besought": "beseech",
  "bound": "bind",
  "clave": "cleave", "cloven": "cleave", "cleft": "cleave",
  "dealt": "deal",
  "dug": "dig",
  "dwelt": "dwell",
  "fled": "flee",
  "flung": "fling",
  "forbore": "forbear", "forborne": "forbear",
  "foreknew": "foreknow", "foreknown": "foreknow",
  "forgat": "forget", "forgot": "forget", "forgotten": "forget",
  "ground": "grind",
  "hung": "hang",
  "knelt": "kneel",
  "leapt": "leap",
  "learnt": "learn",
  "lit": "light",
  "met": "meet",
  "overcame": "overcome",
  "partook": "partake", "partaken": "partake",
  "rent": "rend",
  "shone": "shine",
  "shrank": "shrink", "shrunk": "shrink",
  "slain": "slay", "slew": "slay",
  "smelled": "smell", "smelt": "smell",
  "sowed": "sow", "sown": "sow",
  "sped": "speed",
  "spilt": "spill",
  "spoilt": "spoil",
  "sprang": "spring", "sprung": "spring",
  "stank": "stink", "stunk": "stink",
  "stole": "steal", "stolen": "steal",
  "stuck": "stick",
  "stung": "sting",
  "swept": "sweep",
  "swelled": "swell", "swollen": "swell",
  "swung": "swing",
  "taught": "teach",
  "trod": "tread", "trodden": "tread",
  "underwent": "undergo", "undergone": "undergo",
  "understood": "understand",
  "undertook": "undertake", "undertaken": "undertake",
  "wept": "weep",
  "withdrew": "withdraw", "withdrawn": "withdraw",
  "withstood": "withstand",
  "wrung": "wring",
  "wedded": "wed",
  "shalt": "shall", "wilt": "will", "shouldst": "shall",
};

// Spanish cardinals for the EN numeric resolver (0 → millions).
const EN_ES_0_29 = {
  0: "cero", 1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco",
  6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez", 11: "once",
  12: "doce", 13: "trece", 14: "catorce", 15: "quince", 16: "dieciséis",
  17: "diecisiete", 18: "dieciocho", 19: "diecinueve", 20: "veinte",
  21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro",
  25: "veinticinco", 26: "veintiséis", 27: "veintisiete", 28: "veintiocho",
  29: "veintinueve",
};
const EN_ES_TENS = {
  30: "treinta", 40: "cuarenta", 50: "cincuenta", 60: "sesenta",
  70: "setenta", 80: "ochenta", 90: "noventa",
};
const EN_ES_HUND = {
  200: "doscientos", 300: "trescientos", 400: "cuatrocientos",
  500: "quinientos", 600: "seiscientos", 700: "setecientos",
  800: "ochocientos", 900: "novecientos",
};

export function enNumberEs(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n) || n < 0) return null;
  if (n <= 29) return EN_ES_0_29[n];
  if (n < 100) {
    const t = Math.floor(n / 10) * 10, r = n % 10;
    return r ? EN_ES_TENS[t] + " y " + EN_ES_0_29[r] : EN_ES_TENS[t];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100), r = n % 100;
    if (h === 1) return r === 0 ? "cien" : "ciento " + enNumberEs(r);
    return EN_ES_HUND[h * 100] + (r ? " " + enNumberEs(r) : "");
  }
  if (n < 1000000) {
    const m = Math.floor(n / 1000), r = n % 1000;
    const mw = m === 1 ? "mil"
      : enNumberEs(m).replace(/veintiuno$/, "veintiún").replace(/ uno$/, " un") + " mil";
    return r ? mw + " " + enNumberEs(r) : mw;
  }
  if (n < 1000000000) {
    const mi = Math.floor(n / 1000000), r = n % 1000000;
    const miw = mi === 1 ? "un millón" : enNumberEs(mi) + " millones";
    return r ? miw + " " + enNumberEs(r) : miw;
  }
  return null;
}

// Chapter:verse citations («1:29», «20:13-15»).
const EN_REFERENCE = /^[0-9][0-9.,:\-–—]*$/;

// Same punctuation trim set as TrEngine.segment.
const EN_TRIM = /^[\-.,;:!?…«»"'“”‘’()\[\]{}*–——]+|[\-.,;:!?…«»"'“”‘’()\[\]{}*–——]+$/g;

export class EnEngine {
  constructor(map, names) {
    this._map = map || {};
    this._index = new Map();
    for (const [k, v] of Object.entries(this._map)) {
      this._index.set(normalizeEn(k), v);
    }
    // Proper-name table (EN root → Spanish name), e.g. {"moses": "Moisés"}.
    this._names = names || {};
    this._nameIndex = new Map();
    for (const [k, v] of Object.entries(this._names)) {
      this._nameIndex.set(normalizeEn(k), v);
    }
  }

  _dictGet(key) {
    const arr = this._index.get(key);
    if (arr && Array.isArray(arr) && arr.length) return arr.slice();
    return null;
  }

  // The dictionary key a surface word resolves through (contractions and
  // possessive-'s included), or null.
  _lookupKey(w) {
    if (EN_CONTRACT[w]) return this._lookupKey(EN_CONTRACT[w]);
    for (const [suf, base] of EN_CONTRACT_SUF) {
      if (w.length > suf.length && w.endsWith(suf)) return this._lookupKey(base);
    }
    if (w.length > 3 && w.endsWith("'s")) {
      const b = w.slice(0, -2);
      if (this._index.has(b)) return b;
    }
    if (w.length > 2 && w.endsWith("'")) {
      const b = w.slice(0, -1);
      if (this._index.has(b)) return b;
    }
    return this._index.has(w) ? w : null;
  }

  lookup(word) {
    const w = normalizeEn(word).replace(/’/g, "'");
    const key = this._lookupKey(w);
    return key ? this._dictGet(key) : null;
  }

  // Regular suffix stripping, dict-gated: every candidate stem must be a real
  // dictionary entry, otherwise it is rejected (no over-stemming).
  _stripRegular(bare) {
    const tryStem = (stem, name, surface, es) => {
      if (stem && stem.length >= 2 && this._index.has(stem)) {
        return { stem, name, surface, es };
      }
      return null;
    };
    const PL = "plural / 3ª persona";
    let m;
    if (bare.length > 4 && bare.endsWith("ies")) {
      m = tryStem(bare.slice(0, -3) + "y", "-ies", "ies", PL);
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("es")) {
      m = tryStem(bare.slice(0, -2), "-es", "es", PL) ||
          tryStem(bare.slice(0, -1), "-es", "es", PL);
      if (m) return m;
    }
    if (bare.length > 3 && bare.endsWith("s") && !bare.endsWith("ss")) {
      m = tryStem(bare.slice(0, -1), "-s", "s", PL);
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("ied")) {
      m = tryStem(bare.slice(0, -3) + "y", "-ied", "ied", "pasado");
      if (m) return m;
    }
    if (bare.length > 3 && bare.endsWith("ed")) {
      const noEd = bare.slice(0, -2);
      m = tryStem(noEd, "-ed", "ed", "pasado") ||
          tryStem(bare.slice(0, -1), "-ed", "ed", "pasado") ||
          tryStem(undoubleEn(noEd), "-ed", "ed", "pasado");
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("ing")) {
      const noIng = bare.slice(0, -3);
      m = tryStem(noIng, "-ing", "ing", "gerundio") ||
          tryStem(noIng + "e", "-ing", "ing", "gerundio") ||
          tryStem(undoubleEn(noIng), "-ing", "ing", "gerundio");
      if (m) return m;
    }
    if (bare.length > 5 && bare.endsWith("ier")) {
      m = tryStem(bare.slice(0, -3) + "y", "-er", "ier", "comparativo");
      if (m) return m;
    }
    // Archaic KJV 3rd-person singular («believeth» → «believe»).
    if (bare.length > 5 && bare.endsWith("eth")) {
      const noEth = bare.slice(0, -3);
      m = tryStem(noEth, "-eth", "eth", "3ª persona (arcaico)") ||
          tryStem(noEth + "e", "-eth", "eth", "3ª persona (arcaico)") ||
          tryStem(bare.slice(0, -4), "-eth", "eth", "3ª persona (arcaico)");
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("er")) {
      const noEr = bare.slice(0, -2);
      m = tryStem(noEr, "-er", "er", "comparativo") ||
          tryStem(undoubleEn(noEr), "-er", "er", "comparativo");
      if (m) return m;
    }
    if (bare.length > 5 && bare.endsWith("iest")) {
      m = tryStem(bare.slice(0, -4) + "y", "-est", "iest", "superlativo");
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("est")) {
      const noEst = bare.slice(0, -3);
      m = tryStem(noEst, "-est", "est", "superlativo") ||
          tryStem(undoubleEn(noEst), "-est", "est", "superlativo");
      if (m) return m;
    }
    return null;
  }

  resolve(word, opts = {}) {
    const raw = String(word);
    const w = normalizeEn(raw).replace(/’/g, "'");
    const bare = w;
    if (!bare) return [null, {}];
    // Digits: a pure number (commas allowed) becomes a Spanish cardinal;
    // anything with : or - is kept as a bible reference.
    if (EN_REFERENCE.test(bare)) {
      if (/[:\-–—]/.test(bare)) {
        return [[bare], { root: bare, form: "referencia bíblica", isReference: true, suffixes: [] }];
      }
      const n = Number(bare.replace(/,/g, ""));
      const es = Number.isInteger(n) && n >= 0 ? enNumberEs(n) : null;
      if (es) return [[es], { root: bare, form: "número", isNumber: true, suffixes: [] }];
      return [null, {}];
    }
    // Direct dictionary hit (contractions and possessive-'s included).
    const key = this._lookupKey(bare);
    if (key) {
      return [this._dictGet(key), { root: key, form: "", isBare: true, suffixes: [] }];
    }
    // Irregular inflections.
    const irr = EN_IRREGULAR[bare];
    if (irr) {
      const g = this._dictGet(irr);
      if (g) {
        return [g, {
          root: irr, form: "",
          suffixes: [{ name: "(irregular)", surface: bare, es: "forma irregular" }],
        }];
      }
    }
    // Regular suffix stripping (dict-gated).
    const st = this._stripRegular(bare);
    if (st) {
      return [this._dictGet(st.stem), {
        root: st.stem, form: "",
        suffixes: [{ name: st.name, surface: st.surface, es: st.es }],
      }];
    }
    // Proper names: a capitalized token that is neither a dictionary word nor
    // a known inflection. Consult the curated name table first
    // ("Moses" → "Moisés"), otherwise keep the surface form.
    if (isCapitalizedEn(raw)) {
      const disp = raw.replace(/['’][sS]$/, "").replace(/['’]$/, "");
      const nk = normalizeEn(disp);
      const esName = this._nameIndex.get(nk);
      return [[esName || disp], { isName: true, root: nk, form: "nombre propio", suffixes: [] }];
    }
    return [null, {}];
  }

  segment(text, opts = {}) {
    const out = [];
    for (const tok of String(text).split(/\s+/)) {
      const w = tok.replace(EN_TRIM, "");
      if (!w) continue;
      const [m, info] = this.resolve(w, opts);
      out.push([w, m, info]);
    }
    return out;
  }
}
