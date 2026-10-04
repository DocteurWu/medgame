/* js/index-leaderboard.js - chargement du leaderboard (extrait de index.html) */

window.loadLeaderboard = async function () {
            const listContainer = document.getElementById('leaderboard-list');
            if (!listContainer || typeof supabase === 'undefined') return;

            try {
                const { data: topPlayers, error } = await supabase
                    .from('public_leaderboard')
                    .select('username, total_xp, rank')
                    .order('total_xp', { ascending: false })
                    .limit(10);

                if (error) throw error;

                if (!topPlayers || topPlayers.length === 0) {
                    listContainer.innerHTML = '<div style="text-align:center; color:rgba(255,255,255,0.5); padding: 20px 0;">Aucun classement disponible.</div>';
                    return;
                }

                listContainer.innerHTML = '';
                topPlayers.forEach((player, index) => {
                    // Optionnel: ne pas afficher tous les 0 XP s'il y en a trop
                    if (player.total_xp === 0 && index > 4) return;

                    const rankPos = index + 1;
                    const item = document.createElement('div');
                    item.className = `leaderboard-item ${rankPos <= 3 ? 'rank-' + rankPos : ''}`;

                    const username = player.username || 'Anonyme';
                    const role = player.rank || 'Externe';

                    item.innerHTML = `
                        <div class="lb-rank">${rankPos}</div>
                        <div class="lb-info">
                            <span class="lb-name">${username}</span>
                            <span class="lb-role">${role}</span>
                        </div>
                        <div class="lb-xp">${player.total_xp} XP</div>
                    `;
                    listContainer.appendChild(item);
                });

            } catch (err) {
                console.error("Erreur chargement classement:", err);
                listContainer.innerHTML = '<div style="text-align:center; color:#ff4757; padding: 20px 0;">Erreur de chargement.</div>';
            }
        }

        document.addEventListener('DOMContentLoaded', window.loadLeaderboard);
