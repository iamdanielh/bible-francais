// French -> Spanish dictionary + grammar logic, ported from the desktop app
// (src/dictionary.py and src/grammar.py) so behavior matches exactly.

// ---- normalize (accent folding) --------------------------------------------
const _ACCENTS = {
  "à": "a", "â": "a", "ä": "a", "æ": "ae", "ç": "c",
  "é": "e", "è": "e", "ê": "e", "ë": "e",
  "î": "i", "ï": "i", "ô": "o", "œ": "oe",
  "ù": "u", "û": "u", "ü": "u", "ÿ": "y",
};
function normalize(word) {
  return String(word).toLowerCase().replace(/[àâäæçéèêëîïôœùûüÿ]/g, (c) => _ACCENTS[c] || c);
}

// ---- curated function words + high-frequency vocab (port of _CURATED) -----
const _CURATED = {
  "le": "el / lo", "la": "la", "les": "los / las", "un": "un / uno",
  "une": "una", "des": "unos / unas", "du": "del", "de": "de", "et": "y",
  "ou": "o / u", "que": "que", "qui": "que / quien", "dont": "cuyo",
  "au": "al", "aux": "a los / a las", "en": "en", "dans": "en / dentro de",
  "sur": "sobre", "sous": "bajo", "avec": "con", "sans": "sin",
  "pour": "para", "par": "por", "à": "a / en", "il": "él",
  "elle": "ella", "ils": "ellos", "elles": "ellas", "je": "yo",
  "tu": "tú", "nous": "nosotros", "vous": "ustedes", "on": "se",
  "se": "se", "ne": "no", "pas": "no", "est": "es / está",
  "sont": "son", "était": "era / estaba", "être": "ser / estar",
  "a": "ha / tiene", "avait": "tenía / había", "ont": "tienen / han",
  "avoir": "tener / haber", "fait": "hecho / hace", "faire": "hacer",
  "dit": "dijo", "dire": "decir", "parle": "habla", "parler": "hablar",
  "voit": "ve", "voir": "ver", "vint": "vino", "venait": "venía",
  "prend": "toma", "prendre": "tomar / coger", "vient": "viene",
  "venir": "venir", "va": "va", "aller": "ir", "allait": "iba",
  "me": "me", "te": "te", "lui": "le / él", "leur": "su / les",
  "moi": "mí", "toi": "tí", "vers": "hacia", "chez": "en casa de",
  "depuis": "desde", "pendant": "durante", "avant": "antes",
  "après": "después", "entre": "entre", "selon": "según",
  "contre": "contra", "car": "porque", "mais": "pero", "donc": "así que",
  "si": "si", "bien": "bien", "très": "muy", "plus": "más",
  "moins": "menos", "tout": "todo", "toute": "toda", "tous": "todos",
  "toutes": "todas", "ce": "este / eso", "cette": "esta",
  "ces": "estos / estas", "son": "su (de él)", "sa": "su (de ella)",
  "ses": "sus", "mon": "mi", "ma": "mi", "mes": "mis", "ton": "tu",
  "ta": "tu", "tes": "tus", "notre": "nuestro", "nos": "nuestros",
  "votre": "su / vuestro", "leurs": "sus", "y": "allí",
  "où": "donde", "quand": "cuando", "combien": "cuánto",
  "quel": "cuál", "quelle": "cuál", "quels": "cuáles", "quelles": "cuáles",
  "seul": "solo", "seule": "sola", "grand": "grande", "grande": "grande",
  "petit": "pequeño", "petite": "pequeña", "bon": "bueno",
  "bonne": "buena", "mauvais": "malo", "premier": "primero",
  "dernier": "último", "même": "mismo / incluso", "autre": "otro",
  "chacun": "cada uno", "chose": "cosa", "homme": "hombre",
  "femme": "mujer", "enfant": "niño", "peuple": "pueblo", "vie": "vida",
  "mort": "muerte", "ciel": "cielo", "terre": "tierra", "eau": "agua",
  "feu": "fuego", "lumière": "luz", "ténèbres": "tinieblas", "jour": "día",
  "nuit": "noche", "soleil": "sol", "lune": "luna", "étoile": "estrella",
  "vent": "viento", "pluie": "lluvia", "montagne": "montaña", "mer": "mar",
  "roi": "rey", "reine": "reina", "prêtre": "sacerdote",
  "prophète": "profeta", "ange": "ángel", "diable": "diablo",
  "esprit": "espíritu", "âme": "alma", "cœur": "corazón",
  "parole": "palabra", "voix": "voz", "nom": "nombre", "livre": "libro",
  "ville": "ciudad", "maison": "casa", "porte": "puerta", "pain": "pan",
  "vin": "vino", "poisson": "pescado", "agneau": "cordero",
  "brebis": "oveja", "peur": "miedo", "amour": "amor", "paix": "paz",
  "joie": "alegría", "grâce": "gracia", "foi": "fe", "espoir": "esperanza",
  "vérité": "verdad", "mensonge": "mentira", "voie": "camino / vía",
  "chemin": "camino", "maître": "maestro", "serviteur": "sirviente",
  "Dieu": "Dios", "Seigneur": "Señor", "Christ": "Cristo",
  "Jésus": "Jesús", "frère": "hermano", "sœur": "hermana",
  "père": "padre", "mère": "madre", "fils": "hijo", "fille": "hija",
  "famille": "familia", "ami": "amigo", "ennemi": "enemigo",
  "yeux": "ojos", "main": "mano", "pied": "pie", "tête": "cabeza",
  "bouche": "boca", "oreille": "oreja", "montagne": "montaña",
  "porte": "puerta", "peuple": "pueblo", "chose": "cosa",
};

// Common French verb infinitives -> Spanish (port of _COMMON_VERBS).
const _COMMON_VERBS = {
  "être": "ser / estar", "avoir": "tener / haber", "faire": "hacer",
  "aller": "ir", "venir": "venir", "voir": "ver",
  "dire": "decir", "parler": "hablar", "aimer": "amar / querer",
  "donner": "dar", "prendre": "tomar / coger", "mettre": "poner / meter",
  "trouver": "encontrar", "croire": "creer", "savoir": "saber",
  "pouvoir": "poder", "vouloir": "querer", "devoir": "deber",
  "falloir": "hacer falta / tener que", "entendre": "oír",
  "écouter": "escuchar", "regarder": "mirar", "chercher": "buscar",
  "demander": "pedir / preguntar", "répondre": "responder",
  "penser": "pensar", "connaître": "conocer",
  "arriver": "llegar / suceder", "partir": "partir / irse",
  "sortir": "salir", "rentrer": "volver a casa", "rester": "quedarse",
  "revenir": "volver", "devenir": "convertirse", "mourir": "morir",
  "vivre": "vivir", "naître": "nacer", "manger": "comer", "boire": "beber",
  "dormir": "dormir", "habiter": "habitar / vivir", "travailler": "trabajar",
  "adorer": "adorar", "prier": "orar / rezar", "bénir": "bendecir",
  "louer": "alabar / alquilar", "chanter": "cantar", "créer": "crear",
  "multiplier": "multiplicar", "diviser": "dividir", "recevoir": "recibir",
  "envoyer": "enviar", "porter": "llevar",
  "apporter": "traer", "amener": "llevar / traer", "suivre": "seguir",
  "tenir": "tener / sostener", "garder": "guardar", "protéger": "proteger",
  "sauver": "salvar", "libérer": "liberar", "délivrer": "liberar",
  "commander": "mandar", "obéir": "obedecer", "appeler": "llamar",
  "nommer": "nombrar", "choisir": "elegir", "recommencer": "volver a empezar",
  "commencer": "empezar", "finir": "terminar", "continuer": "continuar",
  "cesser": "cesar / dejar de", "retourner": "volver / devolver",
  "rendre": "devolver", "vendre": "vender", "acheter": "comprar",
  "ouvrir": "abrir", "fermer": "cerrar", "écrire": "escribir",
  "lire": "leer", "compter": "contar",
  "mesurer": "medir", "peser": "pesar", "couper": "cortar",
  "raser": "derribar / arrasar", "bâtir": "edificar", "construire": "construir",
  "détruire": "destruir", "casser": "romper", "cacher": "esconder",
  "montrer": "mostrar", "expliquer": "explicar", "enseigner": "enseñar",
  "apprendre": "aprender", "comprendre": "comprender / entender",
  "payer": "pagar", "coûter": "costar", "valoir": "valer",
  "mériter": "merecer", "gagner": "ganar", "perdre": "perder",
  "attendre": "esperar", "espérer": "esperar / tener esperanza", "souffrir": "sufrir",
  "pleurer": "llorar", "rire": "reír", "sourire": "sonreír",
  "danser": "bailar", "marcher": "caminar",
  "courir": "correr", "voler": "volar / robar", "tomber": "caer",
  "lever": "levantar", "monter": "subir", "descendre": "bajar",
  "entrer": "entrar", "rejoindre": "unirse / alcanzar",
  "accompagner": "acompañar", "quitter": "dejar / salir de",
  "laisser": "dejar", "abandonner": "abandonar", "oublier": "olvidar",
  "se souvenir": "acordarse", "mener": "llevar / guiar",
  "guider": "guiar", "diriger": "dirigir", "gouverner": "gobernar",
  "régner": "reinar", "juger": "juzgar", "condamner": "condenar",
  "pardonner": "perdonar", "aider": "ayudar", "servir": "servir",
  "utiliser": "usar", "manquer": "faltar / echar de menos",
  "jouer": "jugar", "pêcher": "pecar / pescar",
  "semer": "sembrar", "récolter": "cosechar",
  "moissonner": "cosechar", "labourer": "arar", "planter": "plantar",
  "arroser": "regar", "couler": "fluir / correr (líquido)",
  "brûler": "quemar / arder", "éteindre": "apagar", "allumer": "encender",
  "éclairer": "iluminar", "briller": "brillar", "luire": "brillar",
  "se lever": "levantarse", "éveiller": "despertar", "réveiller": "despertar",
  "se repentir": "arrepentirse", "se convertir": "convertirse",
  "s'approcher": "acercarse", "s'éloigner": "alejarse",
  "s'asseoir": "sentarse", "se coucher": "acostarse", "se taire": "callarse",
  "se rencontrer": "encontrarse",
  "constater": "constatar / comprobar",
  "séparer": "separar", "réaliser": "realizar / darse cuenta",
  "rassembler": "reunir", "ajouter": "añadir", "placer": "colocar / poner",
  "produire": "producir", "paraître": "aparecer", "paraitre": "aparecer",
  "apparaître": "aparecer", "pousser": "crecer / empujar",
  "présider": "presidir", "déterminer": "determinar",
  "mouvoir": "mover", "peupler": "poblar", "siéger": "sentarse",
  "couvrir": "cubrir", "déplacer": "mover / desplazar",
  "s'envoler": "alzar el vuelo / volar", "envoler": "alzar el vuelo / volar",
  "dominer": "dominar", "envahir": "invadir", "recouvrir": "cubrir",
  "envelopper": "envolver", "faufiler": "deslizarse / colarse",
};

// Common French nouns -> Spanish (port of _COMMON_NOUNS).
const _COMMON_NOUNS = {
  "commencement": "comienzo / principio", "forme": "forma",
  "obscurité": "oscuridad", "abîme": "abismo", "océan": "océano",
  "surface": "superficie", "eau": "agua", "voûte": "bóveda",
  "fête": "fiesta", "année": "año", "source": "fuente / manantial",
  "étoile": "estrella", "monstre": "monstruo", "animal": "animal",
  "bête": "bestia / animal", "enfant": "niño / hijo", "oisau": "pájaro",
  "oiseau": "pájaro / ave", "graine": "semilla", "pépin": "pepita",
  "noyau": "hueso / núcleo", "semence": "semilla", "fruit": "fruto",
  "arbre": "árbol", "herbe": "hierba", "plante": "planta",
  "mois": "mes", "jour": "día", "soir": "tarde / noche", "matin": "mañana",
  "lumière": "luz", "mère": "madre", "père": "padre", "frère": "hermano",
  "sœur": "hermana", "fils": "hijo", "fille": "hija", "famille": "familia",
  "créature": "criatura", "être": "ser", "espèce": "especie",
  "terre": "tierra", "peuple": "pueblo", "tribu": "tribu",
  "nation": "nación", "roi": "rey", "temple": "templo", "autel": "altar",
  "sacrifice": "sacrificio", "péché": "pecado", "salut": "salvación",
  "promesse": "promesa", "alliance": "alianza", "loi": "ley",
  "prophétie": "profecía", "évangile": "evangelio", "apôtre": "apóstol",
  "église": "iglesia", "parole": "palabra", "Dieu": "Dios",
  "ciel": "cielo", "mer": "mar", "rivière": "río", "désert": "desierto",
  "montagne": "montaña", "colline": "colina", "vallée": "valle",
  "pierre": "piedra", "rocher": "roca", "or": "oro", "argent": "plata",
  "fer": "hierro", "cuivre": "cobre", "blé": "trigo", "pain": "pan",
  "haut": "altura / alto", "os": "hueso", "sang": "sangre",
  "corps": "cuerpo", "esprit": "espíritu", "crainte": "temor",
  "espérance": "esperanza", "chagrin": "tristeza", "force": "fuerza",
  "sagesse": "sabiduría", "connaissance": "conocimiento",
  "puissance": "poder", "gloire": "gloria", "honneur": "honor",
  "paix": "paz", "joie": "alegría", "amour": "amor", "haine": "odio",
  "miséricorde": "misericordia", "bonté": "bondad", "vérité": "verdad",
  "mensonge": "mentira", "mort": "muerte", "vie": "vida", "royaume": "reino",
  "œuvre": "obra", "main": "mano", "pied": "pie", "yeux": "ojos",
  "cœur": "corazón", "voix": "voz", "visage": "rostro",
};

// Common adjectives, ordinals, misc words and remaining nouns (port of _EXTRA_WORDS).
const _EXTRA_WORDS = {
  "premier": "primero", "première": "primera", "premiers": "primeros",
  "deuxième": "segundo", "second": "segundo", "seconde": "segunda",
  "troisième": "tercero", "quatrième": "cuarto", "cinquième": "quinto",
  "sixième": "sexto", "septième": "séptimo", "huitième": "octavo",
  "dernier": "último", "dernière": "última", "principal": "principal",
  "principale": "principal", "principales": "principales",
  "vivant": "vivo", "vivante": "viva", "vivants": "vivos",
  "domestique": "doméstico", "domestiques": "domésticos",
  "divers": "diverso", "diverse": "diversa", "diverses": "diversas",
  "vert": "verde", "verte": "verde", "terrestre": "terrestre",
  "terrestres": "terrestres", "ressemblant": "parecido",
  "ressemblante": "parecida", "gros": "grande / gordo",
  "nombreux": "numerosos", "nombreuse": "numerosa",
  "propre": "propio / limpio", "propres": "propios",
  "unique": "único", "chaque": "cada", "même": "mismo / incluso",
  "mêmes": "mismos", "seul": "solo", "seule": "sola", "seulement": "solamente",
  "très": "muy", "aussi": "también / tan", "encore": "todavía / aún",
  "toujours": "siempre", "jamais": "nunca", "souvent": "a menudo",
  "déjà": "ya", "pas": "no", "ne": "no", "plus": "más", "moins": "menos",
  "bien": "bien", "mal": "mal", "parce": "porque",
  "parce que": "porque", "puis": "luego / después", "ensuite": "después",
  "ainsi": "así / de este modo", "alors": "entonces", "donc": "por tanto",
  "enfin": "por fin / finalmente", "bref": "en resumen", "ras": "ras / raso / plano",
  "lieu": "lugar", "lieux": "lugares", "endroit": "lugar / sitio",
  "comme": "como",
  "vraiment": "realmente / de verdad", "cela": "eso / aquello",
  "ça": "eso", "voilà": "he aquí", "voici": "he aquí",
  "deux": "dos", "trois": "tres", "quatre": "cuatro", "cinq": "cinco",
  "lui-même": "él mismo", "elle-même": "ella misma", "eux-mêmes": "ellos mismos",
  "au-dessus": "por encima / arriba", "au-dessous": "por debajo / abajo",
  "au-dedans": "dentro", "au-dehors": "fuera", "dessous": "debajo",
  "dessus": "encima", "autour": "alrededor", "ensemble": "juntos / conjunto",
  "presque": "casi", "autant": "tanto",
  "tant": "tanto", "tellement": "tanto", "cependant": "sin embargo",
  "pourtant": "sin embargo", "néanmoins": "no obstante",
  "d'ailleurs": "por otra parte", "végétation": "vegetación",
  "foule": "multitud / muchedumbre", "journée": "día / jornada",
  "variété": "variedad", "humain": "humano", "humaine": "humana",
  "humains": "humanos", "oiseau": "pájaro / ave", "oiseaux": "pájaros / aves",
  "animal": "animal", "animaux": "animales", "marin": "marino",
  "marins": "marinos", "onde": "ola / agua", "fruitier": "frutal",
  "fruitiers": "frutales", "graine": "semilla", "graines": "semillas",
  "pépin": "pepita", "pépins": "pepitas", "noyau": "hueso / núcleo",
  "noyaux": "huesos / núcleos", "plante": "planta", "plantes": "plantas",
  "herbe": "hierba", "herbes": "hierbas", "branche": "rama",
  "branches": "ramas", "racine": "raíz", "racines": "raíces",
  "feuille": "hoja", "feuilles": "hojas", "trône": "trono",
  "sceptre": "cetro", "couronne": "corona", "chef": "jefe / cabeza",
  "chefs": "jefes", "armée": "ejército", "armées": "ejércitos",
  "soldat": "soldado", "soldats": "soldados", "épée": "espada",
  "bouclier": "escudo", "lance": "lanza", "arc": "arco", "flèche": "flecha",
  "ville": "ciudad", "villes": "ciudades", "village": "aldea",
  "villageois": "aldeanos", "chemin": "camino", "sentier": "sendero",
  "porte": "puerta", "portes": "puertas", "mur": "muro", "murs": "muros",
  "tour": "torre", "chambre": "habitación", "lit": "cama", "table": "mesa",
  "chaise": "silla", "robe": "vestido", "vêtement": "vestido / ropa",
  "vêtements": "ropa", "habit": "traje", "chaussure": "zapato",
  "manteau": "abrazo / capa", "bâton": "bastón",
  "bâtons": "bastones", "pierre": "piedra", "pierres": "piedras",
  "or": "oro", "argent": "plata / dinero", "perle": "perla",
  "joyau": "joya", "trésor": "tesoro", "trésors": "tesoros",
  "don": "regalo / don", "dons": "regalos", "cadeau": "regalo",
  "présent": "regalo / presente", "offrande": "ofrenda",
  "cultivateur": "agricultor", "berger": "pastor", "bergers": "pastores",
  "pêcheur": "pescador / pecador", "pêcheurs": "pescadores",
  "voyage": "viaje", "voyages": "viajes", "voyageur": "viajero",
  "nomade": "nómada", "étranger": "extranjero", "étrangers": "extranjeros",
  "hôte": "huésped", "invité": "invitado", "invités": "invitados",
  "témoin": "testigo", "témoins": "testigos", "missionnaire": "misionero",
  "envoyé": "enviado", "héros": "héroe", "héritier": "heredero",
  "esclave": "esclavo", "esclaves": "esclavos", "pharaon": "faraón",
  "césar": "césar", "gouverneur": "gobernador", "judge": "juez",
  "juge": "juez", "juges": "jueces", "avocat": "abogado",
  "meurtrier": "asesino", "lièvre": "liebre", "tortue": "tortuga",
  "serpent": "serpiente", "serpents": "serpientes", "colombe": "paloma",
  "colombes": "palomas", "corbeau": "cuervo", "aigle": "águila",
  "pigeon": "paloma", "lion": "león", "lions": "leones", "lionne": "leona",
  "ours": "oso", "loup": "lobo", "loups": "lobos", "renard": "zorro",
  "cheval": "caballo", "chevaux": "caballos", "âne": "asno", "ânes": "asnos",
  "brebis": "oveja", "mouton": "oveja / carnero", "moutons": "ovejas",
  "agneau": "cordero", "agneaux": "corderos", "chèvre": "cabra",
  "vache": "vaca", "boeuf": "buey", "bœuf": "buey", "taureau": "toro",
  "chameau": "camello", "chameaux": "camellos", "chacal": "chacal",
  "souris": "ratón", "chat": "gato", "chien": "perro", "chiens": "perros",
  "abeille": "abeja", "fourmi": "hormiga", "mouche": "mosca",
  "sauterelle": "langosta", "sauterelles": "langostas", "criquet": "langosta",
  "ver": "lombriz / gusano", "vers": "alta / gusano", "miel": "miel",
  "lait": "leche", "beurre": "mantequilla", "fromage": "queso",
  "viande": "carne", "sel": "sal", "sucre": "azúcar", "huile": "aceite",
  "vinaigre": "vinagre", "blé": "trigo", "orge": "cebada",
  "raisin": "uva", "raisins": "uvas", "vigne": "vid", "vignes": "vides",
  "figue": "higo", "olive": "aceituna", "oleifère": "oleífero",
  "grenade": "granada", "pomme": "manzana", "pomme de terre": "patata",
  "maison": "casa", "maisons": "casas", "cuisine": "cocina", "jardin": "jardín",
  "champ": "campo",
  "champs": "campos", "vigne": "vid", "raison": "razón",
  "temps": "tiempo", "moment": "momento", "instant": "instante",
  "heure": "hora", "heures": "horas", "minute": "minuto", "seconde": "segundo",
  "semaine": "semana", "semaines": "semanas", "mois": "mes", "saison": "estación",
  "printemps": "primavera", "été": "verano", "automne": "otoño",
  "hiver": "invierno", "matin": "mañana", "matins": "mañanas",
  "soir": "tarde / noche", "soirée": "tarde / velada", "nuit": "noche",
  "nuits": "noches", "aube": "alba", "crépuscule": "crepúsculo",
  "minuit": "medianoche", "midi": "mediodía", "zéro": "cero",
  "un": "uno", "deux": "dos", "trois": "tres", "quatre": "cuatro",
  "cinq": "cinco", "six": "seis", "sept": "siete", "huit": "ocho",
  "neuf": "nueve", "dix": "diez", "cent": "cien", "mille": "mil",
  "quoi": "qué", "pourquoi": "por qué", "combien": "cuánto",
  "comment": "cómo", "où": "dónde / donde", "quand": "cuándo / cuando",
  "qui": "quién / que", "que": "qué / que", "quel": "cuál / qué",
  "quelle": "cuál / qué", "celui": "ese / aquel", "celle": "esa / aquella",
  "ceux": "esos / aquellos", "celles": "esas / aquellas",
  "quelqu'un": "alguien", "quelque chose": "algo", "quelque": "algún",
  "quelques": "unos / algunos", "personne": "persona / nadie",
  "rien": "nada", "tout monde": "todo el mundo", "toute": "toda",
  "leçon": "lección", "exemple": "ejemplo", "exemples": "ejemplos",
  "grâce": "gracia", "grâces": "gracias", "faute": "falta / culpa",
  "fautes": "faltas", "voiture": "coche", "route": "ruta / camino",
  "routes": "rutas", "pont": "puente", "ponts": "puentes",
  "château": "castillo", "châteaux": "castillos", "palais": "palacio",
  "maison de Dieu": "casa de Dios", "tournoi": "torneo",
};

// ---- grammar: irregular verbs -> (infinitive, tense) ----------------------
const _VERB_IRREGULAR = {
  "est": ["être", "présent 3sg"], "sont": ["être", "présent 3pl"],
  "suis": ["être", "présent 1sg"], "es": ["être", "présent 2sg"],
  "êtes": ["être", "présent 2pl"], "étais": ["être", "imparfait 1/2sg"],
  "était": ["être", "imparfait 3sg"], "étaient": ["être", "imparfait 3pl"],
  "sera": ["être", "futur 3sg"], "fut": ["être", "passé simple 3sg"],
  "soit": ["être", "subjonctif 3sg"],
  "soient": ["être", "subjonctif 3pl"], "soyons": ["être", "impératif 1pl"],
  "soyez": ["être", "impératif 2pl"],
  "a": ["avoir", "présent 3sg"], "ont": ["avoir", "présent 3pl"],
  "ai": ["avoir", "présent 1sg"], "as": ["avoir", "présent 2sg"],
  "avait": ["avoir", "imparfait 3sg"], "avaient": ["avoir", "imparfait 3pl"],
  "aura": ["avoir", "futur 3sg"], "eut": ["avoir", "passé simple 3sg"],
  "ait": ["avoir", "subjonctif 3sg"], "aient": ["avoir", "subjonctif 3pl"],
  "fit": ["faire", "passé simple 3sg"], "faisait": ["faire", "imparfait 3sg"],
  "faisons": ["faire", "présent 1pl"], "faites": ["faire", "présent 2pl"],
  "fera": ["faire", "futur 3sg"], "fasse": ["faire", "subjonctif 3sg"],
  "faisant": ["faire", "participe présent"],
  "alla": ["aller", "passé simple 3sg"], "allait": ["aller", "imparfait 3sg"],
  "ira": ["aller", "futur 3sg"], "vont": ["aller", "présent 3pl"],
  "vint": ["venir", "passé simple 3sg"], "viendra": ["venir", "futur 3sg"],
  "vient": ["venir", "présent 3sg"], "venait": ["venir", "imparfait 3sg"],
  "venez": ["venir", "présent 2pl"], "devenez": ["devenir", "présent 2pl"],
  "devint": ["devenir", "passé simple 3sg"], "deviendra": ["devenir", "futur 3sg"],
  "revint": ["revenir", "passé simple 3sg"],
  "dit": ["dire", "passé simple 3sg"], "disait": ["dire", "imparfait 3sg"],
  "dira": ["dire", "futur 3sg"], "disant": ["dire", "participe présent"],
  "disent": ["dire", "présent 3pl"], "dis": ["dire", "présent 1sg/impératif"],
  "vit": ["voir", "passé simple 3sg"], "voit": ["voir", "présent 3sg"],
  "verra": ["voir", "futur 3sg"], "voyait": ["voir", "imparfait 3sg"],
  "voient": ["voir", "présent 3pl"], "voyant": ["voir", "participe présent"],
  "pu": ["pouvoir", "participe passé"], "peut": ["pouvoir", "présent 3sg"],
  "pouvait": ["pouvoir", "imparfait 3sg"], "pourra": ["pouvoir", "futur 3sg"],
  "prit": ["prendre", "passé simple 3sg"], "pris": ["prendre", "participe"],
  "prend": ["prendre", "présent 3sg"], "prennent": ["prendre", "présent 3pl"],
  "met": ["mettre", "présent 3sg"], "mit": ["mettre", "passé simple 3sg"],
  "mettra": ["mettre", "futur 3sg"], "mis": ["mettre", "participe"],
  "croit": ["croire", "présent 3sg"], "croira": ["croire", "futur 3sg"],
  "sait": ["savoir", "présent 3sg"], "savait": ["savoir", "imparfait 3sg"],
  "saura": ["savoir", "futur 3sg"], "su": ["savoir", "participe"],
  "veut": ["vouloir", "présent 3sg"], "voulait": ["vouloir", "imparfait 3sg"],
  "voudra": ["vouloir", "futur 3sg"], "veulent": ["vouloir", "présent 3pl"],
  "doit": ["devoir", "présent 3sg"], "devait": ["devoir", "imparfait 3sg"],
  "devra": ["devoir", "futur 3sg"], "doivent": ["devoir", "présent 3pl"],
  "couvrait": ["couvrir", "imparfait 3sg"], "couvre": ["couvrir", "présent 3sg"],
  "couvrira": ["couvrir", "futur 3sg"],
  "déplaçait": ["déplacer", "imparfait 3sg"], "déplace": ["déplacer", "présent 3sg"],
  "déplaça": ["déplacer", "passé simple 3sg"],
  "paraît": ["paraître", "présent 3sg"], "parut": ["paraître", "passé simple 3sg"],
  "paraisse": ["paraître", "subjonctif 3sg"], "paraîtra": ["paraître", "futur 3sg"],
  "produit": ["produire", "participe passé / 3sg"],
  "produise": ["produire", "subjonctif 3sg"],
  "produisant": ["produire", "participe présent"],
  "serve": ["servir", "subjonctif 3sg"], "servent": ["servir", "présent 3pl"],
  "servait": ["servir", "imparfait 3sg"], "servira": ["servir", "futur 3sg"],
  "serviront": ["servir", "futur 3pl"],
  "bénit": ["bénir", "passé simple 3sg"], "bénira": ["bénir", "futur 3sg"],
  "bénissaient": ["bénir", "imparfait 3pl"],
  "meuvent": ["mouvoir", "présent 3pl"], "meut": ["mouvoir", "présent 3sg"],
  "donne": ["donner", "présent 3sg"], "donna": ["donner", "passé simple 3sg"],
  "donnera": ["donner", "futur 3sg"], "domna": ["donner", "futur 3sg"],
  "multiplie": ["multiplier", "présent 3sg"],
  "multiplient": ["multiplier", "présent 3pl"],
  "sépare": ["séparer", "présent 3sg"], "sépara": ["séparer", "passé simple 3sg"],
  "existe": ["exister", "présent 3sg"],
};

// -er conjugation suffixes -> tense (ordered longest-first; port of _ER_RULES).
const _ER_RULES = [
  ["ées$", "participle f. pl"], ["és$", "participle m. pl"],
  ["ée$", "participle f. sg"], ["é$", "past participle"],
  ["eront$", "futur 3pl"], ["erons$", "futur 1pl"],
  ["erez$", "futur 2pl"], ["eras$", "futur 2sg"],
  ["era$", "futur 3sg"], ["erai$", "futur 1sg"],
  ["aient$", "imparfait 3pl"], ["iez$", "imparfait 2pl"],
  ["ions$", "imparfait 1pl"], ["ait$", "imparfait 3sg"],
  ["ais$", "imparfait 1/2sg"],
  ["èrent$", "passé simple 3pl"], ["âtes$", "passé simple 2pl"],
  ["âmes$", "passé simple 1pl"], ["à$", "passé simple 3sg"],
  ["â$", "passé simple 3sg"],
  ["ons$", "présent 1pl"], ["ez$", "présent 2pl"],
  ["ent$", "présent 3pl"],
];

// -ir rules (port of _IR_RULES).
const _IR_RULES = [
  ["issant$", "participle"], ["ie?nt$", "présent 3pl"],
  ["issons$", "présent 1pl"], ["issez$", "présent 2pl"],
  ["it$", "présent/ passé simple 3sg"],
];

function _stripElisions(word) {
  return word.replace(/[’']/g, "");
}

function verbInfinitive(word) {
  const w = _stripElisions(word).toLowerCase();
  if (_VERB_IRREGULAR[w]) {
    return _VERB_IRREGULAR[w].slice();
  }
  // -er verbs
  for (const [re, tense] of _ER_RULES) {
    const m = new RegExp(re).exec(w);
    if (m) {
      const base = w.slice(0, m.index);
      if (base) return [base + "er", tense];
    }
  }
  // -ir verbs
  if (w.endsWith("it") && w.length > 4) {
    const base = w.slice(0, -2);
    if (base && /[lnr]$/.test(base)) return [null, null];
    return [base + "ir", "présent 3sg"];
  }
  return [null, null];
}

// ---- friendly explanations of tense / form labels -------------------------
const _TENSE_FR = {
  "présent": "presente (algo que ocurre ahora)",
  "imparfait": "pasado incompleto (describía hábitos o acciones en curso)",
  "passé simple": "pasado simple (una acción concreta y terminada)",
  "futur": "futuro (ocurrirá)",
  "subjonctif": "subjuntivo (deseo, duda o emoción)",
  "impératif": "imperativo (una orden)",
};

const _PARTICIPLE_FR = {
  "past participle": "participio pasado («-ado / -ido»)",
  "participe": "participio",
  "participle": "participio",
  "participe passé": "participio pasado («-ado / -ido»)",
  "participle f. sg": "participio pasado, femenino singular («-ada»)",
  "participle m. pl": "participio pasado, masculino plural («-ados»)",
  "participle f. pl": "participio pasado, femenino plural («-adas»)",
  "participe présent": "participio presente («-ando / -iendo»)",
  "participle présent": "participio presente («-ando / -iendo»)",
};

const _PERSON_FR = {
  "1sg": "1.ª persona del singular (yo)",
  "2sg": "2.ª persona del singular (tú)",
  "3sg": "3.ª persona del singular (él / ella)",
  "1pl": "1.ª persona del plural (nosotros / nosotras)",
  "2pl": "2.ª persona del plural (ustedes)",
  "3pl": "3.ª persona del plural (ellos / ellas)",
  "1/2sg": "1.ª o 2.ª persona del singular (yo / tú)",
};

function friendlyTense(label) {
  if (!label) return "";
  label = String(label).trim();
  let person = "";
  const m = label.match(/\b(1\/2sg|1sg|2sg|3sg|1pl|2pl|3pl)\b/);
  if (m) {
    person = _PERSON_FR[m[1]] || m[1];
    label = label.slice(0, m.index) + label.slice(m.index + m[0].length);
  }
  label = label.trim().replace(/^[,;\·\/\s]+|[,;\·\/\s]+$/g, "");
  const names = [];
  for (const part of label.split("/")) {
    const p = part.trim();
    if (!p) continue;
    const low = p.toLowerCase();
    if (_PARTICIPLE_FR[low]) names.push(_PARTICIPLE_FR[low]);
    else if (_TENSE_FR[low]) names.push(_TENSE_FR[low]);
    else names.push(p);
  }
  let text = names.length ? names.join(" o ") : label;
  if (person) text = text ? `${text} · ${person}` : person;
  return text;
}

function friendlyForm(label) {
  if (!label) return "";
  label = String(label).trim();
  let m = label.match(/^plural de «(.+)»$/);
  if (m) {
    return `es el plural de «${m[1]}» — se refiere a varias personas o cosas`;
  }
  m = label.match(/^«(.+)-…»\s*\(forma compuesta\)$/);
  if (m) {
    return `es una forma compuesta: el verbo «${m[1]}» con un pronombre unido (p. ej. «${m[1]}-la» = «${m[1]}» + «la»)`;
  }
  return label;
}

// ---- Dictionary class -----------------------------------------------------
class Dictionary {
  constructor(map) {
    this._map = map;
    // layer curated overlays (mirroring the python __init__ merge)
    for (const [key, val] of Object.entries(_CURATED)) {
      const k = normalize(key);
      if (!this._map[k]) this._map[k] = [];
      if (val && !this._map[k].includes(val)) this._map[k].push(val);
    }
    for (const [key, val] of Object.entries(_COMMON_VERBS)) {
      const k = normalize(key);
      if (!this._map[k]) this._map[k] = [];
      if (val && !this._map[k].includes(val)) this._map[k].push(val);
    }
    for (const [key, val] of Object.entries(_COMMON_NOUNS)) {
      const k = normalize(key);
      if (!this._map[k]) this._map[k] = [];
      if (val && !this._map[k].includes(val)) this._map[k].push(val);
    }
    for (const [key, val] of Object.entries(_EXTRA_WORDS)) {
      const k = normalize(key);
      if (!this._map[k]) this._map[k] = [];
      if (val && !this._map[k].includes(val)) this._map[k].push(val);
    }
  }

  lookup(word) {
    const arr = this._map[normalize(word)];
    return arr ? arr.slice() : null;
  }

  static _singular(word) {
    const low = word.toLowerCase();
    if (low.endsWith("eaux")) return word.slice(0, -1);
    if (low.endsWith("aux")) return word.slice(0, -3) + "al";
    if (low.endsWith("oux")) return word.slice(0, -3) + "ou";
    if (low.endsWith("eux")) {
      if (low === "yeux") return "oeil";
      return word.slice(0, -3) + "eu";
    }
    if (low.endsWith("s") && !/(ss|us|is|as|os)$/.test(low)) return word.slice(0, -1);
    if (low.endsWith("x") && !/(aux|eaux|oux|eux)$/.test(low)) return word.slice(0, -1);
    return word;
  }

  resolve(word) {
    const info = {};
    // strip elided contractions (l', d', n', s', qu', jusqu', etc.)
    const elide = /^(?:qu|jusqu|lorsqu|puisqu|quoiqu|aujourd|[ldqnsjcmt])’/i;
    let candidates = [word];
    const m = elide.exec(word);
    if (m) candidates.push(word.slice(m[0].length));
    for (const cand of candidates) {
      const res = this._tryDirect(cand, info);
      if (res) return res;
      const [inf, tense] = verbInfinitive(cand);
      if (inf) {
        const meanings = this.lookup(inf);
        if (meanings) {
          info.infinitive = inf;
          info.tense = tense || "";
          return [meanings, info];
        }
      }
    }
    // hyphenated forms (impératif + pronom, e.g. "dominez-la")
    if (word.includes("-")) {
      const left = word.split("-")[0];
      const [m2, info2] = this.resolve(left);
      if (m2) {
        info.form = `«${left}-…» (forma compuesta)`;
        Object.assign(info, info2);
        return [m2, info];
      }
    }
    // accent-stripped fallback
    for (const variant of [word, m ? word.slice(m[0].length) : word]) {
      const variants = [normalize(variant), variant.charAt(0).toUpperCase() + variant.slice(1),
                        normalize(variant.charAt(0).toUpperCase() + variant.slice(1))];
      for (const v2 of variants) {
        const meanings = this.lookup(v2);
        if (meanings) return [meanings, info];
      }
    }
    return [null, info];
  }

  _tryDirect(cand, info) {
    const m = this.lookup(cand);
    if (m) return [m, info];
    const sing = Dictionary._singular(cand);
    if (sing !== cand) {
      const meanings = this.lookup(sing);
      if (meanings) {
        info.form = `plural de «${sing}»`;
        return [meanings, info];
      }
    }
    return null;
  }

  segment(text) {
    const words = [];
    for (const tok of text.split(/\s+/)) {
      const w = tok.replace(/^[.,;:!?«»"'’\[\]()*–—]+|[.,;:!?«»"'’\[\]()*–—]+$/g, "");
      if (w && !/^\d+$/.test(w)) words.push(w);
    }
    const out = [];
    let i = 0;
    while (i < words.length) {
      let best = null;
      for (let length = words.length - i; length > 1; length--) {
        const cand = words.slice(i, i + length).join(" ");
        const [m, info] = this.resolve(cand);
        if (m) { best = [length, cand, m, info]; break; }
      }
      if (best) {
        out.push([best[1], best[2], best[3]]);
        i += best[0];
      } else {
        const cand = words[i];
        const [m, info] = this.resolve(cand);
        out.push([cand, m, info]);
        i += 1;
      }
    }
    return out;
  }
}

export { Dictionary, normalize, friendlyTense, friendlyForm };
