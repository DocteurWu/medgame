/**
 * js/patient-live.js — Consultation « en direct » : l'orchestrateur.
 *
 * Il relie trois choses qui existaient séparément :
 *   - le dialogue (js/patientChat.js en 2D, js/three-hud-agent.js en 3D) ;
 *   - la voix (js/patient-voice.js : micro + voix du patient) ;
 *   - l'alliance thérapeutique (js/patient-live-core.js), rendue VISIBLE et
 *     JOUABLE : jauge, retour à chaque réplique, paliers, ultimatum, départ.
 *
 * Contrat par événements (document) — aucun module n'appelle l'autre :
 *   medgame:case-set          { caseData }            nouveau cas
 *   medgame:student-said      { text }                l'étudiant parle (2D ou 3D)
 *   medgame:patient-sentence  { text, emotion, turnId } phrase prête (flux du Maître du Jeu)
 *   medgame:patient-reply     { text, emotion, alliance, turnId, source } fin de réponse
 *   medgame:voice-*                                   états du micro et de la voix
 *
 * Le « mode direct » (bouton En direct) active : la voix du patient, le micro
 * mains libres qui se rouvre après chaque réplique, les relances quand
 * l'étudiant se tait, et la pénalité quand il coupe la parole. Hors mode
 * direct, la jauge reste active et le micro sert de dictée (le patient répond
 * alors à voix haute, puisqu'on lui a parlé).
 */
(function () {
    'use strict';

    const SILENCE_MS = 14000;
    const SILENCE_ANXIOUS_MS = 10000;
    const MAX_RELANCES = 3;
    const ULTIMATUM_S = 25;
    const INTERRUPT_GRACE_MS = 1600;
    const TAP_MS = 260;

    const C = () => window.PatientLiveCore;
    const V = () => window.PatientVoice;

    const live = {
        alliance: null,
        caseId: null,
        patient: { age: 45, sex: 'M', pain: 0, name: 'Le patient' },
        pendingStudent: null,
        nextViaVoice: false,
        lastViaVoice: false,
        emotion: 'neutre',
        spokenTurns: new Set(),
        silenceTimer: null,
        silenceCount: 0,
        ultimatum: null,       // { deadline, raf }
        locked: false,
        holdStart: 0,
        holdMode: null,        // 'hold' | 'tap'
        toastTimer: null,
        gazeAway: 0
    };

    // ==================== CAS ====================

    function painFrom(caseData) {
        const m = JSON.stringify(caseData?.interrogatoire || {}).match(/EVA\s*[:=]?\s*(\d+)/i);
        return m ? Math.min(10, parseInt(m[1], 10)) : 0;
    }

    function resetForCase(caseData) {
        if (!C()) return;
        const p = caseData?.patient || {};
        const persona = p.persona || {};
        live.caseId = caseData?.id || null;
        live.patient = {
            age: parseInt(p.age, 10) || 45,
            sex: p.sexe || 'M',
            pain: painFrom(caseData),
            name: `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Le patient'
        };
        live.alliance = C().createAlliance({
            trust: typeof persona.confiance === 'number' ? persona.confiance : 55,
            anxiety: typeof persona.anxiete === 'number' ? persona.anxiete : 45
        });
        live.pendingStudent = null;
        live.spokenTurns.clear();
        live.silenceCount = 0;
        live.locked = false;
        live.emotion = 'neutre';
        clearSilence();
        stopUltimatum();
        V()?.stopSpeaking?.();
        V()?.cancelListening?.();
        setInputsLocked(false);
        render(null);
    }

    function ensureCase() {
        const c = window.gameState?.currentCase || window.patientChat?.caseData;
        if (c && (c.id || null) !== live.caseId) resetForCase(c);
        if (!live.alliance && C()) resetForCase(c || {});
        return live.alliance;
    }

    // ==================== PAROLE DU PATIENT ====================

    function currentProsody(emotion) {
        const s = live.alliance?.state || {};
        return C().prosody({
            anxiety: s.anxiety,
            trust: s.trust,
            pain: window.PAIN_LEVEL ?? live.patient.pain,
            age: live.patient.age,
            sex: live.patient.sex,
            emotion: emotion || live.emotion
        });
    }

    function voiceWanted() {
        const v = V();
        if (!v || !v.canSpeak()) return false;
        return v.settings.voiceOut && (v.settings.live || live.lastViaVoice);
    }

    function setEmotion(emotion) {
        if (!C()) return;
        live.emotion = C().normalizeEmotion(emotion);
        const hud = window.threeManager?.hud;
        try { hud?._applyFacialExpression?.(C().expressionFor(live.emotion), 0.5); } catch (e) { /* scène absente */ }
        document.querySelectorAll('.pl-gauge').forEach(g => { g.dataset.emotion = live.emotion; });
    }

    /** Réplique locale du patient (relance, ultimatum, départ) : chat + voix + mémoire LLM. */
    function patientSay(line, emotion) {
        const chat = window.patientChat;
        if (chat?.append) chat.append('Patient', line);
        chat?.messages?.push({ role: 'assistant', content: line });
        window.medicalGameManager?.history?.push({ role: 'assistant', content: `Le patient dit spontanément : « ${line} »` });
        setEmotion(emotion);
        if (voiceWanted()) V().speak(line, { prosody: currentProsody(emotion) });
    }

    // ==================== TOURS ====================

    function onStudentSaid(text) {
        if (!ensureCase()) return;
        const viaVoice = live.nextViaVoice;
        live.nextViaVoice = false;
        live.lastViaVoice = viaVoice;
        clearSilence();
        live.silenceCount = 0;
        // Parler par-dessus le patient (au clavier comme à la voix) le coupe.
        const v = V();
        if (v?.isSpeaking()) {
            const r = v.stopSpeaking();
            if (r.elapsedMs > INTERRUPT_GRACE_MS && v.settings.live) applyTurn({ kind: 'interrupt', trustDelta: -4 });
        }
        live.pendingStudent = { text, t: Date.now() };
        setThinking(true);
    }

    function applyTurn(turn) {
        const a = ensureCase();
        if (!a || live.locked) return null;
        const r = a.applyTurn(turn);
        render(r);
        if (r.ultimatumStarted) startUltimatum();
        if (r.recovered) {
            stopUltimatum();
            toast('Il reste. Il vous laisse une dernière chance.', 'pos', true);
        }
        if (r.walkedOut) walkOut();
        return r;
    }

    function onPatientSentence(d) {
        if (!d?.text || live.locked) return;
        setThinking(false);
        if (d.emotion) setEmotion(d.emotion);
        if (voiceWanted()) {
            if (d.turnId) live.spokenTurns.add(d.turnId);
            V().speak(d.text, { prosody: currentProsody(d.emotion), turnId: d.turnId });
        }
    }

    function onPatientReply(d) {
        if (!ensureCase()) return;
        setThinking(false);
        const student = live.pendingStudent;
        // Alliance : le Maître du Jeu (2D, 3D, ECOS) donne des deltas motivés ;
        // à défaut, l'analyse locale de la réplique de l'étudiant tranche.
        if (student) {
            const al = d.alliance || {};
            applyTurn({
                kind: 'reply',
                text: student.text,
                trustDelta: typeof al.trustDelta === 'number' ? al.trustDelta : undefined,
                anxietyDelta: typeof al.anxietyDelta === 'number' ? al.anxietyDelta : undefined,
                reason: al.reason,
                communication: al.communication
            });
            live.pendingStudent = null;
        }
        let emotion = d.emotion;
        if (!emotion && d.text) {
            try { emotion = window.threeManager?.hud?._analyzeSentiment?.(d.text)?.category; } catch (e) { /* rien */ }
        }
        if (emotion) setEmotion(emotion);
        if (d.text && !live.locked && voiceWanted() && !(d.turnId && live.spokenTurns.has(d.turnId))) {
            V().speak(d.text, { prosody: currentProsody(emotion), turnId: d.turnId });
        }
        if (!V()?.isSpeaking()) afterPatientTurn();
    }

    // ==================== TEMPS RÉEL : SILENCES & MICRO ====================

    function conversationOpen() {
        if (document.hidden) return false;
        const d3 = document.getElementById('dialog-input-3d');
        if (d3 && d3.offsetParent) return true;
        const panel = document.getElementById('dialogue-panel');
        return !!(panel && panel.offsetParent);
    }

    function clearSilence() {
        if (live.silenceTimer) clearTimeout(live.silenceTimer);
        live.silenceTimer = null;
    }

    function armSilence() {
        clearSilence();
        const v = V();
        if (!v?.settings.live || live.locked || live.ultimatum || !live.alliance) return;
        if (live.silenceCount >= MAX_RELANCES) return;
        const anxious = live.alliance.state.anxiety >= 65;
        live.silenceTimer = setTimeout(onSilence, anxious ? SILENCE_ANXIOUS_MS : SILENCE_MS);
    }

    function busy() {
        const input = activeInput();
        return !!(window.patientChat?.isAsking || V()?.isSpeaking() || live.pendingStudent ||
            (input && input.value.trim() && !V()?.isListening()) ||
            (V()?.isListening() && V()?.listeningMode() === 'hold'));
    }

    function onSilence() {
        live.silenceTimer = null;
        if (!conversationOpen() || live.locked) return;
        if (busy()) { armSilence(); return; }
        const s = live.alliance.state;
        const line = C().relanceLine({ anxiety: s.anxiety, trust: s.trust, count: live.silenceCount });
        live.silenceCount++;
        if (live.silenceCount >= 2) applyTurn({ kind: 'silence', trustDelta: -3, anxietyDelta: 4 });
        if (live.locked) return;
        V()?.cancelListening();
        patientSay(line, s.anxiety >= 65 ? 'peur' : 'neutre');
        if (!V()?.isSpeaking()) afterPatientTurn();
    }

    /** Le patient a fini de parler : relance armée, micro rouvert en mains libres. */
    function afterPatientTurn() {
        armSilence();
        const v = V();
        if (v?.settings.live && v.settings.handsFree && v.canListen() && !live.locked && conversationOpen() && !v.isListening()) {
            setTimeout(() => {
                if (!V().isSpeaking() && !V().isListening() && !live.locked && !window.patientChat?.isAsking) startListening('handsfree');
            }, 280);
        }
    }

    function activeInput() {
        const d3 = document.getElementById('dialog-input-3d');
        if (d3 && d3.offsetParent) return d3;
        return document.getElementById('dialogue-input');
    }

    function submitActive(text) {
        const input = activeInput();
        if (!input || !text) return;
        input.value = text;
        live.nextViaVoice = true;
        if (input.id === 'dialog-input-3d') {
            document.getElementById('dialog-send-btn')?.click();
        } else {
            const form = document.getElementById('dialogue-form');
            if (form?.requestSubmit) form.requestSubmit();
            else form?.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    }

    function startListening(mode) {
        const v = V();
        if (!v?.canListen() || live.locked) return false;
        // Barge-in : prendre la parole coupe le patient.
        if (v.isSpeaking()) {
            const r = v.stopSpeaking();
            if (r.elapsedMs > INTERRUPT_GRACE_MS && v.settings.live) applyTurn({ kind: 'interrupt', trustDelta: -4 });
        }
        const input = activeInput();
        const before = input ? input.value : '';
        return v.listen(mode, {
            onInterim: (t) => { if (input) input.value = t; },
            onFinal: (t, reason) => {
                if (reason === 'cancel') return;
                if (t) submitActive(t);
                else if (input) input.value = before;
            },
            onError: (code) => {
                if (code === 'not-allowed' || code === 'service-not-allowed') {
                    toast('Micro refusé par le navigateur. Autorisez-le dans la barre d\'adresse.', 'neg', true);
                } else if (code === 'network') {
                    toast('Reconnaissance vocale indisponible (réseau).', 'neg', true);
                }
            }
        });
    }

    // ==================== ULTIMATUM & DÉPART ====================

    function startUltimatum() {
        stopUltimatum();
        clearSilence();
        V()?.cancelListening();
        patientSay(C().ultimatumLine(live.alliance.state.turns), 'colere');
        live.ultimatum = { remaining: ULTIMATUM_S * 1000, last: performance.now(), raf: 0 };
        document.querySelectorAll('.pl-ultimatum').forEach(el => { el.hidden = false; });
        const tick = () => {
            if (!live.ultimatum) return;
            const now = performance.now();
            const dt = now - live.ultimatum.last;
            live.ultimatum.last = now;
            // Le compte à rebours s'arrête pendant que le patient répond ou parle.
            if (!window.patientChat?.isAsking && !V()?.isSpeaking() && !live.pendingStudent) live.ultimatum.remaining -= dt;
            const frac = Math.max(0, live.ultimatum.remaining / (ULTIMATUM_S * 1000));
            document.querySelectorAll('.pl-ultimatum-fill').forEach(f => { f.style.transform = `scaleX(${frac})`; });
            document.querySelectorAll('.pl-ultimatum-time').forEach(f => { f.textContent = `${Math.ceil(live.ultimatum.remaining / 1000)} s`; });
            if (live.ultimatum.remaining <= 0) {
                stopUltimatum();
                if (live.alliance.expireUltimatum()) walkOut();
                return;
            }
            live.ultimatum.raf = requestAnimationFrame(tick);
        };
        live.ultimatum.raf = requestAnimationFrame(tick);
        if (!V()?.isSpeaking()) afterPatientTurn();
    }

    function stopUltimatum() {
        if (live.ultimatum?.raf) cancelAnimationFrame(live.ultimatum.raf);
        live.ultimatum = null;
        document.querySelectorAll('.pl-ultimatum').forEach(el => { el.hidden = true; });
    }

    function walkOut() {
        if (live.locked) return;
        stopUltimatum();
        clearSilence();
        V()?.cancelListening();
        patientSay(C().walkoutLine(live.alliance.state.turns), 'colere');
        live.locked = true;
        setInputsLocked(true);
        render(null);
        window.MedGameAudio?.play?.('error');
        setTimeout(() => openDebrief(true), 900);
    }

    function setInputsLocked(locked) {
        for (const id of ['dialogue-input', 'dialog-input-3d']) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (locked) {
                el.dataset.plPlaceholder = el.dataset.plPlaceholder || el.placeholder;
                el.placeholder = 'Le patient a quitté le box. Poursuivez le dossier (diagnostic, traitement).';
                el.disabled = true;
            } else if (el.dataset.plPlaceholder) {
                el.placeholder = el.dataset.plPlaceholder;
                delete el.dataset.plPlaceholder;
                el.disabled = false;
            }
        }
        document.querySelectorAll('.pl-mic').forEach(b => { b.disabled = locked; });
    }

    // ==================== INTERFACE ====================

    const STAGE_COLORS = { confiant: 'ok', reserve: 'scrub', ferme: 'warn', rupture: 'alert' };

    function gaugeMarkup(compact) {
        return `
            <button type="button" class="pl-gauge${compact ? ' pl-gauge--compact' : ''}" title="Alliance thérapeutique — cliquez pour la courbe" aria-label="Alliance thérapeutique">
                <span class="pl-gauge-label">Alliance</span>
                <span class="pl-gauge-track" aria-hidden="true"><span class="pl-gauge-fill"></span><span class="pl-gauge-tick" style="left:20%"></span><span class="pl-gauge-tick" style="left:40%"></span><span class="pl-gauge-tick" style="left:70%"></span></span>
                <span class="pl-gauge-value">--</span>
                <span class="pl-gauge-stage"></span>
                <span class="pl-anx" aria-hidden="true" title="Anxiété du patient"><i class="fas fa-heart"></i></span>
            </button>
            <span class="pl-delta" aria-live="polite"></span>`;
    }

    function liveToggleMarkup() {
        const on = !!V()?.settings.live;
        return `<button type="button" class="pl-live${on ? ' is-on' : ''}" aria-pressed="${on}" title="Mode direct : le patient parle, vous répondez au micro, il relance si vous vous taisez">
            <span class="pl-live-dot" aria-hidden="true"></span><span>En direct</span></button>`;
    }

    function micMarkup() {
        return `<button type="button" class="pl-mic" title="Parler au patient — maintenir pour parler, toucher pour dicter une réplique (raccourci : maintenir V)" aria-label="Parler au patient">
            <i class="fas fa-microphone" aria-hidden="true"></i><span class="pl-mic-ring" aria-hidden="true"></span></button>`;
    }

    function ultimatumMarkup() {
        return `<div class="pl-ultimatum" role="alert" hidden>
            <i class="fas fa-door-open" aria-hidden="true"></i>
            <span><strong>Le patient veut partir.</strong> Une réplique pour le retenir : excusez-vous, reformulez ses craintes.</span>
            <span class="pl-ultimatum-time">${ULTIMATUM_S} s</span>
            <span class="pl-ultimatum-bar" aria-hidden="true"><span class="pl-ultimatum-fill"></span></span>
        </div>`;
    }

    function bindGauge(root) {
        root.querySelector('.pl-gauge')?.addEventListener('click', () => openDebrief(false));
        root.querySelector('.pl-live')?.addEventListener('click', toggleLive);
    }

    function bindMic(btn) {
        const down = (e) => {
            if (btn.disabled) return;
            e.preventDefault();
            const v = V();
            if (v.isListening()) {
                // Deuxième appui sur une dictée ou en mains libres : on envoie.
                v.release();
                live.holdMode = null;
                return;
            }
            live.holdStart = performance.now();
            live.holdMode = 'hold';
            startListening('hold');
        };
        const up = () => {
            if (live.holdMode !== 'hold') return;
            const held = performance.now() - live.holdStart;
            live.holdMode = null;
            if (held < TAP_MS) {
                // Simple toucher : dictée d'une réplique, fin au silence.
                V().cancelListening();
                startListening('handsfree');
            } else {
                V().release();
            }
        };
        btn.addEventListener('pointerdown', down);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointerleave', () => { if (live.holdMode === 'hold' && performance.now() - live.holdStart >= TAP_MS) up(); });
        btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); });
        btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') up(); });
    }

    function inject2D() {
        const head = document.querySelector('#dialogue-panel .communicator-header');
        if (head && !head.querySelector('.pl-bar')) {
            const bar = document.createElement('div');
            bar.className = 'pl-bar';
            bar.innerHTML = gaugeMarkup(false) + liveToggleMarkup();
            head.appendChild(bar);
            bindGauge(bar);
            head.insertAdjacentHTML('afterend', ultimatumMarkup());
        }
        const form = document.getElementById('dialogue-form');
        if (form && !form.querySelector('.pl-mic') && V()?.canListen()) {
            const submit = form.querySelector('button[type="submit"]');
            submit?.insertAdjacentHTML('beforebegin', micMarkup());
            bindMic(form.querySelector('.pl-mic'));
        }
    }

    function inject3D() {
        const input = document.getElementById('dialog-input-3d');
        if (!input) return;
        const area = input.closest('.dialog-input-area');
        if (area && !area.querySelector('.pl-mic') && V()?.canListen()) {
            document.getElementById('dialog-send-btn')?.insertAdjacentHTML('beforebegin', micMarkup());
            bindMic(area.querySelector('.pl-mic'));
        }
        const header = document.querySelector('#three-hud .dialog-header, .dialog-header');
        if (header && !header.querySelector('.pl-bar')) {
            const bar = document.createElement('div');
            bar.className = 'pl-bar pl-bar--3d';
            bar.innerHTML = gaugeMarkup(true) + liveToggleMarkup();
            header.querySelector('.dialog-close')?.insertAdjacentElement('beforebegin', bar) || header.appendChild(bar);
            bindGauge(bar);
            const main = document.querySelector('.dialog-chat-main');
            main?.insertAdjacentHTML('afterbegin', ultimatumMarkup());
        }
        if (live.locked) setInputsLocked(true);
        render(null);
    }

    function render(r) {
        const a = live.alliance;
        if (!a) return;
        const snap = a.snapshot();
        const color = STAGE_COLORS[snap.stage.id];
        document.querySelectorAll('.pl-gauge').forEach(g => {
            g.dataset.stage = snap.stage.id;
            g.dataset.tone = color;
            g.classList.toggle('is-gone', snap.walkedOut);
            g.querySelector('.pl-gauge-fill').style.width = `${snap.trust}%`;
            g.querySelector('.pl-gauge-value').textContent = String(Math.round(snap.trust));
            g.querySelector('.pl-gauge-stage').textContent = snap.walkedOut ? 'Parti' : snap.stage.label;
            g.title = `Alliance ${Math.round(snap.trust)}/100 — ${snap.stage.label} : ${snap.stage.hint} Anxiété ${Math.round(snap.anxiety)}/100. Cliquez pour la courbe.`;
            const beat = 1.4 - (snap.anxiety / 100) * 0.95;
            g.querySelector('.pl-anx').style.setProperty('--pl-beat', `${beat.toFixed(2)}s`);
            g.querySelector('.pl-anx').dataset.level = snap.anxiety >= 75 ? 'high' : snap.anxiety >= 50 ? 'mid' : 'low';
        });
        if (!r) return;
        if (r.delta || r.label) {
            const sign = r.delta > 0 ? '+' : '';
            toast(`${r.delta ? `${sign}${r.delta} ` : ''}${r.label}`, r.tone);
        }
        if (r.stageChanged && !r.walkedOut) {
            setTimeout(() => toast(`${r.stage.label} — ${r.stage.hint}`, r.delta >= 0 ? 'pos' : 'neg', true), 1300);
        }
        if (r.delta) {
            document.querySelectorAll('.pl-gauge').forEach(g => {
                g.classList.remove('pulse-pos', 'pulse-neg');
                void g.offsetWidth;
                g.classList.add(r.delta > 0 ? 'pulse-pos' : 'pulse-neg');
            });
        }
    }

    function toast(text, tone, strong) {
        document.querySelectorAll('.pl-delta').forEach(el => {
            el.textContent = text;
            el.dataset.tone = tone || 'neutral';
            el.classList.toggle('is-strong', !!strong);
            el.classList.remove('is-visible');
            void el.offsetWidth;
            el.classList.add('is-visible');
        });
        clearTimeout(live.toastTimer);
        live.toastTimer = setTimeout(() => {
            document.querySelectorAll('.pl-delta').forEach(el => el.classList.remove('is-visible'));
        }, strong ? 4200 : 2800);
    }

    function setThinking(on) {
        document.querySelectorAll('.pl-gauge').forEach(g => g.classList.toggle('is-thinking', !!on));
    }

    function syncVoiceUI() {
        const v = V();
        if (!v) return;
        const listening = v.isListening();
        document.querySelectorAll('.pl-mic').forEach(b => {
            b.classList.toggle('is-listening', listening);
            b.setAttribute('aria-pressed', String(listening));
        });
        document.querySelectorAll('.pl-live').forEach(b => {
            b.classList.toggle('is-on', !!v.settings.live);
            b.setAttribute('aria-pressed', String(!!v.settings.live));
        });
        document.querySelectorAll('.pl-gauge').forEach(g => g.classList.toggle('is-speaking', v.isSpeaking()));
    }

    function toggleLive() {
        const v = V();
        if (!v) return;
        const on = !v.settings.live;
        v.setSetting('live', on);
        syncVoiceUI();
        if (on) {
            window.MedGameSound?.init?.();
            const parts = [];
            parts.push(v.canSpeak() ? 'le patient vous parle' : 'voix indisponible sur ce navigateur');
            parts.push(v.canListen() ? 'répondez au micro' : 'micro non pris en charge (Chrome ou Edge requis)');
            toast(`En direct : ${parts.join(', ')}.`, 'pos', true);
            if (v.canListen() && v.settings.handsFree && !v.isSpeaking() && !live.locked) startListening('handsfree');
            armSilence();
        } else {
            v.cancelListening();
            v.stopSpeaking();
            clearSilence();
            toast('Mode direct coupé : la jauge reste active.', 'neutral');
        }
    }

    // ==================== DÉBRIEFING ====================

    function curveSVG(timeline) {
        const W = 560, H = 170, P = { l: 30, r: 10, t: 10, b: 22 };
        const pts = timeline.length > 1 ? timeline : [timeline[0], { ...timeline[0], t: (timeline[0]?.t || 0) + 1 }];
        const tMax = Math.max(1, pts[pts.length - 1].t);
        const x = t => P.l + (t / tMax) * (W - P.l - P.r);
        const y = v => P.t + (1 - v / 100) * (H - P.t - P.b);
        const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.trust).toFixed(1)}`).join(' ');
        const area = `${line} L${x(pts[pts.length - 1].t).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`;
        const band = (lo, hi, cls) => `<rect class="${cls}" x="${P.l}" y="${y(hi)}" width="${W - P.l - P.r}" height="${y(lo) - y(hi)}"/>`;
        const dots = timeline.filter(p => p.delta).map(p => `<circle class="pl-dot ${p.delta > 0 ? 'pos' : 'neg'}" cx="${x(p.t).toFixed(1)}" cy="${y(p.trust).toFixed(1)}" r="3.5"><title>${escapeText(`${p.t} s — ${p.delta > 0 ? '+' : ''}${p.delta} ${p.label}`)}</title></circle>`).join('');
        const mm = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        return `<svg class="pl-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de confiance au fil de la consultation">
            ${band(70, 100, 'pl-band ok')}${band(40, 70, 'pl-band scrub')}${band(20, 40, 'pl-band warn')}${band(0, 20, 'pl-band alert')}
            ${[0, 20, 40, 70, 100].map(v => `<text class="pl-axis" x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
            <text class="pl-axis" x="${P.l}" y="${H - 6}">0:00</text><text class="pl-axis" x="${W - P.r}" y="${H - 6}" text-anchor="end">${mm(tMax)}</text>
            <path class="pl-area" d="${area}"/><path class="pl-line" d="${line}"/>${dots}
        </svg>`;
    }

    function escapeText(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function advice(sum) {
        if (sum.walkedOut) return 'Le patient est parti : son départ coupe l\'interrogatoire et l\'examen. Présentez-vous, reformulez sa plainte et répondez à son inquiétude avant d\'enchaîner les questions fermées.';
        if (sum.jargonCount >= 2) return 'Traduisez le vocabulaire médical : chaque terme technique incompris fait baisser la confiance et cache des réponses.';
        if (sum.interruptions >= 2) return 'Laissez le patient finir ses phrases : l\'interrompre lui fait sentir qu\'il n\'est pas écouté.';
        if (sum.empathyCount === 0 && sum.turns >= 4) return 'Aucune marque d\'empathie repérée : une reformulation ou un « je comprends que ce soit inquiétant » change la dynamique.';
        if (sum.final >= 70) return 'Belle alliance : le patient se confie, c\'est le moment d\'aborder les sujets intimes.';
        return 'Visez le palier « Confiant » (70) : c\'est là que le patient livre les informations qu\'il cache.';
    }

    function openDebrief(fromWalkout) {
        const a = live.alliance;
        if (!a) return;
        document.getElementById('pl-debrief')?.remove();
        const sum = a.summary();
        const moment = (m, cls) => m ? `<li class="${cls}"><strong>${m.delta > 0 ? '+' : ''}${m.delta}</strong> à ${m.t} s — ${escapeText(m.label)}</li>` : '';
        const wrap = document.createElement('div');
        wrap.id = 'pl-debrief';
        wrap.className = 'pl-debrief-backdrop';
        wrap.innerHTML = `
            <div class="pl-debrief" role="dialog" aria-modal="true" aria-labelledby="pl-debrief-title">
                <header>
                    <h2 id="pl-debrief-title">${fromWalkout ? 'Sortie contre avis médical' : 'Alliance thérapeutique'}</h2>
                    <button type="button" class="pl-debrief-close" aria-label="Fermer"><i class="fas fa-times" aria-hidden="true"></i></button>
                </header>
                ${fromWalkout ? `<p class="pl-debrief-lead">${escapeText(live.patient.name)} a quitté le box. Le dossier reste ouvert : vous pouvez encore poser un diagnostic et prescrire, mais sans lui parler.</p>` : ''}
                ${curveSVG(sum.timeline)}
                <dl class="pl-stats">
                    <div><dt>Confiance finale</dt><dd>${Math.round(sum.final)}</dd></div>
                    <div><dt>Plus haut</dt><dd>${Math.round(sum.peak)}</dd></div>
                    <div><dt>Répliques</dt><dd>${sum.turns}</dd></div>
                    <div><dt>Empathie</dt><dd>${sum.empathyCount}</dd></div>
                    <div><dt>Jargon</dt><dd>${sum.jargonCount}</dd></div>
                    <div><dt>Coupures</dt><dd>${sum.interruptions}</dd></div>
                    <div><dt>Silences</dt><dd>${sum.silences}</dd></div>
                </dl>
                <ul class="pl-moments">${moment(sum.best, 'pos')}${moment(sum.worst, 'neg')}</ul>
                <p class="pl-advice">${escapeText(advice(sum))}</p>
            </div>`;
        document.body.appendChild(wrap);
        const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
        wrap.querySelector('.pl-debrief-close').addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        wrap.querySelector('.pl-debrief-close').focus();
    }

    // ==================== RACCOURCI CLAVIER ====================

    function typingTarget(el) {
        return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    }
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'v' && e.key !== 'V') return;
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typingTarget(document.activeElement)) return;
        if (!V()?.canListen() || live.locked || !conversationOpen()) return;
        e.preventDefault();
        live.holdStart = performance.now();
        live.holdMode = 'hold';
        startListening('hold');
    });
    document.addEventListener('keyup', (e) => {
        if ((e.key === 'v' || e.key === 'V') && live.holdMode === 'hold') {
            live.holdMode = null;
            V()?.release();
        }
    });

    // ==================== BRANCHEMENTS ====================

    document.addEventListener('medgame:case-set', (e) => resetForCase(e.detail?.caseData));
    document.addEventListener('medgame:student-said', (e) => onStudentSaid(e.detail?.text || ''));
    document.addEventListener('medgame:patient-sentence', (e) => onPatientSentence(e.detail));
    document.addEventListener('medgame:patient-reply', (e) => onPatientReply(e.detail || {}));
    document.addEventListener('medgame:patient-error', () => { setThinking(false); live.pendingStudent = null; });
    document.addEventListener('medgame:voice-listening', syncVoiceUI);
    document.addEventListener('medgame:voice-speaking', (e) => {
        syncVoiceUI();
        if (!e.detail?.speaking) afterPatientTurn();
    });
    document.addEventListener('medgame:voice-sentence', (e) => { if (e.detail?.emotion) setEmotion(e.detail.emotion); });
    document.addEventListener('input', (e) => {
        if (e.target?.id === 'dialogue-input' || e.target?.id === 'dialog-input-3d') armSilence();
    });

    function boot() {
        inject2D();
        ensureCase();
        render(null);
        syncVoiceUI();
        // Le dialogue 3D est créé à la demande : on l'habille quand il apparaît.
        setInterval(() => {
            if (document.getElementById('dialog-input-3d') && !document.querySelector('.dialog-input-area .pl-mic, .dialog-header .pl-bar')) inject3D();
        }, 700);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    window.PatientLive = {
        promptBlock: () => (ensureCase() && C() ? C().promptBlock(live.alliance.snapshot()) : ''),
        isLocked: () => live.locked,
        snapshot: () => live.alliance?.snapshot() || null,
        summary: () => live.alliance?.summary() || null,
        openDebrief: () => openDebrief(false),
        toggleLive,
        /** Lu à chaque image par le patient 3D (js/three-patient.js). */
        presence() {
            const s = live.alliance?.snapshot();
            const v = V();
            let away = 0;
            if (s) away = s.walkedOut ? 1 : s.trust < 20 ? 0.8 : s.trust < 40 ? 0.45 : 0;
            if (v?.isListening()) away *= 0.5;
            return {
                level: v ? v.getLevel() : 0,
                speaking: !!v?.isSpeaking(),
                listening: !!v?.isListening(),
                gazeAway: away,
                anxiety: s ? s.anxiety : 45,
                emotion: live.emotion,
                gone: !!s?.walkedOut
            };
        },
        // Tests et débogage
        _live: live,
        _applyTurn: applyTurn
    };
})();
