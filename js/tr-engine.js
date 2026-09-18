// Turkish engine stub — Fase 0 (datos YTC + integración mínima).
// El análisis de sufijos turcos (Fase 1) y el diccionario TR→ES (Fase 2)
// se montan sobre esta clase; por ahora segmenta palabras y no resuelve
// significados para que la app funcione completa en modo turco.
const PUNCT = /^[.,;:!?«»"'“”‘’\[\]()*–—…]+|[.,;:!?«»"'“”‘’\[\]()*–—…]+$/g;

export class TrEngine {
  constructor(dict) {
    this.dict = dict || null;
  }

  // Fase 1: sustituir por el analizador de sufijos turcos.
  lookup(word) {
    return this.dict && Array.isArray(this.dict[word]) ? this.dict[word].slice() : [];
  }

  // Fase 1: derivar la raíz y consultar el diccionario TR→ES.
  resolve(word, _opts) {
    return [null, {}];
  }

  segment(text) {
    const out = [];
    for (const tok of String(text).split(/\s+/)) {
      const w = tok.replace(PUNCT, "");
      if (!w) continue;
      const [m, info] = this.resolve(w);
      out.push([w, m, info]);
    }
    return out;
  }
}