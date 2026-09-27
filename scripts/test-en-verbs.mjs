// English verb/phrase coverage: run with `node scripts/test-en-verbs.mjs`
// from the repo root. Exits non-zero on the first failure.
import { readFileSync } from "node:fs";
import {
  EnEngine, enVerbGloss, enVerbShort, enPhrasalMatch,
  enDetectSubject, enParticipleHint, enConjugarGlosa,
} from "../js/en-engine.js";
import { conjugarEs, esInfinitivos } from "../js/es-conj.js";

const eng = new EnEngine(
  JSON.parse(readFileSync("data/en/dict.json", "utf8")),
  JSON.parse(readFileSync("data/en/names.json", "utf8")),
);

let pass = 0;
function ok(cond, label, extra = "") {
  if (!cond) {
    console.error("FAIL:", label, extra);
    process.exit(1);
  }
  pass++;
  // console.log("ok:", label);
}
const res = (w) => eng.resolve(w);
const info = (w) => res(w)[1];
const firstEs = (w) => res(w)[0][0];

// --- regular forms ---
ok(info("walks").infinitive === "walk" && info("walks").enTense === "present-3sg", "walks -> walk present-3sg");
ok(info("walked").infinitive === "walk" && info("walked").enTense === "past-or-participle", "walked -> walk past-or-participle");
ok(info("walking").infinitive === "walk" && info("walking").enTense === "gerund", "walking -> walk gerund");
ok(info("kings").infinitive == null, "kings stays plural, no verb info");
ok(info("children").infinitive == null, "children -> child, no verb info");

// --- irregular forms ---
const irr = [
  ["went", "go", "past"], ["gone", "go", "past-participle"],
  ["goes", "go", "present-3sg"], ["saw", "see", "past"],
  ["seen", "see", "past-participle"], ["thought", "think", "past-or-participle"],
  ["found", "find", "past-or-participle"], ["left", "leave", "past-or-participle"],
  ["felt", "feel", "past-or-participle"], ["said", "say", "past-or-participle"],
  ["put", "put", "past-or-participle"], ["is", "be", "present"],
  ["was", "be", "past"], ["been", "be", "past-participle"],
  ["has", "have", "present-3sg"], ["does", "do", "present-3sg"],
];
for (const [w, inf, tense] of irr) {
  const i = info(w);
  ok(i.infinitive === inf && i.enTense === tense, `${w} -> ${inf} ${tense}`, JSON.stringify(i));
}
// colliders: dictionary reading must win, no verb metadata
ok(firstEs("saw") === "ver" || res("saw")[0].includes("ver"), "saw means ver, not sierra", res("saw")[0].slice(0, 3).join("/"));
ok(!res("saw")[0].includes("sierra"), "saw is not sierra");
ok(info("ground").infinitive == null && firstEs("ground") === "tierra", "ground -> tierra, no verb");
ok(info("wound").infinitive == null, "wound -> herida, no verb");
ok(info("lay").infinitive == null && firstEs("lay") === "poner", "lay -> poner, no verb");

// --- KJV -eth ---
ok(info("believeth").infinitive === "believe" && info("believeth").enTense === "present-3sg", "believeth -> believe present-3sg");

// --- contractions ---
ok(info("wasn't").infinitive === "be" && info("wasn't").enTense === "past", "wasn't -> be past");
ok(info("didn't").infinitive === "do" && info("didn't").enTense === "past", "didn't -> do past");
ok(info("don't").infinitive === "do" && info("don't").enTense === "present", "don't -> do present");
ok(info("it's").infinitive === "be" && info("it's").enTense === "present", "it's -> be present");
ok(info("i'm").infinitive === "be" && info("i'm").enTense === "present", "i'm -> be present");

// --- -ing noun/verb disambiguation ---
ok(info("evening").infinitive == null, "evening stays noun");
ok(info("weeping").infinitive == null && firstEs("weeping") === "llanto", "weeping -> llanto");
ok(info("offering").infinitive == null && firstEs("offering") === "ofrenda", "offering -> ofrenda");
ok(info("signifying").infinitive === "signify", "signifying -> signify gerund");

// --- gloss helpers ---
const [mWent, iWent] = res("went");
const g = enVerbGloss(iWent, mWent[0], mWent);
ok(g.includes("«go»") && g.includes("pasado") && g.includes("ir"), "enVerbGloss(went) explains past of go", g);
ok(enVerbShort(iWent) === "pasado de «go»", "enVerbShort(went)");
const [mWalk, iWalk] = res("walking");
ok(enVerbGloss(iWalk, mWalk[0], mWalk).includes("«walk» (andar o caminar)"), "gloss leads with infinitive list");

// --- phrasal match from tap context ---
let ph = enPhrasalMatch("give", "gave", ["up", "his", "spirit"]);
ok(ph && ph.phrase === "give up" && ph.es.includes("renunciar"), "gave + up -> give up");
ph = enPhrasalMatch("give", "gave", ["me", "the", "book"]);
ok(ph === null, "gave + me -> no phrasal");
ph = enPhrasalMatch("lay", "laid", ["hands", "on", "him"]);
ok(ph && ph.phrase === "lay hands on", "laid + hands on -> lay hands on");

// --- segment(): greedy phrases ---
const seg = (t) => eng.segment(t).map((s) => [s[0], s[1] && s[1][0], s[2] && s[2].form]);
let s = seg("the kingdom of heaven is at hand");
ok(s[1][0] === "kingdom of heaven" && s[1][1] === "reino de los cielos" && s[1][2] === "locución",
  "kingdom of heaven is one locución unit", JSON.stringify(s[1]));
s = seg("he cast out devils");
ok(s[1][0] === "cast out" && s[1][1] === "expulsar" && s[1][2] === "verbo frasal", "cast out is one phrasal unit");
s = seg("they laid hands on him");
ok(s[1][0] === "laid hands on" && s[1][1] === "imponer las manos", "laid hands on matches inflected first word");
s = seg("the son of man came");
ok(s[1][0] === "son of man" && s[1][2] === "locución", "son of man");
s = seg("the holy spirit descended");
ok(s[1][0] === "holy spirit" && s[1][2] === "locución", "holy spirit");
// longest match wins: "kingdom of heaven" (3) over any 2-word match
s = seg("kingdom of heaven");
ok(s.length === 1 && s[0][0] === "kingdom of heaven", "longest match: single 3-word unit");
// no-phrase fallback still word-by-word
s = seg("he walked home");
ok(s.length === 3 && s[1][2] !== "verbo frasal", "no false phrase match");

// ---- Spanish conjugation ----
const cj = (inf, t, p, want) =>
  ok(conjugarEs(inf, t, p) === want, `conjugarEs(${inf},${t},${p}) = ${want}`, conjugarEs(inf, t, p));
cj("caminar", "presente", "1s", "camino");
cj("caminar", "preterito", "3s", "caminó");
cj("caminar", "preterito", "3p", "caminaron");
cj("comer", "presente", "2s", "comes");
cj("vivir", "preterito", "1s", "viví");
cj("ser", "presente", "1s", "soy");
cj("ir", "preterito", "3s", "fue");
cj("estar", "presente", "3s", "está");
cj("tener", "presente", "1s", "tengo");
cj("hacer", "participio", null, "hecho");
cj("decir", "gerundio", null, "diciendo");
cj("pensar", "presente", "1s", "pienso");
cj("volver", "presente", "3s", "vuelve");
cj("pedir", "presente", "1s", "pido");
cj("pedir", "preterito", "3p", "pidieron");
cj("buscar", "preterito", "1s", "busqué");
cj("llegar", "preterito", "1s", "llegué");
cj("conocer", "presente", "1s", "conozco");
cj("coger", "presente", "1s", "cojo");
cj("construir", "presente", "1s", "construyo");
cj("creer", "gerundio", null, "creyendo");
cj("dormir", "gerundio", null, "durmiendo");
cj("ir", "gerundio", null, "yendo");
cj("jugar", "presente", "1s", "juego");
cj("bendecir", "presente", "3s", "bendice");
cj("andar", "preterito", "3s", "anduvo");
ok(JSON.stringify(esInfinitivos(["ser o estar"])) === '["ser","estar"]', "esInfinitivos splits alternatives");
ok(JSON.stringify(esInfinitivos(["poner en libertad"])) === '["poner"]', "esInfinitivos takes the verb");

// ---- subject detection + participle hint ----
ok(enDetectSubject(["they"]) === "3p", "subject they → 3p");
ok(enDetectSubject(["I"]) === "1s", "subject I → 1s");
ok(enDetectSubject(["Jesus"]) === "3s", "subject proper name → 3s");
ok(enDetectSubject(["thou"]) === "2s", "subject thou → 2s (KJV)");
ok(enDetectSubject(["and", "they"]) === "3p", "subject skips conjunctions");
ok(enDetectSubject([]) === "3s", "subject default → 3s");
ok(enParticipleHint(["has"]) === true, "has + verb → participle");
ok(enParticipleHint(["they"]) === false, "they + verb → not participle");

// ---- conjugated explanations ----
const glossFor = (w, prec) => {
  const [m, info] = eng.resolve(w);
  return enVerbGloss(info, m && m[0], m, { persona: enDetectSubject(prec), participle: enParticipleHint(prec) });
};
ok(glossFor("went", ["they"]).includes("«fueron"), "they went → fueron", glossFor("went", ["they"]));
ok(glossFor("went", ["I"]).includes("«fui"), "I went → fui");
ok(glossFor("walks", ["he"]).includes("camina"), "he walks → camina");
ok(glossFor("walking", ["am"]).includes("caminando"), "walking → caminando");
ok(glossFor("gone", ["has"]).includes("«ido"), "has gone → ido");
ok(glossFor("walked", ["has"]).includes("caminado"), "has walked → caminado");
ok(glossFor("believeth", []).includes("«cree"), "believeth → cree");
ok(glossFor("will", []).startsWith("Es un verbo modal"), "will → modal explanation");
const sh = (() => { const [m, info] = eng.resolve("went"); return enVerbShort(info, m, { persona: "3p" }); })();
ok(sh.includes("fueron") && sh.includes("pasado"), "enVerbShort conjugates: fueron · pasado", sh);

console.log(`ALL OK (${pass} checks)`);
