/**
 * js/editor-interview.js — « Raconter mon cas » dans l'éditeur (editor.html).
 *
 * L'étudiant raconte un patient (clavier ou dictée du système, Windows + H),
 * l'IA pose ses questions une à une, la fiche se remplit à côté, puis le cas
 * est rédigé, chargé dans l'éditeur et testable aussitôt.
 *
 * Toute la logique est dans js/case-interview.js (pur, testé). Ici : le DOM,
 * l'appel au modèle (un par réplique) et le brouillon local.
 */
(function () {
    'use strict';

    const DRAFT_KEY = 'medgame.interview.v1';
    const CI = () => window.CaseInterview;
    const $ = (id) => document.getElementById(id);

    let state = null;
    let busy = false;

    // ==================== BROUILLON ====================

    function saveDraft() {
        try {
            // Les images (lourdes) ne sont pas mises au brouillon.
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...state, images: [] }));
        } catch (e) { /* quota : l'entretien continue sans brouillon */ }
    }

    function loadDraft() {
        try {
            const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
            if (d && Array.isArray(d.transcript) && d.transcript.length > 1) {
                return { facts: d.facts || {}, transcript: d.transcript, skipped: d.skipped || [], images: [] };
            }
        } catch (e) { /* brouillon illisible */ }
        return null;
    }

    function clearDraft() {
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* rien */ }
    }

    // ==================== RENDU ====================

    function line(role, text) {
        const row = document.createElement('div');
        row.className = `iv-line iv-line--${role}`;
        const who = document.createElement('span');
        who.className = 'iv-who';
        who.textContent = role === 'student' ? 'Toi' : 'Chef de clinique';
        const body = document.createElement('p');
        body.className = 'iv-text';
        body.textContent = text;
        row.append(who, body);
        return row;
    }

    function renderTranscript() {
        const box = $('iv-messages');
        box.replaceChildren(...state.transcript.map(m => line(m.role, m.text)));
        if (busy) {
            const wait = line('interviewer', '…');
            wait.classList.add('iv-line--waiting');
            box.appendChild(wait);
        }
        box.scrollTop = box.scrollHeight;
    }

    function summarize(value) {
        if (value == null) return '';
        if (typeof value === 'string' || typeof value === 'number') return String(value);
        if (Array.isArray(value)) return value.map(summarize).filter(Boolean).join(' ; ');
        if (typeof value === 'object') {
            if (typeof value.presence === 'boolean' && !value.presence && !value.liste?.length) return 'aucune';
            return Object.values(value).map(summarize).filter(Boolean).join(', ');
        }
        return '';
    }

    function renderFiche() {
        const cov = CI().coverage(state);
        const list = $('iv-fiche-list');
        list.replaceChildren(...cov.items.map(item => {
            const def = CI().CHECKLIST.find(c => c.id === item.id);
            const li = document.createElement('li');
            li.className = `iv-item${item.done ? ' is-done' : ''}${item.skipped ? ' is-skipped' : ''}`;
            const label = document.createElement('span');
            label.className = 'iv-item-label';
            label.textContent = item.label + (item.essential ? ' *' : '');
            const value = document.createElement('span');
            value.className = 'iv-item-value';
            const got = item.id === 'examens'
                // Un examen s'affiche avec son nom : « ECG : sus-décalage… ».
                ? Object.entries(state.facts.examResults || {}).map(([k, v]) => `${k} : ${summarize(v)}`).join(' · ')
                : def.paths.map(p => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.facts)).map(summarize).filter(Boolean).join(' · ');
            const sexe = item.id === 'patient' && state.facts.patient?.sexe ? ` · ${/^f/i.test(state.facts.patient.sexe) ? 'femme' : 'homme'}` : '';
            value.textContent = item.done ? (item.id === 'patient' ? `${got} ans${sexe}` : got) : (item.skipped ? 'sera complété par l\'IA' : 'à raconter');
            li.append(label, value);
            return li;
        }));

        $('iv-progress-fill').style.width = `${cov.percent}%`;
        $('iv-progress-text').textContent = `${cov.percent} %`;

        const images = $('iv-images');
        images.replaceChildren(...state.images.map(img => {
            const fig = document.createElement('figure');
            fig.className = 'iv-image';
            const el = document.createElement('img');
            el.src = img.dataUrl;
            el.alt = img.name;
            const cap = document.createElement('figcaption');
            cap.textContent = img.name;
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'iv-image-remove';
            rm.setAttribute('aria-label', `Retirer l'image ${img.name}`);
            rm.textContent = '×';
            rm.addEventListener('click', () => {
                state = { ...state, images: state.images.filter(i => i !== img) };
                renderFiche();
            });
            fig.append(el, cap, rm);
            return fig;
        }));

        const build = $('iv-build');
        build.disabled = busy || !cov.canBuild;
        $('iv-build-hint').textContent = cov.canBuild
            ? (cov.missing.length ? `Tu peux rédiger la fiche maintenant : l'IA complétera ${cov.missing.length} élément(s) de façon cohérente.` : 'Tout est là : la fiche peut être rédigée.')
            : `Il manque encore : ${cov.missingEssential.map(i => i.label.toLowerCase()).join(', ')}.`;
    }

    function render() {
        renderTranscript();
        renderFiche();
        $('iv-send').disabled = busy;
    }

    function showStep(step) {
        for (const id of ['iv-step-talk', 'iv-step-loading', 'iv-step-done']) $(id).hidden = id !== `iv-step-${step}`;
    }

    // ==================== ENTRETIEN ====================

    async function send() {
        const input = $('iv-input');
        const said = input.value.trim();
        if (!said || busy) return;
        if (typeof LLMClient === 'undefined') { alert("Le client IA n'est pas chargé."); return; }

        input.value = '';
        busy = true;
        // La réplique de l'étudiant s'affiche tout de suite ; elle n'entre dans
        // l'état qu'avec la réponse (un échec ne laisse pas de tour à moitié fait).
        const shown = { ...state, transcript: [...state.transcript, { role: 'student', text: said }] };
        const before = state;
        state = shown;
        render();

        let parsed = null;
        try {
            const raw = await LLMClient.request({
                messages: CI().buildTurnMessages(before, said),
                temperature: 0.4,
                maxTokens: 900,
                timeoutMs: 25000,
                maxRetries: 1,
                quotaKind: 'correction',
                responseFormat: { type: 'json_object' }
            });
            parsed = CI().parseTurn(raw);
        } catch (err) {
            console.warn('[Entretien] tour sans IA :', err);
            const errEl = $('iv-error');
            errEl.textContent = "L'IA n'a pas répondu : ta réponse est gardée telle quelle et je continue avec les questions de base.";
            errEl.hidden = false;
        }
        if (parsed) $('iv-error').hidden = true;

        state = CI().applyTurn(before, said, parsed);
        busy = false;
        saveDraft();
        render();
        input.focus();
    }

    async function attachImage(file) {
        if (!file) return;
        const name = (prompt("Quel est cet examen ? (ex. Radio thoracique, ECG, Scanner abdominal)", file.name.replace(/\.[^.]+$/, '')) || '').trim();
        if (!name) return;
        try {
            const dataUrl = await window.compressExamImage(file);
            state = CI().addImage(state, name, dataUrl);
            renderFiche();
        } catch (err) {
            alert("Impossible de lire cette image : " + err.message);
        }
    }

    // ==================== RÉDACTION ====================

    function authorName() {
        try { return JSON.parse(localStorage.getItem('medgame_profile') || '{}').username || ''; } catch (e) { return ''; }
    }

    async function build() {
        if (busy || !CI().coverage(state).canBuild) return;
        if (typeof confirmReplaceCurrentCase === 'function' && !confirmReplaceCurrentCase()) return;
        busy = true;
        showStep('loading');
        try {
            const built = await window.EditorAI.buildCaseFromInterview(state, { redacteur: authorName() });
            populateEditor(built);
            if (typeof persistEditorAutosave === 'function') persistEditorAutosave(collectData());
            if (typeof updateCompletionMeter === 'function') updateCompletionMeter();

            const p = built.patient || {};
            $('iv-done-title').textContent = `${p.prenom} ${p.nom}, ${p.age} ans`;
            $('iv-done-motif').textContent = built.interrogatoire?.motifHospitalisation || '';
            $('iv-done-diag').textContent = built.correctDiagnostic || '';
            $('iv-done-exams').textContent = (built.availableExams || []).join(', ') || '—';
            $('iv-done-treat').textContent = (built.correctTreatments || []).join(', ') || '—';
            const issues = CI().problems(built);
            const warn = $('iv-done-warn');
            warn.hidden = !issues.length;
            warn.textContent = issues.length ? `À vérifier dans l'éditeur : ${issues.join(' ')}` : '';
            clearDraft();
            showStep('done');
        } catch (err) {
            console.error('[Entretien] rédaction impossible :', err);
            alert("La fiche n'a pas pu être rédigée : " + err.message + "\nTon récit est conservé, tu peux réessayer.");
            showStep('talk');
        } finally {
            busy = false;
            render();
        }
    }

    // ==================== OUVERTURE ====================

    function open() {
        if (!CI()) { alert("js/case-interview.js n'est pas chargé."); return; }
        if (!state) {
            const draft = loadDraft();
            state = draft && confirm("Reprendre l'entretien commencé ?") ? draft : CI().start(CI().createState());
        }
        showStep('talk');
        $('interview-modal').style.display = 'flex';
        render();
        setTimeout(() => $('iv-input')?.focus(), 100);
    }

    function close() {
        $('interview-modal').style.display = 'none';
    }

    function restart() {
        if (state && state.transcript.length > 1 && !confirm("Recommencer l'entretien depuis le début ?")) return;
        clearDraft();
        state = CI().start(CI().createState());
        $('iv-error').hidden = true;
        showStep('talk');
        render();
    }

    function init() {
        if (!$('interview-modal')) return;
        document.querySelectorAll('[data-open-interview]').forEach(b => b.addEventListener('click', open));
        $('interview-modal-close').addEventListener('click', close);
        $('iv-send').addEventListener('click', send);
        $('iv-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
        $('iv-restart').addEventListener('click', restart);
        $('iv-build').addEventListener('click', build);
        $('iv-image-input').addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = '';
            attachImage(file);
        });
        $('iv-done-test').addEventListener('click', () => { close(); $('btn-preview-case')?.click(); });
        $('iv-done-edit').addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && $('interview-modal').style.display === 'flex' && !busy) close();
        });
    }

    window.EditorInterview = { open, close };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
