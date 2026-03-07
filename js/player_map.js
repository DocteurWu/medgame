// js/player_map.js — Auto-fit skill tree inside themes.html modal

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

            console.log('[PlayerMap] Loading graph for specialty:', spec);

            const { data, error } = await supabase
                .from('cases')
                .select('content')
                .like('id', 'graph_%')
                .eq('specialty', spec)
                .maybeSingle();

            console.log('[PlayerMap] Supabase response:', { data, error });

            if (error) {
                console.error('[PlayerMap] Supabase error:', error);
                if (loadingEl) loadingEl.innerHTML = `
                    <div style="text-align:center;">
                        <i class="fas fa-exclamation-triangle" style="font-size:2.5rem; color:#ff6b6b; margin-bottom:15px;"></i>
                        <h3 style="color:#ccc;">Erreur de chargement</h3>
                        <p style="color:#888; margin-top:8px; font-size:0.85rem;">${error.message || 'Erreur Supabase'}</p>
                    </div>`;
                return false;
            }

            if (!data || !data.content) {
                console.warn('[PlayerMap] No graph data found for', spec);
                if (loadingEl) loadingEl.innerHTML = `
                    <div style="text-align:center;">
                        <i class="fas fa-project-diagram" style="font-size:2.5rem; color:#555; margin-bottom:15px;"></i>
                        <h3 style="color:#aaa;">Aucun parcours défini</h3>
                        <p style="color:#666; margin-top:8px;">L'admin n'a pas encore créé de carte pour cette UE.</p>
                    </div>`;
                return false;
            }

            console.log('[PlayerMap] Graph loaded:', data.content.nodes?.length, 'nodes,', data.content.connections?.length, 'connections');

            state.nodes = data.content.nodes || [];
            state.connections = data.content.connections || [];

            calculateNodeStatuses();
            if (loadingEl) loadingEl.style.display = 'none';
            initMap();
            return true;
        } catch (err) {
            console.error("[PlayerMap] Critical error:", err);
            if (loadingEl) loadingEl.innerHTML = `<h3 style="color:red;">Erreur critique: ${err.message}</h3>`;
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
                    if (parents.every(pId => state.nodeStatus[pId] === 'completed')) {
                        state.nodeStatus[n.id] = 'unlocked';
                        changed = true;
                    }
                }
            });
        }
    }

    // --- AUTO-FIT: Calculate transform to fit all nodes in the container ---
    let graphBoundingBox = { width: 1000, height: 1000, minX: 0, maxX: 1000, minY: 0, maxY: 1000 };
    const NODE_W = 320; // Correspond à la nouvelle taille CSS

    function autoFitTransform(containerW, containerH) {
        if (state.nodes.length === 0) return { x: containerW / 2, y: containerH / 2, scale: 1 };

        const NODE_H = 100; // Hauteur approximative d'un nœud
        const PADDING_X = 150; // Marges horizontales généreuses
        const PADDING_Y = 100; // Marges verticales généreuses

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        state.nodes.forEach(n => {
            minX = Math.min(minX, n.x - NODE_W / 2);
            maxX = Math.max(maxX, n.x + NODE_W / 2);
            minY = Math.min(minY, n.y - NODE_H / 2);
            maxY = Math.max(maxY, n.y + NODE_H / 2);
        });

        // Save for SVG sizing later
        graphBoundingBox = {
            minX: minX - PADDING_X,
            maxX: maxX + PADDING_X,
            minY: minY - PADDING_Y,
            maxY: maxY + PADDING_Y,
            width: (maxX - minX) + PADDING_X * 2,
            height: (maxY - minY) + PADDING_Y * 2
        };

        const scaleX = containerW / graphBoundingBox.width;
        const scaleY = containerH / graphBoundingBox.height;

        // On prend l'échelle la plus restrictive pour tout faire rentrer, mais pas plus petit que 0.3 ni plus grand que 1.5
        let scale = Math.min(scaleX, scaleY);
        scale = Math.max(0.3, Math.min(scale, 1.3));

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
        canvas.style.transform = `translate(${state.transform.x}px, ${state.transform.y}px) scale(${state.transform.scale})`;

        // Ensure SVG does not clip bounding box elements
        if (pathsLayer) {
            pathsLayer.style.width = Math.max(4000, graphBoundingBox.width * 2) + 'px';
            pathsLayer.style.height = Math.max(4000, graphBoundingBox.height * 2) + 'px';
            pathsLayer.style.overflow = 'visible';
        }
    }

    function renderNodes() {
        nodesLayer.innerHTML = '';
        state.nodes.forEach(node => {
            const status = state.nodeStatus[node.id];
            const el = document.createElement('div');
            el.className = `map-node ${status}`;
            el.style.left = node.x + 'px';
            el.style.top = node.y + 'px';

            let icon = '', badgeContent = '';
            if (status === 'locked') {
                icon = '<i class="fas fa-lock" style="color:#555;"></i>';
                badgeContent = '<i class="fas fa-lock"></i> Bloqué';
            } else if (status === 'unlocked') {
                icon = '<i class="fas fa-stethoscope" style="color:var(--pm-primary);"></i>';
                badgeContent = '<i class="fas fa-play"></i> Jouer';
            } else if (status === 'completed') {
                const best = playSessions.filter(s => s.case_id === node.caseId).reduce((m, s) => Math.max(m, s.score), 0);
                icon = '<i class="fas fa-check-circle" style="color:var(--pm-success);"></i>';
                badgeContent = `<i class="fas fa-check"></i> ${best}%`;
            }

            const chapterTag = node.chapter ? `<div class="map-node-chapter"><i class="fas fa-tag"></i> ${node.chapter}</div>` : '';

            el.innerHTML = `
                <div class="map-node-header">
                    <h4>${icon} ${node.title}</h4>
                    ${chapterTag}
                </div>
                <div class="map-node-body">
                    ${node.desc || '<span style="opacity:0.4;font-style:italic;">—</span>'}
                </div>
                <div class="map-socket in"></div>
                <div class="map-socket out"></div>
                <div class="map-node-badge">${badgeContent}</div>
            `;

            // Click handler
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
                    el.style.transform = 'translate(-50%, -50%) scale(0.92)';
                    setTimeout(() => { window.location.href = 'game.html'; }, 200);
                } else {
                    alert("Ce noeud n'est pas lié à un cas clinique.");
                }
            });

            nodesLayer.appendChild(el);
        });
    }

    function renderConnections() {
        pathsLayer.innerHTML = '';
        const NODE_W = 240; // Same as CSS width

        state.connections.forEach(conn => {
            const fromN = state.nodes.find(n => n.id === conn.fromNode);
            const toN = state.nodes.find(n => n.id === conn.toNode);
            if (!fromN || !toN) return;

            // In CSS, nodes have transform: translate(-50%, -50%).
            // The output socket is at the right edge, input socket at the left edge.
            // Right edge X = node.x + (width / 2)
            // Left edge X = node.x - (width / 2)

            const sx = fromN.x + (NODE_W / 2);
            const sy = fromN.y;
            const ex = toN.x - (NODE_W / 2);
            const ey = toN.y;

            // Dist formula for bezier control points to create smooth curves
            const dist = Math.max(Math.abs(ex - sx) * 0.5, 50);

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${sx} ${sy} C ${sx + dist} ${sy}, ${ex - dist} ${ey}, ${ex} ${ey}`);
            path.classList.add('connection-path');

            const fs = state.nodeStatus[fromN.id];
            const ts = state.nodeStatus[toN.id];
            if (fs === 'completed' && ts === 'completed') {
                path.classList.add('validated');
            } else if (fs === 'completed' && ts === 'unlocked') {
                path.classList.add('active');
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

        // Pan support (subtle, for tweaking)
        if (window._mapPanBound) return;
        window._mapPanBound = true;

        let panning = false, px = 0, py = 0;

        viewport.addEventListener('mousedown', (e) => {
            if (e.target === viewport || e.target.closest('.map-node') === null) {
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

        // Scroll zoom (subtle)
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -e.deltaY * 0.001;
            let newScale = state.transform.scale * (1 + delta);
            newScale = Math.max(0.3, Math.min(newScale, 2));

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

    // --- Run ---
    await loadGraph();
};
