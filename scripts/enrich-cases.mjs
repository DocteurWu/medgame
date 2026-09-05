#!/usr/bin/env node
/**
 * scripts/enrich-cases.mjs — Agent d'amélioration LLM-first des cas cliniques
 *
 * Passe le corpus d'une logique "affichage statique" à une logique "patient LLM" :
 *   - patient.persona  : ton, registre, loquacité, style de parole, exemples de phrases
 *   - dialogue         : phraseOuverture, objectifs_cles, spontane / si_question /
 *                        si_insiste / ne_jamais_reveler (prioritaire sur ecos.*)
 *   - examGradation    : parfaits > utiles > inutiles > dangereux
 *   - hints (3), pieges, objectifs, referentiel
 *   - difficulty       : recalibrée 1/2/3 (1 coopératif, 2 standard, 3 réticent)
 *
 * Règles LLM-first appliquées au prompt (js/llm-patient.js) :
 *   - difficulté 1 : patient coopératif, donne l'essentiel spontanément
 *   - difficulté 2 : motif spontané, détails seulement sur question ciblée
 *   - difficulté 3 : minimise, digresse, exige des questions précises
 *   - le patient ne révèle JAMAIS le diagnostic ni les résultats d'examens
 *
 * Usage :
 *   node scripts/enrich-cases.mjs                  → dry-run (résumé, 0 écriture)
 *   node scripts/enrich-cases.mjs --apply          → enrichit tout le corpus
 *   node scripts/enrich-cases.mjs --apply --only=CARDIO_angor_stable.json
 *   node scripts/enrich-cases.mjs --apply --limit=10
 *   node scripts/enrich-cases.mjs --recalibrate-only --apply   → ne touche que difficulty
 *
 * Idempotent : ne réécrit que les champs manquants (sauf --force et difficulty).
 * Après exécution : npm run validate:cases
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = join(ROOT, 'data');
const NON_CASE_FILES = new Set(['case-index.json', 'drugs.json', 'patient_test_complet.json', 'test_gating.json']);

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE = args.includes('--force');
const RECALIBRATE_ONLY = args.includes('--recalibrate-only');
const onlyArg = args.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length) : null;
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.slice('--limit='.length), 10) : Infinity;

// ── Templates de persona (déterministes, variés par hash de l'id) ──
const PERSONAS = [
    {
        ton: 'inquiet et poli', registre: 'courant, phrases simples', loquacite: 'normal',
        style_parole: 'parlé spontané avec hésitations quand la douleur revient',
        exemples_phrases: ['Ça me fait mal surtout quand je fais un effort...', 'Vous croyez que c\'est grave, docteur ?'],
        anxiete: 65, confiance: 60
    },
    {
        ton: 'fatigué et résigné', registre: 'courant, phrases très courtes', loquacite: 'reserve',
        style_parole: 'minimaliste, souffle court, répond mot à mot',
        exemples_phrases: ['Oui... c\'est là que ça fait mal.', 'Ça va passer, je crois.'],
        anxiete: 35, confiance: 55
    },
    {
        ton: 'bavard et anxieux', registre: 'familier', loquacite: 'bavard',
        style_parole: 'digresse (travail, famille) puis revient au symptôme si on le recadre',
        exemples_phrases: ['Attendez, je vous raconte, au boulot en ce moment c\'est... enfin bref, la douleur quoi.', 'Mon conjoint m\'a dit de venir, moi je voulais pas déranger...'],
        anxiete: 70, confiance: 65
    },
    {
        ton: 'sec et pressé', registre: 'direct, sans détour', loquacite: 'reserve',
        style_parole: 'réponses brèves, s\'agace des questions répétées',
        exemples_phrases: ['Je vous l\'ai déjà dit : ça fait mal ici, point.', 'On peut aller vite, j\'ai pas que ça à faire...'],
        anxiete: 45, confiance: 40
    },
    {
        ton: 'angoissé hypocondriaque', registre: 'courant, dramatise', loquacite: 'normal',
        style_parole: 'amplifie les symptômes, guette chaque réaction du médecin',
        exemples_phrases: ['J\'ai trop peur que ce soit quelque chose de grave...', 'Mon cœur bat super vite là, vous entendez ?'],
        anxiete: 85, confiance: 55
    },
    {
        ton: 'calme et coopératif', registre: 'clair et posé', loquacite: 'normal',
        style_parole: 'répond précisément, dans l\'ordre, sans jargon',
        exemples_phrases: ['Ça a commencé il y a quelques mois, toujours dans la même situation.', 'Je prends bien mes médicaments, je vous assure.'],
        anxiete: 30, confiance: 70
    }
];

const REFERENTIELS = [
    [/cardio/i, 'ESC / Collège de cardiologie (SFC)'],
    [/neuro|epileps|convuls/i, 'Collège de neurologie / ILAE'],
    [/uro|nephro|andro/i, 'Collège d\'urologie-néphrologie (AFU)'],
    [/orl|vertige|labyrinth/i, 'Collège ORL / Barany Society'],
    [/digest|gastro|oesoph/i, 'Collège d\'hépato-gastro-entérologie (SNFGE)'],
    [/locomoteur|epaule|lomb|tendin|sciatique|arthr/i, 'Collège de rhumatologie (SFR)'],
    [/edn|diabete|anorexie|boulimie|obesite|denutrition/i, 'Collège d\'endocrinologie-diabétologie-nutrition (SFD)'],
    [/urgence|choc|arret|overdose|trauma|brulure|noyade|asthme/i, 'Référentiels SFMU / ERC (urgences)'],
    [/gyneco|accouchement/i, 'Collège de gynécologie-obstétrique (CNGOF)'],
    [/pneumo/i, 'Collège de pneumologie (SPLF)'],
    [/vih|infect/i, 'SPILF / HAS (infectiologie)']
];

function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
}

function pickPersona(caseId, age) {
    let p = PERSONAS[hashStr(caseId) % PERSONAS.length];
    // Âges extrêmes : adapter le style sans changer le ton
    if (parseInt(age, 10) > 78) {
        p = { ...p, style_parole: p.style_parole + ', parle lentement avec quelques hésitations chronologiques' };
    } else if (parseInt(age, 10) < 25) {
        p = { ...p, style_parole: p.style_parole + ', vocabulaire jeune et relâché' };
    }
    return p;
}

function recalibrateDifficulty(c) {
    const locks = (c.locks || []).length;
    const relevant = (c.relevantExams || []).length;
    const avail = (c.availableExams || []).length;
    const corrLen = (c.correction || '').length;
    const isGraph = !!(c.gameplayConfig && c.nodes);
    const altDx = (c.alternativeDiagnostics || []).length;
    let score = 2;
    if (locks >= 3 || relevant >= 5 || corrLen > 1500 || isGraph || altDx >= 3) score = 3;
    else if (locks === 0 && relevant <= 2 && corrLen < 700 && avail <= 5) score = 1;
    else if (locks >= 2 || relevant >= 3 || corrLen > 900) score = 2;
    return Math.max(1, Math.min(3, score));
}

function buildDialogue(c) {
    const hm = c.interrogatoire?.histoireMaladie || {};
    const ecosPS = c.ecos?.patientStandardise || {};
    const spontane = ['motifHospitalisation'];
    if (hm.symptomesAssocies) spontane.push('histoireMaladie.symptomesAssocies');
    else if (hm.debutSymptomes) spontane.push('histoireMaladie.debutSymptomes');

    const si_question = [
        'histoireMaladie.debutSymptomes', 'histoireMaladie.descriptionDouleur',
        'histoireMaladie.evolution', 'histoireMaladie.facteursDeclenchants',
        'antecedents.medicaux', 'antecedents.familiaux',
        'traitements', 'allergies',
        'modeDeVie.tabac', 'modeDeVie.alcool', 'modeDeVie.emploi'
    ].filter(p => {
        // Ne garder que les chemins qui existent réellement dans le cas
        const val = resolveField(c, p);
        return val !== null && val !== undefined && val !== '';
    });

    // Sujets sensibles → si_insiste (alcool détaillé, familiaux lourds, remarques intimes)
    const si_insiste = [];
    const alcoolQ = c.interrogatoire?.modeDeVie?.alcool?.quantite;
    if (alcoolQ && !/occasionnel|non|jamais|aucun/i.test(String(alcoolQ))) si_insiste.push('modeDeVie.alcool');
    if ((c.interrogatoire?.antecedents?.familiaux || []).length >= 2) si_insiste.push('antecedents.familiaux');
    if (hm.remarques && String(hm.remarques).length > 40) si_insiste.push('histoireMaladie.remarques');

    const ne_jamais_reveler = [];
    if (c.correctDiagnostic) ne_jamais_reveler.push(`le diagnostic (${c.correctDiagnostic})`);
    ne_jamais_reveler.push('vos résultats d\'examens complémentaires (vous ne les connaissez pas)');

    const objectifs_cles = [];
    if (hm.descriptionDouleur || hm.symptomesActuels) objectifs_cles.push('caractérisation complète du symptôme (siège, type, irradiation, intensité, durée)');
    if (hm.facteursDeclenchants) objectifs_cles.push('facteurs déclenchants et calmants');
    if (c.interrogatoire?.antecedents) objectifs_cles.push('antécédents et terrain à risque');
    if (c.relevantExams?.length) objectifs_cles.push(`justification des examens clés (${c.relevantExams.slice(0, 2).join(', ')})`);
    else if (c.availableExams?.length) objectifs_cles.push('choix pertinent des examens complémentaires');

    return {
        phraseOuverture: ecosPS.phraseOuverture || `Bonjour docteur, je viens pour : ${(c.interrogatoire?.motifHospitalisation || 'mon problème')}.`,
        objectifs_cles: objectifs_cles.slice(0, 4),
        spontane: [...new Set(spontane)],
        si_question: [...new Set(si_question)].slice(0, 11),
        si_insiste: [...new Set(si_insiste)],
        ne_jamais_reveler
    };
}

function resolveField(c, path) {
    const parts = path.split('.');
    let curr = c.interrogatoire;
    for (const p of parts) {
        if (curr && typeof curr === 'object') curr = curr[p];
        else return null;
    }
    if (curr === undefined) return null;
    return curr;
}

function buildExamGradation(c) {
    const avail = c.availableExams || [];
    const relevant = c.relevantExams || [];
    const results = c.examResults || {};
    // Sans relevantExams auteur : les 2 premiers disponibles deviennent les parfaits
    // (mieux qu'une liste vide qui casse les hints et le prompt patient).
    const effectiveRelevant = relevant.length ? relevant : avail.slice(0, 2);
    const parfaits = effectiveRelevant.filter(e => avail.includes(e));
    const dangereux = avail.filter(e => {
        const r = results[e];
        return typeof r === 'string' && /non indiqu|inutile|contre-indiqu|dangereux/i.test(r);
    });
    const utiles = avail.filter(e => !parfaits.includes(e) && !dangereux.includes(e)).slice(0, 3);
    // "Inutiles" = le reste des disponibles non pertinents (hors utiles déjà listés)
    const inutiles = avail.filter(e => !parfaits.includes(e) && !utiles.includes(e) && !dangereux.includes(e)).slice(0, 3);
    return { parfaits, utiles, inutiles, dangereux };
}

function buildHints(c) {
    const relevant = c.relevantExams || [];
    const locks = c.locks || [];
    const hints = [];
    if (relevant.length) hints.push(`💡 Pour ce motif, les examens qui font avancer le dossier sont : ${relevant.slice(0, 2).join(' + ')}. Demande-les en priorité.`);
    else hints.push('💡 Relis le motif et l\'histoire de la maladie : un examen complémentaire bien choisi vaut mieux que trois examens au hasard.');
    if (locks.length) {
        const q = locks[0].challenge?.question || locks[0].label || 'le défi';
        hints.push(`🔐 Défi à prévoir : « ${q} ». La réponse se trouve dans l'examen clinique / l'interrogatoire — relis avant de valider.`);
    } else {
        hints.push('🩺 Fais l\'examen par appareil complet avant de trancher : c\'est là que se cachent les points de démarche.');
    }
    const alt = (c.alternativeDiagnostics || [])[0];
    if (alt) hints.push(`🎯 Diagnostics proches à départager : ${c.correctDiagnostic} vs ${alt}. Cherche l'élément qui les distingue (durée, troponine, test d'effort...).`);
    else hints.push('🎯 Avant de valider, confronte ton hypothèse aux diagnostics proposés et élimine-les un par un.');
    return hints;
}

function buildReferentiel(caseId, file) {
    const hay = `${caseId} ${file}`;
    for (const [re, label] of REFERENTIELS) {
        if (re.test(hay)) return label;
    }
    return 'Collège de la spécialité / HAS';
}

// ── Main ──
const files = readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json') && !NON_CASE_FILES.has(f))
    .filter(f => !ONLY || f === ONLY || f.replace('.json', '') === ONLY)
    .slice(0, LIMIT);

console.log(`\n🤖 Enrichissement LLM-first : ${files.length} cas ${APPLY ? '(ÉCRITURE)' : '(dry-run)'}${ONLY ? ` [only=${ONLY}]` : ''}\n`);

let touched = 0, diffChanged = 0;
const diffDist = { 1: 0, 2: 0, 3: 0 };

for (const file of files) {
    const path = join(DATA_DIR, file);
    let c;
    try {
        c = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
        console.error(`  ❌ [${file}] JSON invalide : ${e.message}`);
        continue;
    }
    const changes = [];

    // 1. Difficulté
    const newDiff = recalibrateDifficulty(c);
    if (c.difficulty !== newDiff) {
        changes.push(`difficulty ${c.difficulty} → ${newDiff}`);
        diffChanged++;
        if (APPLY) c.difficulty = newDiff;
    }
    diffDist[APPLY ? (c.difficulty ?? newDiff) : newDiff]++;

    if (!RECALIBRATE_ONLY) {
        // 2. Persona
        if ((!c.patient.persona && !FORCE)) {
            const persona = pickPersona(c.id || file, c.patient?.age);
            changes.push(`patient.persona (${persona.ton})`);
            if (APPLY) c.patient.persona = persona;
        }
        // 3. Dialogue
        if ((!c.dialogue && !FORCE)) {
            changes.push('dialogue (spontane/si_question/si_insiste)');
            if (APPLY) c.dialogue = buildDialogue(c);
        }
        // 4. Examens gradués
        if ((!c.examGradation && !FORCE)) {
            const g = buildExamGradation(c);
            changes.push(`examGradation (parfaits: ${g.parfaits.length}, utiles: ${g.utiles.length}, inutiles: ${g.inutiles.length}, dangereux: ${g.dangereux.length})`);
            if (APPLY) c.examGradation = g;
        }
        // 5. Hints
        if ((!Array.isArray(c.hints) || c.hints.length === 0)) {
            changes.push('hints (3)');
            if (APPLY) c.hints = buildHints(c);
        }
        // 6. Pièges
        if ((!Array.isArray(c.pieges) || c.pieges.length === 0) && (c.alternativeDiagnostics || []).length) {
            changes.push(`pieges (${c.alternativeDiagnostics.length})`);
            if (APPLY) c.pieges = [...c.alternativeDiagnostics].slice(0, 3);
        }
        // 7. Objectifs + référentiel
        if (!Array.isArray(c.objectifs) || c.objectifs.length === 0) {
            const obj = (c.ecos?.vignette?.consignesAttendues || []).slice(0, 3);
            if (obj.length) {
                changes.push(`objectifs (${obj.length})`);
                if (APPLY) c.objectifs = obj;
            }
        }
        if (!c.referentiel) {
            changes.push(`referentiel (${buildReferentiel(c.id || '', file)})`);
            if (APPLY) c.referentiel = buildReferentiel(c.id || '', file);
        }
    }

    if (changes.length > 0) {
        touched++;
        console.log(`  ${APPLY ? '✍️' : '👁️'} [${file}] ${changes.join(' · ')}`);
        if (APPLY) {
            writeFileSync(path, JSON.stringify(c, null, 2) + '\n', 'utf8');
        }
    }
}

console.log(`\n📊 ${touched}/${files.length} cas ${APPLY ? 'enrichis' : 'à enrichir'} · difficultés recalibrées : ${diffChanged} · distribution : 1→${diffDist[1]} 2→${diffDist[2]} 3→${diffDist[3]}`);
console.log(APPLY ? '✅ Écriture terminée. Lancez : npm run validate:cases\n' : '👁️ Dry-run : relancez avec --apply pour écrire.\n');
