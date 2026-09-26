// English morphological engine: light stemmer + irregular table for the EN side.
// Mirrors the TrEngine interface (lookup / resolve / segment) so js/app.js can
// drive it the same way: new EnEngine(dict, names).
//
// English morphology is shallow compared to Turkish, so resolve() is:
//   digits → Spanish cardinal / bible reference
//   hyphen compounds → number words ("twenty-five"), curated splits
//   possessive-'s → full pipeline on the base ("children's" → child)
//   direct dictionary hit (with contraction handling)
//   irregular table (went→go, children→child, sent→send, …)
//   prefixes over-/under-/out- + regular suffix strip, dict-gated and chained
//     (-ies/-es/-s, -ied/-ed, -ing, -ly, -ness, -less, -ful, -ess, -er/-or,
//      -ier/-iest, -est, -eth, f→-ves), every stem must be a real dict entry
//   capitalized unknown → proper name (curated table, else surface form)
//   unknown → [null, {}]
//
// lookup() runs the SAME pipeline as resolve() (returns just the meanings),
// so there is a single source of truth for "does this word have a translation".

function normalizeEn(str) {
  return String(str).normalize("NFC").toLowerCase().replace(/[‘’]/g, "'");
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
  "can't": "can", "couldn't": "can", "cannot": "can",
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
// (hath/doth/saith/spake/smitten/…) and irregular plurals.
const EN_IRREGULAR = {
  "am": "be", "art": "be", "is": "be", "are": "be",
  "was": "be", "wast": "be", "were": "be", "wert": "be", "been": "be",
  "has": "have", "had": "have", "hath": "have",
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
  "abode": "abide", "abided": "abide",
  "awoke": "awake", "awaked": "awake", "awoken": "awake",
  "backslid": "backslide",
  "bade": "bid", "bidden": "bid",
  "bore": "bear", "born": "bear", "borne": "bear",
  "beat": "beat", "beaten": "beat",
  "became": "become", "become": "become",
  "befell": "befall", "befallen": "befall",
  "began": "begin", "begun": "begin",
  "begot": "beget", "begotten": "beget",
  "beheld": "behold",
  "bent": "bend",
  "bereft": "bereave",
  "besought": "beseech",
  "beset": "beset",
  "bound": "bind",
  "bit": "bite", "bitten": "bite",
  "bled": "bleed",
  "blew": "blow", "blown": "blow",
  "broke": "break", "broken": "break",
  "bred": "breed",
  "built": "build",
  "burnt": "burn", "burned": "burn",
  "burst": "burst",
  "cast": "cast",
  "caught": "catch",
  "chid": "chide", "chidden": "chide",
  "chose": "choose", "chosen": "choose",
  "clave": "cleave", "clove": "cleave", "cloven": "cleave", "cleft": "cleave",
  "clung": "cling",
  "cost": "cost",
  "crept": "creep",
  "crew": "crow", "crowed": "crow",
  "cut": "cut",
  "durst": "dare",
  "dealt": "deal",
  "dug": "dig",
  "dived": "dive",
  "drew": "draw", "drawn": "draw",
  "dreamt": "dream", "dreamed": "dream",
  "drank": "drink", "drunk": "drink",
  "drove": "drive", "driven": "drive", "drave": "drive",
  "dwelt": "dwell",
  "ate": "eat", "eaten": "eat",
  "fell": "fall", "fallen": "fall",
  "fed": "feed",
  "fought": "fight",
  "fled": "flee",
  "flung": "fling",
  "flew": "fly", "flown": "fly",
  "forbade": "forbid", "forbidden": "forbid",
  "forecast": "forecast",
  "foresaw": "foresee", "foreseen": "foresee",
  "forgat": "forget", "forgot": "forget", "forgotten": "forget",
  "forgave": "forgive", "forgiven": "forgive",
  "forsook": "forsake", "forsaken": "forsake",
  "froze": "freeze", "frozen": "freeze",
  "gainsaid": "gainsay",
  "girt": "gird", "girded": "gird",
  "ground": "grind",
  "grew": "grow", "grown": "grow",
  "hamstrung": "hamstring",
  "hung": "hang", "hanged": "hang",
  "heard": "hear",
  "hove": "heave", "heaved": "heave",
  "hewed": "hew", "hewn": "hew",
  "hid": "hide", "hidden": "hide",
  "hit": "hit",
  "hurt": "hurt",
  "inlaid": "inlay",
  "knelt": "kneel", "kneeled": "kneel",
  "knit": "knit", "knitted": "knit",
  "laded": "lade", "laden": "lade",
  "laid": "lay",
  "led": "lead",
  "leant": "lean", "leaned": "lean",
  "leapt": "leap", "leaped": "leap",
  "learnt": "learn", "learned": "learn",
  "lent": "lend",
  "let": "let",
  "lit": "light", "lighted": "light",
  "lost": "lose",
  "meant": "mean",
  "met": "meet",
  "misled": "mislead",
  "mistook": "mistake", "mistaken": "mistake",
  "mown": "mow", "mowed": "mow",
  "overcame": "overcome",
  "overdid": "overdo", "overdone": "overdo",
  "overdrew": "overdraw", "overdrawn": "overdraw",
  "overheard": "overhear",
  "overrode": "override", "overridden": "override",
  "overslept": "oversleep",
  "overthrew": "overthrow", "overthrown": "overthrow",
  "overtook": "overtake", "overtaken": "overtake",
  "paid": "pay",
  "pent": "pen", "penned": "pen",
  "pled": "plead", "pleaded": "plead",
  "proven": "prove", "proved": "prove",
  "put": "put",
  "quit": "quit", "quitted": "quit",
  "read": "read",
  "rebuilt": "rebuild",
  "redid": "redo", "redone": "redo",
  "rent": "rend",
  "repaid": "repay",
  "reran": "rerun",
  "retold": "retell",
  "rid": "rid",
  "rode": "ride", "ridden": "ride",
  "rang": "ring", "rung": "ring",
  "rose": "rise", "risen": "rise",
  "arose": "arise", "arisen": "arise",
  "rived": "rive", "riven": "rive",
  "ran": "run",
  "sawn": "saw", "sawed": "saw",
  "sought": "seek",
  "sold": "sell",
  "sent": "send",
  "set": "set",
  "sewn": "sew", "sewed": "sew",
  "shook": "shake", "shaken": "shake",
  "shaven": "shave", "shaved": "shave",
  "shore": "shear", "shorn": "shear",
  "shed": "shed",
  "shone": "shine",
  "shod": "shoe",
  "shot": "shoot",
  "shown": "show", "showed": "show",
  "shrank": "shrink", "shrunk": "shrink",
  "shut": "shut",
  "sang": "sing", "sung": "sing",
  "sank": "sink", "sunk": "sink",
  "slew": "slay", "slain": "slay",
  "slept": "sleep",
  "slid": "slide",
  "slung": "sling",
  "slit": "slit",
  "smote": "smite", "smitten": "smite",
  "smelt": "smell", "smelled": "smell",
  "snuck": "sneak", "sneaked": "sneak",
  "sowed": "sow", "sown": "sow",
  "spoke": "speak", "spoken": "speak", "spake": "speak",
  "sped": "speed", "speeded": "speed",
  "spelt": "spell", "spelled": "spell",
  "spent": "spend",
  "spilt": "spill", "spilled": "spill",
  "spun": "spin",
  "spat": "spit", "spit": "spit",
  "split": "split",
  "spoilt": "spoil", "spoiled": "spoil",
  "spread": "spread",
  "sprang": "spring", "sprung": "spring",
  "stole": "steal", "stolen": "steal",
  "stuck": "stick",
  "stung": "sting",
  "stank": "stink", "stunk": "stink",
  "strode": "stride", "stridden": "stride",
  "struck": "strike", "stricken": "strike",
  "strung": "string",
  "strove": "strive", "striven": "strive",
  "swore": "swear", "sworn": "swear",
  "swept": "sweep",
  "swelled": "swell", "swollen": "swell",
  "swam": "swim", "swum": "swim",
  "swung": "swing",
  "taught": "teach",
  "tore": "tear", "torn": "tear",
  "thought": "think",
  "threw": "throw", "thrown": "throw",
  "thrust": "thrust",
  "trod": "tread", "trodden": "tread",
  "unbent": "unbend",
  "unbound": "unbind",
  "underwent": "undergo", "undergone": "undergo",
  "understood": "understand",
  "undertook": "undertake", "undertaken": "undertake",
  "undid": "undo", "undone": "undo",
  "unfroze": "unfreeze", "unfrozen": "unfreeze",
  "unhid": "unhide", "unhidden": "unhide",
  "unlearnt": "unlearn",
  "unsaid": "unsay",
  "unspun": "unspin",
  "unstuck": "unstick",
  "unstrung": "unstring",
  "unwove": "unweave", "unwoven": "unweave",
  "unwound": "unwind",
  "upheld": "uphold",
  "upset": "upset",
  "woke": "wake", "woken": "wake", "waked": "wake",
  "waylaid": "waylay",
  "wore": "wear", "worn": "wear",
  "wove": "weave", "woven": "weave",
  "wed": "wed", "wedded": "wed",
  "wept": "weep",
  "wet": "wet", "wetted": "wet",
  "won": "win",
  "wound": "wind",
  "withdrew": "withdraw", "withdrawn": "withdraw",
  "withheld": "withhold",
  "withstood": "withstand",
  "wrung": "wring",
  "wrote": "write", "written": "write",
  // KJV 2nd/3rd person
  "shalt": "shall", "wilt": "will", "shouldst": "shall",
  // irregular plurals / demonstratives
  "these": "this", "those": "that",
  "children": "child", "men": "man", "women": "woman",
  "teeth": "tooth", "feet": "foot", "mice": "mouse", "oxen": "ox",
  "geese": "goose", "lice": "louse", "brethren": "brother", "kine": "cow",
  "wives": "wife", "knives": "knife", "loaves": "loaf", "calves": "calf",
  "halves": "half", "elves": "elf", "hooves": "hoof", "scarves": "scarf",
  "shelves": "shelf", "thieves": "thief", "wolves": "wolf", "selves": "self",
  "sheaves": "sheaf",
  "footmen": "footman", "workmen": "workman",
  "horsemen": "horseman", "watchmen": "watchman", "fishermen": "fisherman", "kinsmen": "kinsman",
  "countrymen": "countryman", "madmen": "madman",
  "craftsmen": "craftsman", "herdsmen": "herdsman",
  "staves": "staff", "denarii": "denarius",
};

// Prefixes that compose with a full inflected stem:
// "overlaid" → over + laid → lay; "outstretched" → out + stretch + -ed.
const EN_PREFIX = ["over", "under", "out"];

// English number words for hyphen compounds ("twenty-five", "twenty-fourth").
const EN_NUMW = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
  first: 1, second: 2, third: 3, fifth: 5, eighth: 8, ninth: 9, twelfth: 12,
};
// "twenty-five" → {n:25,ordinal:false}; "twenty-fourth" → {n:24,ordinal:true}.
export function enWordNumber(w) {
  const parts = String(w).toLowerCase().split("-");
  if (!parts.length || parts.length > 2) return null;
  let ordinal = false;
  const vals = [];
  for (let p of parts) {
    if (EN_NUMW[p] != null) {
      if (EN_NUMW[p] < 20 && /^(first|second|third|fifth|eighth|ninth|twelfth)$/.test(p)) ordinal = true;
      vals.push(EN_NUMW[p]);
      continue;
    }
    if (/ieth$/.test(p)) { p = p.replace(/ieth$/, "y"); ordinal = true; }
    else if (/th$/.test(p)) { p = p.replace(/th$/, ""); ordinal = true; }
    else return null;
    if (EN_NUMW[p] == null || EN_NUMW[p] >= 100) return null;
    vals.push(EN_NUMW[p]);
  }
  if (vals.length === 2) {
    const [a, b] = vals;
    if (a < 20 || a > 90 || a % 10 !== 0 || b < 1 || b > 9) return null;
    return { n: a + b, ordinal };
  }
  return { n: vals[0], ordinal };
}

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

  // The dictionary key a surface word resolves through (contraction handling
  // included), or null. Runs on already-normalized input.
  _lookupKey(w) {
    if (EN_CONTRACT[w]) return this._lookupKey(EN_CONTRACT[w]);
    for (const [suf, base] of EN_CONTRACT_SUF) {
      if (w.length > suf.length && w.endsWith(suf)) return this._lookupKey(base);
    }
    if (w.length > 2 && w.endsWith("'")) {
      const b = w.slice(0, -1);
      if (this._index.has(b)) return b;
    }
    return this._index.has(w) ? w : null;
  }

  // Single source of truth: lookup() runs the same pipeline as resolve().
  lookup(word) {
    const [m] = this.resolve(word);
    return m;
  }

  // Irregular table, dict-gated (a lemma missing from the dictionary is skipped).
  _irregularForm(bare) {
    const irr = EN_IRREGULAR[bare];
    if (irr && this._index.has(irr)) {
      return { root: irr, name: "(irregular)", surface: bare, es: "forma irregular" };
    }
    return null;
  }

  // Regular suffix stripping, dict-gated: every candidate stem must be a real
  // dictionary entry, otherwise it is rejected (no over-stemming). One chained
  // level is allowed ("blessings" → -s → "blessing" → -ing → "bless").
  _stripRegular(bare, depth) {
    const self = this;
    const tryStem = (stem, name, surface, es) => {
      if (!stem || stem.length < 2 || !/^[a-z]/.test(stem)) return null;
      if (self._index.has(stem)) return { root: stem, name, surface, es };
      if (depth < 1 && stem.length > 3) {
        const chained = self._stripRegular(stem, depth + 1);
        if (chained) return { root: chained.root, name, surface, es };
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
    // f → -ves ("wolves" → "wolf").
    if (bare.length > 4 && bare.endsWith("ves")) {
      const noVes = bare.slice(0, -3);
      m = tryStem(noVes + "f", "-ves", "ves", PL) ||
          tryStem(noVes + "fe", "-ves", "ves", PL);
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
          tryStem(undoubleEn(noEd), "-ed", "ed", "pasado") ||
          tryStem(noEd.slice(0, -1) + "y", "-ed", "ed", "pasado");
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("ing")) {
      const noIng = bare.slice(0, -3);
      m = tryStem(noIng, "-ing", "ing", "gerundio") ||
          tryStem(noIng + "e", "-ing", "ing", "gerundio") ||
          tryStem(undoubleEn(noIng), "-ing", "ing", "gerundio");
      if (m) return m;
    }
    // -ly adverbs ("quickly" → "quick").
    if (bare.length > 4 && bare.endsWith("ly")) {
      const noLy = bare.slice(0, -2);
      m = tryStem(noLy, "-ly", "ly", "adverbio") ||
          tryStem(noLy + "e", "-ly", "ly", "adverbio");
      if (m) return m;
    }
    // -ness nouns ("darkness" → "dark").
    if (bare.length > 6 && bare.endsWith("ness")) {
      m = tryStem(bare.slice(0, -4), "-ness", "ness", "sustantivo");
      if (m) return m;
    }
    // -less adjectives ("fatherless" → "father").
    if (bare.length > 6 && bare.endsWith("less")) {
      m = tryStem(bare.slice(0, -4), "-less", "less", "adjetivo");
      if (m) return m;
    }
    // -ful adjectives ("faithful" → "faith").
    if (bare.length > 5 && bare.endsWith("ful")) {
      const noFul = bare.slice(0, -3);
      m = tryStem(noFul, "-ful", "ful", "adjetivo") ||
          (noFul.endsWith("i") ? tryStem(noFul.slice(0, -1) + "y", "-ful", "ful", "adjetivo") : null);
      if (m) return m;
    }
    // feminine -ess ("lioness" → "lion").
    if (bare.length > 6 && bare.endsWith("ess")) {
      m = tryStem(bare.slice(0, -3), "-ess", "ess", "femenino");
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
      m = tryStem(noEr, "-er", "er", "comparativo / agente") ||
          tryStem(undoubleEn(noEr), "-er", "er", "comparativo / agente") ||
          tryStem(noEr + "e", "-er", "er", "comparativo / agente");
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("or")) {
      const noOr = bare.slice(0, -2);
      m = tryStem(noOr, "-or", "or", "agente") ||
          tryStem(undoubleEn(noOr), "-or", "or", "agente") ||
          tryStem(noOr + "e", "-or", "or", "agente");
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

  // Full inflection pipeline for one bare (lowercased) word: irregular table,
  // over-/under-/out- prefixes, then regular suffix stripping.
  _inflect(bare) {
    const irr = this._irregularForm(bare);
    if (irr) return irr;
    for (const pre of EN_PREFIX) {
      if (bare.length > pre.length + 3 && bare.startsWith(pre)) {
        const rest = bare.slice(pre.length);
        const r = this._irregularForm(rest) || this._stripRegular(rest, 0);
        if (r) return { root: r.root, name: "(prefijo)", surface: pre, es: "prefijo" };
      }
    }
    return this._stripRegular(bare, 0);
  }

  // The bare (lowercased, no hyphen, no possessive) resolution step.
  // rawSurface keeps the original casing for the proper-name check.
  _resolveBare(bare, rawSurface) {
    const cap = isCapitalizedEn(rawSurface);
    // A capitalized token in the name table is a proper name even when the
    // lowercase form is also a common word ("Mark" → "Marcos", not "marca").
    if (cap) {
      const nmCap = this._nameIndex.get(bare);
      if (nmCap) return [[nmCap], { isName: true, root: bare, form: "nombre propio", suffixes: [] }];
    }
    const key = this._lookupKey(bare);
    if (key) {
      return [this._dictGet(key), { root: key, form: "", isBare: true, suffixes: [] }];
    }
    const st = this._inflect(bare);
    if (st) {
      return [this._dictGet(st.root), {
        root: st.root, form: "",
        suffixes: [{ name: st.name, surface: st.surface, es: st.es }],
      }];
    }
    // Name-table hit on the lowercase form ("yahweh" in running text).
    const nmLo = this._nameIndex.get(bare);
    if (nmLo) return [[nmLo], { isName: true, root: bare, form: "nombre propio", suffixes: [] }];
    // Proper names: a capitalized token that is neither a dictionary word nor
    // a known inflection. Consult the curated name table first
    // ("Moses" → "Moisés"), otherwise keep the surface form so a name never
    // reads as a dead lookup.
    if (isCapitalizedEn(rawSurface)) {
      const disp = String(rawSurface).replace(/['’][sS]$/, "").replace(/['’]$/, "");
      const nk = normalizeEn(disp);
      const esName = this._nameIndex.get(nk);
      return [[esName || disp], { isName: true, root: nk, form: "nombre propio", suffixes: [] }];
    }
    return [null, {}];
  }

  // Dash-joined parts ("man—who" → ["man","who"]): each part is edge-trimmed
  // and resolved with its own casing, so names inside still hit the name table.
  _resolveDashParts(rawParts) {
    const parts = rawParts.map((p) => String(p).replace(EN_TRIM, "")).filter(Boolean);
    if (parts.length < 2) return null;
    const rs = parts.map((p) => this._resolveBare(normalizeEn(p), p));
    if (rs.every((r) => r[0] && r[0].length)) {
      return [[rs.map((r) => r[0][0]).join(" · ")],
        { root: parts.join("—"), form: "compuesto", suffixes: [] }];
    }
    return null;
  }

  // Hyphen compounds: number words ("twenty-five" → "veinticinco",
  // "twenty-fourth" → ordinal 24) or part-by-part resolution.
  _resolveHyphen(bare) {
    const key = this._lookupKey(bare);
    if (key) {
      return [this._dictGet(key), { root: key, form: "", isBare: true, suffixes: [] }];
    }
    const wn = enWordNumber(bare);
    if (wn) {
      const es = enNumberEs(wn.n);
      if (es) {
        return [[es], {
          root: bare, form: wn.ordinal ? "número ordinal" : "número",
          isNumber: true, suffixes: [],
        }];
      }
    }
    const parts = bare.split("-").filter(Boolean);
    if (parts.length >= 2) {
      const rs = parts.map((p) => this._resolveBare(p, p));
      if (rs.every((r) => r[0])) {
        return [[rs.map((r) => r[0][0]).join(" · ")],
          { root: bare, form: "compuesto", suffixes: [] }];
      }
    }
    return null;
  }

  resolve(word, opts = {}) {
    const raw = String(word);
    // Edge punctuation never carries meaning ("sins-" → "sins").
    const w = normalizeEn(raw).replace(EN_TRIM, "");
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
    // Em-dash / en-dash compounds from the source text ("man—who", "heaven—not",
    // "drink,’—let"): resolve part-by-part, original casing kept for names.
    // (References like "20:13–15" are handled above.) Also repairs missing-space
    // artifacts ("suffering.They").
    if (!EN_REFERENCE.test(bare) && /[—–]/.test(bare)) {
      const dc = this._resolveDashParts(raw.split(/[—–]+/));
      if (dc) return dc;
    }
    if (!EN_REFERENCE.test(bare) && /^[a-z]+\.[a-z]+$/.test(bare)) {
      const dc = this._resolveDashParts(raw.split("."));
      if (dc) return dc;
    }
    // Hyphen compounds before anything else.
    if (bare.includes("-")) {
      const h = this._resolveHyphen(bare);
      if (h) return h;
    }
    // Possessive -'s: run the FULL pipeline on the base, so "children's"
    // reaches child and "neighbor's" reaches neighbor.
    if (bare.length > 3 && bare.endsWith("'s")) {
      const [bm, bi] = this._resolveBare(bare.slice(0, -2), raw.slice(0, -2));
      if (bm) {
        return [bm, {
          ...bi,
          suffixes: [...(bi.suffixes || []), { name: "-'s", surface: "'s", es: "posesivo" }],
        }];
      }
    }
    // Plural possessive "s'": run the full pipeline on the base, so
    // "fathers'" reaches father and "Jesus'" reaches Jesús.
    if (bare.length > 3 && bare.endsWith("s'")) {
      const [pm, pi] = this._resolveBare(bare.slice(0, -1), raw.slice(0, -1));
      if (pm) {
        return [pm, {
          ...pi,
          suffixes: [...(pi.suffixes || []), { name: "-s'", surface: "s'", es: "posesivo plural" }],
        }];
      }
    }
    return this._resolveBare(bare, raw);
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
