// es-conj.js — conjugador de español para BiblioLingo.
// Presente, pretérito perfecto simple, pretérito imperfecto, futuro,
// condicional, gerundio y participio.
// Cubre verbos regulares (-ar/-er/-ir), los irregulares más frecuentes y las
// reglas ortográficas comunes (-car/-gar/-zar, -cer→-zco, -ger→-jo, -uir→-uyo,
// -eer→-yendo, cambios de raíz e→ie / o→ue / e→i).

const stripAcc = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const IDX = { "1s": 0, "2s": 1, "3s": 2, "1p": 3, "2p": 4, "3p": 5 };

// Tablas irregulares completas. Claves sin acento.
// pres/pret/imp: [1s,2s,3s,1p,2p,3p]; null = ese tiempo es regular.
const IRREG = {
  ser:   { pres: ["soy","eres","es","somos","sois","son"], pret: ["fui","fuiste","fue","fuimos","fuisteis","fueron"], imp: ["era","eras","era","éramos","erais","eran"], ger: "siendo", pple: "sido" },
  estar: { pres: ["estoy","estás","está","estamos","estáis","están"], pret: ["estuve","estuviste","estuvo","estuvimos","estuvisteis","estuvieron"], imp: ["estaba","estabas","estaba","estábamos","estabais","estaban"], ger: "estando", pple: "estado" },
  ir:    { pres: ["voy","vas","va","vamos","vais","van"], pret: ["fui","fuiste","fue","fuimos","fuisteis","fueron"], imp: ["iba","ibas","iba","íbamos","ibais","iban"], ger: "yendo", pple: "ido" },
  haber: { pres: ["he","has","ha","hemos","habéis","han"], pret: ["hube","hubiste","hubo","hubimos","hubisteis","hubieron"], imp: ["había","habías","había","habíamos","habíais","habían"], ger: "habiendo", pple: "habido" },
  tener: { pres: ["tengo","tienes","tiene","tenemos","tenéis","tienen"], pret: ["tuve","tuviste","tuvo","tuvimos","tuvisteis","tuvieron"], imp: null, ger: "teniendo", pple: "tenido" },
  hacer: { pres: ["hago","haces","hace","hacemos","hacéis","hacen"], pret: ["hice","hiciste","hizo","hicimos","hicisteis","hicieron"], imp: null, ger: "haciendo", pple: "hecho" },
  decir: { pres: ["digo","dices","dice","decimos","decís","dicen"], pret: ["dije","dijiste","dijo","dijimos","dijisteis","dijeron"], imp: null, ger: "diciendo", pple: "dicho" },
  bendecir: { pres: ["bendigo","bendices","bendice","bendecimos","bendecís","bendicen"], pret: ["bendije","bendijiste","bendijo","bendijimos","bendijisteis","bendijeron"], imp: null, ger: "bendiciendo", pple: "bendecido" },
  poder: { pres: ["puedo","puedes","puede","podemos","podéis","pueden"], pret: ["pude","pudiste","pudo","pudimos","pudisteis","pudieron"], imp: null, ger: "pudiendo", pple: "podido" },
  poner: { pres: ["pongo","pones","pone","ponemos","ponéis","ponen"], pret: ["puse","pusiste","puso","pusimos","pusisteis","pusieron"], imp: null, ger: "poniendo", pple: "puesto" },
  saber: { pres: ["sé","sabes","sabe","sabemos","sabéis","saben"], pret: ["supe","supiste","supo","supimos","supisteis","supieron"], imp: null, ger: "sabiendo", pple: "sabido" },
  querer: { pres: ["quiero","quieres","quiere","queremos","queréis","quieren"], pret: ["quise","quisiste","quiso","quisimos","quisisteis","quisieron"], imp: null, ger: "queriendo", pple: "querido" },
  venir: { pres: ["vengo","vienes","viene","venimos","venís","vienen"], pret: ["vine","viniste","vino","vinimos","vinisteis","vinieron"], imp: null, ger: "viniendo", pple: "venido" },
  dar:   { pres: ["doy","das","da","damos","dais","dan"], pret: ["di","diste","dio","dimos","disteis","dieron"], imp: null, ger: "dando", pple: "dado" },
  ver:   { pres: ["veo","ves","ve","vemos","veis","ven"], pret: ["vi","viste","vio","vimos","visteis","vieron"], imp: ["veía","veías","veía","veíamos","veíais","veían"], ger: "viendo", pple: "visto" },
  salir: { pres: ["salgo","sales","sale","salimos","salís","salen"], pret: null, imp: null, ger: "saliendo", pple: "salido" },
  oir:   { pres: ["oigo","oyes","oye","oímos","oís","oyen"], pret: ["oí","oíste","oyó","oímos","oísteis","oyeron"], imp: null, ger: "oyendo", pple: "oído" },
  traer: { pres: ["traigo","traes","trae","traemos","traéis","traen"], pret: ["traje","trajiste","trajo","trajimos","trajisteis","trajeron"], imp: null, ger: "trayendo", pple: "traído" },
  caer:  { pres: ["caigo","caes","cae","caemos","caéis","caen"], pret: null, imp: null, ger: "cayendo", pple: "caído" },
  andar: { pres: null, pret: ["anduve","anduviste","anduvo","anduvimos","anduvisteis","anduvieron"], imp: null, ger: "andando", pple: "andado" },
  reir:  { pres: ["río","ríes","ríe","reímos","reís","ríen"], pret: ["reí","reíste","rió","reímos","reísteis","rieron"], imp: null, ger: "riendo", pple: "reído" },
};

// Raíces irregulares de futuro/condicional (raíz + terminación).
const FUT_STEM = {
  tener: "tendr", poner: "pondr", salir: "saldr", venir: "vendr",
  poder: "podr", haber: "habr", hacer: "har", decir: "dir",
  querer: "querr", saber: "sabr",
};

// Cambios de raíz en presente (1s,2s,3s,3p). Para verbos -ir también aplican
// al gerundio y al pretérito de 3ª persona (e→i, o→u).
const STEM = {
  pensar: "ie", cerrar: "ie", empezar: "ie", comenzar: "ie", entender: "ie",
  perder: "ie", preferir: "ie", sentir: "ie", querer: "ie",
  encontrar: "ue", contar: "ue", recordar: "ue", volver: "ue", dormir: "ue",
  morir: "ue", jugar: "ue", volar: "ue", sonar: "ue", mostrar: "ue",
  mover: "ue", probar: "ue", poder: "ue",
  pedir: "i", seguir: "i", servir: "i", repetir: "i", vestir: "i",
  medir: "i", despedir: "i", freir: "i", sonreir: "i",
};

function stemChange(stem, kind) {
  if (kind === "ie") return stem.replace(/e([^e]*)$/, "ie$1");
  if (kind === "ue") {
    // o→ue and u→ue are mutually exclusive (jugar→juego, volver→vuelvo).
    if (/o[^o]*$/.test(stem)) return stem.replace(/o([^o]*)$/, "ue$1");
    return stem.replace(/u([^u]*)$/, "ue$1");
  }
  if (kind === "i") return stem.replace(/e([^e]*)$/, "i$1");
  return stem;
}

function presenteReg(inf, i) {
  const key = stripAcc(inf.toLowerCase());
  const conj = key.slice(-2);
  let stem = inf.slice(0, -2);
  // -uir → -uyo/-uyes/... (construir, huir, destruir)
  if (/uir$/.test(key) && (i === 0 || i === 1 || i === 2 || i === 5)) stem += "y";
  if (i === 0) {
    if (/cer$/.test(key) || /cir$/.test(key)) return stem.replace(/c$/i, "zc") + "o"; // conocer→conozco
    if (/(ger|gir)$/.test(key) && !/guir$/.test(key)) return stem.replace(/g$/i, "j") + "o"; // coger→cojo
  }
  const ch = STEM[key];
  if (ch && (i === 0 || i === 1 || i === 2 || i === 5)) stem = stemChange(stem, ch);
  const END = {
    ar: ["o", "as", "a", "amos", "áis", "an"],
    er: ["o", "es", "e", "emos", "éis", "en"],
    ir: ["o", "es", "e", "imos", "ís", "en"],
  }[conj] || ["o", "s", "", "", "", "n"];
  return stem + END[i];
}

function preteritoReg(inf, i) {
  const key = stripAcc(inf.toLowerCase());
  const conj = key.slice(-2);
  let stem = inf.slice(0, -2);
  // Ortografía: buscar→busqué, llegar→llegué, cazar→cacé.
  if (conj === "ar" && i === 0) {
    stem = stem.replace(/c$/i, "qu").replace(/g$/i, "gu").replace(/z$/i, "c");
  }
  // -ir con cambio: pedir→pidió/pidieron, dormir→durmió.
  const ch = STEM[key];
  if (conj === "ir" && ch && (i === 2 || i === 5)) {
    stem = stem.replace(/e([^e]*)$/, "i$1").replace(/o([^o]*)$/, "u$1");
  }
  let end;
  if (conj === "ar") {
    end = ["é", "aste", "ó", "amos", "asteis", "aron"][i];
  } else {
    end = ["í", "iste", "ió", "imos", "isteis", "ieron"][i];
    if (/eer$/.test(key)) end = i === 2 ? "yó" : i === 5 ? "yeron" : end; // creer→creyó
  }
  return stem + end;
}

function gerundioReg(inf) {
  const key = stripAcc(inf.toLowerCase());
  const conj = key.slice(-2);
  let stem = inf.slice(0, -2);
  if (conj === "ar") return stem + "ando";
  if (/eer$/.test(key) || /uir$/.test(key)) return stem + "yendo"; // creyendo, construyendo
  const ch = STEM[key];
  if (conj === "ir" && ch) stem = stem.replace(/e([^e]*)$/, "i$1").replace(/o([^o]*)$/, "u$1");
  return stem + "iendo";
}

function participioReg(inf) {
  const key = stripAcc(inf.toLowerCase());
  const conj = key.slice(-2);
  const stem = inf.slice(0, -2);
  if (conj === "ar") return stem + "ado";
  if (/eer$/.test(key)) return stem + "ído"; // creído
  return stem + "ido";
}

function imperfectoReg(inf, i) {
  const key = stripAcc(inf.toLowerCase());
  const conj = key.slice(-2);
  const stem = inf.slice(0, -2);
  const end = conj === "ar"
    ? ["aba", "abas", "aba", "ábamos", "abais", "aban"][i]
    : ["ía", "ías", "ía", "íamos", "íais", "ían"][i];
  return stem + end;
}

function futuroCondReg(inf, i, cond) {
  const key = stripAcc(inf.toLowerCase());
  const stem = FUT_STEM[key] || inf;
  const end = cond
    ? ["ía", "ías", "ía", "íamos", "íais", "ían"][i]
    : ["é", "ás", "á", "emos", "éis", "án"][i];
  return stem + end;
}

// Conjuga un infinitivo español.
// tiempo: "presente" | "preterito" | "imperfecto" | "futuro" | "condicional"
//        | "gerundio" | "participio" | "infinitivo"
// persona: "1s" | "2s" | "3s" | "1p" | "2p" | "3p"
export function conjugarEs(inf, tiempo, persona) {
  if (!inf) return "";
  const clean = String(inf).toLowerCase().trim();
  const key = stripAcc(clean);
  const irr = IRREG[key];
  if (tiempo === "gerundio") return (irr && irr.ger) || gerundioReg(clean);
  if (tiempo === "participio") return (irr && irr.pple) || participioReg(clean);
  if (tiempo === "infinitivo" || !tiempo) return clean;
  const i = IDX[persona] ?? 2;
  if (irr && (tiempo === "presente" || tiempo === "preterito" || tiempo === "imperfecto")) {
    const tab = tiempo === "preterito" ? irr.pret : tiempo === "imperfecto" ? irr.imp : irr.pres;
    if (tab) return tab[i];
  }
  if (tiempo === "preterito") return preteritoReg(clean, i);
  if (tiempo === "imperfecto") return imperfectoReg(clean, i);
  if (tiempo === "futuro") return futuroCondReg(clean, i, false);
  if (tiempo === "condicional") return futuroCondReg(clean, i, true);
  return presenteReg(clean, i);
}

// Extrae los infinitivos españoles de una lista de glosas
// ("ser o estar" → ["ser","estar"]; "poner en libertad" → ["poner"]).
export function esInfinitivos(glosses) {
  const out = [];
  for (const g of glosses || []) {
    for (const tok of String(g).toLowerCase().split(/[\s,;·/()]+/)) {
      const t = tok.replace(/^[¿¡"«»'“”‘’]+|[?!"»'“”‘’.,:;]+$/g, "");
      if (!t || out.includes(t)) continue;
      const k = stripAcc(t);
      if (IRREG[k] || (/(ar|er|ir)$/.test(k) && k.length > 2)) out.push(t);
      if (out.length >= 3) return out;
    }
  }
  return out;
}
