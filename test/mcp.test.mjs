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

    await t.test('listTools should return all 10 medgame tools', async () => {
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
        assert.equal(toolNames.length, 10);
    });

    await t.test('callTool list_cases should return available case files', async () => {
        const response = await client.callTool({ name: 'list_cases', arguments: {} });
        assert.ok(!response.isError);
        assert.equal(response.content[0].type, 'text');
        
        const cases = JSON.parse(response.content[0].text);
        assert.ok(cases.cardiologie);
    });

    await t.test('callTool start_case should launch angor stable case', async () => {
        const response = await client.callTool({ name: 'start_case', arguments: { caseId: 'CARDIO_angor_stable.json' } });
        assert.ok(!response.isError);
        
        const state = JSON.parse(response.content[0].text);
        assert.equal(state.success, true);
        assert.equal(state.caseId, 'cardio_angor_stable');
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
        
        restoreFetch();
    });

    await t.test('callTool submit_case_feedback should persist review to JSONL', async () => {
        const tmpFile = path.join(os.tmpdir(), `medgame-feedback-test-${Date.now()}.jsonl`);
        process.env.MEDGAME_FEEDBACK_FILE = tmpFile;

        const response = await client.callTool({
            name: 'submit_case_feedback',
            arguments: {
                caseId: 'cardio_angor_stable',
                verdict: 'bon',
                problemes: ['Dialogue un peu robotique sur les antécédents'],
                suggestions: ['Ajouter un verrou sémiologique sur les facteurs de risque']
            }
        });
        assert.ok(!response.isError);

        const result = JSON.parse(response.content[0].text);
        assert.equal(result.success, true);
        assert.equal(result.caseId, 'cardio_angor_stable');
        assert.equal(result.verdict, 'bon');

        const raw = await fs.readFile(tmpFile, 'utf-8');
        const lines = raw.trim().split('\n').map(l => JSON.parse(l));
        const last = lines[lines.length - 1];
        assert.equal(last.caseId, 'cardio_angor_stable');
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
