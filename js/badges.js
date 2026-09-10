/**
 * js/badges.js — Système de badges partagé (définitions + déblocage persistant)
 *
 * - Source unique des définitions de badges (consommée par profile.js)
 * - Déblocage persisté (localStorage 'medgame_unlocked_badges', avec date)
 * - Notification en jeu au moment du déblocage (toast doré)
 */
const BadgeSystem = (() => {
    const STORE_KEY = 'medgame_unlocked_badges';

    /**
     * Définitions des badges.
     * @param {Array} sessions — historique de sessions [{case_id, score, mode, ...}]
     * @param {Object|null} profile — profil distant (total_xp, top_10_streak…)
     */
    function getDefinitions(sessions, profile) {
        const lvl = (xp) => (!xp || xp <= 0) ? 1 : Math.floor(Math.pow(xp / 150, 2 / 3)) + 1;
        return [
            // Progression
            { id: 'first_case', name: 'Première Garde', desc: 'Terminer votre premier cas clinique', icon: 'fa-user-md', color: '#4facfe', condition: () => sessions.length >= 1 },
            { id: 'ten_cases', name: 'Semaine de Garde', desc: 'Terminer 10 cas cliniques', icon: 'fa-star', color: '#00f2fe', condition: () => sessions.length >= 10 },
            { id: 'fifty_cases', name: 'Mois de Garde', desc: 'Terminer 50 cas cliniques', icon: 'fa-hospital', color: '#ffd700', condition: () => sessions.length >= 50 },
            { id: 'hundred_cases', name: 'Vétéran de Bichat', desc: 'Terminer 100 cas cliniques', icon: 'fa-shield-heart', color: '#ff4757', condition: () => sessions.length >= 100 },

            // Performance
            { id: 'perfect_score', name: 'Diagnostic Précis', desc: 'Obtenir un score > 90%', icon: 'fa-bolt', color: '#f9d423', condition: () => sessions.some(s => s.score >= 90) },
            { id: 'major', name: 'Major de Promo', desc: '3 cas consécutifs avec > 90%', icon: 'fa-graduation-cap', color: '#ff9a9e', condition: () => {
                if (sessions.length < 3) return false;
                for (let i = 0; i <= sessions.length - 3; i++) {
                    if (sessions[i].score >= 90 && sessions[i+1].score >= 90 && sessions[i+2].score >= 90) return true;
                }
                return false;
            }},
            { id: 'sans_faute', name: 'Sans Faute', desc: 'Obtenir 100% de précision', icon: 'fa-check-double', color: '#2ecc71', condition: () => sessions.some(s => s.score === 100) },

            // Spécialités
            { id: 'cardio_expert', name: 'Cardiologue', desc: 'Maîtriser 5 cas de cardiologie', icon: 'fa-heart', color: '#ff4757', condition: () => sessions.filter(s => s.case_id?.toLowerCase().includes('cardio')).length >= 5 },
            { id: 'neuro_expert', name: 'Neurologue', desc: 'Maîtriser 5 cas de neurologie', icon: 'fa-brain', color: '#a29bfe', condition: () => sessions.filter(s => s.case_id?.toLowerCase().includes('neuro')).length >= 5 },
            { id: 'urgentiste', name: 'Urgentiste', desc: 'Maîtriser 5 cas d\'urgence', icon: 'fa-ambulance', color: '#ff7f50', condition: () => sessions.filter(s => s.case_id?.toLowerCase().includes('urgence')).length >= 5 },
            { id: 'gastro_expert', name: 'Gastrologue', desc: 'Maîtriser 5 cas digestifs', icon: 'fa-pills', color: '#ff9ff3', condition: () => sessions.filter(s => s.case_id?.toLowerCase().includes('digestif')).length >= 5 },
            { id: 'nephro_expert', name: 'Néphrologue', desc: 'Maîtriser 3 cas de néphrologie', icon: 'fa-vials', iconClass: 'fas', color: '#74b9ff', condition: () => sessions.filter(s => s.case_id?.toLowerCase().includes('nephro')).length >= 3 },
            { id: 'polyvalent', name: 'Interne Polyvalent', desc: 'Jouer dans 3 spécialités différentes', icon: 'fa-stethoscope', color: '#55efc4', condition: () => {
                const cats = ['cardio', 'neuro', 'urgence', 'digestif', 'nephro', 'pneumo', 'uro'];
                const found = cats.filter(c => sessions.some(s => s.case_id?.toLowerCase().includes(c)));
                return found.length >= 3;
            }},

            // Skill Lab (ECG, Auscultation & Gaz du Sang)
            { id: 'ecg_cadet', name: 'Lecteur d\'ECG', desc: 'Valider 3 tracés dans l\'ECG Academy', icon: 'fa-heart-pulse', color: '#ff7675', condition: () => (_getSkillStats().ecgCompleted || 0) >= 3, progress: () => `${_getSkillStats().ecgCompleted || 0}/3 tracés` },
            { id: 'ecg_expert', name: 'Rythmologue de Bichat', desc: 'Obtenir ≥ 80% au Test ECG 12 Dérivations', icon: 'fa-wave-square', color: '#00f2fe', condition: () => (_getSkillStats().ecgHighScore || 0) >= 80, progress: () => `${_getSkillStats().ecgHighScore || 0}% / 80%` },
            { id: 'ecg_master', name: 'Maître de l\'Électrode', desc: 'Réaliser un sans-faute (100%) au Test ECG', icon: 'fa-bolt-lightning', color: '#f9ca24', condition: () => (_getSkillStats().ecgHighScore || 0) >= 100 },
            { id: 'auscult_cadet', name: 'Oreille Médicale', desc: 'Valider 3 cas au Stéthoscope Lab', icon: 'fa-headphones', color: '#a29bfe', condition: () => (_getSkillStats().auscultCompleted || 0) >= 3, progress: () => `${_getSkillStats().auscultCompleted || 0}/3 cas` },
            { id: 'auscult_expert', name: 'Stéthoscope d\'Or', desc: 'Obtenir ≥ 80% au Test d\'Auscultation à l\'aveugle', icon: 'fa-lungs', color: '#55efc4', condition: () => (_getSkillStats().auscultHighScore || 0) >= 80, progress: () => `${_getSkillStats().auscultHighScore || 0}% / 80%` },
            { id: 'auscult_master', name: 'Grand Clinicien', desc: 'Réaliser un sans-faute (100%) au Test d\'Auscultation', icon: 'fa-medal', color: '#ffd700', condition: () => (_getSkillStats().auscultHighScore || 0) >= 100 },
            { id: 'gds_cadet', name: 'Analyste des Gaz', desc: 'Valider 3 cas de gazométrie artérielle', icon: 'fa-vial', color: '#00f2fe', condition: () => (_getSkillStats().gdsCompleted || 0) >= 3, progress: () => `${_getSkillStats().gdsCompleted || 0}/3 cas` },
            { id: 'gds_expert', name: 'Maître de Davenport', desc: 'Obtenir ≥ 80% au Quiz Gaz du Sang EDN', icon: 'fa-sliders-h', color: '#ffd700', condition: () => (_getSkillStats().gdsHighScore || 0) >= 80, progress: () => `${_getSkillStats().gdsHighScore || 0}% / 80%` },
            { id: 'gds_master', name: 'Réanimateur d\'Élite', desc: 'Réaliser un sans-faute (100%) au Quiz Gaz du Sang', icon: 'fa-shield-heart', color: '#ff4757', condition: () => (_getSkillStats().gdsHighScore || 0) >= 100 },
            { id: 'skill_master', name: 'Major du Skill Lab', desc: 'Exceller dans les 3 modules (ECG, Auscultation & Gaz du Sang)', icon: 'fa-certificate', color: '#fd79a8', condition: () => {
                const s = _getSkillStats();
                return (s.ecgCompleted >= 3) && (s.ecgHighScore >= 80) && (s.auscultCompleted >= 3) && (s.auscultHighScore >= 80) && (s.gdsCompleted >= 3) && (s.gdsHighScore >= 80);
            }},

            // Compétition
            { id: 'arena_gladiator', name: 'Gladiateur de l\'Arène', desc: 'Participer à une compétition de QCM (Arena)', icon: 'fa-broadcast-tower', color: '#00f2fe', condition: () => sessions.some(s => s.mode === 'arena') },

            // Social / Engagement
            { id: 'public_profile', name: 'Célébrité de Bichat', desc: 'Être dans le Top 10 public pendant 14 jours consécutifs', icon: 'fa-crown', color: '#ffd700',
              condition: () => (profile?.top_10_streak || 0) >= 14,
              progress: () => `${profile?.top_10_streak || 0}/14 jours` },
            { id: 'contributor', name: 'Maître de Stage', desc: 'Atteindre le niveau 2', icon: 'fa-edit', color: '#74b9ff', condition: () => lvl(profile?.total_xp || 0) >= 2 },
            { id: 'legend', name: 'Légende de Bichat', desc: 'Atteindre le niveau 10', icon: 'fa-trophy', color: '#ffd700', condition: () => lvl(profile?.total_xp || 0) >= 10 },
            { id: 'immortal', name: 'Doyen de la Faculté', desc: 'Atteindre le niveau 20', icon: 'fa-medal', color: '#fdcb6e', condition: () => lvl(profile?.total_xp || 0) >= 20 }
        ];
    }

    const SKILL_KEY = 'medgame_skill_stats';

    function _getSkillStats() {
        try {
            return JSON.parse(localStorage.getItem(SKILL_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function _saveSkillStats(stats) {
        try {
            localStorage.setItem(SKILL_KEY, JSON.stringify(stats));
        } catch (e) {}
    }

    /**
     * Enregistre une activité du Skill Lab et déclenche l'évaluation des badges.
     * @param {'ecg'|'auscultation'} type
     * @param {number} score - Pourcentage (0-100)
     */
    function recordSkillActivity(type, score = 100) {
        const stats = _getSkillStats();
        if (type === 'ecg') {
            stats.ecgCompleted = (stats.ecgCompleted || 0) + 1;
            stats.ecgHighScore = Math.max(stats.ecgHighScore || 0, score);
            if (score === 100) stats.ecgPerfectCount = (stats.ecgPerfectCount || 0) + 1;
        } else if (type === 'auscultation') {
            stats.auscultCompleted = (stats.auscultCompleted || 0) + 1;
            stats.auscultHighScore = Math.max(stats.auscultHighScore || 0, score);
            if (score === 100) stats.auscultPerfectCount = (stats.auscultPerfectCount || 0) + 1;
        } else if (type === 'gds') {
            stats.gdsCompleted = (stats.gdsCompleted || 0) + 1;
            stats.gdsHighScore = Math.max(stats.gdsHighScore || 0, score);
            if (score === 100) stats.gdsPerfectCount = (stats.gdsPerfectCount || 0) + 1;
        }
        _saveSkillStats(stats);
        
        // Évaluer et persister les badges
        const fresh = evaluateAndPersist([], null);
        if (fresh.length > 0) {
            notifyNewBadges(fresh);
        }
        return { stats, fresh };
    }

    function _getStore() {
        try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; }
    }

    function _saveStore(store) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
    }

    /** Map id → { unlockedAt } des badges déjà obtenus */
    function getUnlocked() {
        return _getStore();
    }

    /**
     * Évalue les conditions et PERSISTE les nouveaux déblocages.
     * @param {Array} sessions — historique disponible côté client
     * @param {Object|null} profile
     * @returns {Array} définitions des badges NOUVELLEMENT débloqués
     */
    function evaluateAndPersist(sessions, profile = null) {
        const store = _getStore();
        const fresh = [];
        getDefinitions(sessions || [], profile).forEach(def => {
            if (store[def.id]) return;
            let ok = false;
            try { ok = !!def.condition(); } catch (e) { ok = false; }
            if (ok) {
                store[def.id] = { unlockedAt: new Date().toISOString() };
                fresh.push(def);
            }
        });
        if (fresh.length > 0) _saveStore(store);
        return fresh;
    }

    /** Toast doré pour chaque badge fraîchement débloqué. */
    function notifyNewBadges(fresh) {
        (fresh || []).forEach((def, i) => {
            setTimeout(() => {
                if (typeof showNotification === 'function') {
                    showNotification(`🏅 Badge débloqué : ${def.name} — ${def.desc}`, 'success');
                }
                if (typeof MedGameAudio !== 'undefined') {
                    try { MedGameAudio.play('success'); } catch (e) {}
                }
            }, 1200 + i * 1800);
        });
    }

    window.BadgeSystem = {
        getDefinitions,
        evaluateAndPersist,
        notifyNewBadges,
        getUnlocked,
        getSkillStats: _getSkillStats,
        recordSkillActivity
    };
    return window.BadgeSystem;
})();
