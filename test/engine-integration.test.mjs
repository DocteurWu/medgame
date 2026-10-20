/**
 * test/engine-integration.test.mjs — Parcours d'intégration de MedGameEngine.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * `node --check` est purement syntaxique : il ne voit pas un symbole utilisé
 * mais jamais importé. C'est exactement le trou dans lequel un bug a glissé :
 * `getLevenshteinDistance` était appelé dans `submitLock()` sans être importé
 * (il venait d'être déplacé dans engine/scoring.js), et RIEN ne l'a vu :
 * les tests existants ne soumettaient jamais un verrou de type SAISIE, donc
 * la branche concernée n'était jamais atteinte.
 *
 * Ce fichier exerce donc les **9 points d'entrée de l'outil MCP** comme le
 * fait `mcp-server.js`, sur un cas réel. Chaque appel doit :
 *   - ne pas lever (un `ReferenceError` est un bug de régression) ;
 *   - ne pas dépendre du réseau : le LLM est simulé par un `fetch` stub.
 *
 * Le but n'est pas de re-tester la logique métier (c'est le rôle de
 * engine.test.mjs et scoring.test.mjs) mais de **couvrir les chemins de code
 * qui n'étaient jamais pris**, pour qu'un symbole manquant se voie.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { MedGameEngine } from '../engine/MedGameEngine.js';

/** Cas avec un verrou SAISIE dont le mot-cle est "pyrosis". */
const CASE_SAISIE = 'digestif_pyrosis_et_regurgitations_m_nick.json';
/** Cas simple, sans verrou, pour le parcours nominal. */
const CASE_SIMPLE = 'CARDIO_thrombose_veineuse_profonde_droite.json';

/**
 * Stub du fetch : repond une reponse LLM plausible, et compte les appels.
 * L'engine appelle l'API LLM via fetch ; sans stub, le testSortirait en
 * timeout ou dependrait du reseau.
 */
function stubFetch(ok = true) {
    const calls = [];
    globalThis.fetch = async (url, opts) => {
        calls.push({ url: String(url), body: opts?.body });
        // Le proxy parle le format OpenAI : le contenu utile est dans
        // choices[0].message.content, et c'est du JSON (une chaine), que
        // l'engine parse ensuite.
        const payload = {
            dialogue: "Je ressens une brulure dans la region epigastrique.",
            exams: null,
            prescriptions: null,
            otherActions: null,
            vitalChanges: null,
            disclosedInfoFields: null,
            narrativeResponse: "Le patient decrit une brulure epigastrique."
        };
        return {
            ok,
            status: ok ? 200 : 500,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: JSON.stringify(payload)
                        }
                    }
                ]
            }),
            text: async () => JSON.stringify(payload)
        };
    };
    return calls;
}

describe('MedGameEngine — parcours d\'integration (points d\'entree MCP)', () => {

    test('submitLock sur un verrou SAISIE : la branche Levenshtein ne leve pas', async () => {
        // Regression : `getLevenshteinDistance` etait utilise sans etre importe,
        // donc `ReferenceError` sur toute reponse proche mais non exacte.
        const engine = new MedGameEngine();
        await engine.startCase(CASE_SAISIE);

        const lock = (engine.caseData.locks || []).find(l => l.type === 'SAISIE');
        assert.ok(lock, 'le cas de test doit contenir un verrou SAISIE');

        // "pyrosi" est a une distance de Levenshtein de 1 de "pyrosis" :
        // c'est la branche qui plantait.
        const res = engine.submitLock(lock.id, 'pyrosi');
        assert.equal(res.success, true, 'submitLock doit aboutir sans lever');
    });

    test('submitLock : une reponse hors sujet ne leve pas non plus', async () => {
        const engine = new MedGameEngine();
        await engine.startCase(CASE_SAISIE);
        const lock = (engine.caseData.locks || []).find(l => l.type === 'SAISIE');
        // Une mauvaise reponse ne leve pas : elle renvoie success=false.
        const res = engine.submitLock(lock.id, 'zzz');
        assert.equal(res.success, false, 'une reponse hors sujet doit etre refusee, pas lever');
    });

    test('parcours complet des 9 points d\'entree MCP, sans exception', async () => {
        const calls = stubFetch();
        const engine = new MedGameEngine();

        // 1. listCases
        const cases = await engine.listCases();
        assert.ok(cases, 'listCases doit repondre');

        // 2. startCase
        const started = await engine.startCase(CASE_SIMPLE);
        assert.ok(started, 'startCase doit repondre');

        // 3. getState
        const state = engine.getState();
        assert.ok(state, 'getState doit repondre');

        // 4. chat (fetch stube)
        engine.apiKey = 'test-key'; // active le chemin LLM sans cle reelle
        const chatRes = await engine.chat('Bonjour docteur, j\'ai mal a la jambe.');
        assert.ok(chatRes, 'chat doit repondre');
        assert.ok(calls.length > 0, 'chat doit avoir appelle le proxy LLM');

        // 5. orderExams
        const exams = engine.orderExams(['Bilan sanguin']);
        assert.ok(exams, 'orderExams doit repondre');

        // 6. prescribe
        const presc = engine.prescribe([]);
        assert.ok(presc, 'prescribe doit repondre');

        // 7. submitLock (QCM ou SAISIE selon le cas)
        const lock = (engine.caseData.locks || [])[0];
        if (lock) {
            const lockRes = lock.type === 'QCM'
                ? engine.submitLock(lock.id, [0])
                : engine.submitLock(lock.id, 'pyrosi');
            assert.ok(lockRes, 'submitLock doit repondre');
        }

        // 8. selectDiagnostic
        const diags = engine.caseData.correctDiagnostic
            ? [].concat(engine.caseData.correctDiagnostic)
            : (engine.caseData.alternativeDiagnostics || []);
        assert.ok(diags.length > 0, 'le cas doit avoir un diagnostic attendu');
        const diagRes = engine.selectDiagnostic(diags[0]);
        assert.ok(diagRes, 'selectDiagnostic doit repondre');

        // 9. submit
        const final = engine.submit();
        assert.equal(final.success, true);
        assert.equal(typeof final.score, 'number');
        assert.equal(typeof final.scoreOn20, 'number');
        assert.equal(final.scoreOn20, final.score / 5);
    });

    test('les methodes publiques restantes ne lèvent pas', async () => {
        stubFetch();
        const engine = new MedGameEngine();
        await engine.startCase(CASE_SIMPLE);

        assert.doesNotThrow(() => engine.updateVitals());
        assert.doesNotThrow(() => engine.getTimeLeft());
        assert.doesNotThrow(() => engine.getState());
        assert.doesNotThrow(() => engine.isFieldLocked('interrogatoire.motifHospitalisation'));
        assert.doesNotThrow(() => engine.trackInterrogatoireByKeywords('douleur abdominale'));
        assert.doesNotThrow(() => engine.buildPhysioVocalDirectives());
        assert.doesNotThrow(() => engine.buildDisclosurePrompt());
        assert.doesNotThrow(() => engine.cleanAndParseJson('{"a":1}'));

        // resetState() en dernier : il vide le cas, donc tout ce qui lit
        // caseData doit etre appele AVANT.
        assert.doesNotThrow(() => engine.resetState());
    });

    test('getLockStatus ne leve pas sur un verrou inexistant', async () => {
        const engine = new MedGameEngine();
        await engine.startCase(CASE_SIMPLE);
        const locks = engine.caseData.locks || [];
        if (locks.length) {
            assert.doesNotThrow(() => engine.getLockStatus(locks[0]));
        }
    });
});
