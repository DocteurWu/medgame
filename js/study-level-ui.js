/**
 * js/study-level-ui.js — Interface de l'année d'étude (js/study-level.js).
 *
 *   - `mountPicker(host)` : sélecteur « Mon année » (2e → 6e), utilisé sur la
 *     page des thèmes et dans la feuille de route ;
 *   - en partie (game.html) : un bouton dans le bandeau du cas ouvre la
 *     feuille de route de l'année (ce qu'on attend, objectifs).
 *
 * Aucune logique ici : tout vient de `window.StudyLevel`. Le changement
 * d'année est diffusé par l'événement `medgame:level-changed` sur `document`.
 */
(function () {
    'use strict';

    const SL = () => window.StudyLevel;
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    // ==================== SÉLECTEUR ====================

    function pickerHtml() {
        const S = SL();
        const current = S.currentId();
        const chosen = S.isSet();
        return `
            <span class="sl-picker-label" id="sl-picker-label">${chosen ? 'Mon année' : 'Choisis ton année'}</span>
            <div class="sl-picker-options" role="radiogroup" aria-labelledby="sl-picker-label">
                ${S.ORDER.map(id => {
                    const lv = S.LEVELS[id];
                    const on = id === current;
                    return `<button type="button" class="sl-picker-btn${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-level="${id}" title="${esc(lv.label)}">${lv.year}<sup>e</sup></button>`;
                }).join('')}
            </div>
            <span class="sl-picker-focus">${esc(S.get(current).id)} · ${esc(S.get(current).focus)}</span>`;
    }

    function mountPicker(host) {
        if (!host || !SL()) return;
        host.classList.add('sl-picker');
        host.classList.toggle('sl-picker--unset', !SL().isSet());
        host.innerHTML = pickerHtml();
        if (host.dataset.slBound) return;
        host.dataset.slBound = '1';
        host.addEventListener('click', (e) => {
            const btn = e.target.closest('.sl-picker-btn');
            if (btn) SL().set(btn.dataset.level);
        });
        host.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const btns = Array.from(host.querySelectorAll('.sl-picker-btn'));
            const i = btns.indexOf(document.activeElement);
            if (i < 0) return;
            e.preventDefault();
            const next = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
            SL().set(next.dataset.level);
            host.querySelector(`.sl-picker-btn[data-level="${next.dataset.level}"]`)?.focus();
        });
        document.addEventListener('medgame:level-changed', () => {
            host.classList.remove('sl-picker--unset');
            host.innerHTML = pickerHtml();
        });
    }

    // ==================== FEUILLE DE ROUTE (PARTIE) ====================

    function roadmapHtml() {
        const lv = SL().get();
        return `
            <div class="sl-roadmap-head">
                <h3 id="sl-roadmap-title">Feuille de route · ${esc(lv.short)}</h3>
                <button type="button" class="sl-roadmap-close" aria-label="Fermer la feuille de route">&times;</button>
            </div>
            <p class="sl-roadmap-focus">${esc(lv.focus)}</p>
            <ul class="sl-roadmap-list">
                ${lv.objectives.map(o => `<li>${esc(o)}</li>`).join('')}
            </ul>
            <div class="sl-roadmap-picker" id="sl-roadmap-picker"></div>
            <p class="sl-roadmap-note">Le patient, l'aide de l'infirmier et le débriefing s'adaptent à ton année. La note du cas reste la même pour tous.</p>`;
    }

    function mountGameChip() {
        const bar = document.querySelector('.top-bar .case-info');
        if (!bar || !SL() || document.getElementById('sl-chip')) return;

        const chip = document.createElement('button');
        chip.type = 'button';
        chip.id = 'sl-chip';
        chip.className = 'btn-ghost sl-chip';
        chip.setAttribute('aria-haspopup', 'dialog');
        chip.setAttribute('aria-expanded', 'false');
        chip.title = 'Ce qu\'on attend de toi cette année';

        const panel = document.createElement('div');
        panel.id = 'sl-roadmap';
        panel.className = 'sl-roadmap';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-labelledby', 'sl-roadmap-title');
        panel.hidden = true;

        const render = () => {
            chip.innerHTML = `<i class="fas fa-graduation-cap" aria-hidden="true"></i> ${esc(SL().get().short)}`;
            panel.innerHTML = roadmapHtml();
            const inner = panel.querySelector('#sl-roadmap-picker');
            inner.classList.add('sl-picker');
            inner.innerHTML = pickerHtml();
        };
        const setOpen = (open) => {
            panel.hidden = !open;
            chip.setAttribute('aria-expanded', String(open));
            if (open) panel.querySelector('.sl-roadmap-close')?.focus();
        };

        chip.addEventListener('click', () => setOpen(panel.hidden));
        panel.addEventListener('click', (e) => {
            if (e.target.closest('.sl-roadmap-close')) { setOpen(false); chip.focus(); return; }
            const btn = e.target.closest('.sl-picker-btn');
            if (btn) SL().set(btn.dataset.level);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !panel.hidden) { setOpen(false); chip.focus(); }
        });
        document.addEventListener('pointerdown', (e) => {
            if (!panel.hidden && !panel.contains(e.target) && !chip.contains(e.target)) setOpen(false);
        });
        document.addEventListener('medgame:level-changed', render);

        render();
        bar.appendChild(chip);
        document.body.appendChild(panel);

        // Première partie sans année choisie : on montre la feuille de route
        // une fois, pour que l'étudiant règle son année avant de commencer.
        if (!SL().isSet()) setOpen(true);
    }

    function init() {
        document.querySelectorAll('[data-study-level-picker]').forEach(mountPicker);
        mountGameChip();
    }

    window.StudyLevelUI = { mountPicker, mountGameChip };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
