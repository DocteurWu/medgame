import fs from 'fs/promises';
import dotenv from 'dotenv';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });
import { MedGameEngine } from './engine/MedGameEngine.js';

// Initialize the game engine
export const engine = new MedGameEngine();

// Initialize viewers tracking
const viewers = new Set();
let isListening = false;

export function broadcast(message) {
    const raw = JSON.stringify(message);
    for (const ws of viewers) {
        if (ws.readyState === 1) { // OPEN
            try {
                ws.send(raw);
            } catch (err) {
                console.error('[MCP Server] Failed to send WS broadcast:', err.message);
            }
        }
    }

    // If this instance is not the WebSocket listener, forward the message to the process that is
    if (!isListening) {
        try {
            const client = new WebSocket('ws://127.0.0.1:8081');
            client.on('open', () => {
                client.send(JSON.stringify({ ...message, forwarded: true }));
                client.close();
            });
            client.on('error', () => {
                // Silently ignore if server is not up
            });
        } catch (e) {
            // ignore
        }
    }
}

// Configure MCP Server
export const mcpServer = new Server(
    {
        name: "medgame-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

export const tools = [
    {
        name: "list_cases",
        description: "List all available medical cases in MedGame.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "start_case",
        description: "Start a specific medical case. This loads the patient vitals, locks, and triggers a websocket case_started event.",
        inputSchema: {
            type: "object",
            properties: {
                caseId: {
                    type: "string",
                    description: "The case ID or filename to start (e.g. CARDIO_angor_stable.json)"
                }
            },
            required: ["caseId"]
        },
    },
    {
        name: "get_game_state",
        description: "Retrieve the full current game state including patient parameters, vital signs, active examinations, locks, prescriptions, and score.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "send_chat_action",
        description: "Submit a message or clinical action in natural language to the patient. E.g. 'Bonjour, comment allez-vous ?' or 'Injecter 1g de Paracétamol'. Requires a working LLM_API configuration (.env). Physical gestures (inspection, palpation, auscultation) detected here feed the clinical exam score.",
        inputSchema: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "The verbal query or clinical action text."
                }
            },
            required: ["text"]
        },
    },
    {
        name: "order_exams",
        description: "Prescribe complementary exams (e.g. ['ECG', 'Bilan sanguin']). Each NEW exam consumes 60s of in-game time. Ordering is definitive.",
        inputSchema: {
            type: "object",
            properties: {
                exams: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of exam names to order."
                }
            },
            required: ["exams"]
        },
    },
    {
        name: "prescribe_treatments",
        description: "Prescribe therapeutic treatments (e.g. ['Bêta-bloquant', 'Aspirine']). Append-only and definitive: prescriptions cannot be revoked. Prescribing a fatal/contraindicated treatment triggers an immediate game over.",
        inputSchema: {
            type: "object",
            properties: {
                treatments: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of treatment names."
                }
            },
            required: ["treatments"]
        },
    },
    {
        name: "submit_lock_answer",
        description: "Attempt to solve a semiological lock/challenge to access locked patient details. Can be SAISIE (text) or QCM (array of selected option indices).",
        inputSchema: {
            type: "object",
            properties: {
                lockId: {
                    type: "string",
                    description: "The unique ID of the lock to unlock."
                },
                answer: {
                    oneOf: [
                        { type: "string" },
                        { type: "integer" },
                        { type: "array", items: { type: "integer" } }
                    ],
                    description: "The text response (for SAISIE) or choice index/indices (for QCM)."
                }
            },
            required: ["lockId", "answer"]
        },
    },
    {
        name: "select_diagnostic",
        description: "Select the final diagnostic choice from the available possible diagnostics. SINGLE-SHOT under ECOS rules: the first selection is locked and cannot be changed. Choose wisely before calling.",
        inputSchema: {
            type: "object",
            properties: {
                diagnostic: {
                    type: "string",
                    description: "The name of the diagnosis."
                }
            },
            required: ["diagnostic"]
        },
    },
    {
        name: "submit_game",
        description: "Submit the case for final evaluation and composite scoring. Ends the case. DEFINITIVE: a case can only be submitted once.",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    {
        name: "submit_case_feedback",
        description: "After playing a case, submit a review of its quality: verdict, problems encountered, and concrete suggestions to make the experience better for a human medical student (ECOS). Call this once per played case.",
        inputSchema: {
            type: "object",
            properties: {
                caseId: {
                    type: "string",
                    description: "The ID of the case that was just played (e.g. 'cardio_angor_stable')."
                },
                verdict: {
                    type: "string",
                    enum: ["bon", "moyen", "nul"],
                    description: "Overall verdict on the case quality."
                },
                problemes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Problems encountered while playing: inconsistencies, impossible locks, robotic dialogue, missing info, scoring quirks..."
                },
                suggestions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Concrete suggestions to improve fun, clarity, immersion or pedagogy for human players."
                }
            },
            required: ["caseId", "verdict"]
        },
    }
];

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
});

// Persist an AI review of a case as one JSON line in data/feedback.jsonl
export async function submitCaseFeedback(args) {
    const entry = {
        date: new Date().toISOString(),
        caseId: args.caseId,
        verdict: args.verdict,
        problemes: Array.isArray(args.problemes) ? args.problemes : [],
        suggestions: Array.isArray(args.suggestions) ? args.suggestions : []
    };
    const feedbackPath = process.env.MEDGAME_FEEDBACK_FILE || path.join(process.cwd(), 'data', 'feedback.jsonl');
    await fs.mkdir(path.dirname(feedbackPath), { recursive: true });
    await fs.appendFile(feedbackPath, JSON.stringify(entry) + '\n', 'utf-8');
    return { success: true, savedTo: feedbackPath, ...entry };
}

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
        let result;
        let eventType = 'state_changed';
        let eventDetails = {};

        switch (name) {
            case "list_cases":
                result = await engine.listCases();
                return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
            
            case "start_case":
                result = await engine.startCase(args.caseId);
                eventType = 'case_started';
                eventDetails = { caseId: args.caseId };
                break;
            
            case "get_game_state":
                result = engine.getState();
                break;
            
            case "send_chat_action":
                result = await engine.chat(args.text);
                eventType = 'chat_reply';
                eventDetails = { text: args.text, response: result.response, parsed: result.parsed };
                result = engine.getState(); // return full state update
                break;
            
            case "order_exams":
                result = engine.orderExams(args.exams);
                eventType = 'exams_ordered';
                eventDetails = { exams: args.exams };
                result = engine.getState();
                break;
            
            case "prescribe_treatments":
                result = engine.prescribe(args.treatments);
                eventType = 'treatments_prescribed';
                eventDetails = { treatments: args.treatments };
                result = engine.getState();
                break;
            
            case "submit_lock_answer":
                result = engine.submitLock(args.lockId, args.answer);
                eventType = 'lock_resolved';
                eventDetails = { lockId: args.lockId, answer: args.answer, unlocked: result.unlocked, message: result.message };
                result = engine.getState();
                break;
            
            case "select_diagnostic":
                result = engine.selectDiagnostic(args.diagnostic);
                eventType = 'diagnostic_selected';
                eventDetails = { diagnostic: args.diagnostic };
                result = engine.getState();
                break;
            
            case "submit_game":
                const submitRes = engine.submit();
                eventType = 'case_submitted';
                eventDetails = { results: submitRes };
                result = {
                    success: true,
                    score: submitRes.score,
                    correctDiagnostic: submitRes.correctDiagnostic,
                    correctTreatments: submitRes.correctTreatments,
                    evaluation: submitRes.results,
                    state: engine.getState()
                };
                break;

            case "submit_case_feedback":
                result = await submitCaseFeedback(args);
                eventType = 'case_feedback';
                eventDetails = { caseId: args.caseId, verdict: args.verdict };
                break;
            
            default:
                throw new Error(`Tool not found: ${name}`);
        }

        // Broadcast the update to spectator viewers
        broadcast({
            type: eventType,
            details: eventDetails,
            state: engine.getState()
        });

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
        return {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true
        };
    }
});

// Check if running as main process
const isMain = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase();

if (isMain) {
    // Setup HTTP server with health check, secure LLM proxy, and WebSocket upgrades
    const httpServer = http.createServer((req, res) => {
        // CORS : outil de développement local uniquement — restreint aux origines locales
        // (jamais exposé publiquement : ne pas lancer ce serveur derrière un domaine public)
        const origin = req.headers.origin || '';
        const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
        if (isLocalOrigin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, HTTP-Referer, X-Title');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', viewersConnected: viewers.size, activeCase: engine.caseData?.id || null }));
        } else if (req.url === '/llm-proxy' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const parsed = JSON.parse(body);
                    const apiKey = process.env.LLM_API_KEY;
                    const apiUrl = process.env.LLM_API_URL || 'https://api.deepseek.com/chat/completions';

                    if (!apiKey) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "LLM_API_KEY is not configured in .env" }));
                        return;
                    }

                    console.error('[MCP Proxy] Forwarding request to LLM API...');
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                            'HTTP-Referer': 'http://localhost:8080',
                            'X-Title': 'MedGame'
                        },
                        body: JSON.stringify({
                            model: parsed.model || process.env.LLM_MODEL || 'deepseek-chat',
                            messages: parsed.messages,
                            temperature: parsed.temperature ?? 0.7,
                            // Plafond (et non plancher) : aligné sur js/llm-client.js
                            max_tokens: Math.min(Math.max(parsed.max_tokens ?? 300, 50), 4000),
                            stream: parsed.stream ?? false,
                            ...(parsed.response_format ? { response_format: parsed.response_format } : {}),
                            ...(parsed.top_p !== undefined ? { top_p: parsed.top_p } : {})
                        })
                    });

                    res.writeHead(response.status, {
                        'Content-Type': response.headers.get('Content-Type') || 'application/json'
                    });

                    // Read from response body and write directly to client response stream
                    const reader = response.body.getReader();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        res.write(value);
                    }
                    res.end();
                } catch (err) {
                    console.error('[MCP Proxy] Request failed:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    const wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    });

    wss.on('connection', (ws) => {
        console.error('[MCP Server] Viewer client connected.');
        viewers.add(ws);
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.forwarded) {
                    delete msg.forwarded;
                    broadcast(msg);
                }
            } catch (e) {}
        });
        
        // Immediately send the current game state to sync up
        if (engine.caseData) {
            ws.send(JSON.stringify({ type: 'state_changed', state: engine.getState() }));
        }

        ws.on('close', () => {
            console.error('[MCP Server] Viewer client disconnected.');
            viewers.delete(ws);
        });

        ws.on('error', (err) => {
            console.error('[MCP Server] WS error:', err.message);
            viewers.delete(ws);
        });
    });

    // Port binding and EADDRINUSE handling
    httpServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            isListening = false;
            console.error('[MCP Server] WARNING: Port 8081 is already in use. Forwarding active to existing listener.');
        } else {
            console.error('[MCP Server] Server error:', err);
        }
    });

    httpServer.listen(8081, '127.0.0.1', () => {
        isListening = true;
        console.error('[MCP Server] WebSocket & Health HTTP server listening on 127.0.0.1:8081');
    });

    // Run the MCP Stdio server
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('[MCP Server] MedGame stdio MCP Server running!');
}
