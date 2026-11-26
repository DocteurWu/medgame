/* ============================================================
   Avis de clôture du projet MedGame
   Injecte un badge permanent et une modale de remerciement
   affichée une fois par navigateur.
   Aucune dépendance, aucun impact sur la mise en page existante.
   ============================================================ */
(function () {
    'use strict';

    var STORAGE_KEY = 'medgame.closure.ack.v1';
    var injected = false;

    function readAck() {
        try {
            return window.localStorage.getItem(STORAGE_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function writeAck() {
        try {
            window.localStorage.setItem(STORAGE_KEY, '1');
        } catch (e) {
            /* stockage indisponible : la modale se réaffichera, sans casser la page */
        }
    }

    function buildBadge(onOpen) {
        var badge = document.createElement('button');
        badge.type = 'button';
        badge.className = 'mg-closure-badge';
        badge.setAttribute('aria-label', 'Projet arrêté le 26 novembre 2026. Afficher le message de clôture.');
        badge.innerHTML = '<span class="mg-dot" aria-hidden="true"></span><span>Projet arrêté, site non maintenu</span>';
        badge.addEventListener('click', onOpen);
        return badge;
    }

    function buildModal(onClose) {
        var backdrop = document.createElement('div');
        backdrop.className = 'mg-closure-backdrop';
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');
        backdrop.setAttribute('aria-labelledby', 'mg-closure-title');
        backdrop.setAttribute('aria-describedby', 'mg-closure-desc');

        // Contenu statique, défini dans ce fichier : aucune donnée externe
        // ni entrée utilisateur n'entre dans ce innerHTML.
        backdrop.innerHTML = [
            '<div class="mg-closure-card">',
            '  <button type="button" class="mg-closure-close" data-mg-close aria-label="Fermer le message">\u00D7</button>',
            '  <span class="mg-closure-kicker">Projet arrêté</span>',
            '  <h2 id="mg-closure-title">MedGame n\'est plus maintenu</h2>',
            '  <p id="mg-closure-desc">Ce site n\'est plus mis à jour depuis le <strong>26 novembre 2026</strong>. ',
            '  Le projet est arrêté. Pour l\'entraînement aux ECOS, il existe aujourd\'hui des outils bien ',
            '  meilleurs, et gratuits pour les étudiants.</p>',
            '  <div class="mg-closure-thanks">',
            '    <p>Merci à celles et ceux qui y ont contribué : relectures cliniques, écriture de scénarios, ',
            '    tests, corrections, et à tous les étudiants qui l\'ont essayé et qui ont pris le temps de dire ',
            '    ce qui marchait et ce qui ne marchait pas.</p>',
            '    <p>Vos retours ont servi. Le code reste ouvert.</p>',
            '  </div>',
            '  <p>Le dépôt est archivé ici : ',
            '  <a class="mg-closure-inline" href="https://github.com/DocteurWu/medgame" target="_blank" rel="noopener">github.com/DocteurWu/medgame</a>. ',
            '  Si vous en avez besoin, écrivez-moi à ',
            '  <a class="mg-closure-inline" href="mailto:hamlat.louai@gmail.com">hamlat.louai@gmail.com</a>.</p>',
            '  <p class="mg-closure-sign">Louaï Hamlat, fondateur et développeur</p>',
            '  <div class="mg-closure-actions">',
            '    <button type="button" class="mg-closure-btn" data-mg-close>J\'ai compris</button>',
            '    <a class="mg-closure-link" href="https://github.com/DocteurWu/medgame" target="_blank" rel="noopener">Voir le dépôt</a>',
            '    <a class="mg-closure-link" href="credits.html">Voir les crédits</a>',
            '  </div>',
            '</div>'
        ].join('');

        backdrop.addEventListener('click', function (event) {
            if (event.target === backdrop) {
                onClose();
            }
        });

        var closers = backdrop.querySelectorAll('[data-mg-close]');
        for (var i = 0; i < closers.length; i++) {
            closers[i].addEventListener('click', onClose);
        }

        return backdrop;
    }

    function init() {
        if (injected || !document.body) {
            return;
        }
        injected = true;

        var modal = null;
        var lastFocus = null;

        function openModal() {
            if (!modal) {
                modal = buildModal(closeModal);
            }
            lastFocus = document.activeElement;
            document.body.appendChild(modal);
            // Focus sur la carte, pas sur le bouton : sinon le navigateur fait
            // défiler le fond pour amener le bouton dans la vue et coupe le haut du texte.
            var card = modal.querySelector('.mg-closure-card');
            if (card) {
                card.setAttribute('tabindex', '-1');
                card.focus({ preventScroll: true });
            }
            document.addEventListener('keydown', onKeydown);
        }

        function closeModal() {
            if (!modal) {
                return;
            }
            modal.remove();
            modal = null;
            writeAck();
            document.removeEventListener('keydown', onKeydown);
            if (lastFocus && typeof lastFocus.focus === 'function') {
                lastFocus.focus();
            }
        }

        function onKeydown(event) {
            if (event.key === 'Escape') {
                closeModal();
            }
        }

        document.body.appendChild(buildBadge(openModal));

        if (!readAck()) {
            openModal();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
