/**
 * js/progress-tracker.js — Checklist live + fil d'Ariane + feedback immédiat (P0)
 * S'injecte dans game.html : carte progression sidebar + breadcrumb top-bar.
 * Écoute : interrogatoire-asked, exam-ordered, locksystem-unlock, navigation sections.
 */
(function () {
    'use strict';

    const state = { hintsUsed: 0, lastCounts: null };

    function getCase() {
        if (typeof gameState !== 'undefined' && gameState.currentCase) return gameState.currentCase;
        if (window.scoringState && window.scoringState.currentCase) return window.scoringState.currentCase;
        if (typeof lockSystem !== 'undefined' && lockSystem.currentCase) return lockSystem.currentCase;
        return null;
    }

    function countInterrogatoire(currentCase) {
        const dem = (window.scoringState && window.scoringState.demarche) || null;
        if (!currentCase || !dem) return { done: 0, total: 0 };
        const interro = currentCase.interrogatoire || {};
        let total = 0;
        if (interro.modeDeVie) total += Object.keys(interro.modeDeVie).length;
        if (interro.antecedents) total += ['medicaux', 'chirurgicaux', 'familiaux'].filter(k => interro.antecedents[k]).length;
        if (interro.traitements) total += 1;
        if (interro.allergies) total += 1;
        if (interro.histoireMaladie) total += Object.keys(interro.histoireMaladie).length;
        total = Math.max(total, 1);
        // Approximation : champs demandés tracés (peut être inférieur au total réel affiché)
        const done = Math.min(dem.interrogatoireAsked ? dem.interrogatoireAsked.size : 0, total);
        return { done, total };
    }

    function countExams(currentCase) {
        const dem = (window.scoringState && window.scoringState.demarche) || null;
        const ordered = (dem && dem.examsOrdered) || [];
        const relevant = (currentCase && currentCase.relevantExams) || [];
        const total = relevant.length > 0 ? relevant.length : ((currentCase && currentCase.availableExams) || []).length;
        const done = relevant.length > 0
            ? ordered.filter(e => relevant.includes(e)).length
            : ordered.length;
        return { done: Math.min(done, Math.max(total, 1)), total: Math.max(total, 1) };
    }

    function countLocks(currentCase) {
        const dem = (window.scoringState && window.scoringState.demarche) || null;
        const locks = (currentCase && currentCase.locks) || [];
        const done = dem && dem.locksUnlocked ? dem.locksUnlocked.size : 0;
        return { done: Math.min(done, locks.length), total: locks.length };
    }

    function ensureUI() {
        // 1. Carte progression dans la sidebar (sous patient-mini-card)
        if (!document.getElementById('medgame-progress-card')) {
            const anchor = document.querySelector('.patient-mini-card');
            const card = document.createElement('div');
            card.id = 'medgame-progress-card';
            card.setAttribute('role', 'status');
            card.setAttribute('aria-live', 'polite');
            card.innerHTML = `
                <div class="mg-progress-header">
                    <span><i class="fas fa-clipboard-check"></i> Démarche <span id="mg-mode-badge" class="mg-mode-badge"></span></span>
                    <strong id="mg-progress-score">0%</strong>
                </div>
                <div class="mg-progress-bar"><div id="mg-progress-fill" class="mg-progress-fill"></div></div>
                <ul class="mg-progress-list">
                    <li id="mg-p-interro">❓ Interrogatoire <span>—</span></li>
                    <li id="mg-p-examen">🩺 Examen clinique <span>—</span></li>
                    <li id="mg-p-exams">🧪 Examens compl. <span>—</span></li>
                    <li id="mg-p-locks">🔐 Défis <span>—</span></li>
                </ul>
                <div class="mg-progress-actions">
                    <button id="mg-btn-hint" type="button" title="Obtenir un indice (-15s, max 3)"><i class="fas fa-lightbulb"></i> Indice</button>
                    <button id="mg-btn-nurse" type="button" title="Demander l'avis de l'infirmier"><i class="fas fa-user-nurse"></i> Infirmier</button>
                    <button id="mg-btn-calm" type="button" title="Activer/désactiver le mode calme (sans stress visuel/sonore)"><i class="fas fa-leaf"></i> Calme</button>
                </div>`;
            if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
            else document.body.appendChild(card);

            const hintBtn = card.querySelector('#mg-btn-hint');
            if (hintBtn) hintBtn.addEventListener('click', () => window.MedGameHints && window.MedGameHints.requestHint());
            const nurseBtn = card.querySelector('#mg-btn-nurse');
            if (nurseBtn) nurseBtn.addEventListener('click', () => window.MedGameHints && window.MedGameHints.askNurse());
            const calmBtn = card.querySelector('#mg-btn-calm');
            if (calmBtn) calmBtn.addEventListener('click', () => {
                if (!window.MedGameModes) return;
                const next = !window.MedGameModes.isCalmMode();
                window.MedGameModes.setCalmMode(next);
                if (typeof showNotification === 'function') showNotification(next ? '🍃 Mode calme activé.' : '⚡ Mode calme désactivé.');
                refresh();
            });
        }
        // 2. Fil d'Ariane dans la top-bar
        if (!document.getElementById('mg-breadcrumb')) {
            const topBar = document.querySelector('.top-bar .case-info');
            if (topBar) {
                const crumb = document.createElement('div');
                crumb.id = 'mg-breadcrumb';
                crumb.setAttribute('aria-label', "Progression dans le cas");
                crumb.innerHTML = `<span data-step="section-anamnese">1 Interro</span> › <span data-step="section-examen-clinique">2 Examen</span> › <span data-step="section-examens">3 Examens</span> › <span data-step="section-synthese">4 Décision</span>`;
                topBar.appendChild(crumb);
            }
        }
    }

    function setLi(id, done, total) {
        const li = document.getElementById(id);
        if (!li) return;
        const span = li.querySelector('span');
        const label = total === 0 ? '—' : `${done}/${total}`;
        if (span) span.textContent = label;
        li.classList.toggle('done', total > 0 && done >= total);
        li.classList.toggle('partial', done > 0 && (total === 0 || done < total));
    }

    function refresh() {
        ensureUI();
        const currentCase = getCase();
        if (!currentCase) return;
        const interro = countInterrogatoire(currentCase);
        const exams = countExams(currentCase);
        const locks = countLocks(currentCase);
        const dem = (window.scoringState && window.scoringState.demarche) || {};
        const examViewed = dem.examSectionsViewed && (dem.examSectionsViewed.has('section-examen-clinique') || dem.examSectionsViewed.has('section-examen'));

        setLi('mg-p-interro', interro.done, interro.total);
        const examLi = document.getElementById('mg-p-examen');
        if (examLi) {
            const s = examLi.querySelector('span');
            if (s) s.textContent = examViewed ? '✓ vu' : 'à faire';
            examLi.classList.toggle('done', !!examViewed);
        }
        setLi('mg-p-exams', exams.done, exams.total);
        const locksLi = document.getElementById('mg-p-locks');
        if (locksLi) {
            if (locks.total === 0) {
                locksLi.querySelector('span').textContent = 'aucun';
                locksLi.classList.add('done');
            } else setLi('mg-p-locks', locks.done, locks.total);
        }

        // Score démarche live (si dispo)
        try {
            if (typeof calculateDemarcheScore === 'function') {
                const score = calculateDemarcheScore(currentCase);
                const scoreEl = document.getElementById('mg-progress-score');
                if (scoreEl) scoreEl.textContent = `${score}%`;
                const fill = document.getElementById('mg-progress-fill');
                if (fill) fill.style.width = `${Math.max(0, Math.min(100, score))}%`;
            }
        } catch (e) {}

        // Badge mode + bouton calme
        const badge = document.getElementById('mg-mode-badge');
        if (badge && window.MedGameModes) badge.textContent = window.MedGameModes.getModeLabel();
        const calmBtn = document.getElementById('mg-btn-calm');
        if (calmBtn && window.MedGameModes) calmBtn.classList.toggle('active', window.MedGameModes.isCalmMode());

        // Breadcrumb : étape active
        const activeSection = document.querySelector('.game-section.active');
        const crumbs = document.querySelectorAll('#mg-breadcrumb [data-step]');
        crumbs.forEach(c => c.classList.toggle('active', !!activeSection && activeSection.id === c.dataset.step));
    }

    function celebrate(el, value, positive) {
        try {
            if (typeof showScorePopup === 'function' && el) showScorePopup(el, value, positive);
            else if (typeof showNotification === 'function') showNotification(value, positive ? 'success' : 'info');
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play(positive ? 'success' : 'click');
        } catch (e) {}
    }

    function init() {
        ensureUI();
        refresh();
        ['interrogatoire-asked', 'exam-ordered', 'locksystem-unlock', 'timer-tick'].forEach(evt => {
            document.addEventListener(evt, () => setTimeout(refresh, 60));
        });
        document.addEventListener('click', (e) => {
            if (e.target && e.target.closest && e.target.closest('.nav-item')) setTimeout(refresh, 120);
        });
        // Feedback immédiat : toast + son sur déverrouillage
        document.addEventListener('locksystem-unlock', (e) => {
            const revealed = e.detail && e.detail.revealed;
            if (typeof showNotification === 'function') {
                showNotification(revealed ? '🔓 Info révélée (hors points — retente le défi la prochaine fois).' : '✅ Défi relevé ! +démarche.', revealed ? 'info' : 'success');
            }
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play(revealed ? 'reveal' : 'success');
        });
        document.addEventListener('exam-ordered', (e) => {
            const n = (e.detail && e.detail.exams && e.detail.exams.length) || 0;
            if (typeof showNotification === 'function' && n > 0) showNotification(`🧪 ${n} examen(s) demandé(s) — résultats en cours…`, 'info');
        });
        setInterval(refresh, 4000);
    }

    window.MedGameProgress = { refresh, init };
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
        else setTimeout(init, 0);
    }
})();
