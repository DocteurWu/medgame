import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { mcpServer, engine } from "../mcp-server.js";

const originalFetch = globalThis.fetch;

function setupMockFetch(dialogueResponse, exams = null, prescriptions = null) {
    globalThis.fetch = async () => {
        const jsonContent = JSON.stringify({
            dialogue: dialogueResponse,
            exams: exams,
            prescriptions: prescriptions,
            otherActions: null,
            vitalChanges: null,
            narrativeResponse: "Le patient répond."
        });
        return {
            ok: true,
            status: 200,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: jsonContent
                        }
                    }
                ]
            })
        };
    };
}

function restoreFetch() {
    globalThis.fetch = originalFetch;
}

test('MedGame MCP Server — Tool Registration & Interaction', async (t) => {
    // Create in-memory transports
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    // Connect Server to serverTransport
    await mcpServer.connect(serverTransport);

    // Initialize and connect Client to clientTransport
    const client = new Client({
        name: "test-client",
        version: "1.0.0"
    }, {
        capabilities: {}
    });
    
    await client.connect(clientTransport);

    await t.test('listTools should return the 10 game tools and the 11 improvement tools', async () => {
        const result = await client.listTools();
        assert.ok(result);
        assert.ok(Array.isArray(result.tools));

        const toolNames = result.tools.map(t => t.name);
        assert.ok(toolNames.includes('list_cases'));
        assert.ok(toolNames.includes('start_case'));
        assert.ok(toolNames.includes('get_game_state'));
        assert.ok(toolNames.includes('send_chat_action'));
        assert.ok(toolNames.includes('order_exams'));
        assert.ok(toolNames.includes('prescribe_treatments'));
        assert.ok(toolNames.includes('submit_lock_answer'));
        assert.ok(toolNames.includes('select_diagnostic'));
        assert.ok(toolNames.includes('submit_game'));
        assert.ok(toolNames.includes('submit_case_feedback'));
        for (const name of ['get_patient_prompt', 'get_turn_log', 'analyze_utterance', 'get_case', 'audit_case',
            'audit_all_cases', 'play_scripted_consultation', 'propose_case_patch', 'run_tests', 'validate_cases', 'list_feedback']) {
            assert.ok(toolNames.includes(name), name);
        }
        assert.equal(toolNames.length, 21);
        assert.equal(new Set(toolNames).size, 21, 'pas de doublon');
    });

    await t.test('le serveur explique aux agents comment jouer et améliorer', async () => {
        const instructions = client.getInstructions();
        assert.match(instructions || '', /patient-brain/);
        assert.match(instructions || '', /propose_case_patch/);
    });

    await t.test('analyze_utterance et audit_case répondent sans LLM', async () => {
        const a = JSON.parse((await client.callTool({ name: 'analyze_utterance', arguments: { text: 'Avez-vous une orthopnée ?' } })).content[0].text);
        assert.equal(a.jargon[0].term, 'orthopnee');
        const audit = JSON.parse((await client.callTool({ name: 'audit_case', arguments: { caseId: 'cardio_douleur_thoracique_mme_bennet' } })).content[0].text);
        assert.ok(audit.score >= 0 && audit.score <= 100);
        assert.ok(Array.isArray(audit.issues));
        const bad = await client.callTool({ name: 'get_case', arguments: { caseId: '../package.json' } });
        assert.ok(bad.isError || !JSON.parse(bad.content[0].text).scripts, 'aucune lecture hors de data/');
    });

    await t.test('propose_case_patch est un essai à blanc par défaut', async () => {
        const file = path.join(process.cwd(), 'data', 'cardio_douleur_thoracique_mme_bennet.json');
        const before = await fs.readFile(file, 'utf8');
        const r = JSON.parse((await client.callTool({
            name: 'propose_case_patch',
            arguments: { caseId: 'cardio_douleur_thoracique_mme_bennet', patch: { patient: { persona: { confiance: 42 } } }, reason: 'test' }
        })).content[0].text);
        assert.equal(r.applied, false);
        assert.deepEqual(r.changedPaths, ['patient.persona.confiance']);
        assert.equal(await fs.readFile(file, 'utf8'), before, 'le fichier ne doit pas bouger');
    });

    await t.test('callTool list_cases should return available case files', async () => {
        const response = await client.callTool({ name: 'list_cases', arguments: {} });
        assert.ok(!response.isError);
        assert.equal(response.content[0].type, 'text');
        
        const cases = JSON.parse(response.content[0].text);
        assert.ok(cases.cardiologie);
    });

    await t.test('callTool start_case should launch angor stable case', async () => {
        const response = await client.callTool({ name: 'start_case', arguments: { caseId: 'cardio_douleur_thoracique_mme_bennet.json' } });
        assert.ok(!response.isError);
        
        const state = JSON.parse(response.content[0].text);
        assert.equal(state.success, true);
        assert.equal(state.caseId, 'cardio_douleur_thoracique_mme_bennet');
        assert.equal(state.patient.nom, 'Bennet');
        assert.equal(state.isFinished, false);
    });

    await t.test('callTool send_chat_action should trigger conversation LLM call', async () => {
        engine.apiKey = 'test-key'; // Activate LLM pathway
        setupMockFetch("Bonjour docteur. J'ai une douleur dans la poitrine.");

        const response = await client.callTool({ name: 'send_chat_action', arguments: { text: "Quel est votre motif d'hospitalisation ?" } });
        assert.ok(!response.isError);
        
        const state = JSON.parse(response.content[0].text);
        assert.ok(state.chatHistory.length >= 2);
        
        const lastMsg = state.chatHistory[state.chatHistory.length - 1];
        assert.equal(lastMsg.role, 'assistant');
        assert.ok(lastMsg.content.toLowerCase().includes('douleur'));

        // Le tour est lisible par un agent : réplique, alliance, journal.
        assert.ok(state.lastTurn);
        assert.equal(typeof state.lastTurn.alliance.trust, 'number');
        assert.ok(state.alliance && state.alliance.stage);
        const log = JSON.parse((await client.callTool({ name: 'get_turn_log', arguments: {} })).content[0].text);
        assert.equal(log.turns.length, 1);
        const prompt = JSON.parse((await client.callTool({ name: 'get_patient_prompt', arguments: {} })).content[0].text);
        assert.match(prompt.prompt, /ALLIANCE THÉRAPEUTIQUE/);
        assert.match(prompt.prompt, /Bennet/);

        restoreFetch();
    });

    await t.test('play_scripted_consultation joue un entretien complet sur un moteur neuf', async () => {
        const prevKey = process.env.LLM_API_KEY;
        process.env.LLM_API_KEY = 'test-key';
        setupMockFetch("Ça me serre dans la poitrine quand je monte les escaliers.");
        const currentCase = engine.caseData?.id;
        const r = JSON.parse((await client.callTool({
            name: 'play_scripted_consultation',
            arguments: {
                caseId: 'cardio_douleur_thoracique_mme_bennet',
                lines: ['Bonjour, je suis l\'interne. Qu\'est-ce qui vous amène ?', 'Avez-vous une orthopnée ?'],
                submit: true
            }
        })).content[0].text);
        restoreFetch();
        if (prevKey === undefined) delete process.env.LLM_API_KEY; else process.env.LLM_API_KEY = prevKey;
        assert.equal(r.turns.length, 2);
        assert.ok(r.turns[1].delta < 0, 'le jargon fait baisser la confiance');
        assert.match(r.turns[1].feedback, /orthopnee/);
        assert.ok(r.alliance.timeline.length >= 3);
        assert.ok(r.evaluation && typeof r.evaluation.score === 'number');
        assert.equal(engine.caseData?.id, currentCase, 'la partie en cours n\'est pas touchée');
    });

    await t.test('callTool submit_case_feedback should persist review to JSONL', async () => {
        const tmpFile = path.join(os.tmpdir(), `medgame-feedback-test-${Date.now()}.jsonl`);
        process.env.MEDGAME_FEEDBACK_FILE = tmpFile;

        const response = await client.callTool({
            name: 'submit_case_feedback',
            arguments: {
                caseId: 'cardio_douleur_thoracique_mme_bennet',
                verdict: 'bon',
                problemes: ['Dialogue un peu robotique sur les antécédents'],
                suggestions: ['Ajouter un verrou sémiologique sur les facteurs de risque']
            }
        });
        assert.ok(!response.isError);

        const result = JSON.parse(response.content[0].text);
        assert.equal(result.success, true);
        assert.equal(result.caseId, 'cardio_douleur_thoracique_mme_bennet');
        assert.equal(result.verdict, 'bon');

        const raw = await fs.readFile(tmpFile, 'utf-8');
        const lines = raw.trim().split('\n').map(l => JSON.parse(l));
        const last = lines[lines.length - 1];
        assert.equal(last.caseId, 'cardio_douleur_thoracique_mme_bennet');
        assert.equal(last.verdict, 'bon');
        assert.ok(Array.isArray(last.problemes));
        assert.ok(Array.isArray(last.suggestions));

        delete process.env.MEDGAME_FEEDBACK_FILE;
        await fs.unlink(tmpFile);
    });

    // Cleanup transports
    await client.close();
    await mcpServer.close();
});
