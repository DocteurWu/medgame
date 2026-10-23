/**
 * ========================================================================
 * MEDGAME — TRANSMISSION IAO (infirmière d'accueil et d'orientation)
 * ========================================================================
 *
 * À l'ouverture d'un cas, l'IAO transmet le patient au médecin. Ce n'est
 * plus un personnage dessiné : c'est la fiche de transmission telle qu'on
 * la reçoit dans un service — une note datée, signée, avec le motif et le
 * box. Le joueur la lit, puis « prend le patient ».
 *
 * API publique inchangée : init, show, hide, speak, setMood, configure,
 * isVisible (game.js, ecosMode.js et urgenceMode.js l'utilisent).
 */
const NurseIntro = (() => {
    let overlayEl = null;
    let containerEl = null;
    let bubbleTextEl = null;
    let progressBarEl = null;
    let channelTextEl = null;
    let timeEl = null;
    let signEl = null;
    let _keyListenerAttached = false;

    let onDismissCallback = null;
    let autoDismissTimer = null;
    const AUTO_DISMISS_DURATION = 9000; // laisse le temps de lire la fiche

    let currentConfig = {
        name: 'Sarah',
        role: "infirmière d'accueil",
        mood: 'reassuring' // 'neutral' | 'urgent' | 'reassuring' | 'thinking'
    };

    // Phrases de transmission : factuelles, comme une vraie relève.
    const NURSE_PHRASES = [
        `Je vous transmets {patient}, {age} ans, {admission} pour {motif}. Constantes prises, {pronounLow} vous attend en box 3.`,
        `{patient}, {age} ans. Motif : {motif}. Installé{e} en box 2, constantes au moniteur.`,
        `Nouveau patient pour vous : {patient}, {age} ans, {admission} pour {motif}. Le dossier est ouvert.`,
        `{patient}, {age} ans, vient d'arriver pour {motif}. Je l'ai installé{e}, à vous.`
    ];

    const NURSE_PHRASES_NEUTRAL = [
        `Je vous transmets {patient}, {age} ans. Constantes prises, {pronounLow} vous attend en box 3.`,
        `{patient}, {age} ans, installé{e} en box 2. Le dossier est ouvert, à vous.`,
        `Votre patient : {patient}, {age} ans. Je n'ai pas encore le motif détaillé, je vous laisse l'interroger.`
    ];

    const URGENT_RE = /détresse|choc|arrêt|infarctus|coma|urgence|avc|saignement|hémorrag|purpura|inconscien|convuls/i;

    /** Appel d'interphone : passe par le socle audio partagé (bus, mute, mode calme). */
    function _playHospitalBeep(isUrgent = false) {
        try {
            const S = window.MedGameSound;
            if (S) S.play(isUrgent ? 'intercomUrgent' : 'nurseCall');
            if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) {
                navigator.vibrate(isUrgent ? [40, 60, 40] : 25);
            }
        } catch (e) { /* audio bloqué : ignoré */ }
    }

    function _bindElements() {
        overlayEl = document.getElementById('nurse-overlay');
        containerEl = overlayEl ? overlayEl.querySelector('.nurse-container') : null;
        bubbleTextEl = document.getElementById('nurse-bubble-text');
        progressBarEl = document.getElementById('nurse-progress-bar');
        channelTextEl = overlayEl ? overlayEl.querySelector('.hud-channel-text') : null;
        timeEl = overlayEl ? overlayEl.querySelector('.transmission-time') : null;
        signEl = overlayEl ? overlayEl.querySelector('.transmission-sign') : null;
    }

    function _nowLabel() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function setMood(mood = 'reassuring') {
        currentConfig.mood = mood;
        if (!containerEl || !overlayEl) return;
        containerEl.classList.remove('mood-neutral', 'mood-urgent', 'mood-reassuring', 'mood-thinking');
        containerEl.classList.add(`mood-${mood}`);
        const urgent = mood === 'urgent';
        overlayEl.classList.toggle('is-urgent', urgent);
        if (channelTextEl) channelTextEl.textContent = urgent ? 'Transmission urgente' : 'Transmission de l’accueil';
    }

    function configure(newConfig = {}) {
        currentConfig = { ...currentConfig, ...newConfig };
        if (signEl) signEl.textContent = `${currentConfig.name}, ${currentConfig.role}`;
        if (currentConfig.mood) setMood(currentConfig.mood);
    }

    function isVisible() {
        return Boolean(overlayEl && overlayEl.classList.contains('visible'));
    }

    function _handleKeyDown(e) {
        if (!isVisible()) return;
        const k = e.key;
        if (k === 'Escape' || k === 'Esc' || k === ' ' || k === 'Spacebar' || k === 'Enter' || e.code === 'NumpadEnter') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            hide();
        }
    }

    function _attachKeyHandler() {
        if (!_keyListenerAttached && typeof window !== 'undefined') {
            window.addEventListener('keydown', _handleKeyDown, true);
            _keyListenerAttached = true;
        }
    }

    function init() {
        _attachKeyHandler();
        if (document.getElementById('nurse-overlay')) { _bindElements(); return; }

        const html = `
        <div id="nurse-overlay" class="nurse-overlay" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Transmission de l'infirmière d'accueil">
            <div class="nurse-container mood-${currentConfig.mood}">
                <article class="speech-bubble transmission">
                    <header class="bubble-hud-header">
                        <span class="hud-channel"><span class="hud-status-dot" aria-hidden="true"></span><span class="hud-channel-text">Transmission de l’accueil</span></span>
                        <time class="transmission-time"></time>
                    </header>
                    <p id="nurse-bubble-text" class="bubble-text"></p>
                    <footer class="transmission-foot">
                        <span class="transmission-sign">${currentConfig.name}, ${currentConfig.role}</span>
                        <button type="button" class="transmission-take">Prendre le patient</button>
                    </footer>
                    <div class="nurse-progress-container" aria-hidden="true"><div id="nurse-progress-bar" class="nurse-progress-bar"></div></div>
                </article>
                <p class="nurse-footer-actions"><span class="nurse-hint">Entrée ou clic pour continuer</span></p>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('afterbegin', html);
        _bindElements();
        if (overlayEl) overlayEl.addEventListener('click', () => hide());
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    function _startProgress(duration) {
        if (!progressBarEl) return;
        progressBarEl.style.animation = 'none';
        requestAnimationFrame(() => {
            if (progressBarEl) progressBarEl.style.animation = `progressShrink ${duration}ms linear forwards`;
        });
    }

    function _open() {
        if (timeEl) timeEl.textContent = _nowLabel();
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.style.visibility = 'hidden';
        const mobileTabs = document.querySelector('.mobile-tabs');
        if (mobileTabs) mobileTabs.style.visibility = 'hidden';
        overlayEl.classList.add('visible');
        overlayEl.setAttribute('aria-hidden', 'false');
        overlayEl.setAttribute('tabindex', '-1');
        try { overlayEl.focus(); } catch (e) { /* noop */ }
    }

    /** Message libre (urgences, relances). */
    function speak(text, options = {}) {
        if (!overlayEl) init();
        const duration = options.duration || AUTO_DISMISS_DURATION;
        const mood = options.mood || 'reassuring';
        setMood(mood);
        if (bubbleTextEl) bubbleTextEl.innerHTML = text;
        _playHospitalBeep(options.isUrgent || mood === 'urgent');
        _startProgress(duration);
        _open();
        if (autoDismissTimer) clearTimeout(autoDismissTimer);
        autoDismissTimer = setTimeout(hide, duration);
    }

    /**
     * Transmission d'entrée de cas.
     * @param {Object} patient - { nom, prenom, age, sexe }
     * @param {string} motif - motif d'admission (vide en ECOS : anti-spoiler)
     * @param {Function} callback - appelé à la fermeture
     */
    function show(patient, motif, callback) {
        if (!overlayEl) init();
        onDismissCallback = callback || null;
        if (autoDismissTimer) { clearTimeout(autoDismissTimer); autoDismissTimer = null; }

        const isF = !!(patient && patient.sexe && String(patient.sexe).toLowerCase().startsWith('f'));
        const age = patient ? Number(patient.age) : NaN;
        const civ = (Number.isFinite(age) && age < 15) ? '' : (isF ? 'Mme ' : 'M. ');
        const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s) => (s ? String(s) : '');
        const fullName = patient
            ? `${civ}${esc(patient.prenom || '')} ${esc(String(patient.nom || '').toUpperCase())}`.trim()
            : 'le patient';

        const pool = motif ? NURSE_PHRASES : NURSE_PHRASES_NEUTRAL;
        const phrase = pool[Math.floor(Math.random() * pool.length)];
        const text = phrase
            .replace('{patient}', `<strong class="patient-name">${fullName}</strong>`)
            .replace('{age}', esc(patient ? patient.age : ''))
            .replace('{admission}', isF ? 'admise' : 'admis')
            .replace(/\{e\}/g, isF ? 'e' : '')
            .replace('{pronounLow}', isF ? 'elle' : 'il')
            .replace('{motif}', `<span class="motif">${esc(String(motif || '').toLowerCase())}</span>`);

        const isUrgent = !!(motif && URGENT_RE.test(motif));
        setMood(isUrgent ? 'urgent' : 'reassuring');
        if (bubbleTextEl) bubbleTextEl.innerHTML = text;
        _playHospitalBeep(isUrgent);
        _startProgress(AUTO_DISMISS_DURATION);
        _open();
        autoDismissTimer = setTimeout(hide, AUTO_DISMISS_DURATION);
    }

    function hide() {
        if (autoDismissTimer) { clearTimeout(autoDismissTimer); autoDismissTimer = null; }
        if (overlayEl) {
            overlayEl.classList.remove('visible');
            overlayEl.setAttribute('aria-hidden', 'true');
        }
        const sidebarToggle = document.getElementById('sidebar-toggle');
        if (sidebarToggle) sidebarToggle.style.visibility = 'visible';
        const mobileTabs = document.querySelector('.mobile-tabs');
        if (mobileTabs) mobileTabs.style.visibility = 'visible';
        if (typeof onDismissCallback === 'function') {
            const cb = onDismissCallback;
            onDismissCallback = null;
            cb();
        }
    }

    return { init, show, hide, speak, setMood, configure, isVisible };
})();
