/**
 * js/theme-manager.js — Gestionnaire universel du thème clair / sombre (Clinique CHU / Nuit)
 *
 * Persistance dans localStorage ('medgame_theme') : 'light' | 'dark' | 'auto'.
 * Par défaut, suit la préférence du système ou applique 'light' si indéfini.
 * Crée un bouton discret en haut à droite si non présent dans le DOM.
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'medgame_theme';

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || 'auto';
        } catch (e) {
            return 'auto';
        }
    }

    function setSavedTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // mode navigation privée sans quota
        }
    }

    function getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    function getEffectiveTheme() {
        const saved = getSavedTheme();
        if (saved === 'dark' || saved === 'light') return saved;
        return getSystemTheme();
    }

    function applyTheme(theme) {
        const effective = (theme === 'auto') ? getSystemTheme() : theme;
        const root = document.documentElement;
        const body = document.body;

        if (effective === 'dark') {
            root.setAttribute('data-theme', 'dark');
            if (body) {
                body.classList.add('theme-dark');
                body.classList.remove('theme-light');
            }
        } else {
            root.setAttribute('data-theme', 'light');
            if (body) {
                body.classList.add('theme-light');
                body.classList.remove('theme-dark');
            }
        }

        updateToggleButtons(effective);
    }

    function toggleTheme() {
        const current = getEffectiveTheme();
        const next = (current === 'dark') ? 'light' : 'dark';
        setSavedTheme(next);
        applyTheme(next);
    }

    function updateToggleButtons(effective) {
        const buttons = document.querySelectorAll('.btn-theme-toggle, #btn-toggle-theme, .theme-toggle-floating');
        buttons.forEach((btn) => {
            const isDark = (effective === 'dark');
            btn.setAttribute('aria-label', isDark ? 'Basculer vers le mode clair (Dossier Médical)' : 'Basculer vers le mode sombre (Garde de Nuit)');
            btn.setAttribute('title', isDark ? 'Mode clair (Dossier Médical)' : 'Mode sombre (Garde de Nuit)');

            // Si le bouton possède une icône <i>, la basculer
            const icon = btn.querySelector('i');
            if (icon) {
                if (isDark) {
                    icon.className = 'fas fa-sun';
                } else {
                    icon.className = 'fas fa-moon';
                }
            } else if (btn.classList.contains('theme-toggle-floating')) {
                btn.innerHTML = isDark ? '<i class="fas fa-sun" aria-hidden="true"></i>' : '<i class="fas fa-moon" aria-hidden="true"></i>';
            }
        });
    }

    function initButton() {
        // Ne pas dupliquer si déjà présent
        if (document.querySelector('.theme-toggle-floating') || document.getElementById('btn-toggle-theme-floating')) {
            return;
        }

        // Création du bouton flottant discret
        const btn = document.createElement('button');
        btn.id = 'btn-toggle-theme-floating';
        btn.className = 'theme-toggle-floating';
        btn.type = 'button';
        btn.onclick = toggleTheme;
        document.body.appendChild(btn);

        updateToggleButtons(getEffectiveTheme());
    }

    // Écouteur des changements système
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (getSavedTheme() === 'auto') {
                applyTheme('auto');
            }
        });
    }

    // Application immédiate avant le rendu complet pour éviter le flash
    applyTheme(getSavedTheme());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyTheme(getSavedTheme());
            initButton();
        });
    } else {
        initButton();
    }

    // Exposition globale pour usage manuel ou intégrations
    window.MedGameTheme = {
        getTheme: getEffectiveTheme,
        setTheme: (t) => {
            setSavedTheme(t);
            applyTheme(t);
        },
        toggleTheme: toggleTheme
    };
})();
