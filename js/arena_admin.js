/**
 * MedGame Arena - Admin Logic
 * Handles the creation, management, and control of global live QCM events.
 * QCM: 5 options A-E, multiple correct answers, partial scoring.
 */

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initArenaAdmin, 1000);
});

let allEvents = [];
let currentEvent = null;
let currentQuestions = [];
let playersCount = 0;
let realTimeChannel = null;

// Timer and Auto-Flow variables
let adminTimerInterval = null;
let currentAdminTimeLeft = 0;

async function initArenaAdmin() {
    const root = document.getElementById('arena-admin-root');
    if (!root || typeof supabase === 'undefined') return;

    const isAdminUser = await window.isAdmin();
    if (!isAdminUser) {
        root.innerHTML = '<div class="empty-state">Accès refusé.</div>';
        return;
    }

    await loadAllEvents();
    subscribeToArenaEvents();
}

async function loadAllEvents() {
    const root = document.getElementById('arena-admin-root');

    // Try loading with is_draft filter
    let events, error;
    try {
        const result = await supabase
            .from('arena_events')
            .select('*')
            .neq('status', 'finished')
            .order('created_at', { ascending: false });
        events = result.data;
        error = result.error;
    } catch(e) { error = e; }

    // Fallback if query fails
    if (error) {
        console.warn("[Arena Admin] Retry without potential schema issues:", error.message || error);
        try {
            const result = await supabase
                .from('arena_events')
                .select('*')
                .neq('status', 'finished')
                .order('created_at', { ascending: false });
            events = result.data;
            error = result.error;
        } catch(e2) { error = e2; }
    }

    if (error) {
        root.innerHTML = `<div class="empty-state">Erreur: ${error.message || error}</div>`;
        return;
    }

    allEvents = events || [];
    renderEventsList();
}

function renderEventsList() {
    const root = document.getElementById('arena-admin-root');

    const statusBadge = (ev) => {
        if (ev.is_draft) return '<span style="background:rgba(155,89,182,0.2); color:#9b59b6; border:1px solid #9b59b6; padding:3px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold;">BROUILLON</span>';
        if (ev.status === 'active' || ev.status === 'starting' || ev.status === 'question_active' || ev.status === 'showing_answer') return '<span style="background:rgba(46,204,113,0.2); color:#2ecc71; border:1px solid #2ecc71; padding:3px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold;">ACTIF</span>';
        return '<span style="background:rgba(255,165,2,0.2); color:#ffa502; border:1px solid #ffa502; padding:3px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold;">EN ATTENTE</span>';
    };

    const modeLabel = (ev) => (ev.event_mode === 'timed') ? '<span style="color:#9b59b6;"><i class="fas fa-clock"></i> Intervalle</span>' : '<span style="color:#2ecc71;"><i class="fas fa-broadcast-tower"></i> Direct</span>';

    let html = `
        <button onclick="renderCreateEventForm()" style="width: 100%; padding: 15px; border-radius: 10px; border: 2px dashed rgba(255,255,255,0.2); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.6); cursor: pointer; font-weight: bold; font-size: 1rem; margin-bottom: 20px; transition: all 0.2s;">
            <i class="fas fa-plus-circle" style="color: var(--admin-primary);"></i> Créer un nouvel événement
        </button>
    `;

    if (allEvents.length === 0) {
        html += '<div class="empty-state">Aucun événement en cours. Créez-en un !</div>';
    } else {
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">';
        for (const ev of allEvents) {
            const dateObj = new Date(ev.scheduled_at);
            const isTimed = ev.event_mode === 'timed';
            html += `
                <div onclick="selectEvent('${ev.id}')" style="background: rgba(10, 15, 40, 0.6); border: 1px solid var(--glass-border); border-radius: 12px; padding: 18px; cursor: pointer; transition: all 0.2s; hover: border-color: var(--admin-primary);" onmouseover="this.style.borderColor='var(--admin-primary)'" onmouseout="this.style.borderColor='var(--glass-border)'">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        ${statusBadge(ev)}
                        ${modeLabel(ev)}
                    </div>
                    <h3 style="margin: 0 0 8px 0; color: white; font-family: var(--font-title); font-size: 1.1rem;">${ev.title}</h3>
                    <p style="color: var(--text-muted); margin: 0 0 5px; font-size: 0.85rem;">
                        <i class="fas fa-calendar"></i> ${dateObj.toLocaleString('fr-FR')}
                    </p>
                    ${isTimed && ev.ends_at ? `<p style="color: #9b59b6; margin: 0 0 5px; font-size: 0.8rem;"><i class="fas fa-hourglass-end"></i> → ${new Date(ev.ends_at).toLocaleString('fr-FR')}</p>` : ''}
                </div>
            `;
        }
        html += '</div>';
    }

    root.innerHTML = html;
}

async function selectEvent(eventId) {
    const ev = allEvents.find(e => e.id === eventId);
    if (!ev) return;

    currentEvent = ev;
    await loadQuestions(currentEvent.id);
    await updatePlayersCount(currentEvent.id);
    renderEventDashboard();
}

async function loadQuestions(eventId) {
    const { data, error } = await supabase
        .from('arena_questions')
        .select('*')
        .eq('event_id', eventId)
        .order('order_num', { ascending: true });

    if (!error && data) currentQuestions = data;
}

async function updatePlayersCount(eventId) {
    const { count } = await supabase
        .from('arena_players')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId);
    playersCount = count || 0;
    const el = document.getElementById('arena-players-count');
    if (el) el.innerText = playersCount;
}

function subscribeToArenaEvents() {
    if (realTimeChannel) supabase.removeChannel(realTimeChannel);

    realTimeChannel = supabase.channel('admin_arena_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'arena_events' }, payload => {
            if (payload.eventType === 'DELETE') {
                allEvents = allEvents.filter(e => e.id !== payload.old.id);
                if (currentEvent && currentEvent.id === payload.old.id) {
                    currentEvent = null;
                    renderEventsList();
                } else if (!currentEvent) {
                    renderEventsList();
                }
                return;
            }

            const updated = payload.new;
            const idx = allEvents.findIndex(e => e.id === updated.id);
            if (idx >= 0) {
                allEvents[idx] = updated;
            } else {
                allEvents.unshift(updated);
            }

            if (currentEvent && updated.id === currentEvent.id) {
                currentEvent = updated;
                renderEventDashboard();
            } else if (!currentEvent) {
                renderEventsList();
            }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'arena_players' }, payload => {
            if (currentEvent && payload.new.event_id === currentEvent.id) {
                playersCount++;
                const el = document.getElementById('arena-players-count');
                if (el) el.innerText = playersCount;
            }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'arena_answers' }, payload => {
            if (currentEvent) updateAnswersStats(payload.new.answer_indices);
        })
        .subscribe();
}

// ==========================================
// RENDER METHODS
// ==========================================

function renderLoading() {
    const root = document.getElementById('arena-admin-root');
    root.innerHTML = '<div class="empty-state"><i class="fas fa-circle-notch fa-spin"></i> Chargement...</div>';
}

function renderCreateEventForm() {
    const root = document.getElementById('arena-admin-root');
    root.innerHTML = `
        <div style="margin-bottom: 15px;">
            <button onclick="renderEventsList()" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.6); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem;">
                <i class="fas fa-arrow-left"></i> Retour à la liste
            </button>
        </div>
        <div style="background: rgba(10, 15, 40, 0.6); padding: 25px; border-radius: 12px; border: 1px solid var(--glass-border);">
            <h3 style="margin-top:0; color:white; font-family: var(--font-title);"><i class="fas fa-calendar-plus"></i> Planifier un nouvel Événement</h3>
            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 15px;">
                <div>
                    <label style="color: var(--text-muted); font-size: 0.9rem; display: block; margin-bottom: 5px;">Titre de l'événement</label>
                    <input type="text" id="arena-new-title" placeholder="Ex: Grand QCM Cardio" style="width: 100%; max-width: 400px; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
                </div>
                <div>
                    <label style="color: var(--text-muted); font-size: 0.9rem; display: block; margin-bottom: 5px;">Programme / Description (affiché en salle d'attente)</label>
                    <textarea id="arena-new-desc" placeholder="Ex: Voici le programme de ce soir..." style="width: 100%; max-width: 600px; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white; min-height: 60px;"></textarea>
                </div>
                <div>
                    <label style="color: var(--text-muted); font-size: 0.9rem; display: block; margin-bottom: 5px;">Récompenses (XP gagnée par les gagnants en fin de partie)</label>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <input type="number" id="xp-top1" placeholder="1er" title="XP pour 1er" value="300" style="width: 80px; padding: 8px; border-radius: 6px; border: 1px solid #ffcc00; background: rgba(255, 204, 0, 0.1); color: white;">
                        <input type="number" id="xp-top2" placeholder="2ème" title="XP pour 2ème" value="200" style="width: 80px; padding: 8px; border-radius: 6px; border: 1px solid #e0e0e0; background: rgba(224, 224, 224, 0.1); color: white;">
                        <input type="number" id="xp-top3" placeholder="3ème" title="XP pour 3ème" value="100" style="width: 80px; padding: 8px; border-radius: 6px; border: 1px solid #cd7f32; background: rgba(205, 127, 50, 0.1); color: white;">
                        <input type="number" id="xp-top4" placeholder="4ème" title="XP pour 4ème" value="50" style="width: 80px; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: white;">
                        <input type="number" id="xp-top5" placeholder="5ème" title="XP pour 5ème" value="50" style="width: 80px; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: white;">
                    </div>
                </div>
                <div>
                    <label style="color: var(--text-muted); font-size: 0.9rem; display: block; margin-bottom: 5px;">Mode de l'événement</label>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" id="mode-live-btn" onclick="setEventMode('live')" style="flex:1; padding: 12px; border-radius: 8px; border: 2px solid #2ecc71; background: rgba(46,204,113,0.15); color: #2ecc71; cursor: pointer; font-weight: bold; font-size: 0.9rem; transition: all 0.2s;">
                            <i class="fas fa-broadcast-tower"></i> En direct
                        </button>
                        <button type="button" id="mode-timed-btn" onclick="setEventMode('timed')" style="flex:1; padding: 12px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.15); background: transparent; color: rgba(255,255,255,0.5); cursor: pointer; font-weight: bold; font-size: 0.9rem; transition: all 0.2s;">
                            <i class="fas fa-clock"></i> Intervalle de temps
                        </button>
                    </div>
                    <p id="mode-desc" style="color: rgba(255,255,255,0.4); font-size: 0.8rem; margin: 6px 0 0;">L'admin contrôle le déroulement en temps réel.</p>
                </div>
                <div>
                    <label style="color: var(--text-muted); font-size: 0.9rem; display: block; margin-bottom: 5px;" id="date-label">Date et Heure du lancement (Heure locale)</label>
                    <input type="datetime-local" id="arena-new-date" style="max-width: 400px; width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
                </div>
                <div id="ends-at-container" style="display: none;">
                    <label style="color: var(--text-muted); font-size: 0.9rem; display: block; margin-bottom: 5px;"><i class="fas fa-hourglass-end"></i> Date et Heure de fin de l'intervalle</label>
                    <input type="datetime-local" id="arena-new-ends-at" style="max-width: 400px; width: 100%; padding: 10px; border-radius: 8px; border: 1px solid rgba(155, 89, 182, 0.4); background: rgba(155, 89, 182, 0.1); color: white;">
                    <p style="color: rgba(255,255,255,0.4); font-size: 0.8rem; margin: 6px 0 0;">Le QCM sera jouable uniquement entre les deux dates ci-dessus.</p>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 5px;">
                    <label style="color: var(--text-muted); font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="arena-show-countdown" checked style="width: 18px; height: 18px; accent-color: var(--admin-primary); cursor: pointer;">
                        Afficher le décompte aux joueurs
                    </label>
                    <span style="color: rgba(255,255,255,0.3); font-size: 0.8rem;">(bulle d'accueil + salle d'attente)</span>
                </div>
                <div style="margin-top: 10px;">
                    <button class="primary-btn" onclick="arenaCreateEvent()" style="background: var(--admin-primary); padding: 10px 20px; border-radius: 8px; border:none; color:white; font-weight:bold; cursor:pointer;">
                        Créer l'événement
                    </button>
                </div>
            </div>
        </div>
    `;
    const now = new Date(Date.now() + 3600000);
    const localISO = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('arena-new-date').value = localISO;

    // Default ends_at = start + 3 hours
    const endDate = new Date(Date.now() + 3600000 + 3 * 3600000);
    const endsISO = new Date(endDate - endDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('arena-new-ends-at').value = endsISO;
}

window.setEventMode = function (mode) {
    const liveBtn = document.getElementById('mode-live-btn');
    const timedBtn = document.getElementById('mode-timed-btn');
    const endsContainer = document.getElementById('ends-at-container');
    const descEl = document.getElementById('mode-desc');
    const dateLabel = document.getElementById('date-label');

    if (mode === 'live') {
        liveBtn.style.cssText = liveBtn.style.cssText.replace(/border-color:[^;]+;/, '').replace(/background:[^;]+;/, '').replace(/color:[^;]+;/, '');
        liveBtn.style.borderColor = '#2ecc71';
        liveBtn.style.background = 'rgba(46,204,113,0.15)';
        liveBtn.style.color = '#2ecc71';
        timedBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        timedBtn.style.background = 'transparent';
        timedBtn.style.color = 'rgba(255,255,255,0.5)';
        endsContainer.style.display = 'none';
        descEl.textContent = "L'admin contrôle le déroulement en temps réel.";
        dateLabel.textContent = "Date et Heure du lancement (Heure locale)";
    } else {
        timedBtn.style.borderColor = '#9b59b6';
        timedBtn.style.background = 'rgba(155,89,182,0.15)';
        timedBtn.style.color = '#9b59b6';
        liveBtn.style.borderColor = 'rgba(255,255,255,0.15)';
        liveBtn.style.background = 'transparent';
        liveBtn.style.color = 'rgba(255,255,255,0.5)';
        endsContainer.style.display = 'block';
        descEl.textContent = "Le QCM se joue automatiquement dans la fenêtre horaire définie.";
        dateLabel.textContent = "Date et Heure de début de l'intervalle";
    }

    // Store mode on a data attribute for use in arenaCreateEvent
    document.getElementById('arena-new-date').dataset.eventMode = mode;
}

function renderEventDashboard() {
    const root = document.getElementById('arena-admin-root');
    if (!currentEvent) {
        renderEventsList();
        return;
    }
    if (currentEvent.status === 'finished') {
        currentEvent = null;
        renderEventsList();
        return;
    }
    // Waiting, draft, timed-active, and published all use the same editable dashboard
    if (currentEvent.status === 'waiting' || currentEvent.is_draft ||
        (currentEvent.status === 'active' && currentEvent.event_mode === 'timed')) {
        renderWaitingDashboard(root);
    } else {
        renderLiveDashboard(root);
    }
}

function renderWaitingDashboard(root) {
    const dateObj = new Date(currentEvent.scheduled_at);
    const labels = ['A', 'B', 'C', 'D', 'E'];
    const colors = ['#ff4757', '#1e90ff', '#ffa502', '#2ed573', '#a29bfe'];
    const isTimed = currentEvent.event_mode === 'timed';
    const isDraft = currentEvent.is_draft;
    const isActive = currentEvent.status === 'active';

    const modeBadge = isActive
        ? `<span class="badge" style="background: rgba(46,204,113,0.2); color: #2ecc71; border: 1px solid #2ecc71; white-space: nowrap;"><i class="fas fa-play"></i> ACTIF</span>`
        : isDraft
            ? `<span class="badge" style="background: rgba(155,89,182,0.2); color: #9b59b6; border: 1px solid #9b59b6; white-space: nowrap;"><i class="fas fa-pen"></i> BROUILLON</span>`
            : isTimed
                ? `<span class="badge" style="background: rgba(155,89,182,0.2); color: #9b59b6; border: 1px solid #9b59b6; white-space: nowrap;"><i class="fas fa-clock"></i> INTERVALLE</span>`
                : `<span class="badge" style="background: rgba(255, 165, 2, 0.2); color: #ffa502; border: 1px solid #ffa502; white-space: nowrap;">EN ATTENTE</span>`;

    let dateInfo = `<p style="color: var(--text-muted); margin: 0;"><i class="fas fa-clock"></i> ${isTimed ? 'Début' : 'Prévu le'} : ${dateObj.toLocaleString('fr-FR')} <button onclick="editEventDate()" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.6); padding:2px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer; vertical-align:middle;"><i class="fas fa-edit"></i></button></p>`;

    if (isTimed && currentEvent.ends_at) {
        const endsObj = new Date(currentEvent.ends_at);
        dateInfo += `<p style="color: #9b59b6; margin: 5px 0 0 0;"><i class="fas fa-hourglass-end"></i> Fin : ${endsObj.toLocaleString('fr-FR')} <button onclick="editEventEndDate()" style="background:transparent; border:1px solid rgba(155,89,182,0.3); color:rgba(155,89,182,0.8); padding:2px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer; vertical-align:middle;"><i class="fas fa-edit"></i></button></p>`;
    }

    root.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 380px; gap: 20px; align-items: start;">
            <div>
                <div style="background: rgba(10, 15, 40, 0.6); padding: 20px; border-radius: 12px; border: 1px solid var(--glass-border); margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <h3 style="margin-top:0; color:white; font-family: var(--font-title); font-size: 1.5rem; margin-bottom:5px;">${currentEvent.title} <button onclick="editEventTitle()" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.6); padding:2px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer; vertical-align:middle;"><i class="fas fa-edit"></i></button></h3>
                            <button onclick="editEventDescription()" style="background:transparent; border:1px solid rgba(255,255,255,0.3); color:rgba(255,255,255,0.8); padding:4px 8px; border-radius:4px; font-size:0.8rem; cursor:pointer; margin-bottom:10px;"><i class="fas fa-edit"></i> Modifier le programme</button>
                            ${dateInfo}
                            <p style="color: #00f2fe; margin: 5px 0 0 0; font-weight:bold;"><i class="fas fa-users"></i> Joueurs en attente : <span id="arena-players-count">${playersCount}</span></p>
                            <div style="margin-top: 10px; display: flex; align-items: center; gap: 12px;">
                                <label style="color: var(--text-muted); font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="toggle-countdown" ${currentEvent.show_countdown !== false ? 'checked' : ''} onchange="toggleCountdownVisibility(this.checked)" style="width: 16px; height: 16px; accent-color: var(--admin-primary); cursor: pointer;">
                                    <i class="fas fa-eye"></i> Décompte visible pour les joueurs
                                </label>
                                <button onclick="toggleEventMode()" style="background:transparent; border:1px solid ${isTimed ? 'rgba(155,89,182,0.4)' : 'rgba(255,165,2,0.4)'}; color:${isTimed ? '#9b59b6' : '#ffa502'}; padding:3px 10px; border-radius:4px; font-size:0.75rem; cursor:pointer;">
                                    <i class="fas fa-exchange-alt"></i> Basculer en ${isTimed ? 'direct' : 'intervalle'}
                                </button>
                            </div>
                        </div>
                        ${modeBadge}
                    </div>
                </div>

                <div style="background: rgba(10, 15, 40, 0.6); padding: 20px; border-radius: 12px; border: 1px solid var(--glass-border);">
                    <h4 style="margin:0 0 15px 0; color:white; font-family: var(--font-title);"><i class="fas fa-list-ol"></i> Questions (${currentQuestions.length})</h4>
                    <div style="display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto;">
                        ${currentQuestions.length === 0
            ? '<p style="color:var(--text-muted);">Aucune question ajoutée pour le moment.</p>'
            : currentQuestions.map((q, i) => {
                const ci = Array.isArray(q.correct_indices) ? q.correct_indices : JSON.parse(q.correct_indices || '[]');
                return `
                                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border-left: 3px solid var(--primary-color); display: flex; gap: 10px; align-items: flex-start;">
                                    <div style="display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; padding-top: 2px;">
                                        <button onclick="moveQuestion(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Monter" style="width:28px; height:28px; border-radius:4px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:white; cursor:pointer; font-size:0.75rem;">▲</button>
                                        <button onclick="moveQuestion(${i}, 1)" ${i === currentQuestions.length - 1 ? 'disabled' : ''} title="Descendre" style="width:28px; height:28px; border-radius:4px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:white; cursor:pointer; font-size:0.75rem;">▼</button>
                                        <button onclick="deleteQuestion('${q.id}')" title="Supprimer" style="width:28px; height:28px; border-radius:4px; border:1px solid rgba(255,71,87,0.3); background:rgba(255,71,87,0.1); color:#ff4757; cursor:pointer; font-size:0.75rem;">✕</button>
                                    </div>
                                    <div style="flex:1; min-width:0;">
                                        <strong style="color:white;">Q${i + 1} : ${q.question}</strong>
                                        ${q.sub_question ? `<div style="margin-top:6px; padding:6px 10px; border-left:3px solid #00f2fe; background:rgba(0,242,254,0.08); border-radius:4px; color:#00f2fe; font-size:0.9rem;">${q.sub_question}</div>` : ''}
                                        ${q.image_url ? `<div style="margin-top:8px;"><img src="${q.image_url}" style="max-height:80px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);"></div>` : ''}
                                        <div style="display:flex; flex-wrap: wrap; gap:5px; margin-top: 8px; font-size: 0.85rem;">
                                            ${(Array.isArray(q.options) ? q.options : JSON.parse(q.options)).map((opt, idx) => `
                                                <span style="padding: 2px 8px; border-radius: 4px;
                                                    ${ci.includes(idx) ? 'color:#2ecc71; background:rgba(46,204,113,0.15); border: 1px solid rgba(46,204,113,0.4); font-weight:bold;' : 'color:var(--text-muted); background:rgba(255,255,255,0.05);'}">
                                                    <strong>${labels[idx]}.</strong> ${opt}
                                                </span>
                                            `).join('')}
                                        </div>
                                        ${q.explanation ? `<p style="margin: 8px 0 0; font-size: 0.8rem; color: rgba(0,242,254,0.7); font-style: italic;">💡 ${q.explanation}</p>` : ''}
                                    </div>
                                </div>`;
            }).join('')
        }
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <button onclick="saveQcmBank()" style="flex:1; padding: 8px; border-radius: 6px; border: 1px solid rgba(46,204,113,0.4); background: rgba(46,204,113,0.1); color: #2ecc71; cursor: pointer; font-weight: bold; font-size: 0.85rem;" ${currentQuestions.length === 0 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''}>
                            <i class="fas fa-save"></i> Sauvegarder ce QCM
                        </button>
                        <button onclick="loadQcmBank()" style="flex:1; padding: 8px; border-radius: 6px; border: 1px solid rgba(0,242,254,0.4); background: rgba(0,242,254,0.1); color: #00f2fe; cursor: pointer; font-weight: bold; font-size: 0.85rem;">
                            <i class="fas fa-folder-open"></i> Charger un QCM
                        </button>
                    </div>
                </div>
            </div>

            <!-- Colonne droite -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="background: rgba(10, 15, 40, 0.6); padding: 20px; border-radius: 12px; border: 1px solid var(--glass-border);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <button onclick="renderEventsList()" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.6); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem;">
                            <i class="fas fa-arrow-left"></i> Retour
                        </button>
                        <h4 style="margin:0; color:white; font-family: var(--font-title);">Contrôle</h4>
                    </div>
                    ${isDraft ? `
                    <button class="primary-btn" onclick="publishEvent()" style="width: 100%; background: #9b59b6; padding: 15px; border-radius: 8px; border:none; color:white; font-weight:bold; cursor:pointer; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(155, 89, 182, 0.3);">
                        <i class="fas fa-paper-plane"></i> Publier l'événement
                    </button>
                    <p style="color: rgba(255,255,255,0.4); font-size: 0.8rem; margin: 8px 0 0;">Rend l'événement visible aux joueurs.</p>
                    ` : isActive ? `
                    <button class="primary-btn" onclick="finishEvent()" style="width: 100%; background: #ffa502; padding: 15px; border-radius: 8px; border:none; color:white; font-weight:bold; cursor:pointer; font-size: 1.1rem;">
                        <i class="fas fa-flag-checkered"></i> Terminer l'événement
                    </button>
                    <p style="color: rgba(255,255,255,0.4); font-size: 0.8rem; margin: 8px 0 0;">L'événement est en cours. Vous pouvez toujours modifier les questions.</p>
                    ` : isTimed ? `
                    <button class="primary-btn" onclick="startArenaEvent()" style="width: 100%; background: #9b59b6; padding: 15px; border-radius: 8px; border:none; color:white; font-weight:bold; cursor:pointer; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(155, 89, 182, 0.3);">
                        <i class="fas fa-clock"></i> Activer l'événement TOUT DE SUITE
                    </button>
                    <p style="color: rgba(255,255,255,0.4); font-size: 0.8rem; margin: 8px 0 0;">Le QCM est jouable entre les dates définies.</p>
                    ` : `
                    <button class="primary-btn" onclick="startArenaEvent()" style="width: 100%; background: #2ecc71; padding: 15px; border-radius: 8px; border:none; color:white; font-weight:bold; cursor:pointer; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3);">
                        <i class="fas fa-play"></i> Lancer l'événement
                    </button>
                    `}
                    ${!isDraft ? `
                    <button onclick="toggleEventVisibility(true)" style="width: 100%; margin-top: 10px; background: rgba(155,89,182,0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(155,89,182,0.3); color:#9b59b6; cursor:pointer; font-weight:bold;">
                        <i class="fas fa-eye-slash"></i> Masquer l'événement
                    </button>
                    ` : ''}
                    <button onclick="cancelArenaEvent()" style="width: 100%; margin-top: 10px; background: rgba(255,71,87,0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,71,87,0.3); color:#ff4757; cursor:pointer; font-weight:bold;">
                        ${isDraft ? 'Supprimer le brouillon' : isActive ? 'Forcer l\'arrêt' : 'Annuler l\'événement'}
                    </button>
                </div>

                <div style="background: rgba(10, 15, 40, 0.6); padding: 20px; border-radius: 12px; border: 1px solid var(--admin-primary);">
                    <label style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 5px;"><i class="fas fa-file-medical"></i> Titre / Cas clinique</label>
                    <textarea id="nq-text" placeholder="Ex: Un patient de 45 ans se présente aux urgences avec..." style="width: 100%; box-sizing: border-box; padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: white; resize: vertical; min-height: 60px; margin-bottom: 15px; font-family: var(--font-main); font-size: 0.9rem;"></textarea>

                    <label style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 5px;"><i class="fas fa-image"></i> Illustration (QCM)</label>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                        <label for="nq-image-file" style="flex:1; padding: 10px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.3); background: rgba(0,0,0,0.2); color: white; cursor: pointer; text-align: center; font-size: 0.9rem; transition: all 0.2s;">
                            <i class="fas fa-upload" style="margin-right: 8px; color: var(--admin-primary);"></i> 
                            <span id="file-name-display">Choisir une image...</span>
                        </label>
                        <input type="file" id="nq-image-file" accept="image/*" style="display:none;" onchange="document.getElementById('file-name-display').innerText = this.files[0] ? this.files[0].name : 'Choisir une image...'">
                        
                        <input type="text" id="nq-image-url" placeholder="Ou URL externe..." style="flex:1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
                    </div>

                    <label style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 5px;"><i class="fas fa-question-circle"></i> La question</label>
                    <textarea id="nq-sub-question" placeholder="Concernant x, la (lesquelles) proposition(s) est (sont) vraie(s) ?" style="width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #00f2fe; resize: vertical; min-height: 40px; margin-bottom: 12px; font-family: var(--font-main);"></textarea>


                    <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px;">
                        ${labels.map((l, i) => `
                        <div style="display:flex; align-items:center; gap: 8px;">
                            <input type="checkbox" id="nq-correct-${i}" title="Bonne réponse" style="width:16px; height:16px; cursor:pointer; accent-color: #2ecc71;">
                            <input type="text" id="nq-o${i}" placeholder="Proposition ${l}" style="flex:1; padding: 8px; border-radius: 6px; border: 1px solid ${colors[i]}; background: rgba(0,0,0,0.2); color: white; font-family: var(--font-main);">
                            <label style="font-weight:bold; color:${colors[i]}; min-width:20px;">${l}</label>
                        </div>`).join('')}
                    </div>
                    <p style="color: rgba(255,255,255,0.4); font-size: 0.75rem; margin: 0 0 10px;">Cochez ☑ les cases des bonnes réponses.</p>

                    <label style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 5px;"><i class="fas fa-lightbulb"></i> Correction (texte affiché après la question)</label>
                    <textarea id="nq-expl" placeholder="Ex: Le diagnostic est X car... (optionnel)" style="width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid rgba(0,242,254,0.3); background: rgba(0,0,0,0.2); color: white; resize: vertical; min-height: 50px; margin-bottom: 12px; font-size: 0.85rem; font-family: var(--font-main);"></textarea>

                    <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                        <div style="flex:1;">
                            <label style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 5px;"><i class="fas fa-hourglass-half"></i> Temps de réponse (Secs)</label>
                            <input type="number" id="nq-time" value="45" style="width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
                        </div>
                        <div style="flex:1;">
                            <label style="color: var(--text-muted); font-size: 0.85rem; display: block; margin-bottom: 5px;"><i class="fas fa-stopwatch"></i> Temps de correction (Secs)</label>
                            <input type="number" id="nq-corr-time" value="20" style="width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
                        </div>
                    </div>

                    <button class="primary-btn" onclick="addQuestion()" style="width: 100%; background: var(--admin-primary); padding: 10px; border-radius: 8px; border:none; color:white; font-weight:bold; cursor:pointer;">
                        Ajouter la question
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderTimedActiveDashboard(root) {
    const dateObj = new Date(currentEvent.scheduled_at);
    const endsObj = currentEvent.ends_at ? new Date(currentEvent.ends_at) : null;
    const now = Date.now();
    const isWithinWindow = (!endsObj || now < endsObj.getTime());

    root.innerHTML = `
        <div style="margin-bottom: 15px;">
            <button onclick="renderEventsList()" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.6); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem;">
                <i class="fas fa-arrow-left"></i> Retour à la liste
            </button>
        </div>
        <div style="background: rgba(10, 15, 40, 0.8); padding: 30px; border-radius: 12px; border: 2px solid #9b59b6; text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; padding: 5px 15px; border-radius: 20px; background: rgba(155,89,182,0.15); margin-bottom: 15px; font-weight:bold; font-size: 0.9rem; color: #9b59b6;">
                <i class="fas fa-clock"></i> MODE INTERVALLE ACTIF &nbsp;|&nbsp; <i class="fas fa-users"></i> <span id="arena-players-count">${playersCount}</span> joueurs
            </div>
            <h2 style="font-family: var(--font-title); font-size: 1.6rem; color: white; margin: 0 0 10px 0;">${currentEvent.title}</h2>
            <p style="color: var(--text-muted); margin: 0 0 5px;">
                <i class="fas fa-play-circle"></i> Début : ${dateObj.toLocaleString('fr-FR')}
            </p>
            ${endsObj ? `<p style="color: #9b59b6; margin: 0 0 20px;">
                <i class="fas fa-hourglass-end"></i> Fin : ${endsObj.toLocaleString('fr-FR')}
                ${isWithinWindow ? '<span style="color:#2ecc71; font-weight:bold; margin-left:10px;">(en cours)</span>' : '<span style="color:#ff4757; font-weight:bold; margin-left:10px;">(terminé)</span>'}
            </p>` : ''}
            <p style="color: rgba(255,255,255,0.6); font-size: 0.95rem;">Le QCM se joue automatiquement. Les joueurs arrivent et jouent à leur rythme.</p>
            <p style="color: rgba(255,255,255,0.4); font-size: 0.85rem;">${currentQuestions.length} questions chargées</p>
            <div style="margin-top: 20px;">
                <button onclick="finishEvent()" style="background: #ffa502; padding: 15px 30px; border-radius: 8px; border:none; color:white; font-weight:bold; cursor:pointer; font-size: 1rem;">
                    <i class="fas fa-flag-checkered"></i> Terminer l'événement maintenant
                </button>
            </div>
        </div>
    `;
}

function renderLiveDashboard(root) {
    const currentQIndex = currentEvent.current_question_id
        ? currentQuestions.findIndex(q => q.id === currentEvent.current_question_id)
        : -1;
    const currentQ = currentQIndex >= 0 ? currentQuestions[currentQIndex] : null;
    const labels = ['A', 'B', 'C', 'D', 'E'];
    const colors = ['#ff4757', '#1e90ff', '#ffa502', '#2ed573', '#a29bfe'];
    const ci = currentQ ? (Array.isArray(currentQ.correct_indices) ? currentQ.correct_indices : JSON.parse(currentQ.correct_indices || '[]')) : [];

    let statusColor = currentEvent.status === 'question_active' ? '#2ecc71' : 'var(--admin-primary)';

    let html = `
        <div style="margin-bottom: 15px;">
            <button onclick="renderEventsList()" style="background:transparent; border:1px solid rgba(255,255,255,0.2); color:rgba(255,255,255,0.6); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:0.85rem;">
                <i class="fas fa-arrow-left"></i> Retour à la liste
            </button>
        </div>
        <div style="background: rgba(10, 15, 40, 0.8); padding: 30px; border-radius: 12px; border: 2px solid ${statusColor}; text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; padding: 5px 15px; border-radius: 20px; background: rgba(255,255,255,0.1); margin-bottom: 15px; font-weight:bold; font-size: 0.9rem; color: #00f2fe;">
                EN DIRECT &nbsp;|&nbsp; <i class="fas fa-users"></i> <span id="arena-players-count">${playersCount}</span> joueurs
                &nbsp;|&nbsp; <i class="fas fa-reply-all"></i> Réponses: <span id="answered-count">${answeredPlayersCount}/${playersCount}</span>
                <span id="admin-timer-display" style="margin-left: 15px; color: #ffcc00; font-family: monospace; font-size: 1.1rem; display: none;"></span>
            </div>

            ${currentQ ? `
                <h2 style="font-family: var(--font-title); font-size: 1.6rem; color: white; margin: 0 0 10px 0;">Q${currentQIndex + 1} : ${currentQ.question}</h2>
                ${currentQ.image_url ? `<img src="${currentQ.image_url}" style="max-height: 200px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.2);">` : ''}
            ` : `<h2 style="color:rgba(255,255,255,0.7); font-size:1.4rem;">Prêt à envoyer la prochaine question...</h2>`}

            ${(currentEvent.status === 'question_active' || currentEvent.status === 'showing_answer') && currentQ ? `
                <div style="display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; max-width: 700px; margin: 0 auto 20px;">
                    ${(Array.isArray(currentQ.options) ? currentQ.options : JSON.parse(currentQ.options)).map((opt, idx) => `
                        <div style="padding: 10px; border-radius: 8px; background: ${ci.includes(idx) && currentEvent.status === 'showing_answer' ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${ci.includes(idx) && currentEvent.status === 'showing_answer' ? '#2ecc71' : colors[idx]}; color:white; font-size: 0.85rem;">
                            <strong style="color:${colors[idx]}; display:block; font-size:1.1rem;">${labels[idx]}</strong>
                            ${opt}
                            ${ci.includes(idx) && currentEvent.status === 'showing_answer' ? '<br><i class="fas fa-check" style="color:#2ecc71;"></i>' : ''}
                        </div>
                    `).join('')}
                </div>
                <div style="display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; max-width: 700px; margin: 0 auto 20px;">
                    ${[0, 1, 2, 3, 4].map(i => `<div style="padding:10px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid ${colors[i]}; color:white;"><span id="stat-ans-${i}" style="font-size:1.4rem; font-weight:bold; display:block;">0</span><small>${labels[i]}</small></div>`).join('')}
                </div>
            ` : ''}

            ${currentEvent.status === 'showing_answer' && currentQ && currentQ.explanation ? `
                <div style="max-width: 700px; margin: 0 auto 20px; padding: 15px; background: rgba(0,242,254,0.08); border: 1px solid rgba(0,242,254,0.3); border-radius: 10px; text-align: left; color: #cce; font-size: 0.95rem;">
                    <strong style="color:#00f2fe;"><i class="fas fa-lightbulb"></i> Correction :</strong><br>${currentQ.explanation}
                </div>
            ` : ''}

            <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
    `;

    if (currentEvent.status === 'starting' || currentEvent.status === 'showing_answer') {
        const nextQ = currentQIndex + 1 < currentQuestions.length ? currentQuestions[currentQIndex + 1] : null;
        if (nextQ) {
            html += `<button id="btn-next-action" onclick="pushQuestion('${nextQ.id}')" style="background: var(--primary-color); padding: 15px 30px; border-radius: 8px; border:none; color:#0a0f28; font-weight:bold; cursor:pointer; font-size: 1rem;">▶ Question ${currentQIndex + 2}</button>`;
        } else {
            html += `<button id="btn-next-action" onclick="finishEvent()" style="background: #ffa502; padding: 15px 30px; border-radius: 8px; border:none; color:white; font-weight:bold; cursor:pointer; font-size: 1rem;">🏆 Terminer &amp; Podium</button>`;
        }
    } else if (currentEvent.status === 'question_active') {
        html += `<button id="btn-next-action" onclick="showAnswer()" style="background: var(--admin-primary); padding: 15px 30px; border-radius: 8px; border:none; color:white; font-weight:bold; cursor:pointer; font-size: 1rem;">Stopper &amp; Afficher la Correction</button>`;
    }

    html += `
            </div>
            <div style="margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 15px;">
                <button onclick="cancelArenaEvent()" style="background:transparent; border:1px solid rgba(255,255,255,0.15); color:rgba(255,255,255,0.4); padding:7px 14px; border-radius:6px; cursor:pointer; font-size:0.8rem;">Terminer l'événement</button>
            </div>
        </div>
    `;

    root.innerHTML = html;
    if (currentEvent.status === 'question_active' || currentEvent.status === 'showing_answer') {
        fetchCurrentQuestionStats();
    }
}

// ==========================================
// ACTIONS
// ==========================================

async function arenaCreateEvent() {
    const title = document.getElementById('arena-new-title').value.trim();
    const desc = document.getElementById('arena-new-desc').value.trim();
    const dateLocal = document.getElementById('arena-new-date').value;

    const xpRewards = [
        parseInt(document.getElementById('xp-top1').value) || 300,
        parseInt(document.getElementById('xp-top2').value) || 200,
        parseInt(document.getElementById('xp-top3').value) || 100,
        parseInt(document.getElementById('xp-top4').value) || 50,
        parseInt(document.getElementById('xp-top5').value) || 50
    ];

    if (!title || !dateLocal) return alert('Veuillez remplir le titre et la date de l\'événement.');

    const dateUtc = new Date(dateLocal).toISOString();
    const { data: { session } } = await supabase.auth.getSession();

    const showCountdown = document.getElementById('arena-show-countdown')?.checked !== false;
    const eventMode = document.getElementById('arena-new-date').dataset.eventMode || 'live';

    const eventData = {
        title,
        description: desc || null,
        xp_rewards: xpRewards,
        scheduled_at: dateUtc,
        status: 'waiting',
        admin_id: session.user.id,
        show_countdown: showCountdown
    };

    if (eventMode === 'timed') {
        const endsAtLocal = document.getElementById('arena-new-ends-at').value;
        if (!endsAtLocal) return alert('Veuillez définir la date/heure de fin de l\'intervalle.');
        const endsAtUtc = new Date(endsAtLocal).toISOString();
        if (new Date(endsAtUtc) <= new Date(dateUtc)) return alert('La date de fin doit être après la date de début.');
        eventData.ends_at = endsAtUtc;
    }

    // Build full data with new columns
    const fullData = { ...eventData, event_mode: eventMode, is_draft: true };

    // Try insert progressively falling back if columns don't exist
    let data, error;
    const attempts = [
        fullData,                                                // all columns
        { ...eventData, event_mode: eventMode },                 // without is_draft
        { ...eventData, is_draft: true },                        // without event_mode
        eventData                                                // base only
    ];
    for (const attempt of attempts) {
        try {
            const result = await supabase.from('arena_events').insert([attempt]).select('*');
            if (!result.error) { data = result.data; error = null; break; }
            error = result.error;
        } catch(e) { error = e; }
    }

    if (error) { alert("Erreur : " + (error.message || error)); return; }
    currentEvent = data[0];
    allEvents.unshift(currentEvent);
    renderEventDashboard();
}

async function addQuestion() {
    if (!currentEvent) return;

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Traitement...';

    try {
        const text = document.getElementById('nq-text').value.trim();
        const subQuestion = document.getElementById('nq-sub-question').value.trim();
        const fileInput = document.getElementById('nq-image-file');
        const externalUrl = document.getElementById('nq-image-url').value.trim();
        const timeLimit = parseInt(document.getElementById('nq-time').value) || 45;
        const correctionTimeLimit = parseInt(document.getElementById('nq-corr-time').value) || 20;
        const options = [0, 1, 2, 3, 4].map(i => document.getElementById(`nq-o${i}`).value.trim());
        const correctIndices = [0, 1, 2, 3, 4].filter(i => document.getElementById(`nq-correct-${i}`).checked);
        const explanation = document.getElementById('nq-expl').value.trim();

        if (!text) throw new Error('Entrez la question.');
        if (options.some(o => !o)) throw new Error('Remplissez les 5 propositions A à E.');
        if (correctIndices.length === 0) throw new Error('Cochez au moins une bonne réponse.');

        let finalImageUrl = externalUrl || null;

        // Handle File Upload
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
            const filePath = `questions/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('arena-images')
                .upload(filePath, file);

            if (uploadError) throw new Error("Erreur d'upload: " + uploadError.message);

            const { data: { publicUrl } } = supabase.storage
                .from('arena-images')
                .getPublicUrl(filePath);

            finalImageUrl = publicUrl;
        }

        const { data, error } = await supabase
            .from('arena_questions')
            .insert([{
                event_id: currentEvent.id,
                order_num: currentQuestions.length,
                question: text,
                sub_question: subQuestion || null,
                image_url: finalImageUrl,
                options: options,
                correct_indices: correctIndices,
                time_limit: timeLimit,
                correction_time_limit: correctionTimeLimit,
                explanation: explanation || null
            }])
            .select();

        if (error) throw error;

        currentQuestions.push(data[0]);
        renderEventDashboard();
    } catch (err) {
        alert(err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function startArenaEvent() {
    if (!currentEvent) return;
    if (currentQuestions.length === 0) return alert('Ajoutez au moins une question !');

    // Auto-publish if still draft
    if (currentEvent.is_draft) {
        await supabase.from('arena_events').update({ is_draft: false }).eq('id', currentEvent.id);
        currentEvent.is_draft = false;
    }

    const isTimed = currentEvent.event_mode === 'timed';

    if (isTimed) {
        const { error } = await supabase.from('arena_events').update({ status: 'active' }).eq('id', currentEvent.id);
        if (error) alert(error.message);
    } else {
        const { error } = await supabase.from('arena_events').update({ status: 'starting' }).eq('id', currentEvent.id);
        if (!error && currentQuestions.length > 0) {
            setTimeout(() => pushQuestion(currentQuestions[0].id), 3000);
        } else if (error) {
            alert(error.message);
        }
    }
}

async function pushQuestion(questionId) {
    if (!currentEvent) return;

    // Reset answer tracking for the new question
    answeredPlayersCount = 0;
    answerCounts = [0, 0, 0, 0, 0];

    const { error } = await supabase.from('arena_events').update({ status: 'question_active', current_question_id: questionId }).eq('id', currentEvent.id);
    if (error) {
        alert(error.message);
        return;
    }

    // Re-fetch player count in case someone joined late
    await updatePlayersCount(currentEvent.id);

    const q = currentQuestions.find(q => q.id === questionId);
    if (q) startAdminTimer(q.time_limit || 45, 'question');
}

async function showAnswer() {
    if (!currentEvent) return;
    const { error } = await supabase.from('arena_events').update({ status: 'showing_answer' }).eq('id', currentEvent.id);
    if (error) {
        alert(error.message);
        return;
    }

    const q = currentQuestions.find(q => q.id === currentEvent.current_question_id);
    if (q) startAdminTimer(q.correction_time_limit || 20, 'correction');
}

async function finishEvent() {
    if (!currentEvent) return;
    clearAdminTimer();

    try {
        // Fetch all players sorted by score
        const { data: players, error: fetchErr } = await supabase
            .from('arena_players')
            .select('id, user_id, score')
            .eq('event_id', currentEvent.id)
            .order('score', { ascending: false });

        if (fetchErr) { console.error('finishEvent fetch players:', fetchErr); alert('Erreur fetch players: ' + fetchErr.message); return; }
        console.log('finishEvent players:', players);

        // Compute XP rewards from event config
        const rewards = Array.isArray(currentEvent.xp_rewards)
            ? currentEvent.xp_rewards
            : JSON.parse(currentEvent.xp_rewards || '[300,200,100,50,50]');
        console.log('finishEvent rewards:', rewards);

        // Assign final_rank + xp_earned to each player
        if (players && players.length > 0) {
            for (let i = 0; i < players.length; i++) {
                const xp = rewards[i] || 0;
                const { error: rankErr } = await supabase.from('arena_players').update({
                    final_rank: i + 1,
                    xp_earned: xp
                }).eq('id', players[i].id);
                if (rankErr) { console.error('finishEvent update rank:', rankErr); }

                // Add XP to user profile
                if (xp > 0) {
                    const { data: profile, error: profErr } = await supabase
                        .from('profiles')
                        .select('total_xp')
                        .eq('id', players[i].user_id)
                        .single();
                    if (profErr) { console.error('finishEvent fetch profile:', profErr); continue; }
                    if (profile) {
                        const { error: xpErr } = await supabase.from('profiles').update({
                            total_xp: (profile.total_xp || 0) + xp
                        }).eq('id', players[i].user_id);
                        if (xpErr) { console.error('finishEvent update XP:', xpErr); }
                        else { console.log(`+${xp} XP → ${players[i].user_id}`); }
                    }
                }
            }
        }

        // Mark event as finished
        const { error } = await supabase.from('arena_events').update({ status: 'finished' }).eq('id', currentEvent.id);
        if (error) { console.error('finishEvent update event:', error); alert(error.message); }
        else { alert('Événement terminé — classement et XP distribués !'); }

    } catch (err) {
        console.error('finishEvent fatal:', err);
        alert('Erreur finishEvent: ' + err.message);
    }
}

async function publishEvent() {
    if (!currentEvent || !currentEvent.is_draft) return;
    const { error } = await supabase.from('arena_events').update({ is_draft: false }).eq('id', currentEvent.id);
    if (error) return alert("Erreur: " + error.message);
    currentEvent.is_draft = false;
    renderEventDashboard();
}

window.toggleEventVisibility = async function(hide) {
    if (!currentEvent) return;
    const msg = hide
        ? "Masquer cet événement aux joueurs ?"
        : "Rendre cet événement visible aux joueurs ?";
    if (!confirm(msg)) return;
    const { error } = await supabase.from('arena_events').update({ is_draft: hide }).eq('id', currentEvent.id);
    if (error) return alert("Erreur: " + error.message);
    currentEvent.is_draft = hide;
    renderEventDashboard();
};

async function cancelArenaEvent() {
    if (!currentEvent) return;
    const isWaiting = currentEvent.status === 'waiting';
    const msg = isWaiting
        ? "Supprimer cet événement en attente ? (les questions seront perdues)"
        : "Terminer cet événement maintenant ? (les résultats seront conservés)";
    if (!confirm(msg)) return;
    clearAdminTimer();

    if (isWaiting) {
        // Delete entirely if still in waiting
        const { error } = await supabase.from('arena_events').delete().eq('id', currentEvent.id);
        if (!error) { currentEvent = null; currentQuestions = []; renderCreateEventForm(); }
        else alert(error.message);
    } else {
        // Just finish if active
        const { error } = await supabase.from('arena_events').update({ status: 'finished' }).eq('id', currentEvent.id);
        if (!error) { currentEvent = null; currentQuestions = []; renderCreateEventForm(); }
        else alert(error.message);
    }
}

// ==========================================
// QUESTION MANAGEMENT (REORDER / DELETE)
// ==========================================

async function moveQuestion(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentQuestions.length) return;

    const qA = currentQuestions[index];
    const qB = currentQuestions[targetIndex];

    const tempOrder = qA.order_num;
    await supabase.from('arena_questions').update({ order_num: qB.order_num }).eq('id', qA.id);
    await supabase.from('arena_questions').update({ order_num: tempOrder }).eq('id', qB.id);

    currentQuestions[index] = qB;
    currentQuestions[targetIndex] = qA;

    renderEventDashboard();
}

async function deleteQuestion(questionId) {
    if (!confirm("Supprimer cette question ?")) return;

    await supabase.from('arena_questions').delete().eq('id', questionId);
    currentQuestions = currentQuestions.filter(q => q.id !== questionId);

    for (let i = 0; i < currentQuestions.length; i++) {
        if (currentQuestions[i].order_num !== i) {
            await supabase.from('arena_questions').update({ order_num: i }).eq('id', currentQuestions[i].id);
            currentQuestions[i].order_num = i;
        }
    }

    renderEventDashboard();
}

// ==========================================
// QCM BANK (SAVE / LOAD)
// ==========================================

async function saveQcmBank() {
    if (!currentEvent || currentQuestions.length === 0) return alert("Aucune question à sauvegarder.");
    const name = prompt("Donnez un nom à ce QCM pour le retrouver plus tard :");
    if (!name || !name.trim()) return;

    const questionsData = currentQuestions.map(q => ({
        question: q.question,
        sub_question: q.sub_question || null,
        image_url: q.image_url || null,
        options: q.options,
        correct_indices: q.correct_indices,
        time_limit: q.time_limit || 45,
        correction_time_limit: q.correction_time_limit || 20,
        explanation: q.explanation || null
    }));

    const user = await window.requireAuth();
    const { error } = await supabase.from('arena_qcm_banks').insert([{
        name: name.trim(),
        questions: questionsData,
        admin_id: user.id
    }]);

    if (error) return alert("Erreur: " + error.message);
    alert(`✅ QCM "${name.trim()}" sauvegardé avec ${questionsData.length} questions !`);
}

async function loadQcmBank() {
    if (!currentEvent) return;

    const { data: banks, error } = await supabase
        .from('arena_qcm_banks')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return alert("Erreur: " + error.message);
    if (!banks || banks.length === 0) return alert("Aucun QCM sauvegardé.");

    // Build a selection modal
    const root = document.getElementById('arena-admin-root');
    const overlay = document.createElement('div');
    overlay.id = 'qcm-bank-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px;';
    overlay.innerHTML = `
        <div style="background: #0a0f28; border: 1px solid var(--admin-primary); border-radius: 12px; padding: 25px; max-width: 550px; width: 100%; max-height: 80vh; overflow-y: auto;">
            <h3 style="margin-top:0; color:white; font-family: var(--font-title);"><i class="fas fa-folder-open"></i> Charger un QCM sauvegardé</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${banks.map(b => {
        const qs = Array.isArray(b.questions) ? b.questions : JSON.parse(b.questions);
        return `
                    <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color:white;">${b.name}</strong>
                            <p style="margin:3px 0 0; color:var(--text-muted); font-size:0.8rem;">${qs.length} questions · ${new Date(b.created_at).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button onclick="confirmLoadBank('${b.id}')" style="padding: 6px 14px; border-radius: 6px; border: none; background: var(--admin-primary); color: white; cursor: pointer; font-weight: bold; font-size: 0.85rem;">
                                <i class="fas fa-download"></i> Charger
                            </button>
                            <button onclick="deleteQcmBank('${b.id}')" style="padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,71,87,0.3); background: transparent; color: #ff4757; cursor: pointer; font-size: 0.85rem;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>`;
    }).join('')}
            </div>
            <button onclick="document.getElementById('qcm-bank-overlay').remove()" style="margin-top: 15px; width: 100%; padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: rgba(255,255,255,0.6); cursor: pointer;">
                Annuler
            </button>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function confirmLoadBank(bankId) {
    if (!currentEvent) return;
    const overlay = document.getElementById('qcm-bank-overlay');

    const { data: bank } = await supabase.from('arena_qcm_banks').select('*').eq('id', bankId).single();
    if (!bank) return alert("QCM non trouvé.");

    const questions = Array.isArray(bank.questions) ? bank.questions : JSON.parse(bank.questions);

    let mode = 'add';
    if (currentQuestions.length > 0) {
        const choice = prompt(`Charger "${bank.name}" (${questions.length} questions)\n\nTapez :\n1 = Ajouter aux questions existantes\n2 = Remplacer toutes les questions\n\nAnnuler pour annuler.`);
        if (!choice) return;
        if (choice === '2') mode = 'replace';
        else if (choice !== '1') return;
    }

    if (mode === 'replace') {
        await supabase.from('arena_questions').delete().eq('event_id', currentEvent.id);
        currentQuestions = [];
    }

    const inserts = questions.map((q, i) => ({
        event_id: currentEvent.id,
        order_num: currentQuestions.length + i,
        question: q.question,
        sub_question: q.sub_question || null,
        image_url: q.image_url || null,
        options: q.options,
        correct_indices: q.correct_indices,
        time_limit: q.time_limit || 45,
        correction_time_limit: q.correction_time_limit || 20,
        explanation: q.explanation || null
    }));

    const { data, error } = await supabase.from('arena_questions').insert(inserts).select();
    if (error) return alert("Erreur: " + error.message);

    if (data) currentQuestions.push(...data);
    if (overlay) overlay.remove();
    renderEventDashboard();
}

async function deleteQcmBank(bankId) {
    if (!confirm("Supprimer ce QCM sauvegardé ?")) return;
    const { error } = await supabase.from('arena_qcm_banks').delete().eq('id', bankId);
    if (error) return alert("Erreur: " + error.message);
    // Re-open the modal
    const overlay = document.getElementById('qcm-bank-overlay');
    if (overlay) overlay.remove();
    loadQcmBank();
}

let answerCounts = [0, 0, 0, 0, 0];
let answeredPlayersCount = 0;

async function fetchCurrentQuestionStats() {
    if (!currentEvent || !currentEvent.current_question_id) return;
    const { data } = await supabase
        .from('arena_answers')
        .select('answer_indices')
        .eq('question_id', currentEvent.current_question_id);

    if (data) {
        answerCounts = [0, 0, 0, 0, 0];
        data.forEach(ans => {
            const indices = Array.isArray(ans.answer_indices) ? ans.answer_indices : JSON.parse(ans.answer_indices || '[]');
            indices.forEach(i => { if (i >= 0 && i <= 4) answerCounts[i]++; });
        });
        for (let i = 0; i < 5; i++) {
            const el = document.getElementById(`stat-ans-${i}`);
            if (el) el.innerText = answerCounts[i];
        }
    }
}

function updateAnswersStats(answerIndices) {
    const indices = Array.isArray(answerIndices) ? answerIndices : (typeof answerIndices === 'string' ? JSON.parse(answerIndices || '[]') : []);

    // Update per-option counts for display
    indices.forEach(i => {
        if (i >= 0 && i <= 4) {
            answerCounts[i]++;
            const el = document.getElementById(`stat-ans-${i}`);
            if (el) el.innerText = answerCounts[i];
        }
    });

    // Each call to this function = 1 new player answered (triggered by INSERT on arena_answers)
    answeredPlayersCount++;
    const countEl = document.getElementById('answered-count');
    if (countEl) countEl.innerText = `${answeredPlayersCount}/${playersCount}`;


    // If all players have answered and we're still in question_active, fast-forward to correction
    if (currentEvent && currentEvent.status === 'question_active' && playersCount > 0 && answeredPlayersCount >= playersCount) {
        showAnswer();
    }
}

// ==========================================
// AUTO-FLOW TIMERS
// ==========================================

function startAdminTimer(seconds, mode) {
    clearAdminTimer();
    currentAdminTimeLeft = seconds;
    const displayEl = document.getElementById('admin-timer-display');
    if (displayEl) {
        displayEl.style.display = 'inline';
        displayEl.innerText = `⏳ ${currentAdminTimeLeft}s`;
    }

    adminTimerInterval = setInterval(() => {
        currentAdminTimeLeft--;
        if (displayEl) displayEl.innerText = `⏳ ${currentAdminTimeLeft}s`;

        if (currentAdminTimeLeft <= 0) {
            clearAdminTimer();
            if (mode === 'question') {
                showAnswer();
            } else if (mode === 'correction') {
                const currentQIndex = currentQuestions.findIndex(q => q.id === currentEvent.current_question_id);
                const nextQ = currentQIndex + 1 < currentQuestions.length ? currentQuestions[currentQIndex + 1] : null;
                if (nextQ) {
                    pushQuestion(nextQ.id);
                } else {
                    finishEvent();
                }
            }
        }
    }, 1000);
}

function clearAdminTimer() {
    if (adminTimerInterval) clearInterval(adminTimerInterval);
    adminTimerInterval = null;
    const displayEl = document.getElementById('admin-timer-display');
    if (displayEl) displayEl.style.display = 'none';
}

// Global action injected logic
window.editEventDescription = async function () {
    if (!currentEvent) return;
    const newDesc = prompt("Modifiez le programme / la description de l'événement :", currentEvent.description || "");
    if (newDesc !== null) {
        const { error } = await supabase.from('arena_events').update({ description: newDesc }).eq('id', currentEvent.id);
        if (error) {
            alert("Erreur: " + error.message);
        } else {
            currentEvent.description = newDesc;
            renderEventDashboard();
        }
    }
};

window.editEventTitle = async function () {
    if (!currentEvent) return;
    const newTitle = prompt("Modifiez le titre de l'événement :", currentEvent.title || "");
    if (newTitle !== null && newTitle.trim()) {
        const { error } = await supabase.from('arena_events').update({ title: newTitle.trim() }).eq('id', currentEvent.id);
        if (error) {
            alert("Erreur: " + error.message);
        } else {
            currentEvent.title = newTitle.trim();
            renderEventDashboard();
        }
    }
};

window.editEventDate = async function () {
    if (!currentEvent) return;
    const currentDate = new Date(currentEvent.scheduled_at);
    const localISO = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const newDateStr = prompt("Modifiez la date et heure de l'événement (AAAA-MM-JJTHH:MM) :", localISO);
    if (newDateStr !== null && newDateStr.trim()) {
        const dateUtc = new Date(newDateStr.trim()).toISOString();
        if (isNaN(new Date(dateUtc).getTime())) return alert("Format de date invalide.");
        const { error } = await supabase.from('arena_events').update({ scheduled_at: dateUtc }).eq('id', currentEvent.id);
        if (error) {
            alert("Erreur: " + error.message);
        } else {
            currentEvent.scheduled_at = dateUtc;
            renderEventDashboard();
        }
    }
};

window.toggleCountdownVisibility = async function (show) {
    if (!currentEvent) return;
    const { error } = await supabase.from('arena_events').update({ show_countdown: show }).eq('id', currentEvent.id);
    if (error) {
        alert("Erreur: " + error.message);
    } else {
        currentEvent.show_countdown = show;
    }
};

window.toggleEventMode = async function () {
    if (!currentEvent) return;
    const newMode = currentEvent.event_mode === 'timed' ? 'live' : 'timed';
    const updates = { event_mode: newMode };

    if (newMode === 'timed' && !currentEvent.ends_at) {
        // Default ends_at = scheduled_at + 3 hours
        const start = new Date(currentEvent.scheduled_at);
        const defEnd = new Date(start.getTime() + 3 * 3600000);
        updates.ends_at = defEnd.toISOString();
    }

    const { error } = await supabase.from('arena_events').update(updates).eq('id', currentEvent.id);
    if (error) {
        alert("Erreur: " + error.message);
    } else {
        currentEvent.event_mode = newMode;
        if (updates.ends_at) currentEvent.ends_at = updates.ends_at;
        renderEventDashboard();
    }
};

window.editEventEndDate = async function () {
    if (!currentEvent || !currentEvent.ends_at) return;
    const currentEnd = new Date(currentEvent.ends_at);
    const localISO = new Date(currentEnd.getTime() - currentEnd.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const newDateStr = prompt("Modifiez la date et heure de fin (AAAA-MM-JJTHH:MM) :", localISO);
    if (newDateStr !== null && newDateStr.trim()) {
        const dateUtc = new Date(newDateStr.trim()).toISOString();
        if (isNaN(new Date(dateUtc).getTime())) return alert("Format de date invalide.");
        if (new Date(dateUtc) <= new Date(currentEvent.scheduled_at)) return alert("La date de fin doit être après la date de début.");
        const { error } = await supabase.from('arena_events').update({ ends_at: dateUtc }).eq('id', currentEvent.id);
        if (error) {
            alert("Erreur: " + error.message);
        } else {
            currentEvent.ends_at = dateUtc;
            renderEventDashboard();
        }
    }
};
