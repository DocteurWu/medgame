// Profile Page Logic - MedGame

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    await window.requireAuth();
    
    // Initialize 3D background (particles only for profile)
    if (window.ThreeBackground) {
        ThreeBackground.init('canvas-container', { type: 'particles' });
    } else {
        // Fallback if module not loaded
        init3D();
    }
    
    // Load profile data
    loadProfileData();
});

// Fallback init3D (kept for compatibility)
function init3D() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    const scene = new THREE.Scene();
    // Brouillard plus profond, tons bleu nuit/violet
    scene.fog = new THREE.FogExp2(0x050714, 0.04);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Opti perf
    container.appendChild(renderer.domElement);

    // 1. L'ADN Principal (Double Hélice)
    const dnaGeometry = new THREE.BufferGeometry();
    const dnaCount = 1500;
    const dnaPos = new Float32Array(dnaCount * 3);
    const dnaColor = new Float32Array(dnaCount * 3);
    const dnaSizes = new Float32Array(dnaCount);

    for (let i = 0; i < dnaCount; i++) {
        const i3 = i * 3;
        const phase = i * 0.15;
        const radius = 2.5 + Math.sin(i * 0.05) * 0.2; // Légère ondulation
        const rise = (i * 0.04) - 25;

        const isStrand1 = i % 2 === 0;
        const angle = isStrand1 ? phase : phase + Math.PI;

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Dispersion pour un effet nuageux
        const scatter = (Math.random() - 0.5) * 0.8;

        dnaPos[i3] = x + scatter;
        dnaPos[i3 + 1] = rise + (Math.random() - 0.5) * 0.5;
        dnaPos[i3 + 2] = z + scatter;

        // Couleurs: Cyan (Strand 1) et Violet néon (Strand 2)
        if (isStrand1) {
            dnaColor[i3] = 0.0;     // R
            dnaColor[i3 + 1] = 0.95; // G
            dnaColor[i3 + 2] = 1.0;  // B
        } else {
            dnaColor[i3] = 0.7;     // R
            dnaColor[i3 + 1] = 0.2;  // G
            dnaColor[i3 + 2] = 1.0;  // B
        }

        dnaSizes[i] = Math.random() * 2.0 + 0.5;
    }

    dnaGeometry.setAttribute('position', new THREE.BufferAttribute(dnaPos, 3));
    dnaGeometry.setAttribute('color', new THREE.BufferAttribute(dnaColor, 3));
    dnaGeometry.setAttribute('size', new THREE.BufferAttribute(dnaSizes, 1));

    // Texture glowy soft
    const canvasSprite = document.createElement('canvas');
    canvasSprite.width = 32;
    canvasSprite.height = 32;
    const ctx = canvasSprite.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    const sprite = new THREE.CanvasTexture(canvasSprite);

    // Shaders personnalisés pour pouvoir utiliser l'attribut 'size'
    const dnaMaterial = new THREE.ShaderMaterial({
        uniforms: {
            pointTexture: { value: sprite }
        },
        vertexShader: `
            attribute float size;
            varying vec3 vColor;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            void main() {
                gl_FragColor = vec4(vColor, 1.0) * texture2D(pointTexture, gl_PointCoord);
            }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    const dnaMesh = new THREE.Points(dnaGeometry, dnaMaterial);
    scene.add(dnaMesh);


    // 2. Particules d'arrière-plan (Poussière ambiante)
    const bgGeometry = new THREE.BufferGeometry();
    const bgCount = 2000;
    const bgPos = new Float32Array(bgCount * 3);
    const bgColorArray = new Float32Array(bgCount * 3);

    for (let i = 0; i < bgCount; i++) {
        const i3 = i * 3;
        bgPos[i3] = (Math.random() - 0.5) * 50;
        bgPos[i3 + 1] = (Math.random() - 0.5) * 50;
        bgPos[i3 + 2] = (Math.random() - 0.5) * 50 - 10; // Pousser vers l'arrière

        bgColorArray[i3] = 0.0;
        bgColorArray[i3 + 1] = 0.3 + Math.random() * 0.3;
        bgColorArray[i3 + 2] = 0.6 + Math.random() * 0.4;
    }

    bgGeometry.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
    bgGeometry.setAttribute('color', new THREE.BufferAttribute(bgColorArray, 3));

    const bgMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    const bgMesh = new THREE.Points(bgGeometry, bgMaterial);
    scene.add(bgMesh);


    // 3. Liaisons ADN (Lignes entre les brins)
    const linkGeometry = new THREE.BufferGeometry();
    const linkCount = 375; // Une liaison
    const linkPos = new Float32Array(linkCount * 6);
    const linkColor = new Float32Array(linkCount * 6);

    for (let i = 0; i < linkCount; i++) {
        const phase = (i * 4) * 0.15;
        const radius = 2.5;
        const rise = ((i * 4) * 0.04) - 25;

        const x1 = Math.cos(phase) * radius;
        const z1 = Math.sin(phase) * radius;
        const x2 = Math.cos(phase + Math.PI) * radius;
        const z2 = Math.sin(phase + Math.PI) * radius;

        const baseIdx = i * 6;
        linkPos[baseIdx] = x1;
        linkPos[baseIdx + 1] = rise;
        linkPos[baseIdx + 2] = z1;
        linkPos[baseIdx + 3] = x2;
        linkPos[baseIdx + 4] = rise;
        linkPos[baseIdx + 5] = z2;

        for (let c = 0; c < 6; c += 3) {
            linkColor[baseIdx + c] = 0.4;
            linkColor[baseIdx + c + 1] = 0.8;
            linkColor[baseIdx + c + 2] = 1.0;
        }
    }

    linkGeometry.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
    linkGeometry.setAttribute('color', new THREE.BufferAttribute(linkColor, 3));

    const linkMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending
    });
    const linkMesh = new THREE.LineSegments(linkGeometry, linkMaterial);
    scene.add(linkMesh);

    camera.position.z = 12;
    camera.position.y = -2;

    // Curseur interactif
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    const windowHalfX = window.innerWidth / 2;
    const windowHalfY = window.innerHeight / 2;

    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX - windowHalfX) * 0.001;
        mouseY = (event.clientY - windowHalfY) * 0.001;
    });

    // Animation Loop
    let time = 0;
    const animate = () => {
        requestAnimationFrame(animate);
        time += 0.008;

        targetX = mouseX * 2;
        targetY = mouseY * 2;

        // Rotation douce avec inertie vers la souris
        dnaMesh.rotation.y += 0.004 + (targetX - dnaMesh.rotation.y) * 0.02;
        dnaMesh.rotation.x += (targetY - dnaMesh.rotation.x) * 0.02;

        linkMesh.rotation.y = dnaMesh.rotation.y;
        linkMesh.rotation.x = dnaMesh.rotation.x;

        // Mouvement parallaxe du background
        bgMesh.rotation.y = time * 0.1 + mouseX * 0.5;
        bgMesh.rotation.x = time * 0.05 + mouseY * 0.5;

        // Flottement de la caméra
        camera.position.y += (Math.sin(time * 1.5) * 1.0 - 2 - camera.position.y) * 0.02;

        renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

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
            profile = profileData;
            
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
    
    // ... rest of fallback logic ...
    if (useFallback || !profile) {
        // ... same fallback ...
        const savedProfile = localStorage.getItem('medgame_profile');
        if (savedProfile) {
            profile = JSON.parse(savedProfile);
        } else {
            profile = {
                username: 'Médecin',
                total_xp: getCookie('xp') ? parseInt(getCookie('xp')) : 0,
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
}

function updateProfileHeader(profile) {
    const username = profile?.username || 'Médecin';
    document.getElementById('profile-username').textContent = username;
    
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

function calculateLevel(xp) {
    if (!xp || xp <= 0) return 1;
    return Math.floor(Math.pow(xp / 150, 2 / 3)) + 1;
}

function updateStats(sessions, profile) {
    const totalCases = sessions?.length || 0;
    const avgScore = sessions?.length 
        ? Math.round(sessions.reduce((a, b) => a + b.score, 0) / sessions.length)
        : 0;
    
    // Calculate average time (estimate from stats if available)
    const avgTime = '--';
    
    const totalXp = profile?.total_xp || 0;
    
    document.getElementById('total-cases').textContent = totalCases;
    document.getElementById('accuracy').textContent = `${avgScore}%`;
    document.getElementById('avg-time').textContent = avgTime;
    document.getElementById('total-xp').textContent = totalXp;
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
    
    // Count cases by specialty (would need to join with cases table for accurate data)
    // For now, show a simple placeholder
    const specialtyIcons = {
        'Cardiologie': 'fa-heart',
        'Neurologie': 'fa-brain',
        'Urgence': 'fa-ambulance',
        'Digestif': 'fa-stomach',
        'Locomoteur': 'fa-bone'
    };
    
    const specialtyNames = Object.keys(specialtyIcons);
    
    // Simulate distribution based on sessions (in real app, would query cases table)
    const total = sessions.length;
    
    let html = '';
    specialtyNames.forEach((specialty, index) => {
        const count = Math.max(1, Math.floor(Math.random() * (total / 2)));
        const percentage = (count / total) * 100;
        const icon = specialtyIcons[specialty];
        
        html += `
            <div class="specialty-item">
                <div class="specialty-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="specialty-info">
                    <div class="specialty-name">${specialty}</div>
                    <div class="specialty-count">${count} cas</div>
                </div>
                <div class="specialty-bar">
                    <div class="specialty-bar-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
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
    
    const badges = [
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

        // Compétition
        { id: 'arena_gladiator', name: 'Gladiateur de l\'Arène', desc: 'Participer à une compétition de QCM (Arena)', icon: 'fa-broadcast-tower', color: '#00f2fe', condition: () => sessions.some(s => s.mode === 'arena') },
        
        // Social / Engagement
        { id: 'public_profile', name: 'Célébrité de Bichat', desc: 'Être dans le Top 10 public pendant 14 jours consécutifs', icon: 'fa-crown', color: '#ffd700', condition: () => {
            const streak = profile?.top_10_streak || 0;
            return streak >= 14;
        }, progress: () => `${profile?.top_10_streak || 0}/14 jours` },
        { id: 'contributor', name: 'Maître de Stage', desc: 'Atteindre le niveau 2', icon: 'fa-edit', color: '#74b9ff', condition: () => calculateLevel(profile?.total_xp || 0) >= 2 },
        { id: 'legend', name: 'Légende de Bichat', desc: 'Atteindre le niveau 10', icon: 'fa-trophy', color: '#ffd700', condition: () => calculateLevel(profile?.total_xp || 0) >= 10 },
        { id: 'immortal', name: 'Doyen de la Faculté', desc: 'Atteindre le niveau 20', icon: 'fa-medal', color: '#fdcb6e', condition: () => calculateLevel(profile?.total_xp || 0) >= 20 },
    ];
    
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
