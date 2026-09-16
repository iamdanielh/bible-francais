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
node /tmp/opencode/fullregress.mjs       # línea base (172 checks; no deben romperse)
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
  pasiva si el participio es «être» («a été mangé»→«ha sido comido»). «être + participio»
  no-movimiento → estativo (`compound.stative`), movimiento → perfecto (`_BE_PERFECT_VERBS`).
- `verbInfinitive` ~8511–8608: des-nominaliza formas; bloque `_P3` (8570–8585) adivina
  participios de 3er grupo («partie»→partir, «revenues»→revenir) — los sobreviven al `lookup`.
- `resolve()` ~9177–9330: adivinador de verbos con espacio (`^\w+ (?:moi|toi|…)`); el bucle
  de derivación (9222–9253) es **un solo token** (`if (/\s/.test(cand)) continue`) y prefiere
  el candidato cuya glosa ES sea verbo (`esInfinitive`), con `_vbFallback` al primer hit — así
  «cuira»→cuire (no «Cuero»), «sentions»→sentir (no «sendero»), «effet mille» se segmenta.
- `_preferCurated` (9185) consulta `_CURATED[normalize(cand)]` → las claves con tilde en
  `_CURATED` («être») NO son alcanzables (busca la forma llana): añadir claves sin acento.
- `js/app.js` 489, 988: llaman `esInfinitive(inf, glossesGiven)` con la acepción del TOKEN
  (a menudo sustantivo) → por eso verbos como `rencontrer` quedan sin español.

## Auditoría (hecha — veredictos)

En 5.000 versos: 17.123 filas de verbo, 17.123 con español (100%), 0 sin (0%).
2.088 compuestos, 0 sin esInf (0%).

| # | Fallo potencial | Veredicto | Fuente |
|---|---|---|---|
| A1 | Verbo sin nota española | **RESUELTO (LOTE B)**: 0 sin español; era `resolve` que dejaba ganar al homónimo sustantivo | CAUSA REAL (antes): `esInfinitive` recibía la glosa del sustantivo (`resolve` «Reunión…» para `rencontré`), no `lookup(inf)` que sí trae «encontrar». El bucle de derivación ahora prefiere glosa verbal. |
| A2 | Compuesto sin esInf | **RESUELTO (LOTE B)**: 0 rotos | misma causa que A1 |
| A3 | Participios irregulares no derivables | **CONFIRMADO**: «a été élu» → «ha sido» + «élu» vacío (élire); familia -cevoir no deriva | hace falta regla/entradas en `verbInfinitive`/`_VERB_IRREGULAR` |
| A4 | Reflexivos con elisión pegada | **OK en corpus**: s'est(61) m'est(13) t'es(4) t'est(3) → todos bien | solo falla escrito suelto «s est»/«t es» (texto a mano), impacto mínimo |
| A5 | être perfecto vs pasiva | **HECHO** (lote A5–A8): movimiento→perfecto, resto→«ser o estar» estativo | — |
| A6 | nous nous / vous vous reflexivos | **HECHO**: fundidos ante être | — |
| A7 | s'en vont / m'en vais | **HECHO**: clítico «en» fusionado (`pronominalEn`) | — |
| A8 | Frase fija que roba aux («ne sont pas»→«no son», 71 versos) | CONFIRMADO; aceptable/debatible | — |
| A9 | tout/si/très rompen el merge («a tout mangé») | **HECHO** (lote A6): «ne sont pas»/«a tout mangé» se fusionan igual | — |
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

## LOTE A5–A8 — HECHO

**«être + participio» sin sujeto pronominal** (cadena de la parte derecha del merge A2):
- Movimiento/cambio → **perfecto**: `_BE_PERFECT_VERBS` (~10345, Set). «il est venu»→«ha venido»,
  «elle est morte»→«ha muerto», «étaient venus»→«habían venido» (no erosiona la base).
- Resto → **estativo/pasiva** (ser y estar en el tiempo simple, concordancia con `agree`):
  «est cassée»→«es rota o está rota», «furent achevés»→«fueron terminados o estuvieron
  terminados», «sera puni»→«será castigado o estará castigado», «ait été vengé»→«haya sido
  o esté vengado» (glosa « o », prefijo «no » si `neg`).
- Perífrasis negativa **«ne sont pas»**: fila-frase → aux être 3pl sintetizado, `compound.neg`
  («ne sont pas venus»→«no han venido»; cobertura sube 44 versos más).
- Clítico **«en»** de «s'en aller»: pasada previa fusiona «aller»+«en» pegando `pronominalEn`
  («s'en vont»→«se van», «nous nous en allons»→«nos vamos»); en el merge el clítico se
  funde en el compuesto («s'en est allée»→«se ha ido»).
- «nous nous / vous vous» ante être → reflexivo («nous nous sommes levés»→«nos hemos levantado»).
- Guard `_P3`: «nous»/«vous» no derivan participios («nous»→noir, «vous»→voir) — dos falsos
  compuestos en 5.000 quitados.
- Participios irregulares añadidos (V_I): né(s)/née(s)→naître, mort(e)(s)→mourir, assis(es)→asseoir.

**Medido** (corpus, 5.000 versos): compuestos rotos 3 → **2** (noyer/ligure: sustantivos
mal-etiquetados, gap de diccionario); fullregress **1580/0**; es-brainer/segtest/plaingloss OK.

## LOTE B (sustantivos-homónimos + futur -ire) — HECHO

**Medido** (es-audit, 5.000 versos): filas de verbo sin español 1.304 → **0 (100%)**;
compuestos rotos 100 → **0**; fullregress **172/0**; es-brainer(38)/segtest(32)/
plaingloss(38)/accent-scan(35)/elide(44)/scan OK.

Implementado:
- **B1** `resolve()`: el bucle adivinador prefiere el candidato con glosa verbal
  (`esInfinitive`) con `_vbFallback` al primer hit y guard de un solo token →
  `cuira`→«cocer» (no cuero), `sentions`→«sentir» (no sendero), `combattants`→
  «combatientes / guerreros» (no Betta splendens), `Désignez`→«designar / señalar»
  (la clave `_CURATED` va **sin acento**: «designer»).
- **B2** `_EXTRA_WORDS` añadidos: arche→«arca (Noé)», vente→«venta»,
  bouton/boutons→«botones / granos / pústulas», nu/nue/nus/nues→«desnudo(s)»
  (`nus` no se singulariza: acaba en -us).
- **B3** `_BIBLE_NAMES`: Soufa→«Sufá (lugar)» (antes salía «Azufre» de soufre).
- **B4** `_VERB_IRREGULAR` futur 3er grupo: lire (lira/lirai/lirons/lirez/liront),
  écrire (écrira/écrirons/écrirai/écriras/écrirez/écriront), conduire,
  traduire; cuire (cuira/cuirons/cuirez/cuiront); sentions→sentir imparfait 1pl.
  (El audit no los encontraba porque no había regla de derivación para -ire futur.)

## LOTE C (resolver numérico FR→ES + compuestos con guion + verbos+clítico) — HECHO

**Medido** (es-audit, 5.000 versos): filas de verbo 17.183 con español 17.183 (**100%**, 0 sin);
compuestos 2.092, **0** rotos; fullregress **172/0**; es-brainer(38)/segtest(32)/
plaingloss(38)/accent-scan(35)/elide(44)/scan OK. Escaneo de TODA la Biblia: los únicos
tokens con guion sin resolver que quedan son nombres de persona/lugar en minúscula
(i.e. `obed-édom` a mitad de verso) — reales, se aceptan como no-resueltos.

Implementado:
- **C1** Resolver numérico FR→ES (`_frNumberEs` + `_esCardinal`/`_esOrdinal`, ~9105, antes de
  la clase): números con guion («soixante-quinze»→setenta y cinco), compuestos
  («quatre-vingt-dix-neuf»→noventa y nueve, regla 4×20), ordinales («vingt-septième»→
  vigésimo séptimo), «et» («quatre et un»→cuarenta y uno), cientos/miles («quatre mille»).
  Se dispara en `resolve()` tras `_tryDirect` (solo si todo el token es numérico).
- **C2** `segment()` ya resuelve «œufs»/«œuvre», pero el scan separaba `œ`/`’`; compuestos
  reales con guion curados en `_EXTRA_WORDS`: grand-route, contre-attaque, guet-apens,
  contre-cœur, là-dessus, demi-*, nouveau-nés, pots-de-vin, nu-pieds, main-forte,
  palmier-dattier, toute-puissance, nord/sud-ouest, dieu-roi/dieu-étoile, etc.
- **C3** Verbos+clítico con guion («maudis-le», «reçois-les», «appelles-tu»,
  «empêcherait-il», «adviendra-t-il», «secours-nous»): la puerta de `resolve()` (forma
  compuesta) ahora acepta también glosas planas con `(de verbo)` Y `_ER_RULES`/`_IR_RULES`
  añaden condicionales (`erait$`, `iraient$`, …). Verbos faltantes al diccionario:
  immobiliser, intéresser, emprunter, efforcer, advenir, rayer.
- **C4** `_VERB_IRREGULAR` añadidos: maudis, reçois, apprends, appelles, aperçois,
  aurions/auriez, adviendra, secours, rayons.
- **C5** Nombres con guion en minúscula («d’Obed-Édom») → `isName` con form «nombre propio»
  (el scan los cuenta como no-resueltos aunque la app los pinta bien; son reales).

## LOTE D (huecos reales del corpus) — HECHO

**Medido** (es-audit, 5.000 versos): filas de verbo **17.244** con español **17.244 (100%,
0 sin)**; compuestos **2.102, 0 rotos**; fullregress **172/0**; es-brainer(38)/segtest(32)/
plaingloss(38)/accent-scan(35)/elide(44)/scan OK. Escaneo de TODA la Biblia: 800.882 tokens,
los únicos sin resolver son los 8 fragmentos de elisión (`qu`/`jusqu`/`quelqu`/`hui`/
`aujourd`/`lorsqu`/`puisqu`/`quoiqu`, que maneja `segment()`) y `chef-d` (artefacto del split
de `chef-d'œuvre`) — **cero huecos reales**.

Implementado:
- **D1** `_ER_RULES`/`_IR_RULES` nuevos: `ai$` → «passé simple 1sg» (ordonnai→ordonner,
  ajoutai→ajouter, achetai→acheter, llegó a resolver 17 formas -ai) e `isse$` →
  «subjonctif 1/3sg» (unisse→unir, accomplisse→accomplir, épanouisse→épanouir).
- **D2** ~75 infinitivos `-er`/`-ir` añadidos a `_EXTRA_WORDS` (los conjugados derivables se
  resuelven solos por reglas): émerveiller, attrouper, écrouler, écouler, accoupler, entêter,
  acharner, affaisser, élancer, affoler, enraciner, excuser, ancrer, enfoncer, attarder,
  empresser, accroupir, épanouir, élargir, assombrir, évanouir, adonner, effondrer, adjurer,
  expirer, enchanter, insinuer, enlacer, allonger, essouffler, arranger, aligner,
  entrechoquer, encastrer, abréger, aggraver, aliter, avantager, expulser, étrangler,
  empaler, embarrasser, affecter, angoisser, empêtrer, animer, assimiler, activer, affamer,
  embrouiller, empaqueter, endurer, égrener, aboyer, instaurer, illuminer, orienter,
  esquiver, affluer, imbriquer, instituer, engouffrer, ébrouer, entretuer, affiner,
  entailler, enrouler, enchevêtrer, exagérer, évaluer, échauffer, empiffrer, éreinter,
  enrôler, évader, accrocher, infléchir, alourdir, envisager, employer, interposer,
  entamer, exaspérer, avérer, aménager, abstenir, obscurcir, assoupir, appauvrir,
  entrouvrir, embellir, assourdir, ébattre, adjoindre, accroître, interdire, émettre,
  inclure, admettre, assouvir, injurier, adopter.
- **D3** ~60 sustantivos/adjetivos añadidos a `_EXTRA_WORDS`: impression, acheteur,
  ivrognerie, attrait, expression, emprunteur, improviste, alcool, épervier(s), achat,
  essentiel, engourdissement, araignée, insolence, autruche, octave, aigu, immigré, aise,
  étude, inauguration, immobilisation, effraction, édification, émigration, avènement,
  affliction, institution, inconvenant, ail, ibis, affût, hippopotame, agresseur, escrocs,
  enlisement, insolation, indolence, adversité, amadou, agrément, embouchure, enclume,
  itinéraire, envahisseur, aplomb, hôtelier, objection, unanimité, évangéliste,
  interrogatoire, accomplissement, acquittement, envoi, abus, assistance, affectueuse,
  imposition, exhortation, entraînement, aiguisage, ariel, éfa.
- **D4** `_VERB_IRREGULAR` (~55 formas no derivables, futur/cond/subj de 3er grupo y
  pronominales): asseoir (assied(s)/asseyant/asseyent), appartenir (appartiens), abattre
  (abattrai), entretenir (entretint/entretiendras), éteindre (éteindra/éteigne/éteignit/
  éteignent/éteindrai), obtenir (obtiendrai/obtiens/obtiendrais), appuyer (appuient),
  étendre (étendrai/étendît), enfuir (enfuyaient/enfuyais/enfuyait), apercevoir (aperçoive/
  aperçoivent), entendre (entendrai), attendre (attendrai), exclure (excluant), apprendre
  (apprendrai/apprendrais), atteindre (atteindrai/atteignant), appeler (appellerez/
  appellerons/appellerais), enduire (enduiras), interdire (interdisait/interdirai),
  introduire (introduisit/introduis), apparaître (apparais), adjoindre (adjoignirent),
  employer (emploierez/emploie), aménager (aménageant), assouvir (assouvirai), émettre
  (émet), admettre (admettrai/admit), inclure (inclut), envoyer (enverrait), injurier
  (injurièrent), accroître (accroîtront/accroissait), assiéger (assiégeant), adopter
  (adoptera), arriver (arrivât), instruire (instruisit).

## LOTE D2 (cifras y tokens punteados) — HECHO

`segment()` **descartaba enteramente los tokens de solo dígitos** (`!/^\d+$/`)
→ «3 017 kilos» pintaba solo «kilos»; ahora las cifras se conservan y se traducen a
español por `_esCardinal` («1 100 000» → «mil cien mil», «1 290» → «mil doscientos
noventa»), por lo que cada número del corpus aparece en el panel de selección.
Además: glosa para `ouailles`/`kilo`/`gramme(s)`, y la elipsis `…` (U+2026) se añadió
al recorte de puntuación de `segment()` (había ~31 versos con palabra+`…` que daba
nulos). Verificación: escaneo `segment()` de TODA la Biblia (30.742 versos) →
**0 tokens con significado nulo**; suite completa verde (fullregress 172, es-audit
17.245 filas verbo 100%, compuestos 2.102 rotos 0).

## LOTE D3 (limpieza de glosas "desambiguación"/media + dross) — HECHO

El diccionario crudo `data/dict.json` (volcado de Wikipedia) trae miles de glosas basura:
«Sur (desambiguación)», «Encore (desambiguación)», «Gens (desambiguación)», «Nier
(videojuego)», «Imagine (canción)», «Buried (película)», «Segador (Marvel Comics)»…
No son traducciones. Implementado:

- **Strip en construcción** (`Dictionary`): `strip()` elimina de TODA entrada (`_map` y
  `_accent`) las glosas que matchean `desambiguaci` o un paréntesis `(película|canción|
  álbum|cómic|videojuego|serie de TV|novela de|Marvel Comics|DC Comics)`, y las exactas
  `e.t.`/`phone`/`furie`. Si una clave queda con 0 glosas se borra.
- **Bug corregido**: la regex original pisaba glosas legítimas (la «Canción» de
  `chanson`, entrada que quedó en `[]` si no se borraba la clave) → solo se recortan
  paréntesis con etiquetas, nunca palabras sueltas.
- **`_tryDirect`** aplica el mismo filtro con `_stripDross` (y re-aplica `_preferCurated`),
  y la «última carta» del acento (`_accent`) ahora exige `acc.length > 0` antes de devolver
  `[]` (array vacío es truthy → antes cualquier dross en el mapa de acentos devolvía `[]`).
- **~80 glosas reales añadidas a `_EXTRA_WORDS`** para las palabras del corpus cuyo único
  sentido era dross (ahora serían null): passage, prince, corne, vision, cher, cadre,
  plan, ô, filet, profondeur, irrésistible, crochet, coin, allié, allier, jugement,
  service, rangée, personnage, argument, horreur, pointe, dommage, vase, assassin,
  ressource, métal, chouette, essence, brave, lange, patriarche, sort, sol, suite,
  principe, hymne, proposition, tendant, élite, dragon, signal, oracle, droit, herse,
  crise, pasteur, divin, exercice, passager, bravé, rangé, sortir, sers (servir),
  sent (sentir), nier/nie/nia, moissonneur, chanson, impitoyable, inévitable,
  vis (voir), vis-à-vis, commandement, acacia, activité, intérêt, magie, avis, horizon,
  aire, prestige, apparat, passion, cannelle, prétendant, roux, moutarde, choc, franchise,
  société, interprétation, invasion, ranger, carrefour, horde, puce, oh, calcul, armure,
  butte, bandera, chaos, commentaire, coque, fétiche, gel, investigations, iris, lema,
  net, parallèle, piper, singulier, tendance, transparent, abandon, homer, saveur, quart.
- **Idioma "l'a b c de"** → «el abecé de» (`_PHRASES`): las letras sueltas `b`/`c`
  del corpus venían solo de «l'a b c de la sagesse» (el abecé de la sabiduría).
- **`l` suelto** (1 verso, «l impose» sin apóstrofo, elisión de `l'impose`) →
  glosa como pronombre apocopado.

Verificación: escaneo `segment()` de TODA la Biblia → **0 tokens con significado nulo**;
suite completa verde; es-audit 17.223 filas verbo 100%, compuestos 2.102 rotos 0.

## LOTE AP (palabras ligadas por apóstrofo / elisión) — HECHO

Los volcados de Wikipedia también traen **entradas-título** sobre palabras francesas
corrientes que pisan su significado real («l'empereur»→"El Emperador (Tarot)",
«âge»→"Edad biológica", «ayer»→"Ayer (Valais)", «isaac»→"ISAAC (cifrador)",
«aine»→"Ingle", «l'aîné»→"Eldest", «animal»→"Animalia"), y 3 familias se resolvían
semánticamente mal. Implementado:

- **`DROSS_EXACT`** (exact-match en `strip()` de la construcción): elimina las glosas
  exactas `el emperador (tarot)`/`edad biológica`/`ayer (valais)`/`isaac (cifrador)`/
  `ingle`/`eldest`/`animalia`. Sin patrón genérico "Título (X)" (mataría nombres
  legítimos como «Huy (Bélgica)»). Las claves que quedan con 0 glosas se borran →
  `l'empereur`→elide→`empereur`→"Emperador", `d'Isaac`→`Isaac`→nombre bíblico.
- **`_ACCENT_CURATED`** (gorjeo de acento, se unshift a `_accent`): `âge`→edad,
  `âme`→alma, `armée`→ejército, `aîné`→mayor / primogénito + variantes. Faltaba: el
  gorjeo para «où»/«dès» etc. no tenía estas palabras y la rama acentuada de
  `_tryDirect` lee `_accent` **antes** que `_map` → la glosa curada no ganaba.
- **`_VERB_IRREGULAR`**: subjonctif/impératif de `avoir` (aye/ayes/ayez/ayons) →
  `n'ayez`/`N'ayez`/`n'ayons`/`t'ayons` ya no derivan a "Ayer (Valais)" (un -er falso
  de «aez»); `s'agit`/`s'agissant` → s'agir ("se trata").
- **`_PHRASES`**: `n'a jamais`→«nunca» (no «para siempre» de "à jamais"),
  `d'après`→«según» (no «después»). Con y sin apóstrofo tipográfico.
- **`_BIBLE_NAMES`**: Isaac→Isaac (antes el cifrado informático).
- **`_EXTRA_WORDS`**: `aîné(s)`/`aînée(s)`, `s'agir`, `armée(s)`, `animal`/`animaux`,
  y las formas ligadas `l'âme`, `l'aîné`.

**Medido** (corpus completo, 30.742 versos): los **43.276** spans con apóstrofo →
`null-as-name` 680 (nombres propios, aceptados) y **0** null reales; `segfull` **0**
tokens nulos no-nombre; suite completa verde (fullregress 172, elide 44→86 con checks
AP exactos); es-audit 17.220 filas verbo 100%, compuestos 2.104 rotos 0.

Nota: la verificación de `elide.mjs` ahora incluye `APOS_MEANING` (glosas EXACTAS de
cada defecto apóstrofo corregido) — no solo no-null.

## LOTE AP2 (conectores elididos) — HECHO

Gramática del francés: quando las conjunciones/preposiciones terminan en -e antes de una
palabra con vocal se eliden (`lorsque`→`lorsqu'`, `puisque`→`puisqu'`, `quoique`→`quoiqu'`,
`parce que`→`parce qu'`, `jusque`→`jusqu'`, `de`→`d'`); `presque`/`si`/`quelque`solo
contraen en casos fijos (`presqu'île`, `quelqu'un/une`, `s'il`/`s'ils`). El `strip` de
elisión de `resolve()` quitaba el prefijo elidido y dejaba solo el pronombre
(`lorsqu'il`→"él"), perdiendo la conjunción. Implementado:

- **`_PHRASES`** (~40 entradas de conectores elididos + pronombre): conservan la
  conjunción/preposición delante del pronombre. Cuando el número que sigue empieza por
  vocal la elisión pide la forma contraída:
  - `lorsqu'il`→cuando él, `lorsqu'elle`→cuando ella, `lorsqu'ils/elles`→cuando
    ellos/ellas, `lorsqu'on`→cuando se, `lorsqu'un/une`→cuando un/una;
  - `puisqu'il elle ils elles on eux`→ya que él/ella/ellos/ellas/se/ellos (+ `puisqu'il
    y a/avait`, `puisqu'il y en a`, `puisqu'il s'agit de`→ya que …);
  - `quoiqu'il elle ils elles on`→aunque…;
  - `parce qu'il elle ils elles on`→porque…;
  - `s'il`→si él, `s'ils`→si ellos (si + il/ils, nunca elle), + `s'il y a/avait`,
    `s'il y en a`, `s'il faut`, `s'il s'agit de`→si …;
  - fijos: `presqu'île(s)`→península(s), `quelqu'une`→alguien (f.) / alguna,
    `d'accord`→de acuerdo;
  - `jusqu'` + tiempo: `jusqu'alors`→hasta entonces (antes "entonces"),
    `jusqu'à présent`→hasta ahora (antes "ahora"), `jusqu'à la fin`→hasta el final
    (antes "al final"), `jusqu'au matin`→hasta la mañana (antes el dross-título
    "La mañana (Peer Gynt)"), `jusqu'en`→hasta, `jusqu'où`→hasta dónde,
    `jusqu'en bas`→hasta abajo.
- **`DROSS_EXACT`** += `la mañana (peer gynt)` (título de Wikipedia que pisaba
  `jusqu'au matin`).

Sin patrón genérico: cada forma elidida es una clave exacta de `_PHRASES`.

**Medido** (corpus completo, 30.742 versos): `segfull` **0** tokens nulos no-nombre;
escaneo de conectores elididos → todas las formas del corpus (`lorsqu'`×230+,
`puisqu'`×85+, `quoiqu'`×3, `parce qu'`×170+ que el scan previo silenciaba, `s'il(s)`×353,
`jusqu'`×…) resuelven YA con la conjunción (`cuando/ya que/aunque/porque/si/hasta`);
`elide.mjs` 86→116 checks (APOS_MEANING + conectores); suite completa verde
(fullregress 172, es-audit 17.221 filas verbo 100%, compuestos 2.104 rotos 0).

## Historial

- `afe836e` — *BATCH 1*: cobertura española 99,3% (sin español 1304→122; compuestos rotos 100→3).
- `47b5ca0` — concordancia de número en pasivas («hemos sido salvados»): base actual.
- `50433cb` — pasivas, participios fem/pl desnudos, PP irregulares españoles, pronombres reflexivos por persona.
- `b8eeea1` — derivación inversa de glossas conjugadas + compuestos reflexivos + separador de glosas « / ».
- `c2794ec` — conjugación española en popups y fusión de tiempos compuestos.
- `fe4d9d8` — *LOTE B*: verbo vs sustantivo homónimo, futur -ire, cobertura 100%.
- `425159a` — AGENTS.md: verificación + arquitectura + veredictos A1/A2 + LOTE B.
- `e79f758` — *LOTE C*: resolver numérico FR→ES + compuestos con guion + verbos con clítico.
- `b06ca69` — *LOTE D*: huecos reales del corpus a cero (reglas ai/isse + entradas de diccionario + V_I).
- `b8eaedc` — *LOTE D2*: cifras del corpus ya se traducen (segment() no las descarta) + elipsis puntuación + glosa ouailles/kilo/gramme.
- `aed0060` — *Números ES*: millones y elisión «un/veintiún» ante mil/millón.
- `52541c5` — *Números FR*: «et» solo entre decena y unidad (neuf et un → no 10).
- `b4931bf` — *LOTE D3*: limpieza de glosas dross (desambiguación/media) + ~80 glossas reales; «l'a b c de»→abecedario.
- `59746a0` — *LOTE AP*: palabras ligadas por apóstrofo (dross exacto, acentos curados, aye/ayez, n'a jamais, d'après, Isaac).
- (lista) *LOTE AP2*: conectores elididos conservan su conjunción (lorsqu/puisqu/quoiqu/parce qu/s'il/s'ils/jusqu' + pronombre).