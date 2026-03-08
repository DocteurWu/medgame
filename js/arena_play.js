/**
 * MedGame Arena - Player Logic
 * QCM: 5 options A-E, multiple correct answers, partial scoring.
 * Score: 0 écart = 1pt | 1 écart = 0.5pt | 2 écart = 0.2pt | 3+ = 0pt
 */

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initArenaPlay, 500);
});

const LABELS = ['A', 'B', 'C', 'D', 'E'];

let currentEvent = null;
let currentQuestion = null;
let myPlayerId = null;
let myUserId = null;
let hasAnsweredCurrent = false;
let selectedIndices = new Set();
let timerInterval = null;
let arenaChannel = null;

/** Scoring rule based on number of mismatches */
function computeScore(selected, correctSet) {
    const totalExpected = correctSet.size;
    // Wrong = selected but not correct, Missed = correct but not selected
    const wrong = [...selected].filter(i => !correctSet.has(i)).length;
    const missed = [...correctSet].filter(i => !selected.has(i)).length;
    const diff = wrong + missed;

    if (diff === 0) return 1.0;
    if (diff === 1) return 0.5;
    if (diff === 2) return 0.2;
    return 0.0;
}

async function initArenaPlay() {
    if (typeof supabase === 'undefined') return;

    const user = await window.requireAuth();
    if (!user) return;
    myUserId = user.id;

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');
    if (!eventId) { alert("Aucun événement valide."); window.location.href = "index.html"; return; }

    // Fetch profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

    const badge = document.getElementById('player-badge');
    const nameEl = document.getElementById('player-name');
    if (badge && nameEl && profile) {
        badge.style.display = 'block';
        nameEl.innerText = profile.username || "Anonyme";
    }

    await joinEvent(eventId, user.id);
    await loadEventStatus(eventId);
    subscribeToArena(eventId);
}

async function joinEvent(eventId, userId) {
    const { data: existing } = await supabase
        .from('arena_players')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();

    if (existing) {
        myPlayerId = existing.id;
    } else {
        const { data: newPlayer, error } = await supabase
            .from('arena_players')
            .insert([{ event_id: eventId, user_id: userId }])
            .select()
            .single();

        if (error) { console.error("Erreur join:", error); return; }
        myPlayerId = newPlayer.id;
    }
}

async function loadEventStatus(eventId) {
    const { data: ev } = await supabase
        .from('arena_events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (ev) { currentEvent = ev; await processEventState(); }
}

function subscribeToArena(eventId) {
    if (arenaChannel) supabase.removeChannel(arenaChannel);

    arenaChannel = supabase.channel(`player_arena_${eventId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'arena_events', filter: `id=eq.${eventId}` }, async (payload) => {
            const oldStatus = currentEvent ? currentEvent.status : null;
            currentEvent = payload.new;

            // New question => reset
            if (currentEvent.status === 'question_active' && oldStatus !== 'question_active') {
                hasAnsweredCurrent = false;
                selectedIndices = new Set();
                currentQuestion = null;
                if (timerInterval) clearInterval(timerInterval);
            }

            await processEventState();
        })
        .subscribe();
}

async function processEventState() {
    if (!currentEvent) return;
    const root = document.getElementById('arena-play-root');

    switch (currentEvent.status) {
        case 'waiting':
            const hasStarted = new Date(currentEvent.scheduled_at).getTime() < Date.now();
            const rewards = Array.isArray(currentEvent.xp_rewards) ? currentEvent.xp_rewards : JSON.parse(currentEvent.xp_rewards || '[1000,500,250,100,50]');

            root.innerHTML = `
                <div style="padding: 10px 0;">
                    <span style="display:inline-block; background:rgba(255,165,2,0.15); color:#ffa502; padding:5px 15px; border-radius:20px; font-weight:bold; font-size:0.85rem; margin-bottom:15px; border:1px solid rgba(255,165,2,0.3);">
                        <i class="fas fa-hourglass-half"></i> SALLE D'ATTENTE
                    </span>
                    <h2 style="font-size: 2rem; margin-top:0; margin-bottom: 10px; color:white;">${currentEvent.title}</h2>
                    
                    ${currentEvent.description ? `
                        <div style="background: rgba(0, 242, 254, 0.05); border-left: 3px solid #00f2fe; padding: 15px; text-align: left; margin-bottom: 25px; font-size: 0.95rem; color: rgba(255,255,255,0.9); line-height: 1.5;">
                            <strong>Programme :</strong><br>
                            ${currentEvent.description.replace(/\n/g, '<br>')}
                        </div>
                    ` : ''}

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left; margin-bottom: 30px;">
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 12px;">
                            <h4 style="color:#00f2fe; margin:0 0 10px 0; font-size: 1rem;"><i class="fas fa-scroll"></i> Règles</h4>
                            <ul style="margin:0; padding-left: 20px; font-size: 0.85rem; color: rgba(255,255,255,0.7); line-height: 1.6;">
                                <li><strong>5 propositions</strong> (A à E) par question.</li>
                                <li>Plusieurs réponses correctes possibles.</li>
                                <li><strong>0 erreur</strong> = 1 point</li>
                                <li><strong>1 erreur</strong> = 0.5 point</li>
                                <li><strong>2 erreurs</strong> = 0.2 point</li>
                                <li><strong>3 erreurs ou +</strong> = 0 point</li>
                            </ul>
                        </div>
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 12px;">
                            <h4 style="color:#ffa502; margin:0 0 10px 0; font-size: 1rem;"><i class="fas fa-gift"></i> Récompenses</h4>
                            <div style="font-size: 0.85rem; color: rgba(255,255,255,0.7); display:flex; flex-direction:column; gap:6px;">
                                <div><strong style="color:#ffcc00; display:inline-block; width:50px;">1er :</strong> +${rewards[0]} XP</div>
                                <div><strong style="color:#e0e0e0; display:inline-block; width:50px;">2ème :</strong> +${rewards[1]} XP</div>
                                <div><strong style="color:#cd7f32; display:inline-block; width:50px;">3ème :</strong> +${rewards[2]} XP</div>
                                <div><strong style="color:white; display:inline-block; width:50px;">4ème :</strong> +${rewards[3]} XP</div>
                                <div><strong style="color:white; display:inline-block; width:50px;">5ème :</strong> +${rewards[4]} XP</div>
                            </div>
                        </div>
                    </div>

                    ${hasStarted
                    ? `<p style="font-size: 1.2rem; margin-top: 15px; font-weight: bold; color: #2ecc71; animation: pulse-live 1.5s infinite;">L'hôte lancera la partie d'une seconde à l'autre...</p>`
                    : `<div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                               <p style="color:var(--text-muted); margin:0 0 5px 0; font-size:0.9rem;">L'événement démarre dans :</p>
                               <div id="arena-wait-timer" style="font-family: monospace; font-size: 2rem; font-weight: 800; color: white;">--:--:--</div>
                           </div>`
                }
                </div>`;

            if (!hasStarted) startWaitingTimer(currentEvent.scheduled_at);
            break;

        case 'starting':
            stopTimer();
            root.innerHTML = `
                <div style="padding: 40px 0;">
                    <h2 style="font-size:2.5rem; color: #ffa502; animation: pulse-live 1s infinite;">PRÊTS ?</h2>
                    <p style="color: rgba(255,255,255,0.6); font-size: 1.1rem;">La première question arrive...</p>
                </div>`;
            break;

        case 'question_active':
            if (!currentQuestion || currentQuestion.id !== currentEvent.current_question_id) {
                await fetchCurrentQuestion();
            }
            renderQuestion();
            startTimer(currentQuestion ? currentQuestion.time_limit || 45 : 45);
            break;

        case 'showing_answer':
            stopTimer();
            if (!currentQuestion || currentQuestion.id !== currentEvent.current_question_id) {
                await fetchCurrentQuestion();
            }
            renderCorrection();
            break;

        case 'podium':
        case 'finished':
            stopTimer();
            await renderPodium();
            break;
    }
}

async function fetchCurrentQuestion() {
    if (!currentEvent || !currentEvent.current_question_id) return;
    const { data } = await supabase
        .from('arena_questions')
        .select('*')
        .eq('id', currentEvent.current_question_id)
        .single();
    if (data) currentQuestion = data;
}

function renderQuestion() {
    if (!currentQuestion) return;
    const root = document.getElementById('arena-play-root');
    const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : JSON.parse(currentQuestion.options);
    const timeLimit = currentQuestion.time_limit || 45;

    root.innerHTML = `
        <h2 style="font-size:1.3rem; line-height:1.5; margin-bottom:5px;">${currentQuestion.question}</h2>
        ${currentQuestion.image_url ? `<div style="text-align:center; margin-bottom:15px;"><img src="${currentQuestion.image_url}" style="max-height: 200px; max-width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"></div>` : ''}
        ${currentQuestion.sub_question ? `<div style="background: rgba(0,242,254,0.1); border-left: 3px solid #00f2fe; padding: 10px; margin-bottom: 15px; border-radius: 4px;"><h3 style="font-size:1.1rem; color: #00f2fe; margin:0;">${currentQuestion.sub_question}</h3></div>` : ''}
        <p style="color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-bottom: 5px;">Sélectionnez toutes les bonnes réponses, puis validez.</p>

        <div class="timer-bar-container">
            <div class="timer-bar" id="timer-bar" style="width:100%;"></div>
            <div id="timer-text" style="text-align:center; font-family:monospace; font-weight:bold; color:white; margin-top:5px;"></div>
        </div>

        <div class="option-grid" id="options-grid">
            ${options.map((opt, idx) => `
                <div class="option-item" id="opt-${idx}" onclick="toggleOption(${idx})">
                    <div class="option-label" id="lbl-${idx}">${LABELS[idx]}</div>
                    <span class="option-text">${opt}</span>
                </div>
            `).join('')}
        </div>

        <button class="arena-submit-btn" id="submit-btn" onclick="submitAnswer()">
            Valider ma réponse <i class="fas fa-paper-plane"></i>
        </button>

        ${hasAnsweredCurrent ? '<p style="color:#2ecc71; margin-top:10px; font-weight:bold;"><i class="fas fa-check"></i> Réponse envoyée !</p>' : ''}
    `;

    // Re-apply selections if any (e.g. page re-render)
    selectedIndices.forEach(i => {
        const el = document.getElementById(`opt-${i}`);
        if (el) el.classList.add('selected');
    });

    if (hasAnsweredCurrent) {
        lockOptions();
        document.getElementById('submit-btn').disabled = true;
    }

    startTimer(timeLimit, 'question');
}

function toggleOption(idx) {
    if (hasAnsweredCurrent) return;

    const el = document.getElementById(`opt-${idx}`);
    if (!el) return;

    if (selectedIndices.has(idx)) {
        selectedIndices.delete(idx);
        el.classList.remove('selected');
    } else {
        selectedIndices.add(idx);
        el.classList.add('selected');
    }
}

function lockOptions() {
    document.querySelectorAll('.option-item').forEach(el => {
        el.style.cursor = 'default';
        el.onclick = null;
    });
}

async function submitAnswer(isAuto = false) {
    if (hasAnsweredCurrent || !myPlayerId || !currentQuestion) return;

    hasAnsweredCurrent = true;
    stopTimer();
    lockOptions();
    const btn = document.getElementById('submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = isAuto ? 'Temps écoulé !' : '<i class="fas fa-circle-notch fa-spin"></i> Envoi...'; }

    const correctSet = new Set(
        Array.isArray(currentQuestion.correct_indices)
            ? currentQuestion.correct_indices
            : JSON.parse(currentQuestion.correct_indices || '[]')
    );
    const points = computeScore(selectedIndices, correctSet);
    const selectedArr = [...selectedIndices];

    // Score is kept track of entirely internally (as "points" 1, 0.5, 0.2)
    // No direct XP gain per question anymore.
    const xpGained = 0; // Remove per-question XP

    const { error } = await supabase
        .from('arena_answers')
        .insert([{
            player_id: myPlayerId,
            question_id: currentQuestion.id,
            answer_indices: selectedArr,
            score_awarded: points
        }]);

    if (error && error.code !== '23505') { // ignore duplicates
        console.error("Erreur envoi réponse:", error);
    }

    // Accumulate total "points" within the event (not XP)
    const { data: pData } = await supabase.from('arena_players').select('score').eq('id', myPlayerId).single();
    if (pData) {
        // Here score is actually the number of QCM points (1, 1.5, 2.2, etc.)
        await supabase.from('arena_players').update({ score: (pData.score || 0) + points }).eq('id', myPlayerId);
    }

    // Show immediate inline feedback
    showInlineFeedback(points, correctSet);
}

function showInlineFeedback(points, correctSet) {
    const root = document.getElementById('arena-play-root');
    if (!root) return;

    // Color options
    document.querySelectorAll('.option-item').forEach((el, idx) => {
        if (correctSet.has(idx) && selectedIndices.has(idx)) el.classList.add('correct');   // selected & correct
        else if (!correctSet.has(idx) && selectedIndices.has(idx)) el.classList.add('wrong'); // selected & wrong
        else if (correctSet.has(idx) && !selectedIndices.has(idx)) el.classList.add('missed'); // missed
    });

    // Score chip
    const scoreClass = points === 1 ? 'score-1' : points === 0.5 ? 'score-0-5' : points === 0.2 ? 'score-0-2' : 'score-0';
    const scoreMsg = points === 1 ? '🏆 Parfait !' : points === 0.5 ? '👍 Presque !' : points === 0.2 ? '👀 Partiel' : '❌ Raté';

    const chip = document.createElement('div');
    chip.className = `score-chip ${scoreClass}`;
    chip.innerHTML = `${scoreMsg} &nbsp; +${points} pt${points > 0.5 ? 's' : ''}`;

    const submit = document.getElementById('submit-btn');
    if (submit && submit.parentNode) {
        submit.parentNode.insertBefore(chip, submit.nextSibling);
        submit.remove();
    }

    const waiting = document.createElement('p');
    waiting.style.cssText = 'color: rgba(255,255,255,0.5); margin-top:12px; font-size:0.9rem;';
    waiting.innerText = "En attente de la correction de l'admin...";
    root.appendChild(waiting);
}

function renderCorrection() {
    if (!currentQuestion) return;
    const root = document.getElementById('arena-play-root');
    const options = Array.isArray(currentQuestion.options) ? currentQuestion.options : JSON.parse(currentQuestion.options);
    const correctSet = new Set(
        Array.isArray(currentQuestion.correct_indices)
            ? currentQuestion.correct_indices
            : JSON.parse(currentQuestion.correct_indices || '[]')
    );

    const correctList = [...correctSet].map(i => `<strong>${LABELS[i]}.</strong> ${options[i]}`).join('  |  ');

    root.innerHTML = `
        <h2 style="font-size:1.4rem; margin-bottom: 15px;">${currentQuestion.question}</h2>
        ${currentQuestion.image_url ? `<div style="text-align:center; margin-bottom:15px;"><img src="${currentQuestion.image_url}" style="max-height: 200px; max-width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); opacity: 0.5;"></div>` : ''}
        ${currentQuestion.sub_question ? `<div style="background: rgba(0,242,254,0.05); border-left: 3px solid rgba(0,242,254,0.5); padding: 10px; margin-bottom: 15px; border-radius: 4px;"><h3 style="font-size:1.1rem; color: #00f2fe; margin:0;">${currentQuestion.sub_question}</h3></div>` : ''}

        <div class="option-grid">
            ${options.map((opt, idx) => {
        const cls = correctSet.has(idx) ? 'correct' : '';
        return `
                <div class="option-item ${cls}" style="cursor:default;">
                    <div class="option-label">${LABELS[idx]}</div>
                    <span class="option-text">${opt}</span>
                    ${correctSet.has(idx) ? '<i class="fas fa-check" style="color:#2ecc71; margin-left:auto;"></i>' : ''}
                </div>`;
    }).join('')}
        </div>

        ${currentQuestion.explanation ? `
            <div class="correction-panel">
                <strong><i class="fas fa-lightbulb"></i> Correction :</strong><br>
                ${currentQuestion.explanation}
            </div>
        ` : ''}

        <p style="color: rgba(255,255,255,0.45); margin-top: 20px; font-size: 0.9rem;">En attente de la prochaine question...</p>
        
        <div class="timer-bar-container" style="margin-top: 20px;">
            <div class="timer-bar" id="timer-bar" style="width:100%; background: var(--admin-primary) !important;"></div>
            <div id="timer-text" style="text-align:center; font-family:monospace; font-weight:bold; color:var(--admin-primary); margin-top:5px;"></div>
        </div>
    `;

    const corrTimeLimit = currentQuestion.correction_time_limit || 20;
    startTimer(corrTimeLimit, 'correction');
}

async function renderPodium() {
    if (!currentEvent) return;
    const root = document.getElementById('arena-play-root');

    const { data: players } = await supabase
        .from('arena_players')
        .select('score, user_id, profiles(username)')
        .eq('event_id', currentEvent.id)
        .order('score', { ascending: false }); // Fetch all to determine rank properly

    if (!players) return;

    const myData = players.find(p => p.user_id === myUserId);
    const myRank = players.findIndex(p => p.user_id === myUserId) + 1;
    let earnedXp = 0;

    const rewards = Array.isArray(currentEvent.xp_rewards) ? currentEvent.xp_rewards : JSON.parse(currentEvent.xp_rewards || '[1000,500,250,100,50]');

    if (myRank > 0 && myRank <= 5) {
        earnedXp = rewards[myRank - 1] || 0;
        if (earnedXp > 0 && myData) {
            // Update my own profile XP
            const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', myUserId).single();
            if (prof) {
                await supabase.from('profiles').update({ total_xp: (prof.total_xp || 0) + earnedXp }).eq('id', myUserId);
            }
        }
    }

    const medals = ['🥇', '🥈', '🥉'];
    const top10 = players.slice(0, 10);

    root.innerHTML = `
        <div style="padding: 20px 0;">
            <h2 style="font-size:2rem; margin-bottom:5px;">🏆 Résultats finaux</h2>
            <p style="color:rgba(255,255,255,0.5); margin-bottom: 25px;">L'événement est terminé !</p>

            ${myData ? `
                <div style="margin-bottom: 20px; padding: 15px 20px; background: rgba(0,242,254,0.12); border: 1px solid rgba(0,242,254,0.4); border-radius: 12px; font-size: 1rem; text-align: left;">
                    <strong style="color: white; font-size:1.1rem;">Bilan de ta partie :</strong><br>
                    <div style="margin-top: 5px;">Ta position : <strong style="color:#00f2fe; font-size:1.2rem;">#${myRank}</strong></div>
                    <div>Score final : <strong style="color:#2ecc71;">${myData.score} pts</strong></div>
                    ${earnedXp > 0 ? `<div style="margin-top: 8px; color:#ffcc00; font-weight:bold; font-size: 1.1rem;"><i class="fas fa-arrow-up"></i> Tu remportes ${earnedXp} XP !</div>` : '<div style="margin-top: 8px; color:rgba(255,255,255,0.4); font-size: 0.9rem;">Pas d\'XP remportée cette fois. Entraîne-toi pour le prochain !</div>'}
                </div>
            ` : ''}

            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto;">
                ${top10.map((p, i) => {
        const name = p.profiles?.username || 'Anonyme';
        const isMe = p.user_id === myUserId;
        const prize = i < 5 ? ` <span style="font-size:0.8rem; color:#ffcc00; margin-left:8px;">(+${rewards[i] || 0} XP)</span>` : '';
        return `
                    <div style="display:flex; align-items:center; gap:12px; padding:12px 15px; border-radius:10px;
                        background: ${isMe ? 'rgba(0,242,254,0.10)' : 'rgba(255,255,255,0.04)'};
                        border: 1px solid ${isMe ? 'rgba(0,242,254,0.35)' : 'rgba(255,255,255,0.07)'};">
                        <span style="font-size:1.3rem;">${medals[i] || `#${i + 1}`}</span>
                        <span style="flex:1; font-weight:${isMe ? 'bold' : '400'}; color:${isMe ? '#00f2fe' : 'white'};">${name} ${isMe ? '<em style="opacity:.5;font-size:.8em;">(toi)</em>' : ''}</span>
                        <span style="font-weight:bold; color:#2ecc71;">${p.score} pts${prize}</span>
                    </div>`;
    }).join('')}
            </div>

            <button onclick="window.location.href='index.html'" style="margin-top: 25px; background: linear-gradient(135deg, #00f2fe, #4facfe); color: #050714; padding: 13px 30px; border-radius: 30px; border: none; font-weight: bold; cursor: pointer; font-size: 1rem;">
                Retour à l'accueil
            </button>
        </div>
    `;
}

function startTimer(seconds, mode = 'question') {
    stopTimer();
    const bar = document.getElementById('timer-bar');
    const textEl = document.getElementById('timer-text');
    if (!bar) return;
    bar.style.width = '100%';
    bar.classList.remove('urgent');

    let remaining = seconds;
    if (textEl) textEl.innerText = `${remaining}s`;

    timerInterval = setInterval(() => {
        remaining--;
        const pct = Math.max(0, (remaining / seconds) * 100);
        if (bar) bar.style.width = `${pct}%`;

        if (textEl) {
            textEl.innerText = `${Math.max(0, remaining)}s`;
        }

        if (mode === 'question' && remaining <= Math.max(5, seconds * 0.25)) {
            bar.classList.add('urgent');
        }

        if (remaining <= 0) {
            stopTimer();
            if (mode === 'question' && !hasAnsweredCurrent) {
                // Auto-submit on timeout if not answered
                submitAnswer(true);
            }
        }
    }, 1000);
}

function startWaitingTimer(targetDateStr) {
    stopTimer();
    const target = new Date(targetDateStr).getTime();
    const el = document.getElementById('arena-wait-timer');
    if (!el) return;

    const updateTimerDisplay = () => {
        const now = new Date().getTime();
        const diff = target - now;

        const currentEl = document.getElementById('arena-wait-timer');
        if (diff <= 0 || !currentEl) {
            stopTimer();
            // Fallback render to "pulse" ready state if timer runs out while waiting
            if (currentEvent && currentEvent.status === 'waiting') {
                processEventState();
            }
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        let timeStr = "";
        if (days > 0) timeStr += `${days}j `;
        timeStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        currentEl.innerText = timeStr;
    };

    // Call immediately so we don't wait 1 second for the first display
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}
