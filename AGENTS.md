# francais-biblique-web — plan de trabajo persistente

Repositorio de la app web de traducción de la Biblia francés→español. Sin framework de
tests: la verificación se hace con scripts Node en `/tmp/opencode/*.mjs` y `node --check`.

## Verificación (SIEMPRE, tras cualquier cambio)

```bash
cd /home/dangel/Work/francais-biblique-web
node --check js/dict.js && node --check js/app.js
node /tmp/opencode/es-brainer.mjs        # debe decir ALL OK
node /tmp/opencode/es-segtest.mjs        # segmentación/compuestos, debe quedar OK
node /tmp/opencode/es-plaingloss.mjs     # glossas planas, debe quedar OK
node /tmp/opencode/fullregress.mjs       # línea base 1571/0 (no deben romperse)
node /tmp/opencode/accent-scan.mjs       # auxiliar de acentos
node /tmp/opencode/elide.mjs && node /tmp/opencode/scan.mjs
node /tmp/opencode/es-audit.mjs          # auditoría de cobertura (5.000 versos)
```

- Commit CONCISO en español describiendo el cambio; NO `git push` salvo que el usuario lo pida.
- Línea base: HEAD `47b5ca0` ("Agree number in passive participles..."). Arriba están
  `50433cb`, `b8eeea1`, `c2794ec` (los commits previos del feature español).

## Arquitectura del feature español (sucinta)

- `js/dict.js` ~9400–10330: `esInfinitive` (FR→INF es + derivación inversa de formas
  conjugadas via `_esBackderive`/`_esFormsTable`), `esConjugado`, `esCompuesto(esInf,label,cells,opts)`
  (pasiva → «sido», concordancia por `agree`; pronombre reflexivo `_ES_PRON` por persona).
- `segment()` ~9360–9466: agrupa aux+participio en «passé composé» etc, detecta reflexivos
  (`reflPrev` en ~9408 sobre `out[j-1][0]`, y `aWord` para clíticos pegados), y cadena
  pasiva si el participio es «être» («a été mangé»→«ha sido comido»).
- `verbInfinitive` ~8511–8608: des-nominaliza formas; bloque `_P3` (8570–8585) adivina
  participios de 3er grupo («partie»→partir, «revenues»→revenir) — los sobreviven al `lookup`.
- `js/app.js` 489, 988: llaman `esInfinitive(inf, glossesGiven)` con la acepción del TOKEN
  (a menudo sustantivo) → por eso verbos como `rencontrer` quedan sin español.

## Auditoría (hecha — veredictos)

En 5.000 versos: 17.119 filas de verbo, 15.815 con español (92,4%), 1.304 sin (7,6%).
2.057 compuestos, 100 sin esInf (4,9%).

| # | Fallo potencial | Veredicto | Fuente |
|---|---|---|---|
| A1 | Verbo sin nota española | **CONFIRMADO (mayoría)**: rencontrer(112) maintenir(76) régler(67) boire(59) jeûner(44) toucher(39)… | CAUSA REAL: `esInfinitive` recibe la glosa del sustantivo (`resolve` «Reunión…» para `rencontré`), no `lookup(inf)` que sí trae «encontrar». |
| A2 | Compuesto sin esInf | **CONFIRMADO**: emparer(10 «s'est emparé de») manifester(8) frapper(5) coucher(4)… (100/2057) | misma causa que A1 |
| A3 | Participios irregulares no derivables | **CONFIRMADO**: «a été élu» → «ha sido» + «élu» vacío (élire); familia -cevoir no deriva | hace falta regla/entradas en `verbInfinitive`/`_VERB_IRREGULAR` |
| A4 | Reflexivos con elisión pegada | **OK en corpus**: s'est(61) m'est(13) t'es(4) t'est(3) → todos bien | solo falla escrito suelto «s est»/«t es» (texto a mano), impacto mínimo |
| A5 | être perfecto vs pasiva | CONFIRMADO manual («est cassée»→«ha roto») pero frecuencia baja + riesgo alto; NO abordar ahora | — |
| A6 | nous nous / vous vous reflexivos | CONFIRMADO; trade-off deliberado aceptado | — |
| A7 | s'en vont / m'en vais | CONFIRMADO; no abordar (en) | — |
| A8 | Frase fija que roba aux («ne sont pas»→«no son», 71 versos) | CONFIRMADO; aceptable/debatible | — |
| A9 | tout/si/très rompen el merge («a tout mangé») | CONFIRMADO manual; raro en corpus (8/5000, casi todos adjetivos) | fix barato |
| A10 | Tiempos imposibles (impératif passé, surcomposé) | silencio esperado | — |

## BATCH 1 — HECHO (commit de más abajo)

**Resultado medido** (es-audit, 5.000 versos): filas de verbo sin español 1.304 → **122**;
compuestos rotos 100 → **3** (noir/noyer/ligure: sustantivos mal-etiquetados, sin acepción
verbal; fuera de alcance de código). Cobertura 99,3%.

Implementado:
- **P1** `esInfinitive(frInf, glosses, lookup)`: escaneo refactorizado a helper `from(list)`
  ejecutado sobre las glossas dadas y luego sobre `lookup(fr) || []` (los call sites pasan
  `(f)=>dictionary.lookup(f)` / `this.lookup`). Además en `from`: patrón `infinitivo + (…)`
  («apoderarse (s'emparer)», «exclamar (s'écrier)») tras las marcas «= Xse»; y perífrasis
  `X a <inf>` («volver a ver»→ver). `lookup` ya dobla acentos (usa `normalize`).
- **P2** `_ES_INF` añadidos: concevoir→concebir, toucher→tocar, dîner/diner→cenar,
  accoucher→parir, conseiller→aconsejar, braiser→estofar, tapir→agazaparse, gare→aparcar.
- **P3** `verbInfinitive`: regla `ç[ue]s?$` → base+`cevoir` (aperçus→apercevoir, reçu→recevoir…)
  con etiquetas de género; `_VERB_IRREGULAR`: élu/élue/élus/élues → élire.
- **P4** `_NEG_TOKENS` += tout, toute, toutes, tous, très, si (merge «a tout mangé»).
- **P5** clíticos reflexivos: `reflPrev` acepta `s/m/t` desnudos Y gateado a `aux === être`
  (un acusativo ante «avoir» —«il m'a vu»— ya NO da reflexivo; «tu t es blessé» sí).

Cobertura restante razonable: pere/archer/fer/messager/core/stature/gaucher/potager/ventre/
cuir/soufre… son sustantivos sin acepción verbal en el diccionario (no es problema de código).

## PENDIENTES / CONSCIENTEMENTE NO ABORDADO

- être perfecto vs pasiva (A5) — necesitaría lista clásica (verbos de movimiento/pronominales)
  y arriesga regresiones confirmadas; decisión del usuario.
- s'en aller / en (A7), nous-nous/vous-vous (A6, decisión tomada), frase «ne sont pas» (A8),
  impératif passé / passé surcomposé (A10).
- Cobertura de glosas del diccionario en sí (verbos sin entrada: p.ej. frapper→tiene entrada,
  pero hay otros sin ninguna → dependerá de añadir entradas de diccionario, no de código).

## Historial

- (próximo) — *BATCH 1*: cobertura española 99,3% (sin español 1304→122; compuestos rotos 100→3).
- `47b5ca0` — concordancia de número en pasivas («hemos sido salvados»): base actual.
- `50433cb` — pasivas, participios fem/pl desnudos, PP irregulares españoles, pronombres reflexivos por persona.
- `b8eeea1` — derivación inversa de glossas conjugadas + compuestos reflexivos + separador de glosas « / ».
- `c2794ec` — conjugación española en popups y fusión de tiempos compuestos.