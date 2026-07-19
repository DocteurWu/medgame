import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function runIntegrationTest() {
    console.log('[Integration Test] Starting MCP Server via StdioClientTransport...');
    
    // StdioClientTransport will spawn the server process directly
    const transport = new StdioClientTransport({
        command: 'node',
        args: ['mcp-server.js'],
        cwd: rootDir,
        env: { ...process.env, LLM_API_KEY: '' } // Force fallback
    });

    const client = new Client({
        name: 'test-integration-client',
        version: '1.0.0'
    }, {
        capabilities: {}
    });

    await client.connect(transport);
    console.log('[Integration Test] Connected to MCP Stdio!');

    // Wait a moment for the server's WebSocket/HTTP listener to bind to 8081
    console.log('[Integration Test] Waiting for WebSocket server to bind on 8081...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log('[Integration Test] Connecting WebSocket spectator client to ws://127.0.0.1:8081...');
    const ws = new WebSocket('ws://127.0.0.1:8081');
    
    const wsEvents = [];
    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        console.log(`[WS Broadcast Received] Event: ${msg.type}`);
        wsEvents.push(msg);
    });

    ws.on('error', (err) => {
        console.error('[WS Client Error]', err.message);
    });

    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });
    console.log('[Integration Test] Connected to WS server!');

    // 1. List cases
    console.log('[Integration Test] Calling list_cases...');
    const casesRes = await client.callTool({ name: 'list_cases', arguments: {} });
    console.log('[Integration Test] list_cases response received.');

    // 2. Start case
    console.log('[Integration Test] Calling start_case with CARDIO_angor_stable.json...');
    const startRes = await client.callTool({
        name: 'start_case',
        arguments: { caseId: 'CARDIO_angor_stable.json' }
    });
    const startState = JSON.parse(startRes.content[0].text);
    console.log(`[Integration Test] start_case response: patient ${startState.patient.prenom} ${startState.patient.nom}`);

    // 3. Send chat action
    console.log('[Integration Test] Calling send_chat_action...');
    const chatRes = await client.callTool({
        name: 'send_chat_action',
        arguments: { text: 'Quels sont vos antécédents médicaux ?' }
    });
    const chatState = JSON.parse(chatRes.content[0].text);
    console.log(`[Integration Test] send_chat_action response length: ${chatState.chatHistory.length}`);
    console.log(`[Integration Test] Last message: ${chatState.chatHistory[chatState.chatHistory.length - 1].content}`);

    // Wait for WS events to settle
    console.log('[Integration Test] Waiting for broadcast events...');
    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log('[Integration Test] Shutting down client & WebSocket...');
    await client.close();
    ws.close();

    console.log('\n--- VERIFICATION ---');
    console.log(`Total WS events received: ${wsEvents.length}`);
    const eventTypes = wsEvents.map(e => e.type);
    console.log(`Events: ${eventTypes.join(', ')}`);

    if (eventTypes.includes('case_started') && eventTypes.includes('chat_reply')) {
        console.log('🎉 INTEGRATION TEST PASSED! The server, MCP stdio communication, and WebSocket broadcasting are working perfectly together!');
        process.exit(0);
    } else {
        console.error('❌ INTEGRATION TEST FAILED! Expected case_started and chat_reply events.');
        process.exit(1);
    }
}

runIntegrationTest().catch(err => {
    console.error('[Fatal Error]', err);
    process.exit(1);
});
