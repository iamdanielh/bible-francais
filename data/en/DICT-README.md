# English → Spanish dictionary (`data/en/dict.json`)

## Source

**Apertium English–Spanish bilingual dictionary** (`apertium-en-es` bidix),
`apertium-eng-spa.eng-spa.dix` — 37,712 entries, parsed to 17,639 lemma keys.

- Repository: https://github.com/apertium/apertium-en-es
- License: **GPL-3.0** (the FreeDict `eng-spa` alternative is also GPL, but its
  download server timed out during the build, so Apertium was used).

## How it was built

1. Extracted every top-level `<e><p><l>english</l><r>spanish</r></p></e>` pair,
   converting `<b/>` to spaces and dropping `<s n="…"/>` part-of-speech tags.
2. Keys: lowercase, single tokens only (multiword English entries dropped —
   no phrase keys). Glosses deduplicated per key, max 6, in source order.
3. Dropped proper-name echo glosses (e.g. `King` as a surname → `King`).
4. **Curated supplement** (~70 entries): English pronouns and closed-class words
   the bidix omits (`i/me/we/you/he/him/she/it/they/them`), KJV archaisms
   (`thou/thee/thy/thine/ye/hath…/unto/wherefore/wherein/…`), missing common
   verb roots (`forsake/strive/slay/…`), and modal fixes (`will/shall/would/
   could` as auxiliaries, `may` modal-first).

## Attribution (show in the app)

> Diccionario inglés→español derivado de **Apertium en-es**
> (https://github.com/apertium/apertium-en-es), bajo licencia **GPL-3.0**.
> © Apertium contributors. Glosas adicionales de uso bíblico (KJV) añadidas
> por el proyecto.
