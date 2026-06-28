/**
 * ecos-stats.js — Statistiques du mode ECOS
 * 
 * Agrège les sessions ECOS depuis :
 *   - localStorage ('ecos_sessions')
 *   - Supabase (play_sessions avec stats.mode === 'ecos')
 * 
 * Exposé en window.EcosStats pour utilisation dans index.html et profile.html
 */

const EcosStats = {
    /**
     * Récupère toutes les sessions ECOS depuis localStorage.
     * @returns {Array<Object>} Liste des sessions triées par timestamp décroissant
     */
    getLocalSessions() {
        try {
            const raw = localStorage.getItem('ecos_sessions');
            const parsed = JSON.parse(raw || '[]');
            return Array.isArray(parsed) ? parsed.sort((a, b) => (b.ts || 0) - (a.ts || 0)) : [];
        } catch (e) {
            console.warn('[EcosStats] Erreur lecture localStorage:', e);
            return [];
        }
    },

    /**
     * Calcule les statistiques agrégées depuis les sessions locales.
     * @returns {Object} Objet de stats
     */
    computeLocalStats() {
        const sessions = this.getLocalSessions();
        if (sessions.length === 0) {
            return {
                total: 0,
                avgScore: 0,
                avgAptitude: 0,
                avgComm: 0,
                avgDiag: 0,
                bestScore: 0,
                casesPlayed: [],
                recentSessions: []
            };
        }

        const total = sessions.length;
        const avgScore = Math.round(sessions.reduce((s, sess) => s + (sess.score || 0), 0) / total);
        const avgAptitude = Math.round(sessions.reduce((s, sess) => s + (sess.aptitudePct || 0), 0) / total);
        const avgComm = Math.round(sessions.reduce((s, sess) => s + (sess.commPct || 0), 0) / total);
        const avgDiag = Math.round(sessions.reduce((s, sess) => s + (sess.diagScore || 0), 0) / total);
        const bestScore = Math.max(...sessions.map(s => s.score || 0));

        // Cas uniques joués
        const casesPlayed = [...new Set(sessions.map(s => s.case_id).filter(Boolean))];

        // 5 sessions les plus récentes
        const recentSessions = sessions.slice(0, 5);

        return { total, avgScore, avgAptitude, avgComm, avgDiag, bestScore, casesPlayed, recentSessions };
    },

    /**
     * Récupère les statistiques ECOS depuis Supabase pour l'utilisateur courant.
     * @returns {Promise<Object>} Objet de stats
     */
    async fetchSupabaseStats() {
        if (typeof supabase === 'undefined') return null;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('play_sessions')
                .select('score, stats, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error || !data) return null;

            // Filtrer les sessions ECOS (où stats.mode === 'ecos')
            const ecosSessions = data.filter(row => row.stats?.mode === 'ecos');
            if (ecosSessions.length === 0) return null;

            const total = ecosSessions.length;
            const avgScore = Math.round(ecosSessions.reduce((s, r) => s + (r.score || 0), 0) / total);
            const bestScore = Math.max(...ecosSessions.map(r => r.score || 0));
            const casesPlayed = [...new Set(ecosSessions.map(r => r.stats?.case_id).filter(Boolean))];

            return { total, avgScore, bestScore, casesPlayed, source: 'supabase' };
        } catch (e) {
            console.warn('[EcosStats] Erreur Supabase:', e);
            return null;
        }
    },

    /**
     * Récupère et fusionne les statistiques depuis localStorage + Supabase.
     * @returns {Promise<Object>}
     */
    async getStats() {
        const local = this.computeLocalStats();
        const remote = await this.fetchSupabaseStats();

        if (!remote) return { ...local, source: 'local' };

        // Fusionner en préférant les données Supabase pour les totaux
        return {
            total: Math.max(local.total, remote.total),
            avgScore: remote.avgScore || local.avgScore,
            avgAptitude: local.avgAptitude,
            avgComm: local.avgComm,
            avgDiag: local.avgDiag,
            bestScore: Math.max(local.bestScore, remote.bestScore),
            casesPlayed: [...new Set([...local.casesPlayed, ...remote.casesPlayed])],
            recentSessions: local.recentSessions,
            source: 'merged'
        };
    },

    /**
     * Efface toutes les sessions ECOS du localStorage.
     */
    clearLocalSessions() {
        localStorage.removeItem('ecos_sessions');
    }
};

window.EcosStats = EcosStats;
