// Turkish morphological engine (Fase 1): suffix-stripping analyzer for the YTC.
// Ported from skroutz/turkish_stemmer (https://github.com/skroutz/turkish_stemmer,
// MIT) which implements the classic affix-stripping morphological analyzer for
// Turkish ("An affix stripping morphological analyzer for Turkish", 2007).
// States/suffix tables come verbatim from its config/*.yml; unlike that stemmer
// this port also records the chain of suffixes stripped, so the app can explain
// the morphology of each word ("gökleri = gök + -ler plural + -i acusativo").
const TR_VOWELS = "üiıueöaoâîû";
const TR_CONSONANTS = "bcçdfgğhjklmnprsştvyz";
const TR_ROUNDED = "oöuü";
const TR_UNROUNDED = "iıea";
const TR_FOLLOWING_ROUNDED = "aeuü";
const TR_FRONT = "eiöüî";
const TR_BACK = "ıuaoâû";
const TR_AVG_STEMMED = 4;
const TR_ALPHABET = /^[abcçdefgğhıijklmnoöprsştuüvyzâîû]+$/;

function normalizeTr(str) {
  return String(str).normalize("NFC").toLocaleLowerCase("tr-TR");
}

const TR_PROTECTED = new Set([
  "abiye", "adın", "adana", "akılsız", "alaska", "alet", "altı", "ağda", "ağız",
  "alarm", "altınbaşak", "altınyıldız", "anakucağı", "anasayfa", "anime",
  "antifriz", "araba", "ardeşen", "armanı", "aroma", "arma", "arsız", "asa",
  "askı", "astra", "asus", "atkı", "ayakkabı", "aydınlatma", "aynı", "ayı",
  "banka", "başka", "batık", "bayı", "belge", "bellona", "benten", "benzin",
  "beşinci", "bilgi", "bitki", "boyut", "branda", "bütün", "buzlu", "çağrı",
  "çadır", "camsız", "canta", "çanta", "calar", "çalar", "çarşı", "cavalli",
  "ceyiz", "çerçeve", "çıkış", "çini", "cımbiz", "dalga", "damla", "derece",
  "deniz", "denim", "dişli", "düğün", "ege", "elbise", "fendi", "filtre",
  "fıfa", "fiyat", "forma", "fular", "gazete", "gemi", "görüntü", "halı",
  "havuzu", "havuzlu", "igne", "ince", "internet", "iyi", "karyola", "kayısı",
  "kama", "kanepe", "kadın", "katı", "killer", "köşe", "köse", "kötü", "kuma",
  "kumanda", "küpe", "kupa", "koltuk", "kolu", "lamba", "lazım", "litre",
  "mağaza", "magaza", "makara", "makine", "malzeme", "mana", "marka", "masa",
  "maskara", "mine", "mini", "moda", "nike", "nine", "numara", "odun", "oyun",
  "ölçü", "örgü", "öykü", "özen", "parça", "perde", "pompa", "pırlanta",
  "raket", "ranza", "salı", "şamdan", "şapka", "şifre", "sunu", "soyad",
  "tabaka", "takım", "talımat", "tarla", "tasma", "tekken", "törpü", "tozlu",
  "tüplü", "uçurtma", "üfleme", "ürün", "ütü", "uygun", "uzatma", "uzun",
  "vana", "vibe", "yağlı", "yapma", "yardım", "yasa", "yıldız", "zayıflama",
  "zemin", "kurutma", "yazı",
  // Curation for the YTC: common nominals that would otherwise be over-stripped
  // (their final vowel resembles the possessive/acusative suffix).
  "tanrı", "yeni", "gece", "sevgi", "kara", "güneş", "kutsal", "yürek",
]);

const TR_LAST_CONSONANT_EXCEPTIONS = new Set(["ad", "at", "ked", "led"]);
const TR_HARMONY_EXCEPTIONS = new Set([
  "alkoller", "değerın", "saati", "generali", "generale", "projektörlar",
  "saatler", "tabletlar", "tersyüz", "yaninda", "yani",
]);
const TR_SELECTION_EXCEPTIONS = new Set([
  "al", "am", "aparat", "ara", "bilet", "bisiklet", "bulut", "diyet", "ev",
  "es", "fiyat", "fırsat", "general", "git", "gıt", "iç", "ip", "internet",
  "iyi", "kağıt", "kartuş", "katı", "kot", "kötü", "kumanda", "lamba",
  "mağaza", "magaza", "makara", "makine", "marka", "maskara", "ne", "otomat",
  "palet", "perde", "raket", "ranza", "robot", "sepet", "servis", "soyad",
  "su", "tabaka", "tablet", "takım", "talımat", "tanıt", "tarla", "tasma",
  "tenis", "törpü", "uç", "uygun", "var", "yasa", "led", "gaz",
]);

// Suffix labels in Spanish (for the app's morphology explanation).
const TR_NOUN_ES = {
  "-lAr": "plural",
  "-(U)m": "posesivo 1ª sg (mi)",
  "-(U)mUz": "posesivo 1ª pl (nuestro)",
  "-Un": "posesivo 2ª sg / genitivo (tu/de)",
  "-(U)nUz": "posesivo 2ª pl (vuestro)",
  "-(s)U": "posesivo 3ª sg (su)",
  "-lArI": "plural + posesivo (sus)",
  "-(y)U": "acusativo",
  "-nU": "acusativo (con -n-)",
  "-(n)Un": "genitivo (de)",
  "-(y)A": "dativo (a/para)",
  "-nA": "dativo (con -n-)",
  "-DA": "locativo (en)",
  "-nDA": "locativo (con -n-)",
  "-DAn": "ablativo (de/desde)",
  "-nDAn": "ablativo (con -n-)",
  "-(y)lA": "instrumental (con)",
  "-ki": "relativo (-ki)",
  "-(n)cA": "comparativo/cuantitativo",
};
const TR_VERB_ES = {
  "-(y)Um": "1ª sg presente",
  "-sUn": "3ª sg (imperativo)",
  "-(y)Uz": "1ª pl",
  "-sUnUz": "2ª pl (imperativo)",
  "-lAr": "3ª pl",
  "-m": "1ª sg",
  "-n": "2ª sg",
  "-k": "1ª pl",
  "-nUz": "2ª pl",
  "-DUr": "causativo / «es»",
  "-cAsInA": "como (al modo de)",
  "-(y)DU": "pasado",
  "-(y)sA": "condicional (si)",
  "-(y)mUş": "pasado referido",
  "-(y)ken": "mientras",
};
const TR_DERIV_ES = { "-lU": "sufijo relacional (que tiene)" };

// Verbally shared machine: noun "head" suffixes (states from noun_states.yml).
const TR_NOUN_STATES = {
  a: { final: true, t: [["s16", "c"], ["s7", "k"], ["s3", "h"], ["s5", "h"], ["s1", "l"], ["s14", "f"], ["s15", "g"], ["s17", "e"], ["s10", "e"], ["s19", "m"], ["s4", "h"], ["s9", "c"], ["s12", "f"], ["s13", "b"], ["s18", "d"], ["s2", "h"], ["s6", "h"], ["s8", "b"], ["s11", "b"]] },
  b: { final: true, t: [["s3", "h"], ["s5", "h"], ["s1", "l"], ["s4", "h"], ["s2", "h"]] },
  c: { final: false, t: [["s7", "k"], ["s6", "h"]] },
  d: { final: false, t: [["s14", "f"], ["s10", "e"], ["s13", "b"]] },
  e: { final: true, t: [["s7", "k"], ["s3", "h"], ["s5", "h"], ["s1", "l"], ["s4", "h"], ["s18", "d"], ["s2", "h"], ["s6", "h"]] },
  f: { final: false, t: [["s7", "k"], ["s18", "d"], ["s6", "h"]] },
  g: { final: true, t: [["s5", "h"], ["s3", "h"], ["s1", "l"], ["s4", "h"], ["s18", "d"], ["s2", "h"]] },
  h: { final: true, t: [["s1", "l"]] },
  k: { final: true, t: [] },
  l: { final: true, t: [["s18", "d"]] },
  m: { final: true, t: [["s7", "k"], ["s3", "h"], ["s5", "h"], ["s1", "l"], ["s4", "h"], ["s2", "h"], ["s6", "h"]] },
};
const TR_NOUN_SUFFIXES = {
  s1: { regex: "lar|ler", opt: null, harm: true, name: "-lAr" },
  s2: { regex: "m", opt: "ı|i|u|ü", harm: true, name: "-(U)m" },
  s3: { regex: "mız|miz|muz|müz", opt: "ı|i|u|ü", harm: true, name: "-(U)mUz" },
  s4: { regex: "ın|in|un|ün", opt: null, harm: true, name: "-Un" },
  s5: { regex: "nız|niz|nuz|nüz", opt: "ı|i|u|ü", harm: true, name: "-(U)nUz" },
  s6: { regex: "ı|i|u|ü", opt: "s", harm: true, name: "-(s)U" },
  s7: { regex: "ları|leri", opt: null, harm: true, name: "-lArI" },
  s8: { regex: "ı|i|u|ü", opt: "y", harm: true, name: "-(y)U" },
  s9: { regex: "nı|ni|nu|nü", opt: null, harm: true, name: "-nU" },
  s10: { regex: "ın|in|un|ün", opt: "n", harm: true, name: "-(n)Un" },
  s11: { regex: "a|e", opt: "y", harm: true, name: "-(y)A" },
  s12: { regex: "na|ne", opt: null, harm: true, name: "-nA" },
  s13: { regex: "da|de|ta|te", opt: null, harm: true, name: "-DA" },
  s14: { regex: "nta|nte|nda|nde", opt: null, harm: true, name: "-nDA" },
  s15: { regex: "dan|tan|den|ten", opt: null, harm: true, name: "-DAn" },
  s16: { regex: "ndan|ntan|nden|nten", opt: null, harm: true, name: "-nDAn" },
  s17: { regex: "la|le", opt: "y", harm: true, name: "-(y)lA" },
  s18: { regex: "ki", opt: null, harm: false, name: "-ki" },
  s19: { regex: "ca|ce", opt: "n", harm: true, name: "-(n)cA" },
};

// Nominal-verb (person/tense) head from nominal_verb_states.yml.
const TR_VERB_STATES = {
  a: { final: false, t: [["s1", "b"], ["s2", "b"], ["s4", "b"], ["s3", "b"], ["s5", "c"], ["s6", "d"], ["s7", "d"], ["s8", "d"], ["s9", "d"], ["s10", "e"], ["s12", "f"], ["s13", "f"], ["s14", "f"], ["s15", "f"], ["s11", "h"]] },
  b: { final: true, t: [["s14", "f"]] },
  c: { final: true, t: [["s10", "f"], ["s12", "f"], ["s13", "f"], ["s14", "f"]] },
  d: { final: false, t: [["s12", "f"], ["s13", "f"]] },
  e: { final: true, t: [["s1", "g"], ["s2", "g"], ["s3", "g"], ["s4", "g"], ["s5", "g"], ["s14", "f"]] },
  f: { final: true, t: [] },
  g: { final: false, t: [["s14", "f"]] },
  h: { final: false, t: [["s14", "f"], ["s1", "g"], ["s2", "g"], ["s3", "g"], ["s4", "g"], ["s5", "g"]] },
};
const TR_VERB_SUFFIXES = {
  s1: { regex: "ım|im|um|üm", opt: "y", harm: true, name: "-(y)Um" },
  s2: { regex: "sın|sin|sun|sün", opt: null, harm: true, name: "-sUn" },
  s3: { regex: "ız|iz|uz|üz", opt: "y", harm: true, name: "-(y)Uz" },
  s4: { regex: "sınız|siniz|sunuz|sünüz", opt: null, harm: true, name: "-sUnUz" },
  s5: { regex: "lar|ler", opt: null, harm: true, name: "-lAr" },
  s6: { regex: "m", opt: null, harm: true, name: "-m" },
  s7: { regex: "n", opt: null, harm: true, name: "-n" },
  s8: { regex: "k", opt: null, harm: true, name: "-k" },
  s9: { regex: "nız|niz|nuz|nüz", opt: null, harm: true, name: "-nUz" },
  s10: { regex: "tır|tir|tur|tür|dır|dir|dur|dür", opt: null, harm: true, name: "-DUr" },
  s11: { regex: "casına|çasına|cesine|çesine", opt: null, harm: true, name: "-cAsInA" },
  s12: { regex: "dı|di|du|dü|tı|ti|tu|tü", opt: "y", harm: true, name: "-(y)DU" },
  s13: { regex: "sa|se", opt: "y", harm: true, name: "-(y)sA" },
  s14: { regex: "muş|miş|müş|mış", opt: "y", harm: true, name: "-(y)mUş" },
  s15: { regex: "ken", opt: "y", harm: true, name: "-(y)ken" },
};

// Derivational head from derivational_states/suffixes.yml.
const TR_DERIV_STATES = {
  a: { final: false, t: [["s1", "b"]] },
  b: { final: true, t: [] },
};
const TR_DERIV_SUFFIXES = {
  s1: { regex: "lı|li|lu|lü", opt: null, harm: true, name: "-lU" },
};

function trVowels(word) {
  const out = [];
  for (const c of word) if (TR_VOWELS.includes(c)) out.push(c);
  return out;
}

function trSyllables(word) {
  return trVowels(word).length;
}

function trHarmony(a, b) {
  const round =
    (TR_UNROUNDED.includes(a) && TR_UNROUNDED.includes(b)) ||
    (TR_ROUNDED.includes(a) && TR_FOLLOWING_ROUNDED.includes(b));
  const front =
    (TR_FRONT.includes(a) && TR_FRONT.includes(b)) ||
    (TR_BACK.includes(a) && TR_BACK.includes(b));
  return round && front;
}

function trHasHarmony(word) {
  const v = trVowels(word);
  if (v.length < 2) return true;
  return trHarmony(v[v.length - 2], v[v.length - 1]);
}

function trTurkish(word) {
  return TR_ALPHABET.test(word);
}

function trProceed(word) {
  return Boolean(word) && trTurkish(word) &&
    !TR_PROTECTED.has(word) && trSyllables(word) > 1;
}

// Optional buffer letter handling from mark_stem of the reference stemmer.
function trValidOptional(word, letters) {
  const m = word.match(new RegExp("(" + letters + ")$"));
  if (!m) return [true, null];
  const matched = m[1];
  const prev = word[word.length - 2];
  const answer = TR_VOWELS.includes(matched)
    ? Boolean(prev) && TR_CONSONANTS.includes(prev)
    : Boolean(prev) && TR_VOWELS.includes(prev);
  return [answer, matched];
}

function markStem(word, suffix) {
  let stem = !TR_PROTECTED.has(word) &&
    ((suffix.harm && (trHasHarmony(word) || TR_HARMONY_EXCEPTIONS.has(word))) || !suffix.harm);
  let applied = null;
  let newWord = word;
  if (stem) {
    const m = word.match(new RegExp("(" + suffix.regex + ")$"));
    if (m) {
      newWord = word.slice(0, -m[1].length);
      applied = m[1];
      if (suffix.opt) {
        const [answer, matched] = trValidOptional(newWord, suffix.opt);
        if (answer && matched) {
          newWord = newWord.slice(0, -1);
          applied = matched + applied;
        } else if (!answer) {
          newWord = word;
          applied = null;
          stem = false;
        }
      }
    } else {
      stem = false;
      applied = null;
    }
  }
  return { stem, word: newWord, applied };
}

function generatePendings(key, word, states, suffixes, chain) {
  const state = states[key];
  if (!state) return [];
  const pendings = [];
  for (const [suffixKey, toState] of state.t) {
    const suffix = suffixes[suffixKey];
    if (!suffix) continue;
    if (new RegExp("(" + suffix.regex + ")$").test(word)) {
      pendings.push({ suffixKey, toState, fromState: key, word, chain, mark: false });
    }
  }
  return pendings;
}

function uniqByKey(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const k = item.stem;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

// Affix-stripping state machine. Returns every valid {stem, chain} where chain
// lists the stripped suffixes in stripping order (outermost first).
function special_stripper(word, states, suffixes, head) {
  if (!states || !suffixes) return [{ stem: word, chain: [] }];
  const results = [];
  const pendings = generatePendings("a", word, states, suffixes, []);
  while (pendings.length) {
    const transition = pendings.shift();
    const state = states[transition.toState];
    if (!state) continue;
    const suffix = suffixes[transition.suffixKey];
    const answer = markStem(transition.word, suffix);
    if (!answer.stem) continue;
    const chain = transition.chain.concat([{
      key: transition.suffixKey,
      name: suffix.name,
      surface: answer.applied,
      es: (head === "vb" ? TR_VERB_ES : head === "dn" ? TR_DERIV_ES : TR_NOUN_ES)[suffix.name] || suffix.name,
    }]);
    if (state.final) {
      results.push({ stem: answer.word, chain });
      if (state.t && state.t.length) {
        pendings.unshift(...generatePendings(transition.toState, answer.word, states, suffixes, chain));
      }
    } else {
      pendings.unshift(...generatePendings(transition.toState, answer.word, states, suffixes, chain));
    }
  }
  return results.length ? results : [{ stem: word, chain: [] }];
}

const trStripper = (word, states, suffixes, head) => special_stripper(word, states, suffixes, head);

function trLastConsonant(word) {
  if (TR_LAST_CONSONANT_EXCEPTIONS.has(word)) return word;
  const map = { b: "p", c: "ç", d: "t", ğ: "k" };
  const last = word[word.length - 1];
  return map[last] ? word.slice(0, -1) + map[last] : word;
}

function postProcess(list, original) {
  let stems = uniqByKey(list).filter((r) => r.stem !== original)
    .filter((r) => trSyllables(r.stem) > 0);
  if (!stems.length) return [{ stem: original, chain: [] }];
  for (const r of stems) r.stem = trLastConsonant(r.stem);
  for (const r of stems) {
    if (TR_SELECTION_EXCEPTIONS.has(r.stem)) return [r];
  }
  stems.sort((a, b) =>
    (Math.abs(a.stem.length - TR_AVG_STEMMED) - Math.abs(b.stem.length - TR_AVG_STEMMED)) ||
    (a.stem.length - b.stem.length));
  return stems;
}

// Full analyze of a lowercase Turkish word: verb head, noun head, then
// derivational head, each passed over the previous results (mirrors the
// reference stem algorithm's phase order).
function analyzeTr(word, depth = 0) {
  if (!trProceed(word)) return [{ stem: word, chain: [] }];
  let stems = [];
  for (const r of trStripper(word, TR_VERB_STATES, TR_VERB_SUFFIXES, "vb")) stems.push(r);
  stems.push({ stem: word, chain: [] });
  stems = uniqByKey(stems);
  let second = [];
  for (const r of stems) {
    for (const s of trStripper(r.stem, TR_NOUN_STATES, TR_NOUN_SUFFIXES, "nn")) {
      second.push({ stem: s.stem, chain: r.chain.concat(s.chain) });
    }
  }
  second.push({ stem: word, chain: [] });
  stems = uniqByKey(second);
  if (stems.length === 1 && stems[0].stem === word && depth < 1 && /[uüiı]$/.test(word)) {
    const swaps = { ü: "u", ı: "i", i: "ı", u: "ü" };
    const last = word[word.length - 1];
    if (swaps[last]) return analyzeTr(word.slice(0, -1) + swaps[last], depth + 1);
  }
  let third = [];
  for (const r of stems) {
    for (const s of trStripper(r.stem, TR_DERIV_STATES, TR_DERIV_SUFFIXES, "dn")) {
      third.push({ stem: s.stem, chain: r.chain.concat(s.chain) });
    }
  }
  return postProcess(third, word);
}

function trForm(stem, chain) {
  if (!chain.length) return "";
  const parts = chain.slice().reverse().map((c) => "-" + c.surface + " (" + c.es + ")");
  return "«" + stem + "» + " + parts.join(" + ");
}

export class TrEngine {
  constructor(map) {
    this._map = map || {};
    // Index the Turkish dict with Turkish-aware lowercase keys so İ/I/ı match.
    this._index = new Map();
    for (const [k, v] of Object.entries(this._map)) {
      this._index.set(normalizeTr(k), v);
    }
  }

  lookup(word) {
    const w = normalizeTr(word).replace(/’/g, "'");
    let arr = this._index.get(w) || null;
    if (!arr) arr = this._index.get(w.replace(/'/g, "")) || null;
    if (arr && Array.isArray(arr)) return arr.slice();
    return arr;
  }

  resolve(word, _opts = {}) {
    const w = normalizeTr(word).replace(/’/g, "'");
    const bare = w.replace(/'/g, "");
    if (!bare || !trTurkish(bare)) return [null, {}];
    // A known root wins before any stripping (also handles "Tanrı'nın").
    const direct = this.lookup(w) || this.lookup(bare);
    if (direct) return [direct, { root: bare, form: "", isBare: true, suffixes: [] }];
    const analyses = analyzeTr(bare);
    let chosen = analyses[0];
    let meanings = null;
    // Prefer a stem that actually exists in the dict (over-stripping happens).
    for (const a of analyses) {
      const m = this._index.get(a.stem);
      if (m) {
        chosen = a;
        meanings = Array.isArray(m) && m.length ? m.slice() : null;
        break;
      }
    }
    if (!meanings) {
      for (const a of analyses) {
        const m = this._index.get(a.stem.replace(/'/g, ""));
        if (m && Array.isArray(m) && m.length) {
          chosen = a;
          meanings = m.slice();
          break;
        }
      }
    }
    const info = {
      root: chosen.stem,
      form: trForm(chosen.stem, chosen.chain),
      suffixes: chosen.chain.map((c) => ({ name: c.name, surface: c.surface, es: c.es })),
    };
    return [meanings, info];
  }

  segment(text) {
    const out = [];
    for (const tok of String(text).split(/\s+/)) {
      const w = tok.replace(/^[\-.,;:!?…«»"'“”‘’()\[\]{}*\u2013\u2014—]+|[\-.,;:!?…«»"'“”‘’()\[\]{}*\u2013\u2014—]+$/g, "");
      if (!w) continue;
      const [m, info] = this.resolve(w);
      out.push([w, m, info]);
    }
    return out;
  }
}