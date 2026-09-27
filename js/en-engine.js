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
// Spanish conjugation of the resolved verb (conjugarEs, from es-conj.js) lets
// the app show the verb in the matching Spanish tense and person
// ("they went" → fueron).

import { conjugarEs, esInfinitivos } from "./es-conj.js";
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
  "it's": "be", "there's": "be", "here's": "be", "what's": "be",
  "that's": "be", "let's": "let",
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

// ---- English verb tense classification ------------------------------------
// Most irregular forms are genuinely ambiguous in English ("put", "read",
// "said" are both past and past participle). Only forms whose tense is
// unambiguous are listed; anything else in EN_IRREGULAR gets
// "past-or-participle".
const EN_PAST_ONLY = new Set(
  ("was wast wert were did went came saw ate drank drove fell forgave gave knew ran rode rose sang sank spoke stole swore threw took tore woke wore wrote began drew bade bore blew broke chose clave clove forbade forgat froze gainsaid grew hamstrung mistook overcame overdrew overthrew overtook rang reran shook shrank slew smote spake sprang stank strode strove swam trod unfroze unhid unwove arose awoke durst").split(" ")
);
const EN_PPLE_ONLY = new Set(
  ("gone been done seen taken given known gotten eaten written spoken broken chosen driven fallen forgotten forgiven frozen grown hidden risen arisen beaten begun bitten blown born borne drawn drunk foreseen forsaken mown sawn sewn shaken shaven shorn shown slain smitten sown stridden stricken striven swollen swum thrown trodden woken worn woven withdrawn overdrawn overridden overthrown overtaken undergone undertaken undone unfrozen unhidden unwoven chidden cloven cleft laden lain mistaken overdone proven ridden rung sung torn bidden befallen begotten").split(" ")
);
const EN_PRESENT_ONLY = new Set("am art is are".split(" "));
const EN_PRESENT3SG = new Set("has hath does doth says saith goes".split(" "));
// Modals / auxiliaries: they are verbs, but tense labels don't apply to them.
const EN_MODAL = new Set("shall will would can could should may might must".split(" "));

export function enIrregularTense(form) {
  if (EN_PAST_ONLY.has(form)) return "past";
  if (EN_PPLE_ONLY.has(form)) return "past-participle";
  if (EN_PRESENT_ONLY.has(form)) return "present";
  if (EN_PRESENT3SG.has(form)) return "present-3sg";
  return "past-or-participle";
}

// A dictionary gloss reads as a verb when one of its words is a Spanish
// infinitive ("caminar", "ir", "dar"). Accents are stripped first ("oír").
function enLooksLikeVerb(glosses) {
  return !!enFirstVerbGloss(glosses);
}

// First gloss that reads as a Spanish verb ("andar" over "paseo"), so verb
// explanations lead with the verbal meaning instead of a noun homograph.
function enFirstVerbGloss(glosses) {
  for (const g of (glosses || [])) {
    const hit = String(g).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .split(/[\s/]+/).some((t) => t.length > 1 && /(ar|er|ir)(se)?$/.test(t));
    if (hit) return g;
  }
  return null;
}

// Verb roots whose dictionary entry is missing or noun-only ("lie" only has
// "mentira", "sow" only "cerda"). Prepended to the dictionary entry at lookup
// so verb forms resolve to a verb and the verb detector sees them.
const EN_DICT_PATCH = {
  "lie": ["yacer", "echarse", "recostarse", "mentir"],
  "behold": ["contemplar", "mirar"],
  "sow": ["sembrar"],
  "ring": ["sonar", "tañer"],
  "wind": ["enrollar", "girar"],
  "crow": ["cacarear", "cantar (el gallo)"],
  "pen": ["encerrar"],
  "bleed": ["sangrar"],
  "mistake": ["equivocarse"],
  "slide": ["deslizarse", "resbalar"],
  "sting": ["picar"],
  "stride": ["andar a zancadas"],
  "string": ["ensartar"],
  "swell": ["hincharse"],
  "hamstring": ["desjarretar"],
  "backslide": ["apostatar", "recaer"],
  "befall": ["acontecer", "sobrevenir"],
  "beset": ["asediar", "rodear"],
  "chide": ["reprender"],
  "gainsay": ["contradecir"],
  "gird": ["ceñir"],
  "hew": ["labrar", "talar"],
  "inlay": ["incrustar"],
  "lade": ["cargar"],
  "mislead": ["desviar", "engañar"],
  "mow": ["segar"],
  "overdo": ["excederse"],
  "overdraw": ["sobregirar"],
  "overhear": ["oír por casualidad"],
  "override": ["anular", "invalidar"],
  "oversleep": ["quedarse dormido"],
  "rive": ["hender", "rajar"],
  "slit": ["rajar", "cortar"],
  "sneak": ["escabullirse"],
  "unbend": ["enderezar"],
  "unbind": ["desatar"],
  "unfreeze": ["descongelar"],
  "unhide": ["descubrir"],
  "unlearn": ["olvidar lo aprendido"],
  "unsay": ["retractarse"],
  "unspin": ["destorcer"],
  "unstick": ["despegar"],
  "unstring": ["desencordar"],
  "unweave": ["destejer"],
  "unwind": ["desenrollar"],
  "waylay": ["acechar", "tender una emboscada"],
  // Frequent -ing nouns the dictionary lacks: keeps the noun reading so the
  // gerund rule doesn't claim them ("weeping" = llanto, not "weep" gerund).
  "weeping": ["llanto", "lloro"], "mourning": ["luto", "duelo"],
  "threshing": ["trilla"], "signify": ["significar", "indicar", "dar a entender"],
};

// Words where the dictionary reading dominates in Bible text, so it keeps
// winning over the verb/inflection ("ground" = tierra, "offering" = ofrenda,
// "evening" = tarde). Without these, the verb-first heuristics below would
// misread very common verses.
const EN_DICT_WINS = new Set([
  "ground", "wound", "lay", "evening", "anything", "notwithstanding",
  "unwitting", "shaving", "wedding", "saying", "according", "offering",
  "concerning", "living", "coming", "understanding", "meeting", "clothing",
  "beginning", "teaching", "blessing", "dwelling", "hearing", "weeping",
  "mourning", "following", "threshing", "covering", "willing",
]);

// Tense-bearing contractions: "wasn't" is the past of "be", "don't" the
// present of "do".
const EN_CONTRACT_TENSE = {
  "isn't": "present", "aren't": "present", "wasn't": "past", "weren't": "past",
  "haven't": "present", "hasn't": "present", "hadn't": "past",
  "don't": "present", "doesn't": "present", "didn't": "past",
  "it's": "present", "there's": "present", "here's": "present", "what's": "present",
  "that's": "present", "let's": "present",
};
const EN_CONTRACT_SUF_TENSE = { "'m": "present", "'re": "present", "'ve": "present" };

// ---- Phrasal verbs & multi-word biblical concepts --------------------------
// "give up" is not "give" + "up", and "kingdom of heaven" is not three
// separate words. Keys are lowercase; segment() matches them greedily and
// enPhrasalMatch() matches them from a tapped verb + following words.
export const EN_PHRASES = {
  // verbos frasales (verb in infinitive + particle)
  "bear witness": { es: ["dar testimonio"], kind: "verbo frasal" },
  "bow down": { es: ["postrarse", "inclinarse"], kind: "verbo frasal" },
  "break down": { es: ["derribar"], kind: "verbo frasal" },
  "bring forth": { es: ["producir", "dar a luz"], kind: "verbo frasal" },
  "bring up": { es: ["criar"], kind: "verbo frasal" },
  "cast down": { es: ["derribar", "abatir"], kind: "verbo frasal" },
  "cast out": { es: ["expulsar", "echar fuera"], kind: "verbo frasal" },
  "come forth": { es: ["salir", "aparecer"], kind: "verbo frasal" },
  "come upon": { es: ["venir sobre", "sobrevenir"], kind: "verbo frasal" },
  "cry out": { es: ["clamar"], kind: "verbo frasal" },
  "cut off": { es: ["cortar", "separar", "exterminar"], kind: "verbo frasal" },
  "fall down": { es: ["caer", "postrarse"], kind: "verbo frasal" },
  "give up": { es: ["entregar", "renunciar"], kind: "verbo frasal" },
  "go forth": { es: ["salir"], kind: "verbo frasal" },
  "go up": { es: ["subir"], kind: "verbo frasal" },
  "hold fast": { es: ["retener", "aferrarse"], kind: "verbo frasal" },
  "lay down": { es: ["poner", "dar (la vida)"], kind: "verbo frasal" },
  "lay hands on": { es: ["imponer las manos"], kind: "verbo frasal" },
  "lead forth": { es: ["sacar", "guiar"], kind: "verbo frasal" },
  "lift up": { es: ["levantar", "alzar"], kind: "verbo frasal" },
  "look upon": { es: ["mirar"], kind: "verbo frasal" },
  "make known": { es: ["dar a conocer"], kind: "verbo frasal" },
  "pass away": { es: ["pasar", "desaparecer"], kind: "verbo frasal" },
  "pass over": { es: ["pasar por alto"], kind: "verbo frasal" },
  "pour out": { es: ["derramar"], kind: "verbo frasal" },
  "put away": { es: ["repudiar", "desechar"], kind: "verbo frasal" },
  "put forth": { es: ["extender"], kind: "verbo frasal" },
  "put off": { es: ["quitarse", "despojarse"], kind: "verbo frasal" },
  "put on": { es: ["vestirse", "ponerse"], kind: "verbo frasal" },
  "raise up": { es: ["levantar", "resucitar"], kind: "verbo frasal" },
  "rise up": { es: ["levantarse"], kind: "verbo frasal" },
  "run away": { es: ["huir"], kind: "verbo frasal" },
  "send forth": { es: ["enviar"], kind: "verbo frasal" },
  "set apart": { es: ["apartar", "consagrar"], kind: "verbo frasal" },
  "set free": { es: ["libertar", "poner en libertad"], kind: "verbo frasal" },
  "sit down": { es: ["sentarse"], kind: "verbo frasal" },
  "stand up": { es: ["ponerse de pie"], kind: "verbo frasal" },
  "stretch forth": { es: ["extender"], kind: "verbo frasal" },
  "stretch out": { es: ["extender"], kind: "verbo frasal" },
  "take away": { es: ["quitar"], kind: "verbo frasal" },
  "take up": { es: ["tomar", "recoger"], kind: "verbo frasal" },
  "throw down": { es: ["derribar"], kind: "verbo frasal" },
  "turn away": { es: ["apartarse"], kind: "verbo frasal" },
  "turn back": { es: ["volverse atrás"], kind: "verbo frasal" },
  "wash away": { es: ["lavar", "limpiar"], kind: "verbo frasal" },
  "wipe away": { es: ["enjugar"], kind: "verbo frasal" },
  // locuciones
  "kingdom of heaven": { es: ["reino de los cielos"], kind: "locución" },
  "kingdom of god": { es: ["reino de Dios"], kind: "locución" },
  "son of man": { es: ["hijo del hombre"], kind: "locución" },
  "son of god": { es: ["Hijo de Dios"], kind: "locución" },
  "son of david": { es: ["hijo de David"], kind: "locución" },
  "holy spirit": { es: ["Espíritu Santo"], kind: "locución" },
  "most high": { es: ["Altísimo"], kind: "locución" },
  "good news": { es: ["buenas nuevas", "evangelio"], kind: "locución" },
  "eternal life": { es: ["vida eterna"], kind: "locución" },
  "new covenant": { es: ["nuevo pacto"], kind: "locución" },
  "day of judgment": { es: ["día del juicio"], kind: "locución" },
  "last days": { es: ["últimos días"], kind: "locución" },
  "house of god": { es: ["casa de Dios"], kind: "locución" },
  "word of god": { es: ["palabra de Dios"], kind: "locución" },
  "fear of the lord": { es: ["temor del Señor"], kind: "locución" },
  "promised land": { es: ["tierra prometida"], kind: "locución" },
  "ten commandments": { es: ["diez mandamientos"], kind: "locución" },
  "golden calf": { es: ["becerro de oro"], kind: "locución" },
  "burning bush": { es: ["zarza ardiente"], kind: "locución" },
  "tree of life": { es: ["árbol de la vida"], kind: "locución" },
  "body of christ": { es: ["cuerpo de Cristo"], kind: "locución" },
  "blood of christ": { es: ["sangre de Cristo"], kind: "locución" },
  "lamb of god": { es: ["Cordero de Dios"], kind: "locución" },
  "bread of life": { es: ["pan de vida"], kind: "locución" },
  "light of the world": { es: ["luz del mundo"], kind: "locución" },
  "salt of the earth": { es: ["sal de la tierra"], kind: "locución" },
  "narrow gate": { es: ["puerta estrecha"], kind: "locución" },
  "outer darkness": { es: ["tinieblas de afuera"], kind: "locución" },
  "lake of fire": { es: ["lago de fuego"], kind: "locución" },
  "new jerusalem": { es: ["nueva Jerusalén"], kind: "locución" },
  "holy city": { es: ["ciudad santa"], kind: "locución" },
  "lord of hosts": { es: ["Señor de los ejércitos"], kind: "locución" },
  "king of kings": { es: ["Rey de reyes"], kind: "locución" },
  "lord of lords": { es: ["Señor de señores"], kind: "locución" },
  "alpha and omega": { es: ["Alfa y Omega"], kind: "locución" },
};

// A tapped verb plus the words after it: "gave" + ["up", ...] → "give up".
// Tries the infinitive first, then the surface form ("lay" + "down").
export function enPhrasalMatch(infinitive, surface, following) {
  const cands = [];
  const inf = normalizeEn(infinitive || "");
  const sur = normalizeEn(surface || "");
  if (inf) cands.push(inf);
  if (sur && sur !== inf) cands.push(sur);
  const parts = (following || [])
    .map((t) => normalizeEn(t).replace(/[^a-z']/g, ""))
    .filter(Boolean);
  for (const vb of cands) {
    for (let n = Math.min(2, parts.length); n >= 1; n--) {
      const key = [vb, ...parts.slice(0, n)].join(" ");
      const p = EN_PHRASES[key];
      if (p && p.kind === "verbo frasal") return { phrase: key, es: p.es.slice() };
    }
  }
  return null;
}

const EN_TENSE_LABEL = {
  "present": "presente",
  "present-3sg": "presente, 3ª persona",
  "past": "pasado",
  "past-participle": "participio",
  "past-or-participle": "pasado o participio",
  "gerund": "gerundio",
  "base": "forma base",
};
const EN_TENSE_TIP = {
  "past": "El pasado regular añade «-ed»: «walk» → «walked».",
  "past-or-participle": "El pasado regular añade «-ed»: «walk» → «walked»; con «have» es participio («has walked» = ha caminado).",
  "past-participle": "El participio se usa con «have / has / had» («has eaten» = ha comido) o en pasiva.",
  "present-3sg": "En presente, «he / she / it» añade «-s»: «he walks» = él camina.",
  "gerund": "El gerundio («-ing») equivale a «-ando / -iendo»: «walking» = caminando.",
  "present": "«be» es irregular: I am, he is, we are (y «was / were» en pasado).",
  "base": "Es la forma del diccionario: se usa con «to» («to go» = ir) y después de auxiliares («will go» = irá).",
};

// English tense → conjugation tense for conjugarEs.
const EN_TIEMPO_CONJ = {
  present: "presente",
  "present-3sg": "presente",
  past: "preterito",
  "past-participle": "participio",
  "past-or-participle": "preterito",
  gerund: "gerundio",
  base: "infinitivo",
};

const ES_PERSONA = {
  "1s": "yo", "2s": "tú", "3s": "él/ella",
  "1p": "nosotros", "2p": "vosotros", "3p": "ellos",
};

const EN_MODAL_ES = {
  shall: "indica futuro u obligación",
  will: "indica futuro",
  would: "indica condición o hipótesis",
  can: "indica capacidad o posibilidad",
  could: "indica capacidad en el pasado o posibilidad",
  should: "indica deber o consejo",
  may: "indica permiso o posibilidad",
  might: "indica posibilidad",
  must: "indica obligación o necesidad",
};

// Detect the grammatical subject of an English verb from the tokens before it.
// Returns "1s" | "2s" | "3s" | "1p" | "2p" | "3p". A proper name or any other
// noun phrase falls back to 3rd person singular (Bible narrative default).
const EN_SUBJ_SKIP = new Set("and but or nor for yet so then now also even just".split(" "));
export function enDetectSubject(preceding) {
  const toks = (preceding || []).slice(-3);
  for (let i = toks.length - 1; i >= 0; i--) {
    const w = String(toks[i]).toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
    if (!w || EN_SUBJ_SKIP.has(w)) continue;
    if (w === "i") return "1s";
    if (w === "thou" || w === "thee" || w === "thy" || w === "thine") return "2s";
    if (w === "you") return "2s";
    if (w === "ye") return "3p";
    if (w === "he" || w === "she" || w === "it") return "3s";
    if (w === "we") return "1p";
    if (w === "they") return "3p";
    return "3s";
  }
  return "3s";
}

// True when the verb is likely a participle: preceded by has/have/had/hath
// ("has gone", "had walked").
export function enParticipleHint(preceding) {
  const toks = (preceding || []).slice(-2);
  for (let i = toks.length - 1; i >= 0; i--) {
    const w = String(toks[i]).toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
    if (!w) continue;
    return w === "has" || w === "have" || w === "had" || w === "hath";
  }
  return false;
}

// Conjugate the Spanish gloss(es) of an English verb form into the matching
// Spanish tense and person: "they went" → "fueron", "he walks" → "camina".
// opts: { persona: "1s"|"2s"|"3s"|"1p"|"2p"|"3p", participle: bool }.
// Returns "" when there is nothing to conjugate (modals, no verb gloss).
export function enConjugarGlosa(info, glosses, opts = {}) {
  if (!info || !info.infinitive) return "";
  if (EN_MODAL.has(info.infinitive)) return "";
  const infs = esInfinitivos(glosses);
  if (!infs.length) return "";
  const t = info.enTense;
  const persona = opts.persona || "3s";
  const both = (tiempo, p) => {
    const seen = new Set();
    const out = [];
    for (const i of infs) {
      const c = conjugarEs(i, tiempo, p);
      if (c && !seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out.join(" o ");
  };
  if (t === "past-participle" || (t === "past-or-participle" && opts.participle)) {
    return both("participio");
  }
  if (t === "past-or-participle") {
    return both("preterito", persona) + " / " + both("participio");
  }
  if (t === "gerund") return both("gerundio");
  if (t === "present") return both("presente", persona);
  if (t === "present-3sg") return both("presente", "3s");
  if (t === "past") return both("preterito", persona);
  return infs.join(" o ");
}

// Spanish grammar explanation for an English verb form. Pure (no DOM).
// Now conjugates the Spanish gloss into the matching tense and person:
//   "Es el verbo «go» (ir). Aquí está en pasado (ellos): «fueron»."
export function enVerbGloss(info, firstMean, allGlosses, opts = {}) {
  if (!info || !info.infinitive) return "";
  const inf = info.infinitive;
  if (EN_MODAL.has(inf)) {
    return `Es un verbo modal («${inf}»): ${EN_MODAL_ES[inf] || "expresa modo verbal"}.`;
  }
  // Lead with the verb-shaped gloss ("andar", not the noun "paseo").
  // Prefer the infinitive list ("ser o estar") over a single contextual gloss.
  const infs = esInfinitivos(allGlosses);
  const verbMean = enFirstVerbGloss(allGlosses) || firstMean;
  const leadMean = infs.join(" o ") || verbMean;
  let s = "Es el verbo «" + inf + "»" + (leadMean ? " (" + leadMean + ")" : "") + ".";
  const t = info.enTense;
  const conj = enConjugarGlosa(info, allGlosses, opts);
  if (conj) {
    let det = "Aquí está en " + (EN_TENSE_LABEL[t] || t);
    if (t === "present" || t === "past") det += " (" + (ES_PERSONA[opts.persona] || ES_PERSONA["3s"]) + ")";
    else if (t === "present-3sg") det += " (él/ella)";
    s += " " + det + ": «" + conj + "».";
  } else if (t === "past") s += " Aquí está en pasado.";
  else if (t === "past-participle") s += " Aquí está en participio.";
  else if (t === "past-or-participle") s += " Aquí está en pasado o participio.";
  else if (t === "present-3sg") s += " Aquí está en presente, 3ª persona (he / she / it).";
  else if (t === "gerund") s += " Aquí está en gerundio.";
  else if (t === "present") s += " Aquí está en presente.";
  // Irregular forms get an irregular note instead of the regular "-ed"/"-s" tip.
  const isIrregular = (info.suffixes || []).some((x) => x.name === "(irregular)");
  const tip = (isIrregular && (t === "past" || t === "past-participle" || t === "past-or-participle" || t === "present-3sg"))
    ? "Es un verbo irregular: su forma no sigue la regla general."
    : EN_TENSE_TIP[t];
  if (tip) s += " " + tip;
  return s;
}

// Short inline label, e.g. «fueron» · pasado de «go».
export function enVerbShort(info, glosses, opts = {}) {
  if (!info || !info.infinitive) return "";
  if (EN_MODAL.has(info.infinitive)) return "verbo modal «" + info.infinitive + "»";
  const label = EN_TENSE_LABEL[info.enTense];
  const base = label ? label + " de «" + info.infinitive + "»" : "verbo «" + info.infinitive + "»";
  const conj = enConjugarGlosa(info, glosses, opts);
  return conj ? "«" + conj + "» · " + base : base;
}

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
    const base = arr && Array.isArray(arr) && arr.length ? arr.slice() : [];
    const patch = EN_DICT_PATCH[key];
    if (patch && patch.length) return patch.concat(base);
    return base.length ? base : null;
  }

  // Dictionary membership, patch-aware (some verb roots only live in the patch).
  _hasWord(key) {
    return this._index.has(key) || Object.prototype.hasOwnProperty.call(EN_DICT_PATCH, key);
  }

  // Verb metadata for an English root: { infinitive, enTense?, enVerb: true },
  // or null when the root isn't a verb. surfaceForm is the inflected form when
  // known (irregular table); forceTense overrides it (contractions and suffix
  // stripping pass their own tense). forceTense === null means a derivational
  // suffix ("teacher" → "teach"): not a verb form, no metadata.
  _enVerbInfo(root, surfaceForm, forceTense) {
    if (!root || forceTense === null) return null;
    const g = this._dictGet(root);
    if (!enLooksLikeVerb(g)) return null;
    const out = { infinitive: root, enVerb: true };
    if (EN_MODAL.has(root)) return out;
    out.enTense = forceTense || (surfaceForm ? enIrregularTense(surfaceForm) : "base");
    return out;
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
      if (this._hasWord(b)) return b;
    }
    return this._hasWord(w) ? w : null;
  }

  // Single source of truth: lookup() runs the same pipeline as resolve().
  lookup(word) {
    const [m] = this.resolve(word);
    return m;
  }

  // Irregular table, dict-gated (a lemma missing from the dictionary is skipped).
  _irregularForm(bare) {
    const irr = EN_IRREGULAR[bare];
    if (irr && this._hasWord(irr)) {
      return { root: irr, name: "(irregular)", surface: bare, es: "forma irregular", tense: enIrregularTense(bare) };
    }
    return null;
  }

  // Regular suffix stripping, dict-gated: every candidate stem must be a real
  // dictionary entry, otherwise it is rejected (no over-stemming). One chained
  // level is allowed ("blessings" → -s → "blessing" → -ing → "bless").
  _stripRegular(bare, depth) {
    const self = this;
    const tryStem = (stem, name, surface, es, tense) => {
      if (!stem || stem.length < 2 || !/^[a-z]/.test(stem)) return null;
      if (self._hasWord(stem)) return { root: stem, name, surface, es, tense: tense || null };
      if (depth < 1 && stem.length > 3) {
        const chained = self._stripRegular(stem, depth + 1);
        if (chained) return { root: chained.root, name, surface, es, tense: chained.tense || null };
      }
      return null;
    };
    // -s / -es / -ies: 3rd-person singular when the stem is a verb ("walks"),
    // plural when it is a noun ("kings"). One chained level kept for words
    // like "blessings" (old "plural / 3ª persona" label, no tense).
    const tryStemVerbNoun = (stem, name, surface) => {
      if (stem && stem.length >= 2 && /^[a-z]/.test(stem) && self._hasWord(stem)) {
        const verb = enLooksLikeVerb(self._dictGet(stem));
        return {
          root: stem, name, surface,
          es: verb ? "3ª persona (presente)" : "plural",
          tense: verb ? "present-3sg" : null,
        };
      }
      if (depth < 1 && stem && stem.length > 3) {
        const chained = self._stripRegular(stem, depth + 1);
        if (chained) return { root: chained.root, name, surface, es: "plural / 3ª persona", tense: null };
      }
      return null;
    };
    let m;
    if (bare.length > 4 && bare.endsWith("ies")) {
      m = tryStemVerbNoun(bare.slice(0, -3) + "y", "-ies", "ies");
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("es")) {
      m = tryStemVerbNoun(bare.slice(0, -2), "-es", "es") ||
          tryStemVerbNoun(bare.slice(0, -1), "-es", "es");
      if (m) return m;
    }
    if (bare.length > 3 && bare.endsWith("s") && !bare.endsWith("ss")) {
      m = tryStemVerbNoun(bare.slice(0, -1), "-s", "s");
      if (m) return m;
    }
    // f → -ves ("wolves" → "wolf"): noun plurals only, no verb tense.
    if (bare.length > 4 && bare.endsWith("ves")) {
      const noVes = bare.slice(0, -3);
      m = tryStem(noVes + "f", "-ves", "ves", "plural", null) ||
          tryStem(noVes + "fe", "-ves", "ves", "plural", null);
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("ied")) {
      m = tryStem(bare.slice(0, -3) + "y", "-ied", "ied", "pasado / participio", "past-or-participle");
      if (m) return m;
    }
    if (bare.length > 3 && bare.endsWith("ed")) {
      const noEd = bare.slice(0, -2);
      m = tryStem(noEd, "-ed", "ed", "pasado / participio", "past-or-participle") ||
          tryStem(bare.slice(0, -1), "-ed", "ed", "pasado / participio", "past-or-participle") ||
          tryStem(undoubleEn(noEd), "-ed", "ed", "pasado / participio", "past-or-participle") ||
          tryStem(noEd.slice(0, -1) + "y", "-ed", "ed", "pasado / participio", "past-or-participle");
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("ing")) {
      const noIng = bare.slice(0, -3);
      m = tryStem(noIng, "-ing", "ing", "gerundio", "gerund") ||
          tryStem(noIng + "e", "-ing", "ing", "gerundio", "gerund") ||
          tryStem(undoubleEn(noIng), "-ing", "ing", "gerundio", "gerund");
      if (m) return m;
    }
    // -ly adverbs ("quickly" → "quick").
    if (bare.length > 4 && bare.endsWith("ly")) {
      const noLy = bare.slice(0, -2);
      m = tryStem(noLy, "-ly", "ly", "adverbio", null) ||
          tryStem(noLy + "e", "-ly", "ly", "adverbio", null);
      if (m) return m;
    }
    // -ness nouns ("darkness" → "dark").
    if (bare.length > 6 && bare.endsWith("ness")) {
      m = tryStem(bare.slice(0, -4), "-ness", "ness", "sustantivo", null);
      if (m) return m;
    }
    // -less adjectives ("fatherless" → "father").
    if (bare.length > 6 && bare.endsWith("less")) {
      m = tryStem(bare.slice(0, -4), "-less", "less", "adjetivo", null);
      if (m) return m;
    }
    // -ful adjectives ("faithful" → "faith").
    if (bare.length > 5 && bare.endsWith("ful")) {
      const noFul = bare.slice(0, -3);
      m = tryStem(noFul, "-ful", "ful", "adjetivo", null) ||
          (noFul.endsWith("i") ? tryStem(noFul.slice(0, -1) + "y", "-ful", "ful", "adjetivo", null) : null);
      if (m) return m;
    }
    // feminine -ess ("lioness" → "lion").
    if (bare.length > 6 && bare.endsWith("ess")) {
      m = tryStem(bare.slice(0, -3), "-ess", "ess", "femenino", null);
      if (m) return m;
    }
    if (bare.length > 5 && bare.endsWith("ier")) {
      m = tryStem(bare.slice(0, -3) + "y", "-er", "ier", "comparativo", null);
      if (m) return m;
    }
    // Archaic KJV 3rd-person singular («believeth» → «believe»).
    if (bare.length > 5 && bare.endsWith("eth")) {
      const noEth = bare.slice(0, -3);
      m = tryStem(noEth, "-eth", "eth", "3ª persona (arcaico)", "present-3sg") ||
          tryStem(noEth + "e", "-eth", "eth", "3ª persona (arcaico)", "present-3sg") ||
          tryStem(bare.slice(0, -4), "-eth", "eth", "3ª persona (arcaico)", "present-3sg");
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("er")) {
      const noEr = bare.slice(0, -2);
      m = tryStem(noEr, "-er", "er", "comparativo / agente", null) ||
          tryStem(undoubleEn(noEr), "-er", "er", "comparativo / agente", null) ||
          tryStem(noEr + "e", "-er", "er", "comparativo / agente", null);
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("or")) {
      const noOr = bare.slice(0, -2);
      m = tryStem(noOr, "-or", "or", "agente", null) ||
          tryStem(undoubleEn(noOr), "-or", "or", "agente", null) ||
          tryStem(noOr + "e", "-or", "or", "agente", null);
      if (m) return m;
    }
    if (bare.length > 5 && bare.endsWith("iest")) {
      m = tryStem(bare.slice(0, -4) + "y", "-est", "iest", "superlativo", null);
      if (m) return m;
    }
    if (bare.length > 4 && bare.endsWith("est")) {
      const noEst = bare.slice(0, -3);
      m = tryStem(noEst, "-est", "est", "superlativo", null) ||
          tryStem(undoubleEn(noEst), "-est", "est", "superlativo", null);
      if (m) return m;
    }
    return null;
  }

  // Full inflection pipeline for one bare (lowercased) word: irregular table,
  // over-/under-/out- prefixes, then regular suffix stripping.
  _inflect(bare) {
    const irr = this._irregularForm(bare);
    if (irr) return irr;
    return this._inflectAffixes(bare);
  }

  // Prefixes + regular suffix stripping (no irregular table).
  _inflectAffixes(bare) {
    for (const pre of EN_PREFIX) {
      if (bare.length > pre.length + 3 && bare.startsWith(pre)) {
        const rest = bare.slice(pre.length);
        const r = this._irregularForm(rest) || this._stripRegular(rest, 0);
        if (r) return { root: r.root, name: "(prefijo)", surface: pre, es: "prefijo", tense: r.tense || null };
      }
    }
    return this._stripRegular(bare, 0);
  }

  // Candidate phrase keys for the first word of a window: the raw word, its
  // irregular root ("laid" → "lay") and its stripped root ("walking" → "walk"),
  // so "laid hands on" and "took away" match the table entries.
  _phraseFirstKeys(w) {
    const keys = [w];
    const irr = this._irregularForm(w);
    if (irr && irr.root !== w) keys.push(irr.root);
    const st = this._stripRegular(w, 0);
    if (st && st.root !== w && !keys.includes(st.root)) keys.push(st.root);
    return keys;
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
    // Tense-bearing contractions ("wasn't" → past of be, "i'm" → present).
    const ct = EN_CONTRACT_TENSE[bare];
    let ckey = null, ctense = null;
    if (ct) {
      ckey = this._lookupKey(bare); ctense = ct;
    } else {
      for (const suf of Object.keys(EN_CONTRACT_SUF_TENSE)) {
        if (bare.length > suf.length && bare.endsWith(suf)) {
          ckey = this._lookupKey(bare); ctense = EN_CONTRACT_SUF_TENSE[suf]; break;
        }
      }
    }
    if (ckey) {
      const cinfo = { root: ckey, form: "", suffixes: [] };
      return [this._dictGet(ckey), Object.assign(cinfo, this._enVerbInfo(ckey, null, ctense))];
    }
    const key = this._lookupKey(bare);
    const irr = this._irregularForm(bare);
    // An irregular verb form that is ALSO a dictionary word ("saw", "thought",
    // "found", "left", "felt"): the verb reading wins, because in Bible text
    // it almost always is the verb. Exceptions: the dictionary reading
    // dominates (EN_DICT_WINS: "ground" = tierra), or the irregular root has
    // no verb meaning (plurals like "children", demonstratives).
    if (key && irr && !EN_DICT_WINS.has(bare)) {
      const vinfo = this._enVerbInfo(irr.root, bare);
      if (vinfo) {
        const iinfo = {
          root: irr.root, form: "",
          suffixes: [{ name: "(irregular)", surface: bare, es: "forma irregular" }],
        };
        return [this._dictGet(irr.root), Object.assign(iinfo, vinfo)];
      }
    }
    if (key) {
      const info = { root: key, form: "", isBare: true, suffixes: [] };
      // EN_DICT_WINS: the dictionary reading dominates, no verb metadata.
      if (!EN_DICT_WINS.has(bare)) {
        // A gerund whose dictionary entry is noun-only or missing ("walking" →
        // "excursionismo", "gnashing" → "crujir"): the verb reading wins in
        // Bible text, because -ing forms there are gerunds far more often
        // than lexicalized nouns.
        if (bare.length > 4 && bare.endsWith("ing")) {
          const ing = this._stripRegular(bare, 0);
          if (ing && ing.tense === "gerund" && ing.root !== bare) {
            const gv = this._enVerbInfo(ing.root, null, ing.tense);
            if (gv) {
              const ginfo = {
                root: ing.root, form: "",
                suffixes: [{ name: ing.name, surface: ing.surface, es: ing.es }],
              };
              return [this._dictGet(ing.root), Object.assign(ginfo, gv)];
            }
          }
        }
        Object.assign(info, this._enVerbInfo(key, null));
      }
      return [this._dictGet(key), info];
    }
    if (irr) {
      const iinfo = {
        root: irr.root, form: "",
        suffixes: [{ name: "(irregular)", surface: bare, es: "forma irregular" }],
      };
      return [this._dictGet(irr.root), Object.assign(iinfo, this._enVerbInfo(irr.root, bare))];
    }
    const st = this._inflectAffixes(bare);
    if (st) {
      const sinfo = {
        root: st.root, form: "",
        suffixes: [{ name: st.name, surface: st.surface, es: st.es }],
      };
      return [this._dictGet(st.root), Object.assign(sinfo, this._enVerbInfo(st.root, null, st.tense))];
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
    // Full contractions before the possessive -'s rule: "it's" is "it is",
    // not the possessive of "it".
    if (EN_CONTRACT[bare]) {
      const cRoot = EN_CONTRACT[bare];
      const cinfo = { root: cRoot, form: "", suffixes: [] };
      return [this._dictGet(cRoot),
        Object.assign(cinfo, this._enVerbInfo(cRoot, null, EN_CONTRACT_TENSE[bare] || null))];
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

  // Phrasal verbs and multi-word concepts are matched greedily (3 words,
  // then 2) before falling back to word-by-word, so "kingdom of heaven" and
  // "cast out devils" come back as single units. The first word may be
  // inflected ("laid hands on", "took away").
  _phraseAt(toks, i) {
    for (let n = Math.min(3, toks.length - i); n >= 2; n--) {
      const win = toks.slice(i, i + n);
      const rest = win.slice(1).map(normalizeEn).join(" ");
      for (const first of this._phraseFirstKeys(normalizeEn(win[0]))) {
        const p = EN_PHRASES[first + " " + rest];
        if (p) return { span: win.join(" "), entry: p, len: n };
      }
    }
    return null;
  }

  segment(text, opts = {}) {
    const out = [];
    const toks = [];
    for (const tok of String(text).split(/\s+/)) {
      const w = tok.replace(EN_TRIM, "");
      if (w) toks.push(w);
    }
    let i = 0;
    while (i < toks.length) {
      const hit = this._phraseAt(toks, i);
      if (hit) {
        out.push([hit.span, hit.entry.es.slice(), {
          root: hit.span.toLowerCase(), form: hit.entry.kind, isPhrase: true, suffixes: [],
        }]);
        i += hit.len;
      } else {
        const w = toks[i];
        const [m, info] = this.resolve(w, opts);
        out.push([w, m, info]);
        i++;
      }
    }
    return out;
  }
}
