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
import {
    readCase, auditCase, auditAllCases, proposeCasePatch, playScriptedConsultation,
    runTests, validateCases, readFeedback
} from './engine/agent-tools.js';

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
        version: "2.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
        instructions: `Medgame : simulateur de consultation médicale (ECOS) pour étudiants. Le patient est joué par UN SEUL moteur (js/patient-brain.js), le même que dans le navigateur : ce que vous observez ici est ce que vivent les étudiants.

Deux usages :
1. JOUER un cas comme un étudiant : start_case → send_chat_action (une réplique ou une action par appel) → order_exams / prescribe_treatments → select_diagnostic → submit_game → submit_case_feedback. Après chaque send_chat_action, lisez state.lastTurn : réplique du patient, émotion, et alliance (confiance 0-100, variation et motif). Sous 15 de confiance le patient pose un ultimatum ; une réplique non empathique et il part (le dialogue est alors fermé).
2. AMÉLIORER le jeu : audit_all_cases (repérer les cas faibles) → audit_case / get_case → play_scripted_consultation (rejouer un entretien type, voir où la confiance chute et si le patient livre ses informations cachées) → propose_case_patch (essai à blanc, puis apply=true si l'audit s'améliore) → validate_cases et run_tests (ne rien casser). get_patient_prompt montre le prompt exact envoyé au modèle ; analyze_utterance teste une formulation sans appel LLM.

Règles : un diagnostic et une soumission sont définitifs. N'appliquez un patch qu'après un essai à blanc lu. Écrivez les cas en français, le patient parle comme une personne, jamais en jargon.`
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

// ── Outils d'amélioration (agents testeurs) ────────────────────────────────
tools.push(
    {
        name: "get_patient_prompt",
        description: "Return the exact system prompt the patient model receives in the current state (persona, disclosure rules, vitals, alliance, response schema). Use it to understand or debug the patient's behaviour.",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "get_turn_log",
        description: "Return every turn played on the current case: input, patient line, emotion, alliance trust/delta/feedback, disclosed fields, exams, prescriptions, latency.",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "analyze_utterance",
        description: "Instant local analysis of a doctor's sentence, no LLM: medical jargon (with the lay wording to use instead), greeting, empathy, reformulation, open question, rapid-fire questions, brusque tone, and the indicative trust delta.",
        inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] }
    },
    {
        name: "get_case",
        description: "Return the full JSON of a case file from data/ (for reading before proposing a patch).",
        inputSchema: { type: "object", properties: { caseId: { type: "string" } }, required: ["caseId"] }
    },
    {
        name: "audit_case",
        description: "Static quality audit of one case (free, no LLM): playability errors (diagnosis not selectable, treatment not prescribable, exam without result) and live-consultation quality (persona, initial trust/anxiety, hidden info to unlock, opening line, jargon in patient lines). Returns a 0-100 score and issues with fixes.",
        inputSchema: { type: "object", properties: { caseId: { type: "string" } }, required: ["caseId"] }
    },
    {
        name: "audit_all_cases",
        description: "Audit every case and return the average score, the 15 weakest cases and the most common issues. Start improvement work here.",
        inputSchema: { type: "object", properties: {} }
    },
    {
        name: "play_scripted_consultation",
        description: "Play a whole consultation on a fresh engine (does not disturb the current game): the given doctor lines in order, then optional exams, treatments, diagnosis and scoring. Returns the transcript with trust per turn, feedback, disclosed fields, latency, the alliance summary and the evaluation. Uses the real LLM (one call per line).",
        inputSchema: {
            type: "object",
            properties: {
                caseId: { type: "string" },
                lines: { type: "array", items: { type: "string" }, description: "Doctor lines, 1 to 40." },
                exams: { type: "array", items: { type: "string" } },
                treatments: { type: "array", items: { type: "string" } },
                diagnostic: { type: "string" },
                submit: { type: "boolean", description: "Score the case at the end." }
            },
            required: ["caseId", "lines"]
        }
    },
    {
        name: "propose_case_patch",
        description: "Propose a change to a case as a JSON Merge Patch (RFC 7396: objects merge, arrays replace, null deletes). Dry run by default: returns changed paths, audit score before/after and schema validity. With apply=true the file is written only if the schema passes and the audit does not get worse; every write is logged with the previous values in data/case-patches.jsonl.",
        inputSchema: {
            type: "object",
            properties: {
                caseId: { type: "string" },
                patch: { type: "object" },
                reason: { type: "string", description: "Why this change improves the case." },
                apply: { type: "boolean" }
            },
            required: ["caseId", "patch", "reason"]
        }
    },
    {
        name: "run_tests",
        description: "Run the Node test suite declared in package.json, or only the files whose name contains 'filter' (e.g. 'patient', 'engine', 'mcp'). Returns pass/fail counts and failing test names.",
        inputSchema: { type: "object", properties: { filter: { type: "string" } } }
    },
    {
        name: "validate_cases",
        description: "Run scripts/validate-cases.mjs (JSON schema + business consistency of every case). Run it after any applied patch.",
        inputSchema: { type: "object", properties: { strict: { type: "boolean" } } }
    },
    {
        name: "list_feedback",
        description: "Aggregate the reviews left with submit_case_feedback, per case, worst first.",
        inputSchema: { type: "object", properties: {} }
    }
);

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

const textResult = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });

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

            // Outils d'amélioration : pas d'événement pour les spectateurs.
            case "get_patient_prompt":
                if (!engine.caseData) throw new Error("Aucun cas en cours : appelez start_case.");
                return textResult({ caseId: engine.caseData.id, prompt: engine.buildSystemPrompt() });
            case "get_turn_log":
                return textResult({ caseId: engine.caseData?.id || null, turns: engine.turnLog || [], alliance: engine.alliance?.summary() || null });
            case "analyze_utterance":
                return textResult(globalThis.PatientLiveCore.analyzeUtterance(args.text));
            case "get_case":
                return textResult((await readCase(args.caseId)).data);
            case "audit_case":
                return textResult(auditCase((await readCase(args.caseId)).data));
            case "audit_all_cases":
                return textResult(await auditAllCases());
            case "play_scripted_consultation":
                return textResult(await playScriptedConsultation(new MedGameEngine(), args));
            case "propose_case_patch":
                return textResult(await proposeCasePatch(args));
            case "run_tests":
                return textResult(await runTests(args || {}));
            case "validate_cases":
                return textResult(await validateCases(args || {}));
            case "list_feedback":
                return textResult(await readFeedback());
            
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
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, HTTP-Referer, X-Title, X-User-Token');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        const pathname = req.url.split('?')[0];

        if (pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', viewersConnected: viewers.size, activeCase: engine.caseData?.id || null }));
        } else if (pathname === '/llm-proxy' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });
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
        } else if (pathname === '/tts-proxy' && req.method === 'POST') {
            // Voix du patient (js/patient-voice.js). Sans TTS_API_KEY : 501, et
            // le client bascule sur la synthèse vocale du navigateur.
            let body = '';
            req.on('data', chunk => { body += chunk; if (body.length > 8000) req.destroy(); });
            req.on('end', async () => {
                try {
                    dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });
                    const apiKey = process.env.TTS_API_KEY;
                    if (!apiKey) {
                        res.writeHead(501, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'TTS_API_KEY is not configured in .env' }));
                        return;
                    }
                    const parsed = JSON.parse(body || '{}');
                    const text = typeof parsed.text === 'string' ? parsed.text.trim().slice(0, 600) : '';
                    if (!text) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'text is required' }));
                        return;
                    }
                    const upstream = await fetch(process.env.TTS_API_URL || 'https://api.openai.com/v1/audio/speech', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({
                            model: process.env.TTS_MODEL || 'gpt-4o-mini-tts',
                            input: text,
                            voice: /^[a-z]{2,20}$/.test(parsed.voice || '') ? parsed.voice : 'alloy',
                            ...(typeof parsed.instructions === 'string' ? { instructions: parsed.instructions.slice(0, 600) } : {}),
                            ...(Number.isFinite(parsed.speed) ? { speed: Math.min(1.5, Math.max(0.7, parsed.speed)) } : {}),
                            response_format: 'mp3'
                        })
                    });
                    if (!upstream.ok) {
                        const errText = await upstream.text().catch(() => '');
                        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: errText.slice(0, 300) || `TTS upstream ${upstream.status}` }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': upstream.headers.get('Content-Type') || 'audio/mpeg', 'Cache-Control': 'no-store' });
                    res.end(Buffer.from(await upstream.arrayBuffer()));
                } catch (err) {
                    console.error('[MCP TTS] Request failed:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
        } else if (pathname === '/jev-proxy' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });
                    const apiKey = process.env.TYPESAFE_API_KEY;
                    const jevUrl = process.env.JEV_API_URL || 'https://api.typesafe.ai/v1/systemone';

                    if (!apiKey) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "TYPESAFE_API_KEY is not configured in .env" }));
                        return;
                    }

                    let parsed;
                    try {
                        parsed = JSON.parse(body);
                    } catch {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "Invalid JSON body" }));
                        return;
                    }

                    if (typeof parsed !== 'object' || parsed === null) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "Request body must be an object" }));
                        return;
                    }

                    const state = typeof parsed.state === 'string' ? parsed.state : '';
                    if (state.length > 60000) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "State length exceeds 60000 characters limit" }));
                        return;
                    }

                    const questions = parsed.questions;
                    if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "questions must be an object" }));
                        return;
                    }

                    const questionKeys = Object.keys(questions);
                    if (questionKeys.length === 0) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "questions object cannot be empty" }));
                        return;
                    }
                    if (questionKeys.length > 80) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: "questions count exceeds 80 limit" }));
                        return;
                    }

                    const model = typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : 'jev-latest';

                    console.error(`[MCP Jev-Proxy] Forwarding request to TypeSafe System One (questions: ${questionKeys.length})...`);
                    const response = await fetch(jevUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`,
                            'X-Title': 'MedGame'
                        },
                        body: JSON.stringify({
                            model,
                            state,
                            questions
                        })
                    });

                    const respText = await response.text();
                    res.writeHead(response.status, {
                        'Content-Type': response.headers.get('Content-Type') || 'application/json'
                    });
                    res.end(respText);
                } catch (err) {
                    console.error('[MCP Jev-Proxy] Request failed:', err);
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
