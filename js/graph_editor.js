/**
 * MedGame - Éditeur de Graphes Nodal (Node Graph Editor)
 * Permet de créer la trame des scénarios de manière visuelle.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth Admin
    if (typeof window.checkAdminStatus === 'function') {
        window.checkAdminStatus().then(isAdmin => {
            if (!isAdmin) {
                window.location.href = 'index.html';
                return;
            }
            initEditor();
        });
    } else {
        initEditor(); // Fallback for pure testing without server
    }
});

// --- State Management ---
const state = {
    theme: new URLSearchParams(window.location.search).get('theme') || 'Urgences',
    nodes: [], // { id, title, desc, theme, x, y }
    connections: [], // { id, fromNode, fromSocket, toNode, toSocket }

    // Viewport transform
    transform: { x: 0, y: 0, scale: 1 },

    // Interaction states
    isPanning: false,
    panStart: { x: 0, y: 0 },

    draggedNodePreview: null,

    activeTool: 'select', // 'select', 'add', 'link', 'delete'
    selectedNodeId: null,
    selectedConnectionId: null,

    // Connection drawing
    isDrawingConnection: false,
    drawingStartSocket: null, // { nodeId, type: 'output' }

    nextNodeId: 1,
    nextConnectionId: 1,

    // Data
    availableCases: []
};

// --- DOM Elements ---
const viewport = document.getElementById('viewport');
const canvasWrapper = document.getElementById('canvas');
const nodesLayer = document.getElementById('nodes-layer');
const pathsLayer = document.getElementById('paths-layer');
const tempConnection = document.getElementById('temp-connection');
const zoomLevelText = document.getElementById('zoom-level');
const themeBadge = document.getElementById('theme-badge');
const activeThemeTitle = document.getElementById('active-theme-title');
const libraryList = document.getElementById('library-list');

// Tools & Modals
const modal = document.getElementById('node-modal');
const modalTitle = document.getElementById('node-prop-title');
const modalDesc = document.getElementById('node-prop-desc');
const modalTheme = document.getElementById('node-prop-theme');

async function initEditor() {
    // Init UI 
    themeBadge.textContent = state.theme.toUpperCase();
    activeThemeTitle.textContent = state.theme;

    // In Urgences theme, badge color matches
    if (state.theme.toLowerCase() === 'urgences') {
        themeBadge.className = 'badge badge-urgences';
    } else if (state.theme.toLowerCase() === 'pédiatrie') {
        themeBadge.className = 'badge badge-pediatrie';
    }

    setupTools();
    setupViewportNavigation();
    setupModals();

    // Load data from Supabase
    await fetchCases();

    // Load requested base structure if empty
    const graphLoaded = await loadGraph();
    if (!graphLoaded) {
        createInitialStructure();
    }

    // Setup Save button
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.addEventListener('click', saveGraph);
    }

    // Start RAF loop for drawing updates
    requestAnimationFrame(updateDrawLoop);
}

// --- Supabase Data Fetching ---
async function fetchCases() {
    try {
        const supabase = window.supabase;
        if (!supabase) {
            console.error("Supabase client not found");
            renderLibrary();
            return;
        }

        // Map display theme to DB specialty value (lowercase, singular)
        const themeMap = {
            'Urgences': 'urgence',
            'urgences': 'urgence',
            'Pédiatrie': 'pédiatrie',
            'Cardiologie': 'cardiologie',
        };
        const themeFilter = themeMap[state.theme] || state.theme.toLowerCase();
        let query = supabase.from('cases').select('*');

        if (themeFilter && state.theme.toLowerCase() !== 'tous') {
            query = query.ilike('specialty', themeFilter);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Filter out system graph rows so they don't appear in the sidebar
        state.availableCases = (data || []).filter(c => !c.id.toString().startsWith('graph_'));
        renderLibrary();
    } catch (error) {
        console.error("Error fetching cases:", error);
        libraryList.innerHTML = `<div style="color:var(--danger-color); padding:10px;">Erreur de chargement des cas.</div>`;
    }
}

function renderLibrary() {
    libraryList.innerHTML = '';

    // Show real cases from Supabase
    if (state.availableCases.length > 0) {
        state.availableCases.forEach(c => {
            // Recover displayable text from nested JSON content if title is empty
            const caseTitle = c.title || c.content?.interrogatoire?.motifHospitalisation || 'Cas sans titre';
            const caseDesc = c.content?.interrogatoire?.motifHospitalisation || '';
            const item = createLibraryItem({
                title: caseTitle,
                specialty: c.specialty,
                id: c.id,
                desc: caseDesc,
                chapter: c.chapter || ''
            });
            libraryList.appendChild(item);
        });
    } else {
        libraryList.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i class="fas fa-inbox" style="font-size:1.5rem; margin-bottom: 8px; display:block;"></i>Aucun cas dans la DB.</div>';
    }
}

function createLibraryItem(data) {
    const div = document.createElement('div');
    div.className = 'library-item';
    div.draggable = true;

    div.innerHTML = `
        <h4>${data.title}</h4>
        <span>${data.specialty || 'Général'}</span>
    `;

    // Handle standard DnD
    div.addEventListener('dragstart', (e) => {
        const dragData = {
            title: data.title,
            desc: data.desc || '',
            theme: data.specialty || state.theme,
            caseId: data.id
        };
        e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    });

    // Handle click as fallback to spawn at center
    div.addEventListener('click', () => {
        const pt = screenToCanvas(window.innerWidth / 2 + state.transform.x, window.innerHeight / 2 + state.transform.y);
        addNode(data.title, data.desc || '', data.specialty || state.theme, pt.x, pt.y, '', data.id);
        renderAllNodes();
        updateAllConnections();
    });

    return div;
}

// Support Drag & Drop onto viewport
viewport.addEventListener('dragover', (e) => {
    e.preventDefault();
});

viewport.addEventListener('drop', (e) => {
    e.preventDefault();
    try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (!jsonData) return;
        const data = JSON.parse(jsonData);
        const pt = screenToCanvas(e.clientX, e.clientY);
        addNode(data.title, data.desc, data.theme, pt.x, pt.y, '', data.caseId);
        renderAllNodes();
        updateAllConnections();
    } catch (err) {
        console.error("Drop error:", err);
    }
});

// --- Default Structure ---
function createInitialStructure() {
    // Based on user request for Urgences:
    // "deux blocs initiaux en haut, se divisant en une branche complexe à gauche et une branche 'Pédiatrie' à droite, convergeant vers un bloc final 'Anut' en bas"

    let yTop = -300;
    let yMid1 = -100;
    let yMid2 = 100;
    let yBot = 300;

    // Top Blocks
    const n1 = addNode("Cas 1 Départ", "Détresse respiratoire suite à piqûre", state.theme, -300, yTop);
    const n2 = addNode("Cas 2 Départ", "Accident de la route", state.theme, 300, yTop);

    // Left Complex Branch
    const nl1 = addNode("Complication Respiratoire", "Patient s'étouffe", state.theme, -400, yMid1);
    const nl2 = addNode("Choc Anaphylactique", "Baisse de tension critique", state.theme, -400, yMid2);

    // Right Pediatry Branch
    const nr1 = addNode("Enfant Agité", "Gérer la panique", "Pédiatrie", 400, yMid1);
    const nr2 = addNode("Bilan Sanguin Pédiatrique", "Prise de sang difficile", "Pédiatrie", 400, yMid2);

    // Converging Bottom 'Anut'
    const nFinal = addNode("Rencontre Anut", "Fin de scénario, point de validation", state.theme, 0, yBot);

    // Connections
    addConnection(n1, 'output', nl1, 'input');
    addConnection(nl1, 'output', nl2, 'input');
    addConnection(nl2, 'output', nFinal, 'input');

    addConnection(n2, 'output', nr1, 'input');
    addConnection(nr1, 'output', nr2, 'input');
    addConnection(nr2, 'output', nFinal, 'input');

    // Cross connection just to make it complex
    addConnection(n1, 'output', nr1, 'input');

    renderAllNodes();
    updateCanvasTransform();
}

// --- Save & Load Handlers ---

function snapshotNodePositions() {
    document.querySelectorAll('#nodes-layer .node').forEach(el => {
        const id = parseInt(el.getAttribute('data-id'));
        const n = state.nodes.find(n => n.id === id);
        if (n) {
            // Read from style.left/top (set by dragNodeMove)
            const x = parseFloat(el.style.left);
            const y = parseFloat(el.style.top);
            if (!isNaN(x)) n.x = x;
            if (!isNaN(y)) n.y = y;
        }
    });
}

const LOCALSTORAGE_KEY = `medgame_graph_${state.theme.toLowerCase()}`;

async function saveGraph() {
    const btnSave = document.getElementById('btn-save');
    const originalText = btnSave.innerHTML;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
    btnSave.disabled = true;

    try {
        // 1. Snapshot current DOM positions into state (drag updates DOM but state can lag)
        snapshotNodePositions();

        const contentToSave = {
            nodes: state.nodes,
            connections: state.connections,
            transform: state.transform,
            nextNodeId: state.nextNodeId,
            nextConnectionId: state.nextConnectionId,
            savedAt: new Date().toISOString()
        };

        // 2. Save to localStorage (always works, instant)
        try {
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(contentToSave));
        } catch (lsErr) {
            console.warn("localStorage save failed:", lsErr);
        }

        // 3. Try to sync with Supabase as cloud backup
        const supabase = window.supabase;
        if (supabase) {
            const graphId = `graph_${state.theme.toLowerCase()}`;
            const themeMap = {
                'Urgences': 'urgence', 'urgences': 'urgence',
                'Pédiatrie': 'pédiatrie', 'Cardiologie': 'cardiologie',
            };
            const themeFilter = themeMap[state.theme] || state.theme.toLowerCase();

            const { error } = await supabase.from('cases').upsert({
                id: graphId,
                title: `[SYSTEM] Graphe ${state.theme}`,
                specialty: themeFilter,
                content: contentToSave
            }, { onConflict: 'id' });

            if (error) {
                console.warn("Supabase sync failed (graph saved locally anyway):", error);
            }
        }

        btnSave.innerHTML = '<i class="fas fa-check"></i> Sauvegardé';
        setTimeout(() => {
            btnSave.innerHTML = originalText;
            btnSave.disabled = false;
        }, 2000);

    } catch (err) {
        console.error("Save graph error", err);
        alert("Erreur lors de la sauvegarde du graphe.");
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
}

function applyGraphContent(content) {
    state.nodes = content.nodes || [];
    state.connections = content.connections || [];
    if (content.transform) state.transform = content.transform;
    state.nextNodeId = content.nextNodeId || (state.nodes.length > 0 ? Math.max(...state.nodes.map(n => n.id)) + 1 : 1);
    state.nextConnectionId = content.nextConnectionId || (state.connections.length > 0 ? Math.max(...state.connections.map(c => c.id)) + 1 : 1);

    updateCanvasTransform();
    renderAllNodes();
    updateAllConnections();
}

async function loadGraph() {
    // 1. Try localStorage first (fastest, most reliable for positions)
    const localData = localStorage.getItem(LOCALSTORAGE_KEY);
    if (localData) {
        try {
            const content = JSON.parse(localData);
            if (content.nodes && content.nodes.length > 0) {
                console.log(`[GRAPH] Loaded from localStorage (${content.nodes.length} nodes, saved: ${content.savedAt || 'unknown'})`);
                applyGraphContent(content);
                // Still try to sync from Supabase in background in case it's newer
                syncFromSupabase();
                return true;
            }
        } catch (e) {
            console.warn("localStorage parse error:", e);
        }
    }

    // 2. Fallback: try Supabase
    return await syncFromSupabase();
}

async function syncFromSupabase() {
    try {
        const supabase = window.supabase;
        if (!supabase) return false;

        const graphId = `graph_${state.theme.toLowerCase()}`;
        const { data, error } = await supabase.from('cases').select('content').eq('id', graphId).maybeSingle();

        if (error) {
            console.warn("Supabase load error (406 often means no record):", error);
            return false;
        }

        if (!data || !data.content) {
            return false;
        }

        const content = data.content;
        // Only apply if nodes exist
        if (content.nodes && content.nodes.length > 0) {
            // Also mirror to localStorage for next quick load
            try { localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(content)); } catch (e) { }
            applyGraphContent(content);
            return true;
        }
        return false;
    } catch (err) {
        console.error("Load graph error", err);
        return false;
    }
}

// --- Viewport Navigation (Pan & Zoom) ---
function setupViewportNavigation() {
    // Pan with Middle Mouse Button, or Space + Left Click
    viewport.addEventListener('mousedown', (e) => {
        // Middle click (1) or (Left click (0) AND not on a node AND tool is select)
        if (e.button === 1 || (e.button === 0 && e.target === viewport && state.activeTool === 'select')) {
            state.isPanning = true;
            state.panStart = { x: e.clientX, y: e.clientY };
            viewport.classList.add('grabbing');

            // Clear selections if clicking strictly on background
            if (e.button === 0) {
                clearSelection();
            }
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (state.isPanning) {
            const dx = e.clientX - state.panStart.x;
            const dy = e.clientY - state.panStart.y;
            state.transform.x += dx;
            state.transform.y += dy;
            state.panStart = { x: e.clientX, y: e.clientY };
            updateCanvasTransform();
        }

        // Temp connection drawing
        if (state.isDrawingConnection) {
            drawTempConnection(e.clientX, e.clientY);
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (state.isPanning) {
            state.isPanning = false;
            viewport.classList.remove('grabbing');
        }

        // Finish drawing connection
        if (state.isDrawingConnection) {
            finishDrawingConnection(e);
        }
    });

    // Zoom
    viewport.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            // Prevent browser default zoom if possible
            e.preventDefault();
        }

        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        let newScale = state.transform.scale * (1 + delta);

        // Clamp scale
        newScale = Math.max(0.2, Math.min(newScale, 3));

        // Zoom relative to mouse position
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - state.transform.x;
        const mouseY = e.clientY - rect.top - state.transform.y;

        const ratio = newScale / state.transform.scale;

        state.transform.x -= mouseX * (ratio - 1);
        state.transform.y -= mouseY * (ratio - 1);
        state.transform.scale = newScale;

        updateCanvasTransform();
    }, { passive: false });

    // Buttons zoom
    document.getElementById('zoom-in').addEventListener('click', () => zoomCenter(1.2));
    document.getElementById('zoom-out').addEventListener('click', () => zoomCenter(0.8));
    document.getElementById('btn-recenter').addEventListener('click', () => {
        state.transform = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2, scale: 1 };
        updateCanvasTransform();
    });

    // Initial center
    state.transform.x = viewport.clientWidth / 2;
    state.transform.y = viewport.clientHeight / 2;
}

function zoomCenter(factor) {
    state.transform.scale = Math.max(0.2, Math.min(state.transform.scale * factor, 3));
    // Simple center relative adjusting might require offset corrections, but this suffices for UI buttons
    updateCanvasTransform();
}

function updateCanvasTransform() {
    canvasWrapper.style.transform = `translate(${state.transform.x}px, ${state.transform.y}px) scale(${state.transform.scale})`;
    zoomLevelText.textContent = `${Math.round(state.transform.scale * 100)}%`;

    // Update SVG paths because background changes
    updateAllConnections();
}

// Coordinate conversions
function screenToCanvas(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const x = (clientX - rect.left - state.transform.x) / state.transform.scale;
    const y = (clientY - rect.top - state.transform.y) / state.transform.scale;
    return { x, y };
}

// --- Core Data Operations ---
function addNode(title, desc, theme, x, y, chapter = '', caseId = null) {
    const node = {
        id: state.nextNodeId++,
        title: title || 'Nouveau Bloc',
        desc: desc || '',
        theme: theme || state.theme,
        chapter: chapter,
        caseId: caseId,
        x: x,
        y: y
    };
    state.nodes.push(node);
    return node.id;
}

function deleteNode(id) {
    state.nodes = state.nodes.filter(n => n.id !== id);
    // Remove connected links
    state.connections = state.connections.filter(c => c.fromNode !== id && c.toNode !== id);
    if (state.selectedNodeId === id) state.selectedNodeId = null;

    renderAllNodes();
    updateAllConnections();
}

function addConnection(fromNodeId, fromSocket, toNodeId, toSocket) {
    // Prevent duplicate same connections
    const exists = state.connections.find(c =>
        c.fromNode === fromNodeId && c.fromSocket === fromSocket &&
        c.toNode === toNodeId && c.toSocket === toSocket
    );
    if (exists) return;

    // Usually output to input
    state.connections.push({
        id: state.nextConnectionId++,
        fromNode: fromNodeId,
        fromSocket: fromSocket,
        toNode: toNodeId,
        toSocket: toSocket
    });
}

function deleteConnection(id) {
    state.connections = state.connections.filter(c => c.id !== id);
    if (state.selectedConnectionId === id) state.selectedConnectionId = null;
    updateAllConnections();
}

// --- Tools & UI ---
function setupTools() {
    const tools = ['select', 'add', 'link', 'delete'];
    tools.forEach(tool => {
        const btn = document.getElementById(`tool-${tool}`);
        if (btn) {
            btn.addEventListener('click', () => {
                // If it's an action, we might just exec it
                if (tool === 'add') {
                    openNodeModal(null, 0, 0); // Open clean modal
                } else if (tool === 'delete') {
                    if (state.selectedNodeId) deleteNode(state.selectedNodeId);
                    if (state.selectedConnectionId) deleteConnection(state.selectedConnectionId);
                } else {
                    // It's a mode
                    state.activeTool = tool;
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Only if not in input
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                if (state.selectedNodeId) deleteNode(state.selectedNodeId);
                if (state.selectedConnectionId) deleteConnection(state.selectedConnectionId);
            }
        }
    });
}

// --- Modals ---
let pendingModalNode = null; // if updating exist or creating new at coords
let pendingModalPos = { x: 0, y: 0 };

function setupModals() {
    document.getElementById('modal-cancel').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    document.getElementById('modal-save').addEventListener('click', () => {
        const modalChapter = document.getElementById('node-prop-chapter');
        if (pendingModalNode) {
            // Update
            const n = state.nodes.find(n => n.id === pendingModalNode);
            if (n) {
                n.title = modalTitle.value;
                n.desc = modalDesc.value;
                n.theme = modalTheme.value;
                n.chapter = modalChapter ? modalChapter.value : '';
                renderAllNodes();
            }
        } else {
            // Create
            addNode(modalTitle.value, modalDesc.value, modalTheme.value, pendingModalPos.x, pendingModalPos.y, modalChapter ? modalChapter.value : '');
            renderAllNodes();
        }
        modal.style.display = 'none';
        updateAllConnections();
    });
}

function openNodeModal(nodeId = null, x = 0, y = 0) {
    pendingModalNode = nodeId;
    pendingModalPos.x = x;
    pendingModalPos.y = y;
    const modalChapter = document.getElementById('node-prop-chapter');

    if (nodeId) {
        const n = state.nodes.find(n => n.id === nodeId);
        modalTitle.value = n.title;
        modalDesc.value = n.desc;
        modalTheme.value = n.theme || state.theme;
        if (modalChapter) modalChapter.value = n.chapter || '';
    } else {
        modalTitle.value = '';
        modalDesc.value = '';
        modalTheme.value = state.theme;
        if (modalChapter) modalChapter.value = '';
    }

    modal.style.display = 'flex';
    modalTitle.focus();
}

// --- Rendering HTML Nodes ---
function renderAllNodes() {
    nodesLayer.innerHTML = '';
    state.nodes.forEach(n => {
        const el = document.createElement('div');
        el.className = `node ${state.selectedNodeId === n.id ? 'selected' : ''}`;
        el.setAttribute('data-id', n.id);
        el.setAttribute('data-theme', n.theme);
        // Translate to match mathematical center
        el.style.left = `${n.x}px`;
        el.style.top = `${n.y}px`;

        el.innerHTML = `
            <div class="node-theme-bar"></div>
            <div class="node-header">
                <h4>${n.title}</h4>
                ${n.chapter ? `<div class="node-chapter-tag"><i class="fas fa-bookmark"></i> ${n.chapter}</div>` : ''}
            </div>
            <div class="node-content">
                ${n.desc ? (n.desc.substring(0, 60) + (n.desc.length > 60 ? '...' : '')) : '<em style="opacity:0.4">Aucune description</em>'}
            </div>
            <div class="socket input" data-type="input" data-node="${n.id}"></div>
            <div class="socket output" data-type="output" data-node="${n.id}"></div>
        `;

        // Node Events
        const header = el.querySelector('.node-header');
        header.addEventListener('mousedown', (e) => startNodeDrag(e, n.id));
        header.addEventListener('dblclick', () => openNodeModal(n.id));

        el.addEventListener('mousedown', (e) => {
            if (state.activeTool === 'select') {
                selectNode(n.id);
            }
        });

        // Socket Events
        const sockets = el.querySelectorAll('.socket');
        sockets.forEach(s => {
            s.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // prevent node drag/select

                // Colorize socket if it has connections

                startDrawingConnection(n.id, s.getAttribute('data-type'), e);
            });

            s.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                if (state.isDrawingConnection) {
                    // Target socket
                    endDrawingConnection(n.id, s.getAttribute('data-type'));
                }
            });

            // Check if connected
            const isConnected = state.connections.some(c =>
                (c.fromNode === n.id && c.fromSocket === s.getAttribute('data-type')) ||
                (c.toNode === n.id && c.toSocket === s.getAttribute('data-type'))
            );
            if (isConnected) s.classList.add('connected');
        });


        nodesLayer.appendChild(el);
    });
}

// Node Selection & Dragging
let draggedNode = null;
let nodeDragOffset = { x: 0, y: 0 };

function selectNode(id) {
    state.selectedNodeId = id;
    state.selectedConnectionId = null; // deselect line
    renderAllNodes();
    updateAllConnections(); // refresh line colors
}

function clearSelection() {
    state.selectedNodeId = null;
    state.selectedConnectionId = null;
    renderAllNodes();
    updateAllConnections();
}

function startNodeDrag(e, id) {
    if (state.activeTool !== 'select') return;

    // Select it if not
    selectNode(id);

    e.stopPropagation(); // don't pan canvas

    const n = state.nodes.find(n => n.id === id);
    if (n) {
        draggedNode = n;
        // Calculate offset in local canvas logic
        const pt = screenToCanvas(e.clientX, e.clientY);
        nodeDragOffset = {
            x: n.x - pt.x,
            y: n.y - pt.y
        };

        window.addEventListener('mousemove', dragNodeMove);
        window.addEventListener('mouseup', dragNodeEnd);
    }
}

function dragNodeMove(e) {
    if (draggedNode) {
        const pt = screenToCanvas(e.clientX, e.clientY);
        draggedNode.x = pt.x + nodeDragOffset.x;
        draggedNode.y = pt.y + nodeDragOffset.y;

        // Update DOM fast
        const el = document.querySelector(`.node[data-id="${draggedNode.id}"]`);
        if (el) {
            el.style.left = `${draggedNode.x}px`;
            el.style.top = `${draggedNode.y}px`;
        }

        // Will redraw connections in drawing loop or immediately
        updateAllConnections();
    }
}

function dragNodeEnd() {
    draggedNode = null;
    window.removeEventListener('mousemove', dragNodeMove);
    window.removeEventListener('mouseup', dragNodeEnd);
}

// --- Connections Rendering ---

function updateAllConnections() {
    pathsLayer.innerHTML = '';

    state.connections.forEach(c => {
        const fromEl = document.querySelector(`.socket.output[data-node="${c.fromNode}"]`);
        const toEl = document.querySelector(`.socket.input[data-node="${c.toNode}"]`);

        if (fromEl && toEl) {
            drawSVGPath(c.id, fromEl, toEl);
        }
    });
}

function drawSVGPath(connectionId, fromEl, toEl) {
    // Get absolute screen pos of sockets, transform to base SVG canvas pos
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    // Center point of the SVG stroke based on screen coordinates normalized back to layer
    const vtRect = viewport.getBoundingClientRect();

    // Convert DOM rect pos to local SVG coordinates which live inside `.canvas-wrapper` transformed
    // Easier way: local node positions + specific offsets for socket positions.
    // Node width = 260. Output is at right edge, input left edge.
    const fNode = state.nodes.find(n => n.id === parseInt(fromEl.getAttribute('data-node')));
    const tNode = state.nodes.find(n => n.id === parseInt(toEl.getAttribute('data-node')));

    if (!fNode || !tNode) return;

    // Base 5000 offset applied to SVG to ensure always positive range when creating paths.
    const SVG_OFFSET = 5000;

    // Width=260/2 = 130
    const x1 = fNode.x + 130 + SVG_OFFSET;
    const y1 = fNode.y + SVG_OFFSET;

    const x2 = tNode.x - 130 + SVG_OFFSET;
    const y2 = tNode.y + SVG_OFFSET;

    // Create Bezier Curve
    // Control points pushing horizontally
    const distance = Math.abs(x2 - x1);
    const controlOffset = Math.max(100, distance / 2);

    const pathD = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('class', `connection-path ${state.selectedConnectionId === connectionId ? 'selected' : ''}`);

    // Selection interaction
    path.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        state.selectedConnectionId = connectionId;
        state.selectedNodeId = null;
        renderAllNodes();
        updateAllConnections();
    });

    pathsLayer.appendChild(path);
}

// Temporary Drawing Path
function startDrawingConnection(nodeId, type, e) {
    state.isDrawingConnection = true;
    state.drawingStartSocket = { nodeId: parseInt(nodeId), type };

    tempConnection.style.display = 'block';
    drawTempConnection(e.clientX, e.clientY);
}

function drawTempConnection(mouseX, mouseY) {
    if (!state.drawingStartSocket) return;

    const sNode = state.nodes.find(n => n.id === state.drawingStartSocket.nodeId);
    if (!sNode) return;

    const SVG_OFFSET = 5000;

    let x1, y1;
    if (state.drawingStartSocket.type === 'output') {
        x1 = sNode.x + 130 + SVG_OFFSET;
    } else {
        x1 = sNode.x - 130 + SVG_OFFSET;
    }
    y1 = sNode.y + SVG_OFFSET;

    // Convert mouse to local canvas 
    const pt = screenToCanvas(mouseX, mouseY);
    const x2 = pt.x + SVG_OFFSET;
    const y2 = pt.y + SVG_OFFSET;

    const distance = Math.abs(x2 - x1);
    const controlOffset = Math.max(50, distance / 2);

    let pathD;
    // Always draw out -> in to make curve logic simple
    if (state.drawingStartSocket.type === 'output') {
        pathD = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
    } else {
        // Drawing backwards from input socket
        pathD = `M ${x1} ${y1} C ${x1 - controlOffset} ${y1}, ${x2 + controlOffset} ${y2}, ${x2} ${y2}`;
    }

    tempConnection.setAttribute('d', pathD);
}

function finishDrawingConnection(e) {
    state.isDrawingConnection = false;
    tempConnection.style.display = 'none';
    state.drawingStartSocket = null;
}

function endDrawingConnection(nodeId, type) {
    // We released mouse OVER a socket!
    // check validity
    if (state.drawingStartSocket && state.drawingStartSocket.nodeId !== parseInt(nodeId)) {
        // Can't connect output to output
        if (state.drawingStartSocket.type !== type) {
            let fromNode, fromSocket, toNode, toSocket;

            if (state.drawingStartSocket.type === 'output') {
                fromNode = state.drawingStartSocket.nodeId;
                fromSocket = 'output';
                toNode = parseInt(nodeId);
                toSocket = 'input';
            } else {
                fromNode = parseInt(nodeId);
                fromSocket = 'output';
                toNode = state.drawingStartSocket.nodeId;
                toSocket = 'input';
            }

            addConnection(fromNode, fromSocket, toNode, toSocket);

            state.isDrawingConnection = false;
            tempConnection.style.display = 'none';
            state.drawingStartSocket = null;

            renderAllNodes(); // update socket color states
            updateAllConnections();
        }
    }
}

// Request animation frame for smooth updates over SVG just in case
function updateDrawLoop() {
    // If not actively moving things via manual DOM updates, this acts as a catchall
    // But we are manually triggering renderAllConnections on drag. 
    // We can keep this empty or handle smooth lerping here if needed.
    requestAnimationFrame(updateDrawLoop);
}
