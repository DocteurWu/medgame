// scripts/convert_ecos_canonical.mjs
// Conversion et enrichissement des cas MedGame vers la norme canonique ECOS (Jev + DeepSeek).
// REGLE FONDAMENTALE : NE RIEN SUPPRIMER. Enrichissement additif uniquement.
// Contraintes : aucun emoji, aucun tiret cadratin (U+2014), JSON valide, francais rigoureux.
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const EXCLUDE = new Set([
  "REFERENCE_ECOS_CANONICAL.json",
  "case-index.json",
  "patient_test_complet.json",
  "test_gating.json",
  "auscultation-database.js",
  "auscultation-sounds.js",
  "ecg-database.js",
  "pcg-trainer-database.js",
  "credits.js",
  "gds-cases.js",
  "drugs.json",
]);

const EMOJI_RE = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
const CADRATIN_RE = /[\u2014\u2013]/g;

function sanitizeString(s) {
  if (typeof s !== "string") return s;
  // Contraintes fichier : suppression des emojis et remplacement du tiret
  // cadratin (U+2014/U+2013) par un trait d'union. Aucune autre alteration
  // (ni trim ni normalisation d'espaces) afin de preserver les donnees
  // cliniques existantes a l'identique.
  let out = s.replace(EMOJI_RE, "");
  out = out.replace(CADRATIN_RE, "-");
  return out;
}

function deepSanitize(value) {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map(deepSanitize);
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) value[k] = deepSanitize(value[k]);
    return value;
  }
  return value;
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null) return [];
  return [v];
}

function firstDiag(c) {
  const d = c.correctDiagnostic;
  if (Array.isArray(d)) return String(d[0] || "le diagnostic retenu");
  if (typeof d === "string" && d.trim()) return d.trim();
  return "le diagnostic retenu";
}

function motifOf(c) {
  return (
    c.motif ||
    c?.interrogatoire?.motifHospitalisation ||
    c?.ecos?.titre ||
    "le motif de consultation"
  );
}

function examsOf(c) {
  const a = asArray(c.availableExams).map(String);
  const r = asArray(c.relevantExams).map(String);
  const keys = c.examResults && typeof c.examResults === "object" ? Object.keys(c.examResults) : [];
  return { available: a, relevant: r, resultsKeys: keys };
}

function treatsOf(c) {
  return {
    correct: asArray(c.correctTreatments).map(String),
    fatal: asArray(c.fatalTreatments).map(String),
    possible: asArray(c.possibleTreatments).map(String),
  };
}

function patientName(c) {
  const p = c.patient || {};
  const prenom = p.prenom || "le patient";
  const nom = p.nom || "";
  const age = p.age ?? "?";
  const sexe = p.sexe || "M";
  return { prenom, nom, age, sexe };
}

// ---------- Criteres Jev ----------

function criteriaForClinique(item, ctx) {
  const label = String(item.label || item.id || "competence clinique");
  const id = String(item.id || "");
  const diag = ctx.diag;
  const motif = ctx.motif;
  const keyExams = ctx.relevant.length > 0 ? ctx.relevant.slice(0, 3).join(", ") : ctx.available.slice(0, 3).join(", ");
  const keyTreat = ctx.correctTreats.length > 0 ? ctx.correctTreats.slice(0, 2).join(" et ") : "le traitement adapte";

  const L = (id + " " + label).toLowerCase();

  function mk(fait, en_partie, non_fait) {
    return { fait, en_partie, non_fait };
  }

  if (L.includes("accueil") || L.includes("presentation") || L.includes("installe")) {
    return mk(
      "Salue le patient avec courtoisie, donne son nom et son statut, verifie l'identite et installe confortablement le patient avant de commencer.",
      "Salue le patient mais omet de donner son nom, son statut ou de verifier l'installation.",
      "Debute l'interrogatoire sans salutation ni presentation."
    );
  }
  if (L.includes("douleur") || L.includes("plainte") || L.includes("pqrst") || L.includes("semiolog") || L.includes("caracterise") || L.includes("histoire")) {
    return mk(
      `Explore systematiquement la plainte liee a (${motif}) : siege, type, irradiation, intensite, duree, facteurs declenchants et calmants, en lien avec l'hypothese de (${diag}).`,
      "Aborde le siege et un facteur declenchant mais omet le type, la duree ou les facteurs calmants.",
      "Se contente d'une question vague sans caracterisation semiologique utilisable."
    );
  }
  if (L.includes("facteur") || L.includes("risque") || L.includes("antecedent") || L.includes("terrain") || L.includes("fdrcv")) {
    return mk(
      "Recherche activement les antecedents medicaux, chirurgicaux et familiaux, le terrain a risque et les facteurs de risque pertinents pour ce motif.",
      "Recherche un ou deux antecedents sans explorer le terrain familial ni les autres facteurs de risque.",
      "Aucune recherche des antecedents ni des facteurs de risque."
    );
  }
  if (L.includes("associe") || L.includes("accompagnement") || L.includes("gravite") || L.includes("instabil") || L.includes("signe")) {
    return mk(
      "Recherche formellement les signes associes et les criteres de gravite ou d'instabilite (retentissement, signes generaux, drapeaux rouges du motif).",
      "Interroge un signe associe mais ne verifie pas les criteres de gravite ni l'instabilite.",
      "Ne recherche aucun signe associe ni aucun critere de gravite."
    );
  }
  if (L.includes("traitement") && (L.includes("inventaire") || L.includes("allergie") || L.includes("observance") || L.includes("medicament") || L.includes("recueille"))) {
    return mk(
      "Recueille la liste exacte des traitements en cours, verifie l'observance reelle et interroge les allergies medicamenteuses.",
      "Cite un traitement sans verifier l'observance ni les allergies.",
      "Ne pose aucune question sur les traitements ni les allergies."
    );
  }
  if (L.includes("constante") || L.includes("vitale") || L.includes("mesure") || L.includes("ta,") || L.includes("saturation")) {
    return mk(
      "Mesure et interprete les constantes de securite : pression arterielle, frequence cardiaque, saturation en oxygene, frequence respiratoire et temperature.",
      "Prend une seule constante (par exemple la tension) sans controler le pouls ni l'oxygenation.",
      "N'effectue aucune prise de constantes vitales."
    );
  }
  if (L.includes("pulmonaire") || L.includes("pleuro") || L.includes("respiratoire") || L.includes("auscultation pulmonaire")) {
    return mk(
      "Realise une auscultation pulmonaire bilaterale et symetrique et recherche les bruits surajoutes en lien avec le motif.",
      "Auscultation rapide ou incomplete sans comparaison des deux champs.",
      "Omet completement l'auscultation pulmonaire."
    );
  }
  if (L.includes("cardio") || L.includes("vasculaire") || L.includes("pouls") || L.includes("coeur")) {
    return mk(
      "Realise un examen cardiovasculaire cible : auscultation cardiaque, palpation des pouls peripheriques et recherche de signes d'insuffisance cardiaque.",
      "Ausculte le coeur mais omet les pouls peripheriques ou la recherche d'oedemes.",
      "Aucun examen cardiovasculaire realise."
    );
  }
  if (L.includes("neurolog") || L.includes("moteur") || L.includes("sensibil") || L.includes("reflexe") || L.includes("nihss") || L.includes("glasgow") || L.includes("examen physique") || L.includes("examen clinique") || L.includes("examen")) {
    return mk(
      "Realise un examen physique cible et complet adapte au motif : inspection, palpation, manoeuvres et echelles validees si indiquees, avec consignation des resultats.",
      "Examen partiel ou superficiel, sans manoeuvre discriminante ni echelle validee.",
      "Aucun examen physique realise."
    );
  }
  if (L.includes("strateg") || L.includes("paraclin") || L.includes("diagnostique") || L.includes("examen complementaire") || L.includes("ecg") || L.includes("imagerie") || L.includes("bilan")) {
    return mk(
      `Prescrit une strategie paraclinique de premiere intention coherente avec (${diag}) : (${keyExams}), en justifiant chaque examen et en evitant les examens invasifs d'emblee.`,
      "Prescrit un examen pertinent isole sans strategie d'ensemble ni justification.",
      "Ne prescrit aucun examen pertinent ou prescrit d'emblee un examen invasif non indique."
    );
  }
  if (L.includes("enonce") || L.includes("diagnostic") || L.includes("hypothese") || L.includes("synthese") || L.includes("explique") && L.includes("situation")) {
    return mk(
      `Enonce clairement l'hypothese de (${diag}), l'explique en termes simples et la relie aux arguments cliniques et paracliniques du dossier.`,
      "Mentionne une hypothese diagnostique sans explication ni lien avec les arguments du dossier.",
      "Ne propose aucune synthese diagnostique ou retient un diagnostic incompatible avec le tableau."
    );
  }
  if (L.includes("propose un traitement") || L.includes("therapeutique") || L.includes("ordonnance") || L.includes("prise en charge therapeutique") || (L.includes("traitement") && !L.includes("inventaire"))) {
    return mk(
      `Propose un plan therapeutique adapte a (${diag}) incluant (${keyTreat}), en precisant posologie, duree et contre-indications verifiees.`,
      "Evoque un traitement sans precision de posologie, de duree ni de contre-indications.",
      "Ne propose aucune prise en charge therapeutique ou propose un traitement contre-indique."
    );
  }
  if (L.includes("educ") || L.includes("alerte") || L.includes("consigne") || L.includes("securite") || L.includes("urgence") || L.includes("15") || L.includes("samu")) {
    return mk(
      "Donne des consignes de securite explicites : signes d'alerte a surveiller, conduite a tenir et recours aux urgences (appel au 15) si aggravation.",
      "Donne une consigne d'alerte vague sans conduite pratique ni recours precise.",
      "Ne donne aucune consigne de securite ni aucun signe d'alerte."
    );
  }
  if (L.includes("prevention") || L.includes("hygieno") || L.includes("mode de vie") || L.includes("suivi")) {
    return mk(
      "Aborde la prevention secondaire et le suivi : regles hygieno-dietetiques, controle des facteurs de risque et planification du suivi.",
      "Mentionne le suivi de facon formelle sans conseil concret sur le mode de vie.",
      "Aucun conseil de prevention ni de suivi."
    );
  }
  // Generique
  return mk(
    `Realise completement l'etape (${label}) selon les regles de l'art, en lien avec (${diag}) et le motif (${motif}).`,
    `Realise partiellement l'etape (${label}), de facon incomplete ou imprecise.`,
    `Omet completement l'etape (${label}) ou suit une demarche erronee.`
  );
}

function inferCategory(item) {
  const L = String((item.id || "") + " " + (item.label || "")).toLowerCase();
  if (L.includes("prevention") || L.includes("hygieno") || L.includes("mode de vie") || L.includes("suivi") || L.includes("education") || L.includes("alerte") || L.includes("securite") || L.includes("annonce") || L.includes("diagnostic")) return "education";
  if (L.includes("accueil") || L.includes("plainte") || L.includes("douleur") || L.includes("facteur") || L.includes("risque") || L.includes("antecedent") || L.includes("associe") || L.includes("gravite") || L.includes("inventaire") || L.includes("allergie") || L.includes("interrogatoire") || L.includes("histoire")) return "interrogatoire";
  if (L.includes("constante") || L.includes("cardio") || L.includes("pulmonaire") || L.includes("neurolog") || L.includes("examen") || L.includes("palpation") || L.includes("auscultation") || L.includes("pouls") || L.includes("nihss") || L.includes("glasgow") || L.includes("score") || L.includes("echelle") || L.includes("moteur") || L.includes("sensibil") || L.includes("reflexe") || L.includes("glycemie") || L.includes("tension")) return "examen_physique";
  if (L.includes("thrombolyse") || L.includes("thrombectomie")) return "traitement";
  if (L.includes("strateg") || L.includes("paraclin") || L.includes("ecg") || L.includes("imagerie") || L.includes("bilan") || L.includes("test") || L.includes("scanner") || L.includes("irm")) return "strategie_diagnostique";
  if (L.includes("traitement") && !L.includes("inventaire") || L.includes("therapeutique") || L.includes("ordonnance")) return "traitement";
  return "education";
}

function keywordsFor(item, ctx) {
  const base = String(item.label || item.id || "")
    .toLowerCase()
    .replace(/[^a-zàâäéèêëîïôöùûüçœ\s'-]/gi, " ")
    .split(/[\s,;:'()/-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)
    .filter((w) => !["les", "des", "une", "avec", "dans", "pour", "sans", "sur", "par", "qui", "que", "aux", "est", "sont", "plus", "moins", "entre", "comme", "cela", "cette", "votre", "vous"].includes(w));
  const extra = String(ctx.diag + " " + ctx.motif)
    .toLowerCase()
    .split(/[\s,;:'()/-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4)
    .slice(0, 3);
  const seen = new Set();
  const out = [];
  for (const w of [...base, ...extra]) {
    if (!seen.has(w) && out.length < 8) { seen.add(w); out.push(w); }
  }
  return out.length > 0 ? out : ["examen", "interrogatoire", "diagnostic"];
}

const COMM_CANON = [
  {
    id: "ecoute_active",
    label: "Ecoute active : laisse s'exprimer le patient sans l'interrompre lors de l'expose initial",
    criteria: {
      fait: "Laisse le patient decrire spontanement ses symptomes sans l'interrompre pendant les premieres minutes.",
      en_partie: "Interrompt prematurement le patient ou coupe la parole a plusieurs reprises.",
      non_fait: "Interrogatoire directif sans aucun temps d'expression spontanee laisse au patient."
    }
  },
  {
    id: "questions_ouvertes",
    label: "Utilise des questions ouvertes avant de resserrer par des questions ciblees",
    criteria: {
      fait: "Ouvre chaque rubrique par une question ouverte puis precise rigoureusement.",
      en_partie: "Pose quasi exclusivement des questions fermees ou inductives orientant les reponses.",
      non_fait: "Questions exclusivement binaires ne permettant pas au patient d'exprimer son vecu."
    }
  },
  {
    id: "reformulation",
    label: "Reformule regulierement et verifie la bonne comprehension du patient",
    criteria: {
      fait: "Synthetise a intervalles reguliers et controle activement l'adhesion et la comprehension du patient.",
      en_partie: "Ne pratique qu'une seule reformulation superficielle en fin de consultation.",
      non_fait: "Aucune tentative de reformulation ni de verification de la comprehension."
    }
  },
  {
    id: "vocabulaire_adapte",
    label: "Adopte un vocabulaire clair, adapte au patient et depourvu de jargon non explique",
    criteria: {
      fait: "S'exprime dans un langage limpide et traduit spontanement toute notion medicale en termes accessibles.",
      en_partie: "Emploie quelques termes techniques complexes mais s'efforce de les expliquer sur relance.",
      non_fait: "Monologue hermetique truffe d'acronymes medicaux et de jargon technique."
    }
  },
  {
    id: "empathie",
    label: "Fait preuve d'empathie, valide les inquietudes et adopte une posture rassurante",
    criteria: {
      fait: "Reconnait l'anxiete du patient avec bienveillance et valorise ses questions sans banaliser la maladie.",
      en_partie: "Attitude polie mais distante et mecanique sans reelle ecoute emotionnelle.",
      non_fait: "Attitude dedaigneuse, culpabilisante ou anxiogene sans egard pour l'inquietude manifestee."
    }
  }
];

const PERF_CANON = [
  {
    id: "temps_station",
    label: "Respect du temps imparti et gestion equilibree du rythme des 8 minutes",
    instructions: "L'etudiant a-t-il su equilibrer interrogatoire, examen physique et synthese d'information en 8 minutes chrono ?",
    weight: 1,
    criteria: {
      fait: "Gestion du temps exemplaire : chaque etape clinique a ete abordee et conclue dans le delai des 8 minutes.",
      en_partie: "Gestion debordee : l'etudiant n'a pas eu le temps de boucler l'education ou a du bacler la fin.",
      non_fait: "Station bloquee des l'interrogatoire sans progression de la demarche medicale."
    }
  },
  {
    id: "ordre_logique",
    label: "Enchainement logique et structure de la demarche medicale",
    instructions: "L'etudiant a-t-il respecte la chronologie clinique : accueil - interrogatoire - examen physique - examens complementaires - explication et traitement ?",
    weight: 1,
    criteria: {
      fait: "Demarche clinique parfaitement structuree et ordonnee du motif initial jusqu'au plan therapeutique.",
      en_partie: "Structure hesitee : va-et-vient desordonne entre interrogatoire et examen physique.",
      non_fait: "Confusion des etapes : propose un traitement invasif d'emblee avant toute anamnese."
    }
  },
  {
    id: "signes_gravite",
    label: "Depistage des urgences et securisation immediate du patient",
    instructions: "L'etudiant a-t-il formellement ecarte l'urgence vitale liee au motif et securise le pronostic vital ?",
    weight: 1,
    criteria: {
      fait: "A verifie formellement l'absence de critere d'urgence vitale, la stabilite des constantes et etabli les consignes de securite.",
      en_partie: "A constate l'absence de signe evident sans verifier l'evolution recente ni les criteres de gravite.",
      non_fait: "N'a pas evalue le risque immediat ni le caractere stable ou instable du tableau."
    }
  }
];

const STANDARD_CLINIQUE_TEMPLATES = [
  { id: "accueil_presentation", label: "Se presente, precise son statut et installe confortablement le patient", category: "interrogatoire", weight: 1 },
  { id: "interrogatoire_plainte", label: "Caracterise precisement la plainte principale (siege, type, duree, facteurs declenchants et calmants)", category: "interrogatoire", weight: 1.5 },
  { id: "interrogatoire_antecedents", label: "Recherche les antecedents medicaux, chirurgicaux, familiaux et les facteurs de risque", category: "interrogatoire", weight: 1 },
  { id: "interrogatoire_gravite", label: "Recherche les signes associes et les criteres de gravite ou d'instabilite", category: "interrogatoire", weight: 1 },
  { id: "interrogatoire_traitements", label: "Recueille les traitements en cours, l'observance et le statut allergique", category: "interrogatoire", weight: 1 },
  { id: "examen_constantes", label: "Prend et interprete les constantes vitales de securite", category: "examen_physique", weight: 1 },
  { id: "examen_physique_cible", label: "Realise un examen physique cible adapte au motif", category: "examen_physique", weight: 1 },
  { id: "strategie_diagnostique", label: "Prescrit une strategie paraclinique de premiere intention justifiee", category: "strategie_diagnostique", weight: 1.5 },
  { id: "annonce_diagnostic", label: "Enonce et explique clairement l'hypothese diagnostique", category: "education", weight: 1 },
  { id: "plan_therapeutique", label: "Propose un plan therapeutique adapte avec posologie et contre-indications", category: "traitement", weight: 1 },
  { id: "education_securite", label: "Donne les consignes de securite, les signes d'alerte et le recours aux urgences", category: "education", weight: 1 }
];

function convertOne(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const c = JSON.parse(raw);
  const report = { file: path.basename(filePath), added: [], fixed: [] };

  const diag = firstDiag(c);
  const motif = motifOf(c);
  const { available, relevant, resultsKeys } = examsOf(c);
  const { correct: correctTreats, fatal: fatalTreats } = treatsOf(c);
  const ctx = { diag, motif, available, relevant, correctTreats, fatalTreats };
  const pn = patientName(c);

  // ---- patient.persona (DeepSeek) ----
  c.patient = c.patient || {};
  if (!c.patient.persona || typeof c.patient.persona !== "object") {
    c.patient.persona = {};
    report.added.push("patient.persona");
  }
  const pers = c.patient.persona;
  if (!pers.ton) { pers.ton = "poli et cooperant, inquiet de ses symptomes"; report.added.push("patient.persona.ton"); }
  if (!pers.registre) { pers.registre = "courant, sans jargon medical"; report.added.push("patient.persona.registre"); }
  if (!pers.loquacite) { pers.loquacite = "normal"; report.added.push("patient.persona.loquacite"); }
  if (!pers.style_parole) { pers.style_parole = "decrit concretement sa gene avec ses mots, minimise parfois la gravite, precise les details seulement si on l'interroge"; report.added.push("patient.persona.style_parole"); }
  if (!Array.isArray(pers.exemples_phrases) || pers.exemples_phrases.length < 2) {
    const ouverture = c.dialogue?.phraseOuverture || c?.ecos?.consignesPatient?.phraseOuverture || `Bonjour docteur, je viens pour ${motif}.`;
    pers.exemples_phrases = [
      String(ouverture),
      `Ca m'inquiete docteur, surtout quand ca revient. Je ne sais pas si c'est grave.`
    ];
    report.added.push("patient.persona.exemples_phrases");
  }
  if (typeof pers.anxiete !== "number") { pers.anxiete = 55; report.added.push("patient.persona.anxiete"); }
  if (typeof pers.confiance !== "number") { pers.confiance = 60; report.added.push("patient.persona.confiance"); }

  // ---- dialogue ----
  if (!c.dialogue || typeof c.dialogue !== "object") { c.dialogue = {}; report.added.push("dialogue"); }
  const dlg = c.dialogue;
  if (!dlg.phraseOuverture) {
    dlg.phraseOuverture = c?.ecos?.consignesPatient?.phraseOuverture || c?.ecos?.patientStandardise?.phraseOuverture || `Bonjour docteur, je viens vous voir pour ${motif}.`;
    report.added.push("dialogue.phraseOuverture");
  }
  if (!Array.isArray(dlg.objectifs_cles) || dlg.objectifs_cles.length < 3) {
    dlg.objectifs_cles = [
      `Caracterisation semiologique complete du motif (${motif})`,
      "Recherche des antecedents, du terrain et des facteurs de risque",
      `Justification de la strategie paraclinique en lien avec (${diag})`,
      "Information claire et consignes de securite"
    ];
    report.added.push("dialogue.objectifs_cles");
  }
  if (!Array.isArray(dlg.spontane) || dlg.spontane.length === 0) {
    dlg.spontane = ["motifHospitalisation", "histoireMaladie.facteursDeclenchants"];
    report.added.push("dialogue.spontane");
  }
  if (!Array.isArray(dlg.si_question) || dlg.si_question.length === 0) {
    dlg.si_question = ["histoireMaladie.debutSymptomes", "histoireMaladie.evolution", "antecedents.medicaux", "antecedents.familiaux", "traitements", "allergies", "modeDeVie.tabac", "modeDeVie.emploi"];
    report.added.push("dialogue.si_question");
  }
  if (!Array.isArray(dlg.si_insiste) || dlg.si_insiste.length === 0) {
    dlg.si_insiste = ["histoireMaladie.remarques", "Detail cache ou embarrassant avoue seulement si le medecin insiste avec tact"];
    report.added.push("dialogue.si_insiste");
  }
  if (!Array.isArray(dlg.ne_jamais_reveler) || dlg.ne_jamais_reveler.length === 0) {
    dlg.ne_jamais_reveler = [`Le diagnostic medical formel (${diag}) en jargon, que le patient ignore`, "Les resultats chiffres des examens complementaires non encore realises"];
    report.added.push("dialogue.ne_jamais_reveler");
  }

  // ---- examGradation ----
  if (!c.examGradation || typeof c.examGradation !== "object") { c.examGradation = {}; report.added.push("examGradation"); }
  const eg = c.examGradation;
  for (const k of ["parfaits", "utiles", "inutiles", "dangereux"]) {
    if (!Array.isArray(eg[k])) { eg[k] = []; report.added.push(`examGradation.${k}`); }
  }
  const inGrad = new Set([...eg.parfaits, ...eg.utiles, ...eg.inutiles, ...eg.dangereux].map(String));
  const ungraded = available.filter((e) => !inGrad.has(String(e)));
  if (eg.parfaits.length === 0) {
    const pick = relevant.length > 0 ? relevant.slice(0, 3) : available.slice(0, 2);
    eg.parfaits = pick.length > 0 ? pick : ["Examen clinique cible et constantes"];
    report.added.push("examGradation.parfaits(contenu)");
  }
  if (eg.utiles.length === 0) {
    eg.utiles = ungraded.length > 0 ? ungraded.slice(0, Math.min(2, ungraded.length)) : ["Bilan complementaire oriente selon l'evolution clinique"];
    report.added.push("examGradation.utiles(contenu)");
  }
  const stillUngraded = available.filter((e) => ![...eg.parfaits, ...eg.utiles].map(String).includes(String(e)));
  if (eg.inutiles.length === 0) {
    eg.inutiles = stillUngraded.length > 0 ? stillUngraded.slice(0, 2) : ["Examen sans lien demontre avec le motif de consultation"];
    report.added.push("examGradation.inutiles(contenu)");
  }
  if (eg.dangereux.length === 0) {
    eg.dangereux = ["Realiser un geste invasif ou irradier sans indication en retardant la prise en charge adaptee"];
    report.added.push("examGradation.dangereux(contenu)");
  }

  // ---- ecos ----
  if (!c.ecos || typeof c.ecos !== "object") { c.ecos = {}; report.added.push("ecos"); }
  const ecos = c.ecos;

  // consignesPatient
  if (!ecos.consignesPatient || typeof ecos.consignesPatient !== "object") { ecos.consignesPatient = {}; report.added.push("ecos.consignesPatient"); }
  const cp = ecos.consignesPatient;
  if (!cp.identite) { cp.identite = { nom: pn.nom, prenom: pn.prenom, age: pn.age, sexe: pn.sexe }; report.added.push("ecos.consignesPatient.identite"); }
  if (!cp.personnalite) { cp.personnalite = `Patient cooperant, inquiet, concerné par (${motif}).`; report.added.push("ecos.consignesPatient.personnalite"); }
  if (!cp.phraseOuverture) { cp.phraseOuverture = dlg.phraseOuverture; report.added.push("ecos.consignesPatient.phraseOuverture"); }
  else if (cp.phraseOuverture !== dlg.phraseOuverture) { /* garder les deux, aligner dialogue comme reference */ }
  if (!Array.isArray(cp.infosVolontaires) || cp.infosVolontaires.length === 0) {
    cp.infosVolontaires = [`Gene ou symptome principal en lien avec (${motif})`, "Retentissement concret sur la vie quotidienne"];
    report.added.push("ecos.consignesPatient.infosVolontaires");
  }
  if (!Array.isArray(cp.infosSiDemandees) || cp.infosSiDemandees.length === 0) {
    cp.infosSiDemandees = ["Antecedents principaux si le medecin les demande", "Traitements en cours et observance", "Facteurs de risque et habitudes de vie"];
    report.added.push("ecos.consignesPatient.infosSiDemandees");
  }
  if (!Array.isArray(cp.infosCachees) || cp.infosCachees.length === 0) {
    cp.infosCachees = ["Detail minimise ou embarrassant avoue seulement si le medecin insiste avec tact"];
    report.added.push("ecos.consignesPatient.infosCachees");
  }
  if (!Array.isArray(cp.questionsPieges) || cp.questionsPieges.length < 2) {
    cp.questionsPieges = [
      `Docteur, est-ce que je peux reprendre une vie normale avec (${motif}) sans risque ?`,
      "Ce ne serait pas seulement le stress ou la fatigue, docteur ?"
    ];
    report.added.push("ecos.consignesPatient.questionsPieges");
  }
  if (!cp.reactions || typeof cp.reactions !== "object") { cp.reactions = {}; report.added.push("ecos.consignesPatient.reactions"); }
  if (!cp.reactions.brutal) { cp.reactions.brutal = "Vous me faites un peu peur docteur... vous voulez dire que c'est grave ?"; report.added.push("reactions.brutal"); }
  if (!cp.reactions.silence) { cp.reactions.silence = "Docteur ? Tout va bien ? Vous avez l'air preoccupe."; report.added.push("reactions.silence"); }
  if (!cp.reactions.jargon) { cp.reactions.jargon = "Pardon docteur, qu'est-ce que vous voulez dire exactement ?"; report.added.push("reactions.jargon"); }

  // consignesEvaluateur + erreursRedhibitoires
  if (!ecos.consignesEvaluateur || typeof ecos.consignesEvaluateur !== "object") { ecos.consignesEvaluateur = {}; report.added.push("ecos.consignesEvaluateur"); }
  const ce = ecos.consignesEvaluateur;
  if (!Array.isArray(ce.erreursRedhibitoires) || ce.erreursRedhibitoires.length < 2) {
    const base = asArray(ce.erreursRedhibitoires).map(String);
    const fat = fatalTreats[0] ? `Prescrire (${fatalTreats[0]}) alors qu'il est contre-indique ou dangereux dans ce contexte` : null;
    const candidates = [
      `Affirmer a tort qu'un examen normal elimine a lui seul (${diag})`,
      fat || "Prescrire un traitement contre-indique mettant en danger immediat le patient",
      "Omettre la consigne formelle d'appel aux urgences (15) en cas de signe de gravite ou d'aggravation",
      "Banaliser un critere d'instabilite et retarder la prise en charge urgente"
    ];
    const merged = [...base];
    for (const cand of candidates) {
      if (merged.length >= 3) break;
      if (cand && !merged.includes(cand)) merged.push(cand);
    }
    ce.erreursRedhibitoires = merged.slice(0, 4);
    report.added.push("ecos.consignesEvaluateur.erreursRedhibitoires");
  }

  // grilleAptitudesCliniques (Jev choice)
  if (!Array.isArray(ecos.grilleAptitudesCliniques)) { ecos.grilleAptitudesCliniques = []; report.added.push("ecos.grilleAptitudesCliniques"); }
  const grille = ecos.grilleAptitudesCliniques;
  // Enrichir chaque item existant
  for (const item of grille) {
    if (!item.id) item.id = "item_" + Math.random().toString(36).slice(2, 8);
    if (!item.label) item.label = String(item.id);
    if (!item.category) { item.category = inferCategory(item); report.fixed.push(`category:${item.id}`); }
    else {
      // Reparation : les premieres passes ont pu mal classer certaines categories
      // (repli "education", ou "prevention des facteurs de risque" en interrogatoire).
      // Toutes les categories sont machine-generees, donc re-inference systematique.
      const better = inferCategory(item);
      if (better !== item.category) { report.fixed.push(`category-reparee:${item.id}:${item.category}->${better}`); item.category = better; }
    }
    if (typeof item.weight !== "number") { item.weight = 1; report.fixed.push(`weight:${item.id}`); }
    if (!item.criteria || !item.criteria.fait || !item.criteria.en_partie || !item.criteria.non_fait) {
      item.criteria = criteriaForClinique(item, ctx);
      report.fixed.push(`criteria:${item.id}`);
    }
    if (!Array.isArray(item.triggerKeywords) || item.triggerKeywords.length === 0) {
      item.triggerKeywords = keywordsFor(item, ctx);
      report.fixed.push(`triggerKeywords:${item.id}`);
    }
  }
  // Completer si moins de 8 items (sans supprimer)
  if (grille.length < 8) {
    const existingIds = new Set(grille.map((g) => String(g.id)));
    for (const tpl of STANDARD_CLINIQUE_TEMPLATES) {
      if (grille.length >= 8) break;
      if (existingIds.has(tpl.id)) continue;
      // Eviter les doublons semantiques grossiers
      const L = tpl.label.toLowerCase();
      const alreadyCovered = grille.some((g) => {
        const gl = String(g.label || "").toLowerCase();
        if (tpl.id === "examen_physique_cible" && (gl.includes("examen") || gl.includes("auscultation") || gl.includes("palpation"))) return true;
        if (tpl.id.startsWith("interrogatoire_") && gl.includes(tpl.id.split("_")[1]?.slice(0, 5) || "zzz")) return false;
        return false;
      });
      if (alreadyCovered) continue;
      const item = {
        id: tpl.id,
        label: tpl.id === "interrogatoire_plainte" ? `Caracterise precisement le motif (${motif})` : tpl.id === "strategie_diagnostique" ? `Prescrit une strategie paraclinique coherente avec (${diag})` : tpl.id === "annonce_diagnostic" ? `Enonce et explique l'hypothese de (${diag})` : tpl.label,
        category: tpl.category,
        weight: tpl.weight,
        criteria: null,
        triggerKeywords: []
      };
      item.criteria = criteriaForClinique(item, ctx);
      item.triggerKeywords = keywordsFor(item, ctx);
      grille.push(item);
      existingIds.add(tpl.id);
      report.added.push(`grilleAptitudesCliniques:${tpl.id}`);
    }
  }

  // grilleCommunication : normaliser vers les 5 criteres officiels (sans supprimer l'existant non officiel ?)
  // Regle : conserver les items existants, mapper les ids proches, ajouter les manquants.
  if (!Array.isArray(ecos.grilleCommunication)) { ecos.grilleCommunication = []; report.added.push("ecos.grilleCommunication"); }
  const comm = ecos.grilleCommunication;
  const normId = (id) => {
    const s = String(id || "").toLowerCase();
    if (s.includes("ecoute")) return "ecoute_active";
    if (s.includes("ouverte") || s.includes("question")) return "questions_ouvertes";
    if (s.includes("reformul")) return "reformulation";
    if (s.includes("vocab") || s.includes("jargon") || s.includes("adapte")) return "vocabulaire_adapte";
    if (s.includes("empath") || s.includes("bienveillance")) return "empathie";
    return String(id);
  };
  const seenComm = new Set();
  for (const item of comm) {
    const nid = normId(item.id);
    if (nid !== item.id) { report.fixed.push(`commId:${item.id}->${nid}`); item.id = nid; }
    if (typeof item.max !== "number") { item.max = 1; }
    if (!item.label) item.label = String(item.id);
    if (!item.criteria || !item.criteria.fait || !item.criteria.en_partie || !item.criteria.non_fait) {
      item.criteria = {
        fait: `Maitrise de la dimension (${item.label}) tout au long de la station, de facon naturelle et adaptee au contexte.`,
        en_partie: `Dimension (${item.label}) partiellement maitrisee, de facon inegale ou mecanique.`,
        non_fait: `Dimension (${item.label}) absente ou manifestement inadaptee.`
      };
      report.fixed.push(`commCriteria:${item.id}`);
    }
    seenComm.add(item.id);
  }
  for (const canon of COMM_CANON) {
    const found = comm.find((x) => x.id === canon.id);
    if (!found) {
      comm.push({ id: canon.id, label: canon.label, max: 1, criteria: { ...canon.criteria } });
      report.added.push(`grilleCommunication:${canon.id}`);
    } else {
      if (!found.label) found.label = canon.label;
      if (!found.criteria || !found.criteria.fait) { found.criteria = { ...canon.criteria }; report.fixed.push(`commCriteria:${canon.id}`); }
      if (typeof found.max !== "number") found.max = 1;
    }
  }

  // grillePerformance : 3 criteres officiels
  if (!Array.isArray(ecos.grillePerformance)) { ecos.grillePerformance = []; report.added.push("ecos.grillePerformance"); }
  const perf = ecos.grillePerformance;
  for (const canon of PERF_CANON) {
    const found = perf.find((x) => x.id === canon.id);
    if (!found) {
      perf.push({ id: canon.id, label: canon.label, weight: 1, instructions: canon.instructions, criteria: { ...canon.criteria } });
      report.added.push(`grillePerformance:${canon.id}`);
    } else {
      if (!found.label) found.label = canon.label;
      if (typeof found.weight !== "number") { found.weight = 1; report.fixed.push(`perfWeight:${canon.id}`); }
      if (!found.instructions) { found.instructions = canon.instructions; report.fixed.push(`perfInstructions:${canon.id}`); }
      if (!found.criteria || !found.criteria.fait) { found.criteria = { ...canon.criteria }; report.fixed.push(`perfCriteria:${canon.id}`); }
    }
  }

  // Sanitize integrale (sans emoji, sans cadratin)
  deepSanitize(c);

  // Ecriture formatee
  fs.writeFileSync(filePath, JSON.stringify(c, null, 2) + "\n", "utf8");
  return report;
}

function main() {
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") && !EXCLUDE.has(f));
  const allReports = [];
  let errors = 0;
  for (const f of files) {
    const fp = path.join(DATA_DIR, f);
    try {
      const r = convertOne(fp);
      allReports.push(r);
      console.log(`OK ${f} (+${r.added.length} ajouts, ${r.fixed.length} corrections)`);
    } catch (e) {
      errors++;
      console.error(`FAIL ${f}: ${e.message}`);
    }
  }
  console.log(`\nTermine : ${allReports.length} cas convertis, ${errors} erreurs.`);
  // Verification contraintes
  let badEmoji = 0, badDash = 0, badJson = 0;
  for (const f of files) {
    const fp = path.join(DATA_DIR, f);
    try {
      const txt = fs.readFileSync(fp, "utf8");
      JSON.parse(txt);
      if (/[\u2014]/.test(txt)) { badDash++; console.error(`CADRATIN restant : ${f}`); }
      // detection emoji restante (hors texte medical legitime)
      const m = txt.match(/[\p{Extended_Pictographic}]/gu);
      if (m && m.length > 0) { badEmoji++; console.error(`EMOJI restant (${m.slice(0, 3).join("")}) : ${f}`); }
    } catch (e) {
      badJson++;
      console.error(`JSON invalide : ${f} : ${e.message}`);
    }
  }
  console.log(`Controle : emoji=${badEmoji}, cadratin=${badDash}, jsonInvalide=${badJson}`);
  if (badEmoji > 0 || badDash > 0 || badJson > 0) process.exitCode = 1;
}

main();
