// Integration test for the English learner extras (falsos amigos, confusables,
// morfología, construcciones, familias, pronunciación, ejemplos).
import { readFileSync } from "fs";
import {
  EnEngine, enFalseFriend, enConfusable, enArchaic, enPron, enMorphGloss,
  enConstructionMatch, enConstructionEs, EN_CONSTRUCTION_LABEL,
  enWordFamily, enDetectSubject,
} from "../js/en-engine.js";

const dict = JSON.parse(readFileSync("data/en/dict.json", "utf8"));
let names = {};
try { names = JSON.parse(readFileSync("data/en/names.json", "utf8")); } catch (e) {}
const eng = new EnEngine(dict, names);

let fails = 0;
function eq(name, got, exp) {
  const g = JSON.stringify(got), e = JSON.stringify(exp);
  if (g !== e) { fails++; console.log("FAIL", name, "\n  got:", g, "\n  exp:", e); }
}

// --- construcciones: persona + tiempo correctos ---
function tap(phraseWords, idx) {
  const word = phraseWords[idx];
  const preceding = phraseWords.slice(0, idx);
  const [meanings, info] = eng.resolve(word);
  const persona = enDetectSubject(preceding);
  const cm = enConstructionMatch(preceding, info);
  const es = cm ? enConstructionEs(cm.kind, persona, meanings) : null;
  return { persona, kind: cm && cm.kind, es };
}
let r = tap(["they", "have", "gone"], 2);
eq("they have gone", [r.persona, r.kind, r.es], ["3p", "perfecto", "han ido"]);
r = tap(["I", "have", "gone"], 2);
eq("I have gone", [r.persona, r.kind, r.es], ["1s", "perfecto", "he ido"]);
r = tap(["he", "had", "walked"], 2);
eq("he had walked", [r.persona, r.kind, r.es], ["3s", "pluscuamperfecto", "había andado"]);
r = tap(["she", "was", "walking"], 2);
eq("she was walking", [r.persona, r.kind, r.es], ["3s", "continuo-pas", "estaba andando"]);
r = tap(["we", "are", "walking"], 2);
eq("we are walking", [r.persona, r.kind, r.es], ["1p", "continuo-pres", "estamos andando"]);
r = tap(["I", "will", "go"], 2);
eq("I will go", [r.persona, r.kind, r.es], ["1s", "futuro", "iré"]);
r = tap(["he", "would", "go"], 2);
eq("he would go", [r.persona, r.kind, r.es], ["3s", "condicional", "iría"]);
r = tap(["they", "will", "go"], 2);
eq("they will go", [r.persona, r.kind, r.es], ["3p", "futuro", "irán"]);
r = tap(["they", "have", "not", "gone"], 3);
eq("they have not gone", [r.persona, r.kind, r.es], ["3p", "perfecto", "han ido"]);

// --- falsos amigos ---
r = eng.resolve("embarrassed");
eq("ff embarrassed", !!enFalseFriend(r[1], "embarrassed"), true);
r = eng.resolve("actually");
eq("ff actually", enFalseFriend(r[1], "actually"), "Falso amigo de «actualmente» (= currently)");
r = eng.resolve("dog");
eq("ff dog (no es falso amigo)", enFalseFriend(r[1], "dog"), null);

// --- confusables ---
r = eng.resolve("their");
const cf = enConfusable(r[1], "their");
eq("confusable their", cf && cf.words.map((x) => x.w + (x.current ? "*" : "")).join(","), "they're,their*,there");
r = eng.resolve("dog");
eq("confusable dog", enConfusable(r[1], "dog"), null);

// --- arcaísmos (defensivo) ---
eq("arcaico thou", enArchaic("thou"), "«you» (tú) — arcaico");
eq("arcaico go", enArchaic("go"), null);

// --- pronunciación ---
r = eng.resolve("sword");
eq("pron sword", enPron(r[1], "sword"), "sord");
r = eng.resolve("though");
eq("pron though", enPron(r[1], "though"), "dou");

// --- morfología no verbal ---
r = eng.resolve("children");
eq("morph children", enMorphGloss(r[1]).texto, "plural irregular de «child»");
r = eng.resolve("kings");
eq("morph kings", enMorphGloss(r[1]).texto, "plural de «king»");
r = eng.resolve("happier");
eq("morph happier", enMorphGloss(r[1]).texto, "comparativo de «happy»");
r = eng.resolve("greatest");
eq("morph greatest", enMorphGloss(r[1]).texto, "superlativo de «great»");
r = eng.resolve("darkly");
const mgDarkly = enMorphGloss(r[1]);
eq("morph darkly", mgDarkly && mgDarkly.texto, "adverbio formado de «dark»");
r = eng.resolve("darkness");
const mgDark = enMorphGloss(r[1]);
eq("morph darkness (lexicalizada, sin nota)", mgDark, null);
r = eng.resolve("went");
eq("morph went (verbo, sin nota)", enMorphGloss(r[1]), null);

// --- familias ---
const famFaith = enWordFamily(eng, "faith");
eq("familia faith contiene faithful", famFaith.includes("faithful"), true);
eq("familia faith contiene faithfulness", famFaith.includes("faithless"), true);

// --- etiquetas de construcción ---
eq("labels", Object.keys(EN_CONSTRUCTION_LABEL).sort(), ["condicional", "continuo-pas", "continuo-pres", "futuro", "perfecto", "pluscuamperfecto"].sort());

console.log(fails ? fails + " FALLOS" : "ALL OK (extras)");
process.exit(fails ? 1 : 0);
