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

## Suplementos de cobertura (2026-09-26)

Medición sobre el corpus: 751.570 tokens, 12.684 formas únicas. Tasa de
palabras sin traducción: **6,8% → 0,6%**.

- **Lote 1** (~210 entradas): vocabulario bíblico frecuente ausente del bidix
  (`covenant`, `tabernacle`, `shekel`, `rejoice`, `anoint`, `cherubim`…),
  interjecciones (`woe`, `o`, `selah`) y el artículo `an`.
- **Lote 2** (~10 entradas): `eastward`, `savior`, `fisherman`, `countryman`,
  `madman` y raíces para plurales irregulares en *-men*.
- **Lote 3** (~100 entradas): resto de alta frecuencia (`molten`, `conscience`,
  `travail`, `garrison`, `reproof`, `deliverance`, `covetousness`…).
- **Lote 4** (~40 entradas): `footman/craftsman/herdsman` (raíces de los
  irregulares en *-men*), `mistress`, `trough`, `extol`, `tetrarch`…
- Ningún lote sobrescribió entradas existentes (`overwrote-existing: 0`).

## Nombres propios (`data/en/names.json`)

1.322 entradas EN (minúsculas) → nombre en español, convenciones Reina-Valera
(`yahweh`→Yahvé, `moses`→Moisés, `jerusalem`→Jerusalén, `judah`→Judá).
Incluye gentilicios en minúscula (`philistines`→filisteos, `jews`→judíos) y
formas idénticas al inglés para nombres raros (p. ej. `ashkenaz`→Ashkenaz),
que el motor marca como nombre propio. Tabla curada por el proyecto
(hechos onomásticos, sin licencia de terceros).
