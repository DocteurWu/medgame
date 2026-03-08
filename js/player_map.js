// js/player_map.js — Cyberpunk high-fidelity skill tree matching UI mockup

window.initPlayerMap = async (themeName) => {
    const user = await window.requireAuth();
    if (!user) return;

    const formattedTheme = themeName.charAt(0).toUpperCase() + themeName.slice(1).toLowerCase();

    let state = {
        nodes: [],
        connections: [],
        transform: { x: 0, y: 0, scale: 1 },
        nodeStatus: {}
    };

    let playSessions = [];

    // --- Fetch player sessions ---
    try {
        const { data: sessions, error } = await supabase
            .from('play_sessions')
            .select('case_id, score')
            .eq('user_id', user.id);
        if (!error && sessions) playSessions = sessions;
    } catch (e) {
        console.error("Erreur sessions:", e);
    }

    function hasCompletedCase(caseId) {
        if (!caseId) return false;
        return playSessions.some(s => s.case_id === caseId && s.score >= 70);
    }

    // --- Load graph from Supabase ---
    async function loadGraph() {
        const loadingEl = document.getElementById('loading-overlay');
        if (loadingEl) loadingEl.style.display = 'flex';

        try {
            const mapKeys = { 'urgences': 'urgence', 'urgence': 'urgence', 'pédiatrie': 'pédiatrie' };
            const spec = mapKeys[themeName.toLowerCase()] || themeName.toLowerCase();

            const { data, error } = await supabase
                .from('cases')
                .select('content')
                .like('id', 'graph_%')
                .eq('specialty', spec)
                .maybeSingle();

            if (error || !data || !data.content) {
                if (loadingEl) loadingEl.innerHTML = `
                    <div style="text-align:center;">
                        <i class="fas fa-project-diagram" style="font-size:2.5rem; color:#555; margin-bottom:15px;"></i>
                        <h3 style="color:#aaa;">Aucun parcours défini</h3>
                        <p style="color:#666; margin-top:8px;">L'admin n'a pas encore créé de carte pour cette UE.</p>
                    </div>`;
                return false;
            }

            state.nodes = data.content.nodes || [];
            state.connections = data.content.connections || [];

            calculateNodeStatuses();
            if (loadingEl) loadingEl.style.display = 'none';
            initMap();
            return true;
        } catch (err) {
            console.error("Map load error:", err);
            if (loadingEl) loadingEl.innerHTML = `<h3 style="color:red;">Erreur de chargement</h3>`;
            return false;
        }
    }

    // --- Calculate node unlock states ---
    function calculateNodeStatuses() {
        const parentsOf = {};
        state.nodes.forEach(n => parentsOf[n.id] = []);
        state.connections.forEach(c => {
            if (parentsOf[c.toNode]) parentsOf[c.toNode].push(c.fromNode);
        });

        // Pass 1: Mark completed or locked
        state.nodes.forEach(n => {
            state.nodeStatus[n.id] = (n.caseId && hasCompletedCase(n.caseId)) ? 'completed' : 'locked';
        });

        // Pass 2: Unlock nodes whose ALL parents are completed (iterative for DAG)
        let changed = true;
        while (changed) {
            changed = false;
            state.nodes.forEach(n => {
                if (state.nodeStatus[n.id] === 'locked') {
                    const parents = parentsOf[n.id];
                    // Si pas de parents on débloque direct (racine du graphe)
                    if (parents.length === 0 || parents.every(pId => state.nodeStatus[pId] === 'completed')) {
                        state.nodeStatus[n.id] = 'unlocked';
                        changed = true;
                    }
                }
            });
        }
    }

    // --- AUTO-FIT: Calculate transform to fit all nodes in the container ---
    function autoFitTransform(containerW, containerH) {
        if (state.nodes.length === 0) return { x: containerW / 2, y: containerH / 2, scale: 1 };

        const NODE_W = 320;
        const NODE_H = 150; // Hauteur approximative d'un nœud + bouton
        const PADDING_X = 100; // Marges
        const PADDING_Y = 100;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        state.nodes.forEach(n => {
            minX = Math.min(minX, n.x - NODE_W / 2);
            maxX = Math.max(maxX, n.x + NODE_W / 2);
            minY = Math.min(minY, n.y - NODE_H / 2);
            maxY = Math.max(maxY, n.y + NODE_H / 2);
        });

        const graphW = (maxX - minX) + PADDING_X * 2;
        const graphH = (maxY - minY) + PADDING_Y * 2;

        const scaleX = containerW / graphW;
        const scaleY = containerH / graphH;

        let scale = Math.min(scaleX, scaleY);
        scale = Math.max(0.3, Math.min(scale, 1.2)); // Restrict zoom

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        return {
            x: containerW / 2 - centerX * scale,
            y: containerH / 2 - centerY * scale,
            scale: scale
        };
    }

    // --- Render ---
    const viewport = document.getElementById('map-viewport');
    const canvas = document.getElementById('map-canvas');
    const nodesLayer = document.getElementById('nodes-layer');
    const pathsLayer = document.getElementById('paths-layer');

    function applyTransform() {
        // Applique uniquement la translation aux nodes layer
        nodesLayer.style.transform = `translate(${state.transform.x}px, ${state.transform.y}px) scale(${state.transform.scale})`;

        // Pour les chemins (SVG), meme translation. La viewBox est infinie (-5000).
        pathsLayer.style.transform = `translate(${state.transform.x}px, ${state.transform.y}px) scale(${state.transform.scale})`;
    }

    function renderNodes() {
        nodesLayer.innerHTML = '';
        state.nodes.forEach(node => {
            const status = state.nodeStatus[node.id];
            const el = document.createElement('div');
            el.className = `map-node ${status}`;
            el.style.left = node.x + 'px';
            el.style.top = node.y + 'px';

            const iconClass = node.title.toLowerCase().includes('respiratoire') ? 'fa-lungs' :
                (status === 'locked' ? 'fa-lock' : 'fa-head-side-medical');

            // Find parents to show requirements if locked
            let reqHtml = '';
            if (status === 'locked') {
                const parents = state.connections.filter(c => c.toNode === node.id).map(c => {
                    const parentNode = state.nodes.find(n => n.id === c.fromNode);
                    return parentNode ? parentNode.title : 'Précédent';
                });
                const reqText = parents.length > 0 ? `Requis : ${parents.join(', ')}` : `Bloqué`;

                reqHtml = `
                    <div class="map-locked-req">
                        ${reqText}
                        <div class="map-locked-req-badge"><i class="fas fa-lock"></i> Bloqué</div>
                    </div>
                `;
            }

            // Bottom action button format
            let actionHtml = '';
            if (status === 'unlocked' || status === 'completed') {
                actionHtml = `
                    <div class="map-btn-wrapper">
                        <button class="map-play-btn"><i class="fas fa-play"></i> Jouer</button>
                    </div>
                `;
            }

            el.innerHTML = `
                <div class="map-node-status-dot"></div>
                <div class="map-node-header">
                    <i class="fas ${iconClass} map-node-icon"></i>
                    <h4 class="map-node-title">${node.title}</h4>
                </div>
                <div class="map-node-desc">${node.desc || ''}</div>
                ${reqHtml}
                ${actionHtml}
                <div class="map-socket in"></div>
                <div class="map-socket out"></div>
            `;

            // Click handler sur tout le bloc si actif
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (status === 'locked') {
                    el.style.borderColor = '#ff3333';
                    setTimeout(() => el.style.borderColor = '', 350);
                    return;
                }
                if (node.caseId) {
                    localStorage.setItem('selectedThemes', JSON.stringify([formattedTheme]));
                    localStorage.setItem('selectedCaseFiles', JSON.stringify([node.caseId]));
                    localStorage.removeItem('selectedCaseFile');
                    el.style.transform = 'translate(-50%, -50%) scale(0.95)';
                    setTimeout(() => { window.location.href = 'game.html'; }, 200);
                } else {
                    alert("Ce noeud n'est lié à aucun cas clinique réel. (Seulement un test admin)");
                }
            });

            nodesLayer.appendChild(el);
        });
    }

    function renderConnections() {
        pathsLayer.innerHTML = '';
        const NODE_W = 320; // Exact node width from CSS
        const SVG_OFFSET = 5000; // Compensating for top: -5000 left: -5000 in CSS

        state.connections.forEach(conn => {
            const fromN = state.nodes.find(n => n.id === conn.fromNode);
            const toN = state.nodes.find(n => n.id === conn.toNode);
            if (!fromN || !toN) return;

            // X = Center +/- Half Width | Y = Center
            const sx = fromN.x + (NODE_W / 2) + SVG_OFFSET;
            const sy = fromN.y + SVG_OFFSET;
            const ex = toN.x - (NODE_W / 2) + SVG_OFFSET;
            const ey = toN.y + SVG_OFFSET;

            // Constrain bezier width minimum spacing
            const dist = Math.max(Math.abs(ex - sx) * 0.4, 60);

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${sx} ${sy} C ${sx + dist} ${sy}, ${ex - dist} ${ey}, ${ex} ${ey}`);
            path.classList.add('connection-path');

            const fs = state.nodeStatus[fromN.id];
            // Le rendu visuel dépend du noeud d'origine : si l'origine est dispo, la ligne "coule" vers la cible
            if (fs === 'completed' || fs === 'unlocked') {
                path.classList.add('active');
            } else {
                path.classList.add('inactive');
            }

            pathsLayer.appendChild(path);
        });
    }

    // --- Map Initialization ---
    function initMap() {
        const container = document.getElementById('motifs-graph');
        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        state.transform = autoFitTransform(containerW, containerH);

        applyTransform();
        renderNodes();
        renderConnections();

        // Mouse pan
        if (window._mapPanBound) return;
        window._mapPanBound = true;

        let panning = false, px = 0, py = 0;

        viewport.addEventListener('mousedown', (e) => {
            if (e.target === viewport || !e.target.closest('.map-node')) {
                panning = true;
                px = e.clientX; py = e.clientY;
                viewport.classList.add('grabbing');
                e.preventDefault();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!panning) return;
            state.transform.x += e.clientX - px;
            state.transform.y += e.clientY - py;
            px = e.clientX; py = e.clientY;
            applyTransform();
        });

        window.addEventListener('mouseup', () => {
            panning = false;
            viewport.classList.remove('grabbing');
        });

        // Wheel zoom
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            let newScale = state.transform.scale * (1 + delta);
            newScale = Math.max(0.25, Math.min(newScale, 2.5));

            const rect = viewport.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const rx = mx - state.transform.x;
            const ry = my - state.transform.y;
            const ratio = newScale / state.transform.scale;

            state.transform.x -= rx * (ratio - 1);
            state.transform.y -= ry * (ratio - 1);
            state.transform.scale = newScale;
            applyTransform();
        }, { passive: false });
    }

    // --- Start ---
    await loadGraph();
};
