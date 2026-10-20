// Profile Page Logic - MedGame

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    await window.requireAuth();
    
    // Initialize 3D background (particles only for profile)
    // `three-background.js` est un module ES : il est donc différé et s'exécute
    // AVANT le déclenchement de DOMContentLoaded. `window.ThreeBackground` est
    // par conséquent toujours défini ici. L'ancien repli `init3D()` était du
    // code mort : il n'utilisait que le global `THREE`, qui n'existe nulle part
    // dans ce dépôt (le code 3D est en modules ES, sans global), et il ne pouvait
    // donc que lever une ReferenceError.
    ThreeBackground.init('canvas-container', { type: 'particles' });

    // Load profile data
    loadProfileData();
});


// `getCookie` est fourni par js/utils.js (source unique). La copie locale
// qui existait ici lisait le cookie brut, alors que la version canonique lit
// aussi le miroir localStorage : la liste « cas joués » vue sur cette page
// pouvait donc être plus courte que celle vue dans le jeu.

async function loadProfileData() {
    let profile = null;
    let sessions = [];
    let useFallback = false;
    let currentRank = 999;
    
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        
        // Load profile
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        if (profileError) {
            console.warn('Profile error:', profileError.message);
            useFallback = true;
        } else {
            profile = profileData || {};
            const localXp = typeof getLocalXp === 'function' ? getLocalXp() : 0;
            const remoteXp = profile.total_xp || 0;
            const effectiveXp = Math.max(remoteXp, localXp);

            profile.total_xp = effectiveXp;
            if (typeof setLocalXp === 'function') setLocalXp(effectiveXp);

            if (effectiveXp > remoteXp && session?.user?.id) {
                supabase
                    .from('profiles')
                    .upsert({ id: session.user.id, total_xp: effectiveXp }, { onConflict: 'id' })
                    .then(() => {})
                    .catch(e => console.warn('XP sync error:', e));
            }
            
            // --- LOGIQUE TOP 10 STREAK (Célébrité) ---
            if (profile.is_public) {
                // 1. Calculer le rang actuel via la vue publique
                const { count, error: rankError } = await supabase
                    .from('public_leaderboard')
                    .select('*', { count: 'exact', head: true })
                    .gt('total_xp', profile.total_xp || 0);
                
                if (!rankError) {
                    currentRank = count + 1;
                    
                    const now = new Date();
                    const lastCheck = profile.last_rank_check ? new Date(profile.last_rank_check) : null;
                    const isNewDay = !lastCheck || lastCheck.toDateString() !== now.toDateString();
                    
                    if (isNewDay) {
                        let newStreak = profile.top_10_streak || 0;
                        
                        if (currentRank <= 10) {
                            // Vérifier si c'était hier pour continuer la série
                            const yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            const wasYesterday = lastCheck && lastCheck.toDateString() === yesterday.toDateString();
                            
                            if (wasYesterday || !lastCheck) {
                                newStreak += 1;
                            } else {
                                newStreak = 1;
                            }
                        } else {
                            newStreak = 0;
                        }
                        
                        // Mettre à jour en base
                        await supabase
                            .from('profiles')
                            .update({ 
                                top_10_streak: newStreak, 
                                last_rank_check: now.toISOString() 
                            })
                            .eq('id', session.user.id);
                        
                        profile.top_10_streak = newStreak;
                    }
                }
            }
        }
        
        // Load play sessions
        const { data: sessionsData, error: sessionsError } = await supabase
            .from('play_sessions')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (sessionsError) {
            console.warn('Sessions error:', sessionsError.message);
            // Try fallback without order if column doesn't exist
            if (sessionsError.message.includes('created_at')) {
                const { data: sessionsData2 } = await supabase
                    .from('play_sessions')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .limit(50);
                sessions = sessionsData2 || [];
            }
        } else {
            sessions = sessionsData || [];
        }
        
    } catch (error) {
        console.warn('Supabase error, using fallback:', error);
        useFallback = true;
    }
    
    if (useFallback || !profile) {
        const savedProfile = localStorage.getItem('medgame_profile');
        if (savedProfile) {
            profile = JSON.parse(savedProfile);
            if (typeof getLocalXp === 'function') {
                profile.total_xp = Math.max(profile.total_xp || 0, getLocalXp());
            }
        } else {
            profile = {
                username: 'Médecin',
                total_xp: typeof getLocalXp === 'function' ? getLocalXp() : (getCookie('xp') ? parseInt(getCookie('xp')) : 0),
                rank: 'DFGSM3'
            };
        }
        
        const playedCasesCookie = getCookie('playedCases');
        if (playedCasesCookie) {
            const playedIds = playedCasesCookie.split(',').filter(id => id);
            sessions = playedIds.map(caseId => ({
                case_id: caseId,
                score: 50
            }));
        }
    }
    
    updateProfileHeader(profile);
    updateStats(sessions, profile);
    updateSpecialties(sessions);
    updateHistory(sessions);
    updateBadges(sessions, profile);

    // 3.5 Statistiques ECOS (séparées des sessions classiques)
    if (window.EcosStats) {
        window.EcosStats.getStats().then(stats => {
            renderEcosStats(stats);
        }).catch(e => {
            console.warn('[Profile] EcosStats unavailable:', e);
            renderEcosStats(window.EcosStats.computeLocalStats());
        });
    }
}

function updateProfileHeader(profile) {
    const username = profile?.username || 'Médecin';
    document.getElementById('profile-username').textContent = username;

    // Render gender state
    const gender = (profile?.sexe || 'M').toUpperCase();
    const selector = document.getElementById('gender-selector');
    if (selector) {
        selector.style.display = 'inline-flex';
        const btnM = document.getElementById('gender-btn-m');
        const btnF = document.getElementById('gender-btn-f');
        if (gender === 'F') {
            btnF.classList.add('active');
            btnM.classList.remove('active');
        } else {
            btnM.classList.add('active');
            btnF.classList.remove('active');
        }
    }
    
    // Calculate level
    const xp = profile?.total_xp || 0;
    const level = calculateLevel(xp);
    const xpForNextLevel = 150 * Math.pow(level + 1, 1.5);
    const xpForCurrentLevel = 150 * Math.pow(level, 1.5);
    const xpProgress = ((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;
    
    document.getElementById('level-badge').textContent = `Niv. ${level}`;
    document.getElementById('xp-bar').style.width = `${Math.min(xpProgress, 100)}%`;
    document.getElementById('xp-text').textContent = `${xp} / ${Math.round(xpForNextLevel)} XP`;
}

window.updateProfileGender = async function(sexe) {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { error } = await supabase
            .from('profiles')
            .update({ sexe: sexe })
            .eq('id', session.user.id);

        if (error) throw error;

        // Update UI locally
        const btnM = document.getElementById('gender-btn-m');
        const btnF = document.getElementById('gender-btn-f');
        if (sexe === 'F') {
            btnF.classList.add('active');
            btnM.classList.remove('active');
        } else {
            btnM.classList.add('active');
            btnF.classList.remove('active');
        }

        // Update local storage fallback
        const savedProfile = localStorage.getItem('medgame_profile');
        if (savedProfile) {
            const parsed = JSON.parse(savedProfile);
            parsed.sexe = sexe;
            localStorage.setItem('medgame_profile', JSON.stringify(parsed));
        }
    } catch (err) {
        console.error('Error updating gender:', err);
        const btnM = document.getElementById('gender-btn-m');
        const btnF = document.getElementById('gender-btn-f');
        if (sexe === 'F') {
            btnF.classList.add('active');
            btnM.classList.remove('active');
        } else {
            btnM.classList.add('active');
            btnF.classList.remove('active');
        }
        
        const savedProfile = localStorage.getItem('medgame_profile');
        const parsed = savedProfile ? JSON.parse(savedProfile) : { username: 'Médecin' };
        parsed.sexe = sexe;
        localStorage.setItem('medgame_profile', JSON.stringify(parsed));
    }
};

function calculateLevel(xp) {
    if (!xp || xp <= 0) return 1;
    return Math.floor(Math.pow(xp / 150, 2 / 3)) + 1;
}

function updateStats(sessions, profile) {
    const totalCases = sessions?.length || 0;
    const avgScore = sessions?.length 
        ? Math.round(sessions.reduce((a, b) => a + b.score, 0) / sessions.length)
        : 0;
    
    const sessionsWithDuration = sessions?.filter(s => s.duration_seconds) || [];
    let avgTimeText = '--';
    if (sessionsWithDuration.length > 0) {
        const avgSeconds = sessionsWithDuration.reduce((a, b) => a + b.duration_seconds, 0) / sessionsWithDuration.length;
        const minutes = Math.round(avgSeconds / 60);
        avgTimeText = `${minutes}min`;
    }

    const totalXp = profile?.total_xp || 0;

    document.getElementById('total-cases').textContent = totalCases;
    document.getElementById('accuracy').textContent = `${avgScore}%`;
    document.getElementById('avg-time').textContent = avgTimeText;
    document.getElementById('total-xp').textContent = totalXp;
}

// Cache du mapping case_id -> spécialité
let caseToSpecialtyMap = null;

async function loadCaseIndexMap() {
    if (caseToSpecialtyMap) return caseToSpecialtyMap;
    try {
        const response = await fetch('data/case-index.json');
        const index = await response.json();
        const map = {};
        for (const [specialty, cases] of Object.entries(index)) {
            cases.forEach(caseFile => {
                map[caseFile] = specialty;
                const caseId = caseFile.replace('.json', '');
                map[caseId] = specialty;
            });
        }
        caseToSpecialtyMap = map;
        return map;
    } catch (e) {
        console.warn('Impossible de charger case-index.json:', e);
        return {};
    }
}

function getSpecialtyDisplayName(key) {
    const names = {
        'cardiologie': 'Cardiologie',
        'endocrinologie': 'Endocrinologie',
        'appareil-digestif': 'Appareil Digestif',
        'uronephro': 'Uro-Néphrologie',
        'neurosensorielle': 'Neurosensorielle',
        'neurologie/psychiatrie': 'Neurologie / Psychiatrie',
        'locomoteur': 'Locomoteur',
        'urgence': 'Urgence',
        'agents-infectieux': 'Agents Infectieux',
        'immunologie': 'Immunologie'
    };
    return names[key] || key;
}

function getSpecialtyIcon(key) {
    const icons = {
        'cardiologie': 'fa-heart',
        'endocrinologie': 'fa-dna',
        'appareil-digestif': 'fa-stomach',
        'uronephro': 'fa-kidneys',
        'neurosensorielle': 'fa-eye',
        'neurologie/psychiatrie': 'fa-brain',
        'locomoteur': 'fa-bone',
        'urgence': 'fa-truck-medical',
        'agents-infectieux': 'fa-virus',
        'immunologie': 'fa-shield-virus'
    };
    return icons[key] || 'fa-stethoscope';
}

function updateSpecialties(sessions) {
    const container = document.getElementById('specialties-list');

    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-heartbeat"></i>
                <p>Jouez vos premiers cas pour voir vos spécialités favorites</p>
            </div>
        `;
        return;
    }

    loadCaseIndexMap().then(map => {
        const specialtyCounts = {};
        let totalMapped = 0;

        sessions.forEach(session => {
            const caseId = session.case_id || '';
            const specialty = map[caseId] || map[caseId + '.json'];
            if (specialty) {
                specialtyCounts[specialty] = (specialtyCounts[specialty] || 0) + 1;
                totalMapped++;
            }
        });

        if (totalMapped === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-pie"></i>
                    <p>Spécialités non disponibles pour ces cas</p>
                </div>
            `;
            return;
        }

        const sorted = Object.entries(specialtyCounts)
            .sort((a, b) => b[1] - a[1]);

        const maxCount = sorted[0][1];

        let html = '';
        sorted.forEach(([specialty, count]) => {
            const percentage = (count / totalMapped) * 100;
            const barWidth = (count / maxCount) * 100;
            const icon = getSpecialtyIcon(specialty);
            const displayName = getSpecialtyDisplayName(specialty);

            html += `
                <div class="specialty-item">
                    <div class="specialty-icon">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div class="specialty-info">
                        <div class="specialty-name">${displayName}</div>
                        <div class="specialty-count">${count} cas (${Math.round(percentage)}%)</div>
                    </div>
                    <div class="specialty-bar">
                        <div class="specialty-bar-fill" style="width: ${barWidth}%"></div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    });
}

function updateHistory(sessions) {
    const container = document.getElementById('history-list');
    
    if (!sessions || sessions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>Aucun historique de jeu</p>
            </div>
        `;
        return;
    }
    
    // Show last 10 sessions
    const recentSessions = sessions.slice(0, 10);
    
    let html = '';
    recentSessions.forEach(session => {
        const score = session.score || 0;
        const date = new Date(session.created_at);
        const dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        
        let scoreClass = 'poor';
        if (score >= 80) scoreClass = 'excellent';
        else if (score >= 60) scoreClass = 'good';
        else if (score >= 40) scoreClass = 'average';
        
        // Get case name from case_id (would need to join in real app)
        const caseName = session.case_id || 'Cas médical';
        
        html += `
            <div class="history-item">
                <div class="history-score ${scoreClass}">${score}%</div>
                <div class="history-info">
                    <div class="history-name">${caseName}</div>
                    <div class="history-date">${dateStr}</div>
                </div>
                <div class="history-stars">
                    ${getStarsHtml(session.score || 0)}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function getStarsHtml(score) {
    let stars = 0;
    if (score >= 80) stars = 3;
    else if (score >= 50) stars = 2;
    else if (score >= 30) stars = 1;
    
    let html = '';
    for (let i = 0; i < 3; i++) {
        if (i < stars) {
            html += '<i class="fas fa-star"></i>';
        } else {
            html += '<i class="far fa-star"></i>';
        }
    }
    return html;
}

function updateBadges(sessions, profile) {
    const container = document.getElementById('badges-grid');

    // Définitions partagées (js/badges.js — source unique, aussi utilisée en jeu)
    const badges = (window.BadgeSystem && typeof window.BadgeSystem.getDefinitions === 'function')
        ? window.BadgeSystem.getDefinitions(sessions, profile)
        : [];
    
    let html = '';
    badges.forEach(badge => {
        const unlocked = badge.condition();
        const iconStyle = unlocked ? `style="color: ${badge.color}; text-shadow: 0 0 10px ${badge.color}80;"` : '';
        const badgeStyle = unlocked ? `style="border-color: ${badge.color}50; background: ${badge.color}10;"` : '';
        
        let progressText = '';
        if (!unlocked && badge.progress) {
            progressText = `<span class="badge-progress">${badge.progress()}</span>`;
        }

        html += `
            <div class="badge ${unlocked ? '' : 'disabled'}" ${badgeStyle} title="${badge.desc}">
                <i class="${badge.iconClass || 'fas'} ${badge.icon}" ${iconStyle}></i>
                <span class="badge-name">${badge.name}</span>
                <span class="badge-desc">${badge.desc}</span>
                ${progressText}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================================
//  3.5 — Stats mode ECOS séparées
// ============================================================
function renderEcosStats(stats) {
    if (!stats || stats.total === 0) return;

    // Trouver ou créer le container — sélecteurs alignés sur profile.html réel
    // (.profile-container / .badges-card ; #badges-list et .profile-content n'existent pas)
    let container = document.getElementById('ecos-stats-section');
    if (!container) {
        container = document.createElement('section');
        container.id = 'ecos-stats-section';
        container.className = 'profile-card';
        container.style.cssText = 'margin-top:24px;padding:24px;';
        const anchor = document.getElementById('badges-grid')?.closest('.badges-card')
            || document.querySelector('.profile-columns')
            || document.querySelector('.profile-container');
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(container, anchor.nextSibling);
        }
    }
    if (!container.parentNode) return;

    const avgBadgeColor = stats.avgScore >= 80 ? '#2ecc71' : stats.avgScore >= 60 ? '#f39c12' : '#e74c3c';
    const casesCount = stats.casesPlayed?.length || 0;

    container.innerHTML = `
        <div class="section-header">
            <h2 class="section-title"><i class="fas fa-hospital-user"></i> Mode ECOS</h2>
        </div>
        <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:16px;margin-top:12px;">
            <div class="stat-card" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:2rem;font-weight:800;color:#4facfe;">${stats.total}</div>
                <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-top:4px;">Stations jouées</div>
            </div>
            <div class="stat-card" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:2rem;font-weight:800;color:${avgBadgeColor};">${stats.avgScore}<span style="font-size:1rem;">%</span></div>
                <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-top:4px;">Score moyen</div>
            </div>
            <div class="stat-card" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:2rem;font-weight:800;color:#2ecc71;">${stats.bestScore}<span style="font-size:1rem;">%</span></div>
                <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-top:4px;">Meilleur score</div>
            </div>
            <div class="stat-card" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:2rem;font-weight:800;color:#f39c12;">${casesCount}</div>
                <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-top:4px;">Cas distincts</div>
            </div>
            ${stats.avgAptitude !== undefined ? `
            <div class="stat-card" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;text-align:center;">
                <div style="font-size:2rem;font-weight:800;color:#9b59b6;">${stats.avgAptitude}<span style="font-size:1rem;">%</span></div>
                <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-top:4px;">Aptitudes moy.</div>
            </div>` : ''}
        </div>
        ${stats.recentSessions?.length > 0 ? `
        <div style="margin-top:16px;">
            <div style="font-size:0.85rem;font-weight:600;color:rgba(255,255,255,0.6);margin-bottom:8px;">Dernières stations</div>
            ${stats.recentSessions.slice(0, 5).map(s => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:4px;font-size:0.82rem;">
                    <span style="color:rgba(255,255,255,0.7);">${s.case_id || '—'}</span>
                    <span style="font-weight:700;color:${s.score >= 80 ? '#2ecc71' : s.score >= 60 ? '#f39c12' : '#e74c3c'};">${s.score}%</span>
                    <span style="color:rgba(255,255,255,0.3);">${s.stars !== undefined ? '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars) : ''}</span>
                </div>
            `).join('')}
        </div>` : ''}
    `;
}
