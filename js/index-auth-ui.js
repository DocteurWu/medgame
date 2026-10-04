/* js/index-auth-ui.js - mise a jour de l'UI d'authentification (extrait de index.html) */

// Check session to update Auth UI on index
        document.addEventListener('DOMContentLoaded', async () => {
            if (typeof supabase !== 'undefined') {
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    // --- Utilisateur CONNECTÉ ---

                    // Cacher la section auth et les éléments réservés aux invités, montrer les boutons auth-only
                    document.getElementById('auth-section').style.display = 'none';
                    document.querySelectorAll('.guest-only').forEach(el => {
                        el.style.display = 'none';
                    });

                    document.querySelectorAll('.auth-only').forEach(el => {
                        el.style.display = '';
                    });

                    // Afficher le classement
                    const lb = document.getElementById('leaderboard');
                    if (lb) {
                        lb.style.display = 'flex';
                        if (window.loadLeaderboard) window.loadLeaderboard();
                    }

                    // Fetch profile info
                    const defaultPseudo = session.user.email.substring(0, 3) + '***';
                    let displayedUsername = defaultPseudo;
                    let niveau = 1;
                    let xpText = '0 XP';
                    let rankText = 'Niv. 1';

                    // Helper: calcule le niveau depuis le XP total (XP_requis = 150 * Niveau^1.5)
                    function calculateLevel(xp) {
                        if (!xp || xp <= 0) return 1;
                        return Math.floor(Math.pow(xp / 150, 2 / 3)) + 1;
                    }

                    try {
                        const localXp = typeof getLocalXp === 'function' ? getLocalXp() : 0;
                        const { data: profile, error } = await supabase
                            .from('profiles')
                            .select('username, total_xp, rank')
                            .eq('id', session.user.id)
                            .maybeSingle();

                        if (!error && profile) {
                            if (profile.username) displayedUsername = profile.username;
                            const totalXp = Math.max(profile.total_xp || 0, localXp);
                            if (typeof setLocalXp === 'function') setLocalXp(totalXp);
                            niveau = calculateLevel(totalXp);
                            xpText = `${totalXp} XP`;
                            rankText = `Niv. ${niveau} ${profile.rank ? '· ' + profile.rank : ''}`;
                        } else {
                            niveau = calculateLevel(localXp);
                            xpText = `${localXp} XP`;
                            rankText = `Niv. ${niveau}`;
                        }
                    } catch (err) {
                        console.error("Erreur chargement profil:", err);
                    }

                    // Badge haut droit
                    const badge = document.getElementById('user-badge-top');
                    badge.style.display = 'flex';
                    document.getElementById('top-username').innerHTML =
                        `${displayedUsername} <span style="font-size:0.75em;opacity:0.75;margin-left:6px;background:rgba(0,242,254,0.18);padding:2px 7px;border-radius:20px;font-weight:400;">${rankText} • ${xpText}</span>`;

                    const isAdminUser = await window.isAdmin();

                    // Vérifier si Admin
                    if (isAdminUser) {
                        const adminBtn = document.getElementById('admin-button');
                        if (adminBtn) adminBtn.style.display = 'flex';
                    }

                    // Gérer le bouton Éditeur (Niveau 2 requis)
                    const editorBtn = document.getElementById('editor-button');
                    if (editorBtn) {
                        if (niveau >= 2 || isAdminUser) {
                            // Laisser le comportement interactif/visuel par défaut
                        } else {
                            // Verrouiller
                            editorBtn.onclick = () => alert("Le mode Création de Cas est débloqué à partir du Niveau 2 ! Jouez quelques cas pour gagner de l'XP.");
                            const contentSpan = editorBtn.querySelector('.btn-content');
                            if (contentSpan) contentSpan.innerHTML = '<i class="fas fa-lock"></i> Créer /Améliorer un Cas (Niv. 2)';
                            const btnLayer = editorBtn.querySelector('.btn-layer');
                            if (btnLayer) btnLayer.style.background = 'rgba(255,255,255,0.05)';
                            editorBtn.style.opacity = '0.6';
                        }
                    }

                } else {
                    // --- Utilisateur NON connecté ---
                    document.querySelectorAll('.guest-only').forEach(el => {
                        el.style.display = '';
                    });
                    document.getElementById('user-badge-top').style.display = 'none';
                }
            }
        });
