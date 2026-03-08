// --- MINI GRAPH EDITOR LOGIC (Intra-Case Urgences Dynamiques) ---

const miniGraphState = {
    nodes: [], // { id, x, y, name, descriptionClinique, constantesCibles: { tension, pouls, saturationO2, temperature, frequenceRespiratoire }, isEndState, success }
    connections: [], // { id, fromId, toId, label, tempsExecutionSec, feedback }
    isDragging: false,
    dragNode: null,
    dragOffset: { x: 0, y: 0 },
    isDrawingConnection: false,
    connectionStartNode: null,
    selectedNodeId: null,
    selectedConnectionId: null
};

// --- SESSION STORAGE PERSISTENCE ---
const MINI_GRAPH_STORAGE_KEY = 'editorMiniGraph';

function persistMiniGraph() {
    try {
        const toSave = {
            nodes: miniGraphState.nodes,
            connections: miniGraphState.connections,
            enabled: enableUrgenceModeSwitch ? enableUrgenceModeSwitch.checked : false
        };
        sessionStorage.setItem(MINI_GRAPH_STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn('Mini graph persist failed:', e);
    }
}

function restoreMiniGraph() {
    try {
        const raw = sessionStorage.getItem(MINI_GRAPH_STORAGE_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        if (saved && saved.nodes && saved.nodes.length > 0) {
            miniGraphState.nodes = saved.nodes;
            miniGraphState.connections = saved.connections || [];
            if (enableUrgenceModeSwitch) {
                enableUrgenceModeSwitch.checked = saved.enabled;
            }
            if (urgenceEditorContainer) {
                urgenceEditorContainer.style.display = saved.enabled ? 'block' : 'none';
            }
            renderMiniNodes();
            renderMiniConnections();
            return true;
        }
    } catch (e) {
        console.warn('Mini graph restore failed:', e);
    }
    return false;
}

// Elements
const miniCanvas = document.getElementById('mini-canvas');
const miniNodesLayer = document.getElementById('mini-nodes-layer');
const miniPathsLayer = document.getElementById('mini-paths-layer');
const miniTempConnection = document.getElementById('mini-temp-connection');
const urgenceEditorContainer = document.getElementById('urgence-editor-container');
const enableUrgenceModeSwitch = document.getElementById('enable-urgence-mode');

// Modals
const stateModal = document.getElementById('state-modal');
const actionModal = document.getElementById('action-modal');
let editingNodeId = null;
let editingConnectionId = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Restore from sessionStorage first
    restoreMiniGraph();

    if (enableUrgenceModeSwitch) {
        enableUrgenceModeSwitch.addEventListener('change', (e) => {
            urgenceEditorContainer.style.display = e.target.checked ? 'block' : 'none';
            if (e.target.checked && miniGraphState.nodes.length === 0) {
                addMiniNode(50, 50, true);
            }
            persistMiniGraph();
        });
    }

    document.getElementById('add-state-node')?.addEventListener('click', () => {
        addMiniNode(100, 100);
    });

    // Panning (simplified, no zooming for now to keep it straightforward, just drag canvas)
    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let panOffset = { x: 0, y: 0 };

    miniCanvas?.parentElement?.addEventListener('mousedown', (e) => {
        if (e.target.id === 'mini-graph-editor' || e.target.id === 'mini-svg-layer') {
            isPanning = true;
            panStart = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
            miniCanvas.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isPanning && miniCanvas) {
            panOffset.x = e.clientX - panStart.x;
            panOffset.y = e.clientY - panStart.y;
            miniCanvas.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px)`;
        }

        if (miniGraphState.isDragging && miniGraphState.dragNode) {
            // Mouse coord to canvas coord
            const canvasRect = miniCanvas.getBoundingClientRect();
            // Since we use translate on canvas, canvasRect.left/top includes panning.
            // We want position relative to the canvas internal space (which is 0,0 at top left of the translated div).

            // Revert panning offset to get local coordinates
            let targetX = e.clientX - canvasRect.left - miniGraphState.dragOffset.x;
            let targetY = e.clientY - canvasRect.top - miniGraphState.dragOffset.y;

            // Grid snapping
            targetX = Math.round(targetX / 20) * 20;
            targetY = Math.round(targetY / 20) * 20;

            miniGraphState.dragNode.x = targetX;
            miniGraphState.dragNode.y = targetY;
            renderMiniNodes();
            renderMiniConnections();
        }

        if (miniGraphState.isDrawingConnection) {
            const canvasRect = miniCanvas.getBoundingClientRect();
            const mouseX = e.clientX - canvasRect.left;
            const mouseY = e.clientY - canvasRect.top;

            const startNode = miniGraphState.nodes.find(n => n.id === miniGraphState.connectionStartNode);
            if (startNode) {
                const startX = startNode.x + 200; // Node width
                const startY = startNode.y + 30;  // Approx socket Y
                miniTempConnection.setAttribute('d', createSvgPath(startX, startY, mouseX, mouseY));
            }
        }
    });

    document.addEventListener('mouseup', (e) => {
        isPanning = false;
        if (miniCanvas) miniCanvas.style.cursor = 'grab';

        if (miniGraphState.isDragging) {
            miniGraphState.isDragging = false;
            miniGraphState.dragNode = null;
            persistMiniGraph(); // Save position after drag
        }

        if (miniGraphState.isDrawingConnection) {
            miniGraphState.isDrawingConnection = false;
            miniTempConnection.style.display = 'none';
        }
    });

    // Handle Keyboard Delete
    document.addEventListener('keydown', (e) => {
        // Only if we are in the editor and not typing in an input
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                if (miniGraphState.selectedNodeId) {
                    deleteMiniNode(miniGraphState.selectedNodeId);
                } else if (miniGraphState.selectedConnectionId) {
                    deleteMiniConnection(miniGraphState.selectedConnectionId);
                }
            }
        }
    });

    // Modals bindings
    document.getElementById('state-modal-cancel')?.addEventListener('click', () => {
        stateModal.style.display = 'none';
        editingNodeId = null;
    });

    document.getElementById('state-modal-save')?.addEventListener('click', saveStateModal);

    document.getElementById('state-prop-is-end')?.addEventListener('change', (e) => {
        document.getElementById('state-end-options').style.display = e.target.checked ? 'block' : 'none';
    });

    document.getElementById('action-modal-cancel')?.addEventListener('click', () => {
        actionModal.style.display = 'none';
        editingConnectionId = null;
    });

    document.getElementById('action-modal-save')?.addEventListener('click', saveActionModal);
});

function addMiniNode(x, y, isStart = false) {
    const isFirst = miniGraphState.nodes.length === 0;
    const id = 'state_' + Date.now();
    miniGraphState.nodes.push({
        id: id,
        x: x,
        y: y,
        name: isFirst ? 'État Initial' : 'Nouvel État',
        descriptionClinique: '',
        constantesCibles: { tension: '', pouls: '', saturationO2: '', temperature: '', frequenceRespiratoire: '' },
        isEndState: false,
        success: true,
        evolutionAuto: { delaiSecondes: 0, nextNode: '', motif: '' }
    });
    renderMiniNodes();
    persistMiniGraph();
    return id;
}

function renderMiniNodes() {
    if (!miniNodesLayer) return;
    miniNodesLayer.innerHTML = '';

    miniGraphState.nodes.forEach((node, index) => {
        const el = document.createElement('div');
        el.className = `mini-node ${index === 0 ? 'start-node' : ''} ${node.isEndState ? 'end-node' : ''} ${miniGraphState.selectedNodeId === node.id ? 'selected' : ''}`;
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';

        let headerIcon = '<i class="fas fa-procedures"></i>';
        if (index === 0) headerIcon = '<i class="fas fa-play" style="color:#2ecc71;"></i>';
        if (node.isEndState) headerIcon = node.success ? '<i class="fas fa-flag-checkered" style="color:#2ecc71;"></i>' : '<i class="fas fa-skull" style="color:#e74c3c;"></i>';

        el.innerHTML = `
            <div class="mini-node-header">
                <span>${headerIcon} ${node.name}</span>
                <i class="fas fa-cog" style="cursor:pointer; color:#aaa;" onclick="openStateModal('${node.id}')"></i>
            </div>
            <div class="mini-node-content">
                <div>TA: ${node.constantesCibles.tension} | FC: ${node.constantesCibles.pouls}</div>
                <div>SpO2: ${node.constantesCibles.saturationO2}% | FR: ${node.constantesCibles.frequenceRespiratoire}</div>
            </div>
            ${index !== 0 ? `<div class="mini-socket input" data-id="${node.id}" title="Lier vers cet état"></div>` : ''}
            ${!node.isEndState ? `<div class="mini-socket output" data-id="${node.id}" title="Lier depuis cet état"></div>` : ''}
        `;

        // Selection
        el.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('mini-socket') || e.target.classList.contains('fa-cog')) return;
            e.stopPropagation();
            miniGraphState.selectedNodeId = node.id;
            miniGraphState.selectedConnectionId = null;
            renderMiniNodes();
            renderMiniConnections();

            const rect = el.getBoundingClientRect();
            const canvasRect = miniCanvas.getBoundingClientRect();

            miniGraphState.isDragging = true;
            miniGraphState.dragNode = node;
            // Target is the node div, so to get click offset within node:
            miniGraphState.dragOffset = {
                x: e.clientX - canvasRect.left - node.x,
                y: e.clientY - canvasRect.top - node.y
            };
        });

        // Sockets logic
        const output = el.querySelector('.mini-socket.output');
        if (output) {
            output.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                miniGraphState.isDrawingConnection = true;
                miniGraphState.connectionStartNode = node.id;

                const startX = node.x + 200; // Node width
                const startY = node.y + 30;  // Approx socket Y
                miniTempConnection.setAttribute('d', createSvgPath(startX, startY, startX, startY));
                miniTempConnection.style.display = 'block';
            });
        }

        const input = el.querySelector('.mini-socket.input');
        if (input) {
            input.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                if (miniGraphState.isDrawingConnection && miniGraphState.connectionStartNode && miniGraphState.connectionStartNode !== node.id) {
                    addMiniConnection(miniGraphState.connectionStartNode, node.id);
                }
                miniGraphState.isDrawingConnection = false;
                miniTempConnection.style.display = 'none';
            });
        }

        miniNodesLayer.appendChild(el);
    });
}

function addMiniConnection(fromId, toId) {
    // Check if connection already exists
    if (miniGraphState.connections.find(c => c.fromId === fromId && c.toId === toId)) return;

    const id = 'conn_' + Date.now();
    miniGraphState.connections.push({
        id: id,
        fromId: fromId,
        toId: toId,
        label: 'Nouvelle Action',
        tempsExecutionSec: 30,
        feedback: ''
    });

    // Auto open modal for new connection
    openActionModal(id);
    renderMiniConnections();
    persistMiniGraph();
}

function createSvgPath(startX, startY, endX, endY) {
    const dx = Math.abs(endX - startX) * 0.5;
    const cp1x = startX + dx;
    const cp1y = startY;
    const cp2x = endX - dx;
    const cp2y = endY;
    return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
}

function renderMiniConnections() {
    if (!miniPathsLayer) return;
    miniPathsLayer.innerHTML = '';

    miniGraphState.connections.forEach(conn => {
        const fromNode = miniGraphState.nodes.find(n => n.id === conn.fromId);
        const toNode = miniGraphState.nodes.find(n => n.id === conn.toId);
        if (!fromNode || !toNode) return;

        const startX = fromNode.x + 200;
        const startY = fromNode.y + 30;
        const endX = toNode.x;
        const endY = toNode.y + 30;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', createSvgPath(startX, startY, endX, endY));
        path.setAttribute('class', `mini-connection ${miniGraphState.selectedConnectionId === conn.id ? 'selected' : ''}`);
        path.setAttribute('marker-end', 'url(#arrowhead-mini)');

        path.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            miniGraphState.selectedConnectionId = conn.id;
            miniGraphState.selectedNodeId = null;
            renderMiniNodes();
            renderMiniConnections();
        });

        // Label handling
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', midY - 10);
        text.setAttribute('fill', '#fff');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '12px');
        text.setAttribute('background', 'rgba(0,0,0,0.5)'); // Need foreignObject for real background
        text.textContent = conn.label;
        text.style.cursor = 'pointer';
        text.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            openActionModal(conn.id);
        });

        miniPathsLayer.appendChild(path);
        miniPathsLayer.appendChild(text);
    });
}

function deleteMiniNode(nodeId) {
    // Don't delete start node
    if (miniGraphState.nodes.length > 0 && miniGraphState.nodes[0].id === nodeId) {
        alert("L'état initial ne peut pas être supprimé.");
        return;
    }
    miniGraphState.nodes = miniGraphState.nodes.filter(n => n.id !== nodeId);
    miniGraphState.connections = miniGraphState.connections.filter(c => c.fromId !== nodeId && c.toId !== nodeId);
    miniGraphState.selectedNodeId = null;
    renderMiniNodes();
    renderMiniConnections();
    persistMiniGraph();
}

function deleteMiniConnection(connId) {
    miniGraphState.connections = miniGraphState.connections.filter(c => c.id !== connId);
    miniGraphState.selectedConnectionId = null;
    renderMiniConnections();
    persistMiniGraph();
}

// -- Modals --
function openStateModal(nodeId) {
    editingNodeId = nodeId;
    const node = miniGraphState.nodes.find(n => n.id === nodeId);
    if (!node) return;

    document.getElementById('state-prop-name').value = node.name || '';
    document.getElementById('state-prop-desc').value = node.descriptionClinique || '';
    document.getElementById('state-prop-ta').value = node.constantesCibles.tension || '';
    document.getElementById('state-prop-fc').value = node.constantesCibles.pouls || '';
    document.getElementById('state-prop-spo2').value = node.constantesCibles.saturationO2 || '';
    document.getElementById('state-prop-fr').value = node.constantesCibles.frequenceRespiratoire || '';

    document.getElementById('state-prop-is-end').checked = node.isEndState;
    document.getElementById('state-end-options').style.display = node.isEndState ? 'block' : 'none';
    document.getElementById('state-prop-success').value = node.success ? 'true' : 'false';

    // Populate "Next node" dropdown for auto evolution
    const autoNextSelect = document.getElementById('state-prop-auto-next');
    autoNextSelect.innerHTML = '<option value="">Aucun</option>';
    miniGraphState.nodes.forEach(n => {
        if (n.id !== nodeId) {
            const opt = document.createElement('option');
            opt.value = n.id;
            opt.textContent = n.name || n.id;
            autoNextSelect.appendChild(opt);
        }
    });

    document.getElementById('state-prop-auto-time').value = node.evolutionAuto?.delaiSecondes || '';
    document.getElementById('state-prop-auto-next').value = node.evolutionAuto?.nextNode || '';
    document.getElementById('state-prop-auto-msg').value = node.evolutionAuto?.motif || '';

    stateModal.style.display = 'flex';
}

function saveStateModal() {
    if (!editingNodeId) return;
    const node = miniGraphState.nodes.find(n => n.id === editingNodeId);
    if (node) {
        node.name = document.getElementById('state-prop-name').value || 'État sans nom';
        node.descriptionClinique = document.getElementById('state-prop-desc').value;
        node.constantesCibles.tension = document.getElementById('state-prop-ta').value;
        node.constantesCibles.pouls = document.getElementById('state-prop-fc').value;
        node.constantesCibles.saturationO2 = document.getElementById('state-prop-spo2').value;
        node.constantesCibles.frequenceRespiratoire = document.getElementById('state-prop-fr').value;

        node.isEndState = document.getElementById('state-prop-is-end').checked;
        node.success = document.getElementById('state-prop-success').value === 'true';

        const autoTime = parseInt(document.getElementById('state-prop-auto-time').value) || 0;
        const autoNext = document.getElementById('state-prop-auto-next').value;
        const autoMsg = document.getElementById('state-prop-auto-msg').value;

        if (autoTime > 0 && autoNext) {
            node.evolutionAuto = {
                delaiSecondes: autoTime,
                nextNode: autoNext,
                motif: autoMsg
            };
        } else {
            node.evolutionAuto = null;
        }
    }

    // Clean up invalid connections if node became an end state
    if (node.isEndState) {
        miniGraphState.connections = miniGraphState.connections.filter(c => c.fromId !== node.id);
    }

    stateModal.style.display = 'none';
    editingNodeId = null;
    renderMiniNodes();
    renderMiniConnections();
    persistMiniGraph();
}

function openActionModal(connId) {
    editingConnectionId = connId;
    const conn = miniGraphState.connections.find(c => c.id === connId);
    if (!conn) return;

    const fromNode = miniGraphState.nodes.find(n => n.id === conn.fromId);
    const toNode = miniGraphState.nodes.find(n => n.id === conn.toId);

    document.getElementById('action-from-name').textContent = fromNode ? fromNode.name : '???';
    document.getElementById('action-to-name').textContent = toNode ? toNode.name : '???';

    document.getElementById('action-prop-label').value = conn.label || '';
    document.getElementById('action-prop-time').value = conn.tempsExecutionSec || 0;
    document.getElementById('action-prop-feedback').value = conn.feedback || '';

    actionModal.style.display = 'flex';
}

function saveActionModal() {
    if (!editingConnectionId) return;
    const conn = miniGraphState.connections.find(c => c.id === editingConnectionId);
    if (conn) {
        conn.label = document.getElementById('action-prop-label').value || 'Action';
        conn.tempsExecutionSec = parseInt(document.getElementById('action-prop-time').value) || 0;
        conn.feedback = document.getElementById('action-prop-feedback').value;
    }

    actionModal.style.display = 'none';
    editingConnectionId = null;
    renderMiniConnections();
    persistMiniGraph();
}

function loadMiniGraphData(data) {
    if (data && data.gameplayConfig && data.gameplayConfig.startNode && data.nodes) {
        // Case has urgence data — load it
        enableUrgenceModeSwitch.checked = true;
        urgenceEditorContainer.style.display = 'block';

        if (data.editorData && data.editorData.miniGraph) {
            miniGraphState.nodes = data.editorData.miniGraph.nodes || [];
            miniGraphState.connections = data.editorData.miniGraph.connections || [];
        }

    } else if (miniGraphState.nodes.length > 0) {
        // No urgence data in loaded case, but we already have nodes in memory
        // (e.g. from sessionStorage restore) — keep them, don't wipe
        return;
    } else {
        // Truly empty — reset
        enableUrgenceModeSwitch.checked = false;
        urgenceEditorContainer.style.display = 'none';
        miniGraphState.nodes = [];
        miniGraphState.connections = [];
    }

    renderMiniNodes();
    renderMiniConnections();
}

function exportMiniGraphData() {
    if (!enableUrgenceModeSwitch.checked || miniGraphState.nodes.length === 0) return null;

    const startNode = miniGraphState.nodes[0]; // Assume first added is start

    const exportedNodes = {};

    miniGraphState.nodes.forEach(node => {
        const actionsDisponibles = [];

        // Find all outgoing connections for this node
        const outgoingConns = miniGraphState.connections.filter(c => c.fromId === node.id);

        outgoingConns.forEach(conn => {
            actionsDisponibles.push({
                label: conn.label,
                tempsExecutionSec: conn.tempsExecutionSec,
                feedback: conn.feedback,
                nextNode: conn.toId
            });
        });

        exportedNodes[node.id] = {
            id: node.id,
            descriptionClinique: node.descriptionClinique,
            constantesCibles: node.constantesCibles,
            actionsDisponibles: actionsDisponibles,
            isEndState: node.isEndState,
            success: node.success
        };
    });

    return {
        gameplayConfig: {
            startNode: startNode.id
        },
        nodes: exportedNodes,
        editorData: {
            miniGraph: {
                nodes: miniGraphState.nodes,
                connections: miniGraphState.connections
            }
        }
    };
}

// Add these exports to the global collectData/populateEditor flow later.
