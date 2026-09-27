// English verb/phrase coverage: run with `node scripts/test-en-verbs.mjs`
// from the repo root. Exits non-zero on the first failure.
import { readFileSync } from "node:fs";
import {
  EnEngine, enVerbGloss, enVerbShort, enPhrasalMatch,
} from "../js/en-engine.js";

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
ok(enVerbGloss(iWalk, mWalk[0], mWalk).includes("«walk» (andar)"), "gloss leads with verb gloss andar");

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

console.log(`ALL OK (${pass} checks)`);
