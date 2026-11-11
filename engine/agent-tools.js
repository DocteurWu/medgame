/**
 * engine/agent-tools.js — Outils des agents IA qui testent et améliorent Medgame.
 *
 * Exposés par mcp-server.js. Un agent peut ainsi boucler sans humain :
 *   1. auditer un cas (statique, gratuit)      → auditCase / auditAllCases
 *   2. le jouer de bout en bout, script fourni → playScriptedConsultation
 *      (même cerveau patient que le navigateur : js/patient-brain.js)
 *   3. lire ce qui s'est passé                 → journal des tours, alliance
 *   4. proposer une correction du cas          → proposeCasePatch (essai à
 *      blanc par défaut, validation de schéma, journal des écritures)
 *   5. vérifier qu'il n'a rien cassé           → runTests / validateCases
 *
 * Aucun appel réseau ici : seul `playScriptedConsultation` passe par
 * l'engine, qui appelle le LLM.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../js/patient-live-core.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_DIR = path.join(ROOT, 'data');
const NON_CASE_FILES = new Set(['case-index.json', 'case-meta.json', 'drugs.json']);
const Live = globalThis.PatientLiveCore;

// ==================== LECTURE ====================

/** Nom de fichier sûr dans data/ (pas de traversée de répertoire). */
export function caseFileName(caseId) {
    const base = path.basename(String(caseId || ''));
    if (!base || base.startsWith('.')) throw new Error('caseId invalide.');
    const file = base.endsWith('.json') ? base : `${base}.json`;
    if (NON_CASE_FILES.has(file)) throw new Error(`${file} n'est pas un cas.`);
    return file;
}

export async function readCase(caseId) {
    const file = caseFileName(caseId);
    const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
    return { file, data: JSON.parse(raw) };
}

export async function listCaseFiles() {
    return (await fs.readdir(DATA_DIR)).filter(f => f.endsWith('.json') && !NON_CASE_FILES.has(f)).sort();
}

// ==================== AUDIT ====================

const lc = (s) => String(s || '').toLowerCase().trim();

/**
 * Audit statique d'un cas : ce qui rendra le patient plat, incohérent ou
 * injouable en direct. Chaque problème porte une gravité et une piste.
 * @returns {{ caseId:string, score:number, issues:{severity:'error'|'warning'|'info', field:string, message:string, fix:string}[] }}
 */
export function auditCase(c) {
    const issues = [];
    const add = (severity, field, message, fix) => issues.push({ severity, field, message, fix });
    const p = c?.patient || {};
    const persona = p.persona || {};
    const ecos = c?.ecos?.patientStandardise || c?.ecos?.consignesPatient || null;

    // Jouabilité de base
    if (!c?.id) add('error', 'id', 'Le cas n\'a pas d\'identifiant.', 'Ajouter "id" (nom du fichier sans .json).');
    if (!c?.interrogatoire?.motifHospitalisation) add('error', 'interrogatoire.motifHospitalisation', 'Pas de motif : le patient ne sait pas pourquoi il vient.', 'Renseigner le motif en langage patient.');
    if (!c?.correctDiagnostic) add('error', 'correctDiagnostic', 'Pas de diagnostic attendu.', 'Renseigner correctDiagnostic.');
    if (c?.correctDiagnostic && Array.isArray(c.possibleDiagnostics) && !c.possibleDiagnostics.some(d => lc(d) === lc(c.correctDiagnostic))) {
        add('error', 'possibleDiagnostics', 'Le diagnostic attendu n\'est pas dans la liste proposée : impossible à choisir.', 'Ajouter correctDiagnostic à possibleDiagnostics.');
    }
    const possibleTx = (c?.possibleTreatments || []).map(lc);
    for (const t of c?.correctTreatments || []) {
        if (!possibleTx.includes(lc(t))) add('error', 'correctTreatments', `Traitement attendu « ${t} » absent de possibleTreatments : impossible à prescrire.`, 'L\'ajouter à possibleTreatments.');
    }
    const results = c?.examResults || {};
    for (const ex of c?.availableExams || []) {
        if (!(ex in results)) add('warning', `examResults.${ex}`, `Examen « ${ex} » proposé sans résultat : l'étudiant obtiendra « normal ».`, 'Ajouter le résultat ou retirer l\'examen.');
    }

    // Incarnation (ce qui fait un patient vivant en direct)
    if (typeof persona.confiance !== 'number') add('warning', 'patient.persona.confiance', 'Confiance initiale absente : la jauge démarre à 55 par défaut.', 'Fixer 30-80 selon le caractère (méfiant → bas).');
    if (typeof persona.anxiete !== 'number') add('warning', 'patient.persona.anxiete', 'Anxiété initiale absente.', 'Fixer 20-90 selon la situation.');
    if (!persona.ton && !persona.style_parole) add('warning', 'patient.persona.ton', 'Pas de ton ni de style : le patient parlera comme un assistant poli.', 'Décrire le ton (ex. « inquiète, pressée ») et le style de parole.');
    if (!Array.isArray(persona.exemples_phrases) || persona.exemples_phrases.length < 2) add('info', 'patient.persona.exemples_phrases', 'Moins de 2 exemples de phrases : la voix du personnage sera générique.', 'Ajouter 3 phrases typiques, à l\'oral.');
    if (!c?.dialogue && !ecos) add('warning', 'dialogue', 'Aucune règle de divulgation : le patient peut tout dire d\'emblée.', 'Ajouter dialogue.spontane / si_question / si_insiste.');
    const hidden = c?.dialogue?.si_insiste || ecos?.infosCachees || [];
    if (!hidden.length) add('info', 'dialogue.si_insiste', 'Aucune information cachée : l\'alliance n\'a rien à débloquer.', 'Cacher 1 ou 2 éléments intimes (alcool, observance, peur) révélés si la confiance ≥ 65.');
    const opening = c?.dialogue?.phraseOuverture || ecos?.phraseOuverture;
    if (!opening) add('info', 'dialogue.phraseOuverture', 'Pas de phrase d\'ouverture : une phrase générique est utilisée.', 'Écrire la première réplique du patient, à l\'oral.');
    if (opening && Live) {
        const a = Live.analyzeUtterance(opening);
        if (a.jargon.length) add('warning', 'dialogue.phraseOuverture', `La phrase d'ouverture contient du jargon (${a.jargon.map(j => j.term).join(', ')}) : un patient ne parle pas ainsi.`, `Remplacer par « ${a.jargon[0].lay} ».`);
    }
    if (Array.isArray(persona.exemples_phrases) && Live) {
        for (const ph of persona.exemples_phrases) {
            const a = Live.analyzeUtterance(ph);
            if (a.jargon.length) add('warning', 'patient.persona.exemples_phrases', `Exemple « ${String(ph).slice(0, 60)} » en jargon médical.`, `Dire plutôt « ${a.jargon[0].lay} ».`);
        }
    }

    const weights = { error: 25, warning: 8, info: 2 };
    const score = Math.max(0, 100 - issues.reduce((s, i) => s + weights[i.severity], 0));
    return { caseId: c?.id || null, score, issues };
}

export async function auditAllCases() {
    const files = await listCaseFiles();
    const rows = [];
    for (const f of files) {
        try {
            const data = JSON.parse(await fs.readFile(path.join(DATA_DIR, f), 'utf8'));
            const a = auditCase(data);
            rows.push({ file: f, score: a.score, errors: a.issues.filter(i => i.severity === 'error').length, warnings: a.issues.filter(i => i.severity === 'warning').length, top: a.issues[0]?.message || null });
        } catch (e) {
            rows.push({ file: f, score: 0, errors: 1, warnings: 0, top: `JSON illisible : ${e.message}` });
        }
    }
    rows.sort((a, b) => a.score - b.score);
    const byField = {};
    for (const f of files) {
        try {
            const a = auditCase(JSON.parse(await fs.readFile(path.join(DATA_DIR, f), 'utf8')));
            for (const i of a.issues) byField[i.field] = (byField[i.field] || 0) + 1;
        } catch (e) { /* déjà compté */ }
    }
    return {
        total: rows.length,
        averageScore: Math.round(rows.reduce((s, r) => s + r.score, 0) / Math.max(1, rows.length)),
        worst: rows.slice(0, 15),
        mostCommonIssues: Object.entries(byField).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([field, count]) => ({ field, count }))
    };
}

// ==================== PATCH DE CAS ====================

/** JSON Merge Patch (RFC 7396) : `null` supprime une clé, un tableau remplace. */
export function mergePatch(target, patch) {
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
    const out = (target && typeof target === 'object' && !Array.isArray(target)) ? { ...target } : {};
    for (const [k, v] of Object.entries(patch)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
        if (v === null) delete out[k];
        else out[k] = mergePatch(out[k], v);
    }
    return out;
}

/** Chemins modifiés entre deux objets (pour l'aperçu). */
export function changedPaths(a, b, prefix = '') {
    const out = [];
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) {
        const p = prefix ? `${prefix}.${k}` : k;
        const va = a?.[k], vb = b?.[k];
        const objs = va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(va) && !Array.isArray(vb);
        if (objs) out.push(...changedPaths(va, vb, p));
        else if (JSON.stringify(va) !== JSON.stringify(vb)) out.push(p);
    }
    return out;
}

async function schemaValidator() {
    try {
        const { default: Ajv } = await import('ajv');
        const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
        return ajv.compile(JSON.parse(await fs.readFile(path.join(ROOT, 'schemas', 'case.schema.json'), 'utf8')));
    } catch (e) {
        return null; // ajv absent (installation sans devDependencies) : audit seul
    }
}

/**
 * Propose (et applique sur demande) une modification d'un cas.
 * Par défaut c'est un ESSAI À BLANC : rien n'est écrit. Avec `apply`, le cas
 * est réécrit seulement si le schéma passe et que l'audit ne se dégrade pas,
 * et l'écriture est tracée dans data/case-patches.jsonl (avec l'ancien état
 * des champs modifiés, pour pouvoir revenir en arrière).
 */
export async function proposeCasePatch({ caseId, patch, reason, apply = false }) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('patch doit être un objet (JSON Merge Patch).');
    if ('id' in patch) throw new Error('Le patch ne peut pas changer l\'id du cas.');
    const { file, data } = await readCase(caseId);
    const next = mergePatch(data, patch);
    const changed = changedPaths(data, next);
    const before = auditCase(data);
    const after = auditCase(next);
    const validate = await schemaValidator();
    const schemaOk = validate ? !!validate(next) : null;
    const schemaErrors = validate && !schemaOk ? (validate.errors || []).slice(0, 10).map(e => `${e.instancePath || '/'} ${e.message}`) : [];
    const result = {
        file,
        changedPaths: changed,
        audit: { before: before.score, after: after.score, remaining: after.issues },
        schemaValid: schemaOk,
        schemaErrors,
        applied: false
    };
    if (!apply) return { ...result, note: 'Essai à blanc : rien n\'a été écrit. Relancer avec apply=true pour enregistrer.' };
    if (!changed.length) return { ...result, note: 'Aucun changement.' };
    if (schemaOk === false) return { ...result, note: 'Refusé : le cas modifié ne respecte plus le schéma.' };
    if (after.score < before.score) return { ...result, note: 'Refusé : l\'audit se dégrade avec ce patch.' };

    const previous = {};
    for (const p of changed) previous[p] = p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data);
    await fs.writeFile(path.join(DATA_DIR, file), JSON.stringify(next, null, 2) + '\n', 'utf8');
    const logPath = path.join(DATA_DIR, 'case-patches.jsonl');
    await fs.appendFile(logPath, JSON.stringify({ date: new Date().toISOString(), file, reason: reason || '', changed, previous }) + '\n', 'utf8');
    return { ...result, applied: true, loggedTo: logPath, note: 'Cas enregistré. Lancer validate_cases puis rejouer le cas.' };
}

// ==================== CONSULTATION SCRIPTÉE ====================

/**
 * Joue une consultation complète, réplique par réplique, avec le vrai moteur
 * (donc le vrai cerveau patient et un vrai LLM). Renvoie le transcript,
 * l'alliance tour par tour, les latences et, si demandé, la note finale.
 * S'arrête proprement si le patient part.
 */
export async function playScriptedConsultation(engine, { caseId, lines, exams, treatments, diagnostic, submit = false }) {
    if (!Array.isArray(lines) || !lines.length) throw new Error('lines : au moins une réplique.');
    if (lines.length > 40) throw new Error('lines : 40 répliques au maximum.');
    await engine.startCase(caseId);
    const opening = engine.chatHistory[0]?.content || '';
    const turns = [];
    let stoppedBecause = null;
    for (const line of lines) {
        try {
            await engine.chat(String(line));
            turns.push(engine.lastTurn);
        } catch (e) {
            stoppedBecause = e.message;
            break;
        }
        if (engine.alliance?.state.walkedOut) { stoppedBecause = 'Le patient est parti.'; break; }
        if (engine.isFinished) { stoppedBecause = 'Cas terminé (décès ou temps).'; break; }
    }
    if (Array.isArray(exams) && exams.length && !engine.isFinished) engine.orderExams(exams);
    if (Array.isArray(treatments) && treatments.length && !engine.isFinished) engine.prescribe(treatments);
    if (diagnostic && !engine.isFinished) engine.selectDiagnostic(diagnostic);
    const evaluation = submit && !engine.isFinished ? engine.submit() : null;
    const latencies = turns.map(t => t.latencyMs).filter(Number.isFinite);
    return {
        caseId: engine.caseData?.id,
        opening,
        turns: turns.map(t => ({
            input: t.input,
            dialogue: t.dialogue,
            narrative: t.narrative,
            emotion: t.emotion,
            trust: t.alliance.trust,
            delta: t.alliance.delta,
            feedback: t.alliance.feedback,
            stage: t.alliance.stage,
            disclosed: t.disclosedInfoFields,
            latencyMs: t.latencyMs
        })),
        stoppedBecause,
        alliance: engine.alliance?.summary() || null,
        latency: latencies.length ? {
            averageMs: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
            maxMs: Math.max(...latencies)
        } : null,
        evaluation
    };
}

// ==================== TESTS & VALIDATION ====================

function runNode(args, timeoutMs) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, NO_COLOR: '1' } });
        let out = '';
        const timer = setTimeout(() => child.kill(), timeoutMs);
        child.stdout.on('data', d => { out += d; });
        child.stderr.on('data', d => { out += d; });
        child.on('close', (code) => { clearTimeout(timer); resolve({ code, out }); });
    });
}

/** Fichiers de test déclarés dans package.json (liste blanche). */
async function declaredTests() {
    const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
    return (pkg.scripts?.test || '').split(/\s+/).filter(t => /^test\/.+\.test\.mjs$/.test(t));
}

/**
 * Lance la suite Node (ou un sous-ensemble filtré par nom). Résumé + échecs.
 * @param {{ filter?: string }} opts — sous-chaîne d'un nom de fichier (« patient », « engine »)
 */
export async function runTests({ filter } = {}) {
    const all = await declaredTests();
    const files = filter ? all.filter(f => f.includes(String(filter))) : all;
    if (!files.length) throw new Error(`Aucun fichier de test ne correspond à « ${filter} ». Disponibles : ${all.join(', ')}`);
    const { code, out } = await runNode(['--test', ...files], 300000);
    const pick = (k) => Number((out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) || [])[1] || 0);
    const failures = [];
    const re = /^\s*not ok \d+ - (.+)$/gm;
    let m;
    while ((m = re.exec(out)) && failures.length < 20) failures.push(m[1]);
    return { ok: code === 0, files, tests: pick('tests'), pass: pick('pass'), fail: pick('fail'), failures, tail: code === 0 ? '' : out.slice(-3000) };
}

export async function validateCases({ strict = false } = {}) {
    const { code, out } = await runNode(['scripts/validate-cases.mjs', ...(strict ? ['--strict'] : [])], 120000);
    const lines = out.split('\n');
    return {
        ok: code === 0,
        errors: lines.filter(l => l.includes('❌')).slice(0, 40),
        warnings: lines.filter(l => l.includes('⚠️')).length,
        summary: lines.slice(-12).join('\n')
    };
}

// ==================== RETOURS ====================

export async function readFeedback() {
    const p = process.env.MEDGAME_FEEDBACK_FILE || path.join(DATA_DIR, 'feedback.jsonl');
    let raw = '';
    try { raw = await fs.readFile(p, 'utf8'); } catch (e) { return { total: 0, byCase: [] }; }
    const entries = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
    const byCase = {};
    for (const e of entries) {
        const k = e.caseId || '?';
        byCase[k] = byCase[k] || { caseId: k, reviews: 0, verdicts: {}, problemes: [], suggestions: [] };
        byCase[k].reviews++;
        byCase[k].verdicts[e.verdict] = (byCase[k].verdicts[e.verdict] || 0) + 1;
        byCase[k].problemes.push(...(e.problemes || []));
        byCase[k].suggestions.push(...(e.suggestions || []));
    }
    return { total: entries.length, byCase: Object.values(byCase).sort((a, b) => (b.verdicts.nul || 0) - (a.verdicts.nul || 0)) };
}
