/**
 * js/skills-hub.js — Contrôleur du Hub Skill Lab (Statistiques & Vitrine des Badges)
 */

document.addEventListener('DOMContentLoaded', () => {
    function refreshHub() {
        if (!window.BadgeSystem) return;

        const stats = window.BadgeSystem.getSkillStats();
        const unlocked = window.BadgeSystem.getUnlocked();
        const allDefs = window.BadgeSystem.getDefinitions([], null);

        // 1. Mettre à jour les statistiques ECG
        const elEcgCompleted = document.getElementById('hub-ecg-completed');
        const elEcgHighScore = document.getElementById('hub-ecg-highscore');
        if (elEcgCompleted) elEcgCompleted.textContent = `${stats.ecgCompleted || 0} tracés`;
        if (elEcgHighScore) elEcgHighScore.textContent = `${stats.ecgHighScore || 0}%`;

        // 2. Mettre à jour les statistiques Auscultation
        const elAuscultCompleted = document.getElementById('hub-auscult-completed');
        const elAuscultHighScore = document.getElementById('hub-auscult-highscore');
        if (elAuscultCompleted) elAuscultCompleted.textContent = `${stats.auscultCompleted || 0} cas`;
        if (elAuscultHighScore) elAuscultHighScore.textContent = `${stats.auscultHighScore || 0}%`;

        // 3. Mettre à jour les statistiques Gaz du sang
        const elGdsCompleted = document.getElementById('hub-gds-completed');
        const elGdsHighScore = document.getElementById('hub-gds-highscore');
        if (elGdsCompleted) elGdsCompleted.textContent = `${stats.gdsCompleted || 0} cas`;
        if (elGdsHighScore) elGdsHighScore.textContent = `${stats.gdsHighScore || 0}%`;

        // 4. Vitrine des badges Skill Lab
        const skillBadgeIds = [
            'ecg_cadet', 'ecg_expert', 'ecg_master',
            'auscult_cadet', 'auscult_expert', 'auscult_master',
            'gds_cadet', 'gds_expert', 'gds_master',
            'skill_master'
        ];

        const container = document.getElementById('skills-badges-list');
        if (!container) return;

        container.innerHTML = '';

        const skillBadges = allDefs.filter(b => skillBadgeIds.includes(b.id));

        skillBadges.forEach(badge => {
            const isUnlocked = !!unlocked[badge.id] || badge.condition();
            const el = document.createElement('div');
            el.className = `skill-badge-item ${isUnlocked ? 'unlocked' : 'locked'}`;

            const iconColor = isUnlocked ? badge.color : 'rgba(255,255,255,0.4)';
            const iconGlow = isUnlocked ? `style="color:${badge.color}; text-shadow: 0 0 12px ${badge.color}90;"` : '';

            let progressHtml = '';
            if (!isUnlocked && badge.progress) {
                progressHtml = `<span style="display:block; font-size:0.7rem; color:var(--skill-cyan); margin-top:2px;">Progression : ${badge.progress()}</span>`;
            } else if (isUnlocked && unlocked[badge.id]?.unlockedAt) {
                const dateStr = new Date(unlocked[badge.id].unlockedAt).toLocaleDateString('fr-FR');
                progressHtml = `<span style="display:block; font-size:0.68rem; color:#ffd700; margin-top:2px;"><i class="fas fa-check"></i> Obtenu le ${dateStr}</span>`;
            }

            el.innerHTML = `
                <div class="badge-item-icon" style="background:${isUnlocked ? badge.color + '20' : 'rgba(255,255,255,0.05)'}; border:1px solid ${isUnlocked ? badge.color + '60' : 'transparent'};">
                    <i class="fas ${badge.icon}" ${iconGlow}></i>
                </div>
                <div class="badge-item-info">
                    <h4>${badge.name}</h4>
                    <p>${badge.desc}</p>
                    ${progressHtml}
                </div>
            `;

            container.appendChild(el);
        });
    }

    refreshHub();
});
