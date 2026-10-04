/* js/index-game-ui.js - logique de jeu et UI de l'accueil (extrait de index.html) */

/* --- MIXAGE AUDIO (par bus) --- */

/**
 * Le socle audio (js/audio-core.js) lit ses réglages dans la clé unique
 * `medgame.audio.v2`. Ces fonctions ne font que refléter cet état dans le
 * modale de l'accueil et le renvoyer quand l'utilisateur touche un curseur.
 * Aucun réglage audio n'est écrit à la main dans localStorage ici : ce serait
 * une deuxième source de vérité, exactement le problème qu'on vient de
 * supprimer (deux modules se partageant `medgame.audio.volume` avec des
 * défauts contradictoires).
 */

const AUDIO_BUS_SLIDERS = [
    { id: 'audio-bus-master', bus: 'master' },
    { id: 'audio-bus-ui', bus: 'ui' },
    { id: 'audio-bus-sfx', bus: 'sfx' },
    { id: 'audio-bus-medical', bus: 'medical' },
    { id: 'audio-bus-ambience', bus: 'ambience' },
    { id: 'audio-bus-music', bus: 'music' }
];

/**
 * Vrai si le joueur a coupé le son. Le socle est la source de vérité ;
 * `medgame.audio.muted` n'est lu ici que si le socle n'est pas chargé, et ne
 * l'est plus jamais : le garder en écriture créait une seconde vérité qui
 * pouvait contredire `medgame.audio.v2`.
 */
function isAudioMuted() {
    if (window.MedGameSound) return window.MedGameSound.isMuted();
    return localStorage.getItem('medgame.audio.muted') === 'true';
}

/** Reflète l'état courant du socle dans les curseurs et les presets. */
function initAudioMixerUI() {
    const S = window.MedGameSound;

    for (const { id, bus } of AUDIO_BUS_SLIDERS) {
        const slider = document.getElementById(id);
        if (!slider) continue;
        const value = S
            ? (bus === 'master' ? S.getMasterVolume() : S.getBusVolume(bus))
            : BUS_FALLBACK[bus];
        setAudioSlider(slider, value);
        // Les écouteurs ne sont posés qu'une fois : le bouton de preset
        // rappelle cette fonction, et sans ce garde chaque clic de preset
        // empilait un écouteur supplémentaire — donc N écritures dans
        // localStorage par pixel glissé sur le curseur.
        if (!slider.dataset.lie) {
            slider.dataset.lie = '1';
            slider.addEventListener('input', () => {
                if (S) {
                    if (bus === 'master') S.setMasterVolume(slider.value / 100);
                    else S.setBusVolume(bus, slider.value / 100);
                }
                clearAudioPresetSelection();
            });
        }
    }

    for (const btn of document.querySelectorAll('#setting-audio-presets .audio-preset-btn')) {
        if (btn.dataset.lie) continue;
        btn.dataset.lie = '1';
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (S) {
                S.applyPreset(preset);
                initAudioMixerUI();
            }
            // Un preset n'est jamais « silencieux » : on relève l'interrupteur.
            const toggle = document.getElementById('setting-sound-toggle');
            if (toggle && !toggle.checked) {
                toggle.checked = true;
                if (S) S.setMuted(false);
            }
        });
    }

    refreshAudioPresetSelection();
}

/** Valeurs de repli si le socle n'est pas chargé (page cassée). */
const BUS_FALLBACK = {
    master: 0.85, ui: 0.75, sfx: 0.9, medical: 0.85, ambience: 0.6, music: 0.45
};

function setAudioSlider(slider, value) {
    const pct = Math.round((Number(value) || 0) * 100);
    slider.value = String(pct);
    const out = slider.parentElement.querySelector('output');
    if (out) out.textContent = pct + ' %';
    // Atténue visuellement un canal à zéro : on voit d'un coup d'œil
    // ce qui est coupé, sans avoir à lire les chiffres.
    slider.dataset.silent = pct === 0 ? '1' : '0';
}

function refreshAudioPresetSelection() {
    const current = window.MedGameSound ? window.MedGameSound.getPreset() : 'normal';
    for (const btn of document.querySelectorAll('#setting-audio-presets .audio-preset-btn')) {
        btn.setAttribute('aria-pressed', btn.dataset.preset === current ? 'true' : 'false');
    }
}

function clearAudioPresetSelection() {
    for (const btn of document.querySelectorAll('#setting-audio-presets .audio-preset-btn')) {
        btn.setAttribute('aria-pressed', 'false');
    }
}

/** Écrit les curseurs dans le socle (appelé au clic sur « Enregistrer »). */
function applyAudioMixerUI() {
    const S = window.MedGameSound;
    if (!S) return;
    for (const { id, bus } of AUDIO_BUS_SLIDERS) {
        const slider = document.getElementById(id);
        if (!slider) continue;
        if (bus === 'master') S.setMasterVolume(slider.value / 100);
        else S.setBusVolume(bus, slider.value / 100);
    }
}

/* --- LOGIQUE JEU & UI --- */

        // Gestion Paramètres
        sessionStorage.setItem('immersionMode', 'immersif'); // Toujours en mode ECOS/Immersif unifié

        const settingsBtn = document.getElementById('settings-button');
        const modal = document.getElementById('settings-modal');
        const closeBtn = document.getElementById('settings-close-icon');
        const saveBtn = document.getElementById('settings-save');

        const openModal = async () => {
            modal.classList.add('active');
            const isPractice = localStorage.getItem('ecos_practice_mode') !== 'false';
            const radio = document.querySelector(`input[name="gamePlayMode"][value="${isPractice ? 'practice' : 'exam'}"]`);
            if (radio) radio.checked = true;

            const ecosSection = document.getElementById('ecos-settings-section');
            if (ecosSection) ecosSection.style.display = 'block';

            document.getElementById('ecos-setting-feedback').checked = localStorage.getItem('ecos_llm_feedback') !== 'false';
            document.getElementById('ecos-setting-duration').value = localStorage.getItem('ecos_duration') || '480';
            document.getElementById('setting-sound-toggle').checked = !isAudioMuted();
            document.getElementById('setting-view-mode-toggle').checked = localStorage.getItem('medgame_text_mode_default') !== 'true';
            document.getElementById('setting-calm-toggle').checked = localStorage.getItem('medgame_calm_mode') === 'true';
            initAudioMixerUI();
            const llmToggle = document.getElementById('setting-llm-mode');
            if (llmToggle) llmToggle.checked = (localStorage.getItem('medgame_llm_mode') ?? 'true') !== 'false';

            const usernameInput = document.getElementById('setting-username');
            const usernameStatus = document.getElementById('username-status');

            // État par défaut
            usernameInput.disabled = true;
            usernameInput.value = "Chargement...";

            // Charger les données du profil depuis Supabase
            if (typeof supabase !== 'undefined') {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('username, is_public, username_updated_at, rank, rank_updated_at, sexe')
                        .eq('id', session.user.id)
                        .single();

                    if (!error && data) {
                        document.getElementById('setting-public-toggle').checked = data.is_public;
                        document.getElementById('setting-sexe').value = data.sexe || 'M';

                        // Gestion du pseudonyme
                        const defaultPseudo = session.user.email.substring(0, 3) + '***';
                        const currentUsername = data.username || defaultPseudo;
                        usernameInput.value = currentUsername;

                        // Vérifier la date du dernier changement (1 semaine = 7 jours)
                        const lastUpdate = data.username_updated_at ? new Date(data.username_updated_at) : null;
                        const now = new Date();
                        const offset = 7 * 24 * 60 * 60 * 1000; // 7 jours en ms

                        if (!lastUpdate || (now - lastUpdate) > offset) {
                            usernameInput.disabled = false;
                            usernameStatus.innerHTML = '<i class="fas fa-pen"></i> Changement dispo';
                            usernameStatus.style.color = 'rgba(255, 255, 255, 0.5)';
                        } else {
                            const nextUpdate = new Date(lastUpdate.getTime() + offset);
                            const diffDays = Math.ceil((nextUpdate - now) / (24 * 60 * 60 * 1000));
                            usernameInput.disabled = true;
                            usernameStatus.innerHTML = `<i class="fas fa-lock"></i> Bloqué (${diffDays}j)`;
                            usernameStatus.style.color = 'rgba(255, 255, 255, 0.3)';
                        }

                        // Gestion du rang (modifiable 1x/an = 365 jours)
                        const rankSelect = document.getElementById('setting-rank');
                        const rankStatus = document.getElementById('rank-status');
                        rankSelect.value = data.rank || 'DFGSM3';
                        rankSelect.disabled = true;

                        const lastRankUpdate = data.rank_updated_at ? new Date(data.rank_updated_at) : null;
                        const yearOffset = 365 * 24 * 60 * 60 * 1000;

                        if (!lastRankUpdate || (now - lastRankUpdate) > yearOffset) {
                            rankSelect.disabled = false;
                            rankStatus.innerHTML = '<i class="fas fa-pen"></i> Changement dispo';
                            rankStatus.style.color = 'rgba(255, 255, 255, 0.5)';
                        } else {
                            const nextRankUpdate = new Date(lastRankUpdate.getTime() + yearOffset);
                            const diffMonths = Math.ceil((nextRankUpdate - now) / (30 * 24 * 60 * 60 * 1000));
                            rankSelect.disabled = true;
                            rankStatus.innerHTML = `<i class="fas fa-lock"></i> Bloqué (${diffMonths} mois)`;
                            rankStatus.style.color = 'rgba(255, 255, 255, 0.3)';
                        }
                    } else if (error) {
                        console.error("Erreur chargement profil:", error);
                        usernameInput.value = session.user.email.split('@')[0];
                        usernameInput.disabled = false;
                        
                        const savedProfile = localStorage.getItem('medgame_profile') ? JSON.parse(localStorage.getItem('medgame_profile')) : {};
                        document.getElementById('setting-sexe').value = savedProfile.sexe || 'M';
                    }
                }
            } else {
                // Fallback local storage
                const savedProfile = localStorage.getItem('medgame_profile') ? JSON.parse(localStorage.getItem('medgame_profile')) : {};
                usernameInput.value = savedProfile.username || 'Médecin';
                usernameInput.disabled = false;
                document.getElementById('setting-sexe').value = savedProfile.sexe || 'M';
            }
        };
        const closeModal = () => modal.classList.remove('active');

        const saveSettings = async () => {
            const saveBtn = document.getElementById('settings-save');
            const originalText = saveBtn.textContent;
            saveBtn.disabled = true;
            saveBtn.textContent = "Sabre au clair...";

            const selectedPlayMode = document.querySelector('input[name="gamePlayMode"]:checked')?.value || 'practice';
            const ecosPractice = selectedPlayMode === 'practice';
            sessionStorage.setItem('immersionMode', 'immersif'); // Toujours en mode ECOS/Immersif unifié

            const ecosFeedback = document.getElementById('ecos-setting-feedback').checked;
            const ecosDuration = document.getElementById('ecos-setting-duration').value || '480';
            const soundEnabled = document.getElementById('setting-sound-toggle').checked;
            const defaultTo3D = document.getElementById('setting-view-mode-toggle').checked;
            const calmEnabled = document.getElementById('setting-calm-toggle').checked;

            localStorage.setItem('ecos_practice_mode', ecosPractice ? 'true' : 'false');
            localStorage.setItem('ecos_llm_feedback', ecosFeedback);
            localStorage.setItem('ecos_duration', ecosDuration);
            applyAudioMixerUI();
            // Le socle EST la source de vérité du mute. On ne réécrit plus la
            // clé plate `medgame.audio.muted` : elle n'est lue qu'une fois,
            // pour migrer les réglages d'un joueur existant.
            if (window.MedGameSound) window.MedGameSound.setMuted(!soundEnabled);
            localStorage.setItem('medgame_text_mode_default', defaultTo3D ? 'false' : 'true');
            if (!defaultTo3D) sessionStorage.removeItem('use3D');
            localStorage.setItem('medgame_calm_mode', calmEnabled ? 'true' : 'false');
            const llmModeEnabled = document.getElementById('setting-llm-mode') ? document.getElementById('setting-llm-mode').checked : true;
            localStorage.setItem('medgame_llm_mode', llmModeEnabled ? 'true' : 'false');

            const newUsername = document.getElementById('setting-username').value.trim();
            const isPublic = document.getElementById('setting-public-toggle').checked;

            if (typeof supabase !== 'undefined') {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const updateData = { is_public: isPublic };

                    // N'ajouter le username que s'il a changé et n'est pas vide et que l'input n'est pas disabled
                    const usernameInput = document.getElementById('setting-username');
                    if (!usernameInput.disabled && newUsername && newUsername.length >= 3) {

                        // --- VÉRIFICATION MOTS INTERDITS ---
                        const { data: bannedWords, error: bannedErr } = await supabase
                            .from('banned_usernames')
                            .select('word');

                        if (!bannedErr && bannedWords) {
                            const newUsernameLower = newUsername.toLowerCase();
                            const isBanned = bannedWords.some(bw => newUsernameLower.includes(bw.word.toLowerCase()));
                            if (isBanned) {
                                alert("Ce pseudonyme contient un mot interdit et ne peut pas être utilisé.");
                                saveBtn.textContent = originalText;
                                saveBtn.disabled = false;
                                return; // Stoppe la sauvegarde
                            }
                        }
                        // ------------------------------------

                        updateData.username = newUsername;
                        updateData.username_updated_at = new Date().toISOString();
                    }

                    // N'ajouter le rang que s'il a changé et que le select n'est pas disabled
                    const rankSelect = document.getElementById('setting-rank');
                    if (!rankSelect.disabled) {
                        updateData.rank = rankSelect.value;
                        updateData.rank_updated_at = new Date().toISOString();
                    }

                    // Sexe
                    const selectedSexe = document.getElementById('setting-sexe').value;
                    updateData.sexe = selectedSexe;

                    // Sauvegarder localement dans medgame_profile pour un accès rapide
                    try {
                        const savedProfile = localStorage.getItem('medgame_profile') ? JSON.parse(localStorage.getItem('medgame_profile')) : {};
                        savedProfile.sexe = selectedSexe;
                        if (!document.getElementById('setting-username').disabled && newUsername) {
                            savedProfile.username = newUsername;
                        }
                        if (updateData.rank) {
                            savedProfile.rank = updateData.rank;
                        }
                        localStorage.setItem('medgame_profile', JSON.stringify(savedProfile));
                    } catch (e) {}

                    const { error } = await supabase
                        .from('profiles')
                        .update(updateData)
                        .eq('id', session.user.id);

                    if (error) {
                        console.error("Erreur sauvegarde réglages:", error);
                        alert("Erreur lors de la sauvegarde : " + error.message);
                    } else {
                        if (window.loadLeaderboard) window.loadLeaderboard();
                        // Mettre à jour le badge si besoin
                        const topUsername = document.getElementById('top-username');
                        if (topUsername && newUsername) {
                            // On garde le rang et l'xp
                            const currentBadgeHtml = topUsername.innerHTML;
                            const badgeParts = currentBadgeHtml.split('<span');
                            topUsername.innerHTML = `${newUsername} <span${badgeParts[1]}`;
                        }
                    }
                }
            }

            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
            closeModal();
        };

        settingsBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);
        saveBtn.addEventListener('click', saveSettings);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        // Escape key closes settings modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeModal();
            }
        });

        // Listen for escape key or other exit methods
        document.addEventListener('fullscreenchange', () => {
            // Logic removed for index.html
        });



        // Lancer un cas d'essai en 1 clic sans inscription
        function startQuickTest() {
            localStorage.setItem('selectedCaseFile', 'cardio_douleur_thoracique_mme_bennet.json');
            transitionTo('game.html?case=cardio_douleur_thoracique_mme_bennet.json');
        }

        /* ── Transition de page : warp 3D + voile radial + fade ── */
        let _transitioning = false;
        function transitionTo(url) {
            if (_transitioning) return;
            _transitioning = true;
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
            const veil = document.getElementById('page-veil');
            if (veil) {
                veil.style.setProperty('--vx', (window._lastPointer?.x ?? 50) + '%');
                veil.style.setProperty('--vy', (window._lastPointer?.y ?? 50) + '%');
                veil.classList.add('active');
            }
            if (window.ThreeBackground && typeof window.ThreeBackground.warp === 'function') {
                window.ThreeBackground.warp();
            }
            const card = document.getElementById('main-card');
            if (card) {
                card.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.5s ease';
                card.style.transform = 'scale(0.92) translateZ(-80px)';
                card.style.opacity = '0';
            }
            document.body.style.transition = 'opacity 0.5s ease 0.15s';
            document.body.style.opacity = 0;
            setTimeout(() => window.location.href = url, 600);
        }

        /* ── Tilt 3D + reflet interactif (rAF, desktop) ── */
        (() => {
            const card = document.getElementById('main-card');
            if (!card) return;
            const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

            document.addEventListener('mousemove', (e) => {
                window._lastPointer = { x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 };
                if (!finePointer || reduced || _transitioning) return;
                const r = card.getBoundingClientRect();
                const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
                const k = inside ? 8 : 3;
                tx = ((e.clientY - (r.top + r.height / 2)) / r.height) * -k;
                ty = ((e.clientX - (r.left + r.width / 2)) / r.width) * k;
                card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
                card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
                if (!raf) raf = requestAnimationFrame(tick);
            }, { passive: true });

            function tick() {
                cx += (tx - cx) * 0.12;
                cy += (ty - cy) * 0.12;
                card.style.transform = `rotateX(${cx.toFixed(2)}deg) rotateY(${cy.toFixed(2)}deg)`;
                if (Math.abs(tx - cx) > 0.02 || Math.abs(ty - cy) > 0.02) {
                    raf = requestAnimationFrame(tick);
                } else {
                    raf = null;
                }
            }

            document.addEventListener('mouseleave', () => {
                tx = 0;
                ty = 0;
                if (!raf) raf = requestAnimationFrame(tick);
            });
        })();

        /* ── Battement cardiaque synchronisé 3D -> UI ── */
        window.addEventListener('medgame:heartbeat', () => {
            const icon = document.querySelector('.icon-pulse');
            if (icon) {
                icon.classList.remove('beat');
                void icon.offsetWidth;
                icon.classList.add('beat');
            }
        });
