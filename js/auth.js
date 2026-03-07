document.addEventListener('DOMContentLoaded', () => {
    // Éléments du DOM (sur login.html)
    const authForm = document.getElementById('auth-form');
    const toggleModBtn = document.getElementById('toggle-mod-btn');
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const formSubtitle = document.getElementById('form-subtitle');
    const errorTarget = document.getElementById('auth-error');
    const successTarget = document.getElementById('auth-success');
    const roleGroup = document.getElementById('role-group');

    let isLoginMode = true; // true = Connexion, false = Création de compte

    // ----- LOGIGUE DE LOGIN.HTML -----
    if (authForm) {
        // Rediriger l'utilisateur s'il est déjà connecté
        checkAndRedirectIfLoggedIn();

        // Basculer entre Connexion et Inscription
        toggleModBtn.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            errorTarget.style.display = 'none';
            successTarget.style.display = 'none';

            if (isLoginMode) {
                submitText.innerHTML = '<i class="fas fa-sign-in-alt"></i> Se connecter';
                toggleModBtn.innerHTML = '<span class="btn-content"><i class="fas fa-user-plus"></i> Créer un compte</span><div class="btn-layer"></div>';
                formSubtitle.textContent = "Accès Étudiant / Médecin";
                document.querySelector('.glitch-title').setAttribute('data-text', 'CONNEXION');
                document.querySelector('.glitch-title').textContent = 'CONNEXION';
                if (roleGroup) roleGroup.style.display = 'none';
            } else {
                submitText.innerHTML = '<i class="fas fa-user-plus"></i> S\'inscrire';
                toggleModBtn.innerHTML = '<span class="btn-content"><i class="fas fa-sign-in-alt"></i> J\'ai déjà un compte</span><div class="btn-layer"></div>';
                formSubtitle.textContent = "Rejoindre le Staff de Bichat";
                document.querySelector('.glitch-title').setAttribute('data-text', 'INSCRIPTION');
                document.querySelector('.glitch-title').textContent = 'INSCRIPTION';
                if (roleGroup) roleGroup.style.display = 'block';
            }
        });

        // Soumission du formulaire
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            // UI Loading state
            const originalIcon = isLoginMode ? '<i class="fas fa-sign-in-alt"></i>' : '<i class="fas fa-user-plus"></i>';
            const originalText = isLoginMode ? ' Se connecter' : ' S\'inscrire';
            submitText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Chargement...';
            submitBtn.disabled = true;
            errorTarget.style.display = 'none';
            successTarget.style.display = 'none';

            try {
                if (isLoginMode) {
                    // CONNEXION
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: email,
                        password: password,
                    });

                    if (error) throw error;

                    // Succès Connexion
                    successTarget.textContent = "Connexion réussie ! Redirection...";
                    successTarget.style.display = 'block';
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 1000);

                } else {
                    // INSCRIPTION
                    const selectedRank = document.querySelector('input[name="rank"]:checked')?.value || 'Autre';

                    const { data, error } = await supabase.auth.signUp({
                        email: email,
                        password: password,
                        options: {
                            data: {
                                rank: selectedRank
                            }
                        }
                    });

                    if (error) throw error;

                    if (data.user && data.session === null) {
                        // Inscription réussie mais confirmation d'email requise (si activé dans Supabase)
                        successTarget.textContent = "Compte créé ! Veuillez vérifier vos emails pour confirmer votre adresse.";
                        successTarget.style.display = 'block';
                    } else {
                        // Mettre à jour manuellement le profil au cas où le trigger n'aurait pas tout pris
                        if (data.user) {
                            await supabase
                                .from('profiles')
                                .update({ rank: selectedRank })
                                .eq('id', data.user.id);
                        }

                        // Inscription réussie et connexion automatique
                        successTarget.textContent = "Inscription réussie ! Bienvenue.";
                        successTarget.style.display = 'block';
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 1000);
                    }
                }
            } catch (err) {
                console.error("Auth error:", err);
                errorTarget.textContent = err.message || "Une erreur est survenue.";
                if (err.message.includes("Invalid login credentials")) {
                    errorTarget.textContent = "Email ou mot de passe incorrect.";
                } else if (err.message.includes("User already registered")) {
                    errorTarget.textContent = "Cet email est déjà utilisé.";
                } else if (err.message.includes("Password should be at least")) {
                    errorTarget.textContent = "Le mot de passe doit faire au moins 6 caractères.";
                }
                errorTarget.style.display = 'block';
            } finally {
                // Restore UI
                submitText.innerHTML = originalIcon + originalText;
                submitBtn.disabled = false;
            }
        });
    }
});

// ----- FONCTIONS GLOBALES D'AUTHENTIFICATION -----

// Redirige vers index.html si l'utilisateur est déjà connecté et essaie d'accéder à login.html
async function checkAndRedirectIfLoggedIn() {
    if (typeof supabase === 'undefined') return;

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'index.html';
    }
}

// Vérifie si l'utilisateur a le rôle admin
window.isAdmin = async function () {
    if (typeof supabase === 'undefined') return false;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (error || !data) return false;
    return data.role === 'admin';
}

// Vérifie si l'utilisateur est connecté. Sinon, redirige vers login.html.
// À inclure au début des scripts sensibles (game.js, editor.js, themes.js)
window.requireAuth = async function (redirectUrl = 'login.html', requireAdmin = false) {
    if (typeof supabase === 'undefined') {
        console.warn("Supabase not initialized, skipping auth check.");
        return null;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        console.log("Accès refusé. Redirection vers la page de connexion.");
        // Utiliser sessionStorage pour rediriger l'utilisateur vers la page qu'il voulait après login
        sessionStorage.setItem('redirectAfterLogin', window.location.href);
        window.location.href = redirectUrl;
        return null;
    }

    if (requireAdmin) {
        const isUserAdmin = await window.isAdmin();
        if (!isUserAdmin) {
            console.log("Accès refusé: Administrateur requis.");
            window.location.href = 'index.html';
            return null;
        }
    }

    return session.user;
}

// Fonction utilitaire pour se déconnecter
window.logoutUser = async function () {
    if (typeof supabase !== 'undefined') {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Erreur lors de la déconnexion:", error.message);
        } else {
            window.location.href = 'index.html';
        }
    }
}
