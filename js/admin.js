/**
 * MedGame Admin Logic
 * Handles Case Management, Drag & Drop, and Reviews
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Auth & Admin Role
    const user = await window.requireAuth('login.html', true);
    if (!user) return; // Redirection handled by requireAuth

    // Hide loader
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('loading').style.display = 'none';
    }, 500);

    // 2. Navigation Logic
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const sections = document.querySelectorAll('.admin-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.section;

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(target).classList.add('active');

            if (target === 'section-cases') loadCasesGrid();
            if (target === 'section-review') loadReviewList();
            if (target === 'section-stats') updateStats();
            if (target === 'section-banned') loadBannedWords();
        });
    });

    // 3. Global State
    let allCases = [];
    let specialties = [];
    let allUsers = [];
    let currentSort = { column: 'xp', asc: false };

    // 4. Load Stats
    async function updateStats() {
        try {
            const { data: allCasesData, error: casesErr } = await supabase.from('cases').select('status');

            let publishedCount = 0;
            let pendingCount = 0;
            if (!casesErr && allCasesData) {
                publishedCount = allCasesData.filter(c => !c.status || c.status === 'published').length;
                pendingCount = allCasesData.filter(c => c.status === 'pending').length;
            }

            const { data: usersData, error: usersErr } = await supabase
                .from('profiles')
                .select('*')
                .order('total_xp', { ascending: false });

            const usersCount = usersData ? usersData.length : 0;
            const { count: sessionsCount } = await supabase.from('play_sessions').select('*', { count: 'exact', head: true });

            document.getElementById('count-published').textContent = publishedCount || 0;
            const countPendingEl = document.getElementById('count-pending');
            if (countPendingEl) countPendingEl.textContent = pendingCount || 0;
            document.getElementById('count-users').textContent = usersCount || 0;
            document.getElementById('count-sessions').textContent = sessionsCount || 0;

            if (usersErr) {
                console.error("Error loading users:", usersErr);
                const tbody = document.getElementById('users-table-body');
                if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #ff4757;">Erreur lors du chargement des joueurs.</td></tr>';
            } else {
                allUsers = usersData || [];
                renderUsersTable();
            }

            const navBadge = document.getElementById('pending-count-nav');
            if (navBadge) {
                navBadge.textContent = pendingCount;
                if (pendingCount > 0) {
                    navBadge.style.background = 'var(--admin-warning)';
                    navBadge.style.color = 'white';
                } else {
                    navBadge.style.background = 'rgba(255,255,255,0.1)';
                    navBadge.style.color = '#747d8c';
                }
            }
        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    }

    function renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;

        const searchTerm = (document.getElementById('user-search')?.value || '').toLowerCase();
        const roleFilter = document.getElementById('user-role-filter')?.value || 'all';
        const levelFilter = document.getElementById('user-level-filter')?.value || 'all';

        let filtered = allUsers.filter(u => {
            const matchSearch = (u.username || 'Anonyme').toLowerCase().includes(searchTerm);
            const matchRole = roleFilter === 'all' || u.role === roleFilter || (roleFilter === 'joueur' && (!u.role || u.role !== 'admin'));
            
            let uRank = (u.rank || 'autre').toLowerCase();
            let matchLevel = false;
            if (levelFilter === 'all') matchLevel = true;
            else if (levelFilter === 'dfgsm2' && uRank.includes('dfgsm2')) matchLevel = true;
            else if (levelFilter === 'dfgsm3' && uRank.includes('dfgsm3')) matchLevel = true;
            else if (levelFilter === 'autre' && !uRank.includes('dfgsm2') && !uRank.includes('dfgsm3')) matchLevel = true;

            return matchSearch && matchRole && matchLevel;
        });

        filtered.sort((a, b) => {
            let valA, valB;
            if (currentSort.column === 'pseudo') {
                valA = (a.username || 'Anonyme').toLowerCase();
                valB = (b.username || 'Anonyme').toLowerCase();
            } else if (currentSort.column === 'role') {
                valA = (a.role || 'joueur').toLowerCase();
                valB = (b.role || 'joueur').toLowerCase();
            } else if (currentSort.column === 'niveau') {
                valA = (a.rank || 'autre').toLowerCase();
                valB = (b.rank || 'autre').toLowerCase();
            } else {
                valA = a.total_xp || 0;
                valB = b.total_xp || 0;
            }
            
            if (valA < valB) return currentSort.asc ? -1 : 1;
            if (valA > valB) return currentSort.asc ? 1 : -1;
            return 0;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="padding: 20px; text-align: center; color: var(--text-muted);">Aucun joueur trouvé.</td></tr>';
        } else {
            tbody.innerHTML = filtered.map(user => {
                const isAdmin = user.role === 'admin';
                const roleBadge = isAdmin 
                    ? '<span class="badge" style="background: rgba(255, 71, 87, 0.15); color: var(--admin-primary); border: 1px solid rgba(255, 71, 87, 0.3);">Admin</span>'
                    : '<span class="badge" style="background: rgba(255, 255, 255, 0.05); color: #747d8c; border: 1px solid rgba(255, 255, 255, 0.1);">Joueur</span>';
                    
                return `
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 15px 20px; font-weight: 500;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-user-circle" style="color: var(--text-muted); font-size: 1.2rem;"></i>
                                ${user.username || 'Anonyme'}
                            </div>
                        </td>
                        <td style="padding: 15px 20px;">${roleBadge}</td>
                        <td style="padding: 15px 20px;"><span style="color: #4facfe; font-weight: 600;">${user.rank || 'Autre'}</span></td>
                        <td style="padding: 15px 20px; font-family: var(--font-title); font-weight: 700;">${user.total_xp || 0} XP</td>
                    </tr>
                `;
            }).join('');
        }

        // Update Sort Icons
        document.querySelectorAll('.sortable-col .sort-indicator').forEach(icon => {
            icon.className = 'fas fa-sort sort-indicator';
            icon.style.color = 'inherit';
        });
        const activeCol = document.querySelector(`.sortable-col[data-sort="${currentSort.column}"]`);
        if (activeCol) {
            const icon = activeCol.querySelector('.sort-indicator');
            if (icon) {
                icon.className = currentSort.asc ? 'fas fa-sort-up sort-indicator' : 'fas fa-sort-down sort-indicator';
                icon.style.color = 'var(--admin-primary)';
            }
        }
    }

    // Event Listeners for Filters & Sort
    document.getElementById('user-search')?.addEventListener('input', renderUsersTable);
    document.getElementById('user-role-filter')?.addEventListener('change', renderUsersTable);
    document.getElementById('user-level-filter')?.addEventListener('change', renderUsersTable);

    document.querySelectorAll('.sortable-col').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (currentSort.column === column) {
                currentSort.asc = !currentSort.asc;
            } else {
                currentSort.column = column;
                currentSort.asc = column === 'xp' ? false : true;
            }
            renderUsersTable();
        });
    });

    updateStats();

    // 5. Case Management (Drag & Drop)
    async function loadCasesGrid() {
        const container = document.getElementById('specialties-container');
        container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Chargement des thèmes...</div>';

        try {
            const { data, error } = await supabase.from('cases').select('*');

            if (error) throw error;


            if (!data || data.length === 0) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-database"></i> Aucun cas trouvé dans Supabase.<br><small>Avez-vous lancé le script de migration ?</small></div>';
                return;
            }

            // Log unique specialties for debugging
            const uniqueSpecs = [...new Set(data.map(c => c.specialty))];

            // Filter: Published or no status (legacy data from migration)
            const publishedCases = data.filter(c => !c.status || c.status === 'published');

            // Sort by display_order
            publishedCases.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
            allCases = publishedCases;

            // Build specialties PURELY from database data
            specialties = uniqueSpecs.filter(s => s);
            // Ensure urgence is always shown
            if (!specialties.some(s => s.toLowerCase() === 'urgence')) {
                specialties.push('urgence');
            }

            container.innerHTML = '';

            specialties.forEach(spec => {
                const specLower = spec.toLowerCase();
                const casesInSpec = allCases.filter(c => (c.specialty || '').toLowerCase() === specLower);

                const section = document.createElement('div');
                section.className = 'specialty-section';
                // Capitalize first letter for display
                const displayName = spec.charAt(0).toUpperCase() + spec.slice(1);
                section.innerHTML = `
                    <div class="specialty-header">
                        <h2>${displayName}</h2>
                        <span class="badge" style="background: rgba(255,255,255,0.05); color: #747d8c;">${casesInSpec.length} cas</span>
                    </div>
                    <div class="case-list drag-container" data-specialty="${spec}">
                        ${casesInSpec.map(c => renderCaseCard(c)).join('')}
                        ${casesInSpec.length === 0 ? '<div class="empty-state" style="padding: 20px; font-size: 0.8rem;">Aucun cas publié dans cette catégorie</div>' : ''}
                    </div>
                `;
                container.appendChild(section);
            });

            initDragAndDrop();
        } catch (err) {
            console.error("Error loading grid:", err);
            container.innerHTML = `<div class="empty-state">Erreur lors du chargement des cas :<br><small>${err.message}</small></div>`;
        }
    }

    function renderCaseCard(c) {
        const content = c.content || {};
        const motif = content.interrogatoire?.motifHospitalisation || content.title || c.title || 'Sans titre';
        const patientName = content.patient ? `${content.patient.nom || ''} (${content.patient.age || '?'} ans, ${content.patient.sexe || '?'})` : 'Patient inconnu';
        return `
            <div class="case-card" draggable="true" data-id="${c.id}">
                <div class="case-badges">
                    <span class="badge badge-status">${c.specialty || 'N/A'}</span>
                    <span class="badge" style="background: rgba(160, 32, 240, 0.1); color: #a020f0;">ID: ${c.id}</span>
                </div>
                <div class="case-content">
                    <h3>${motif}</h3>
                    <p>${patientName}</p>
                </div>
                <div class="case-footer">
                    <div class="case-author">
                        <i class="fas fa-pen-nib"></i> ${c.author_name || content.redacteur || 'Anonyme'}
                    </div>
                    <div class="case-actions">
                        <button class="action-btn action-edit" onclick="editCase('${c.id}')" title="Modifier">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn action-delete" onclick="deleteCase('${c.id}')" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 6. Drag & Drop Engine
    function initDragAndDrop() {
        const containers = document.querySelectorAll('.drag-container');
        let draggedElement = null;

        document.querySelectorAll('.case-card').forEach(card => {
            card.addEventListener('dragstart', () => {
                draggedElement = card;
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', () => {
                draggedElement = null;
                card.classList.remove('dragging');
            });
        });

        containers.forEach(container => {
            container.addEventListener('dragover', e => {
                e.preventDefault();
                const afterElement = getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(draggedElement);
                } else {
                    container.insertBefore(draggedElement, afterElement);
                }
            });
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.case-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // 7. Save Order Logic
    document.getElementById('save-order-btn').addEventListener('click', async () => {
        const containers = document.querySelectorAll('.drag-container');
        const updates = [];
        let order = 0;

        containers.forEach(container => {
            const spec = container.dataset.specialty;
            const cards = container.querySelectorAll('.case-card');
            cards.forEach(card => {
                updates.push({
                    id: card.dataset.id,
                    display_order: order++,
                    specialty: spec
                });
            });
        });

        const btn = document.getElementById('save-order-btn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';
        btn.disabled = true;

        try {
            for (const update of updates) {
                await supabase
                    .from('cases')
                    .update({ display_order: update.display_order, specialty: update.specialty })
                    .eq('id', update.id);
            }
            alert("L'ordre et les thèmes ont été mis à jour avec succès !");
        } catch (err) {
            console.error("Save error:", err);
            alert("Erreur lors de l'enregistrement de l'ordre.");
        } finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    });

    // 8. Review Section
    async function loadReviewList() {
        const list = document.getElementById('review-list');
        list.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i> Chargement des soumissions...</div>';

        try {
            const { data, error } = await supabase
                .from('cases')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                list.innerHTML = '<div class="empty-state"><i class="fas fa-check-double"></i> Aucun cas en attente de review.</div>';
                return;
            }

            list.innerHTML = data.map(c => {
                const content = c.content || {};
                return `
                <div class="case-card" style="cursor: default;">
                    <div class="case-badges">
                        <span class="badge badge-pending">EN ATTENTE</span>
                        <span class="badge" style="background: rgba(255,255,255,0.05); color: #747d8c;">Soumis le ${new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="case-content">
                        <h3>${content.interrogatoire?.motifHospitalisation || 'Sans titre'}</h3>
                        <p>Specialté suggérée: <strong>${c.specialty}</strong></p>
                    </div>
                    <div class="case-footer">
                        <div class="case-author">
                            <i class="fas fa-user-circle"></i> Proposé par ${c.author_name || content.redacteur || 'Anonyme'}
                        </div>
                        <div class="case-actions">
                            <button class="action-btn" onclick="openReview('${c.id}')" title="Ouvrir dans l'éditeur" style="background: var(--admin-primary); width: auto; padding: 0 15px;">
                                <i class="fas fa-eye"></i> REVIEW & EDIT
                            </button>
                            <button class="action-btn action-approve" onclick="approveCase('${c.id}')" title="Approuver directement">
                                <i class="fas fa-check"></i>
                            </button>
                            <button class="action-btn action-delete" onclick="deleteCase('${c.id}')" title="Rejeter">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

        } catch (err) {
            console.error("Error loading reviews:", err);
        }
    }

    // Global actions for onclick
    window.editCase = (id) => {
        const c = allCases.find(item => item.id === id);
        if (c) {
            sessionStorage.setItem('previewCase', JSON.stringify(c.content));
            sessionStorage.setItem('editingCaseId', id);
            window.location.href = 'editor.html';
        }
    };

    window.openReview = async (id) => {
        const { data, error } = await supabase.from('cases').select('content').eq('id', id).single();
        if (data) {
            sessionStorage.setItem('previewCase', JSON.stringify(data.content));
            sessionStorage.setItem('editingCaseId', id);
            window.location.href = 'editor.html';
        }
    };

    window.approveCase = async (id) => {
        if (!confirm("Voulez-vous publier ce cas ?")) return;
        const { error } = await supabase.from('cases').update({ status: 'published' }).eq('id', id);
        if (!error) {
            loadReviewList();
            updateStats();
        }
    };

    window.deleteCase = async (id) => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer/rejeter ce cas ?")) return;
        const { error } = await supabase.from('cases').delete().eq('id', id);
        if (!error) {
            loadCasesGrid();
            loadReviewList();
            updateStats();
        }
    };

    // 9. Banned Pseudos Section
    async function loadBannedWords() {
        const list = document.getElementById('banned-words-list');
        list.innerHTML = '<div class="empty-state" style="width: 100%;"><i class="fas fa-spinner fa-spin"></i> Chargement...</div>';

        const TIMEOUT_MS = 5000; // 5 seconds timeout

        try {
            const fetchPromise = supabase
                .from('banned_usernames')
                .select('*')
                .order('word', { ascending: true });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out')), TIMEOUT_MS)
            );

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

            if (error) {
                if (error.code === '42P01') { // Relation does not exist
                    list.innerHTML = `<div class="empty-state" style="width: 100%;">
                        ATTENTION : La table <b>banned_usernames</b> n'existe pas dans Supabase.<br>
                        Veuillez la créer via l'éditeur SQL avec :<br>
                        <code>CREATE TABLE banned_usernames (word TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());</code>
                    </div>`;
                } else if (error.message === 'Request timed out') {
                    list.innerHTML = `<div class="empty-state" style="width: 100%;">Erreur : La requête a expiré après ${TIMEOUT_MS / 1000} secondes. Vérifiez votre connexion ou la disponibilité de Supabase.</div>`;
                } else if (error.message.includes('Failed to fetch')) {
                    list.innerHTML = `<div class="empty-state" style="width: 100%;">Erreur de connexion : Impossible de joindre le serveur Supabase. Vérifiez votre connexion internet.</div>`;
                } else {
                    list.innerHTML = `<div class="empty-state" style="width: 100%;">Erreur Supabase : ${error.message} (Code: ${error.code || 'N/A'})</div>`;
                }
                console.error("Supabase error loading banned words:", error);
                return;
            }

            if (!data || data.length === 0) {
                list.innerHTML = '<div class="empty-state" style="width: 100%;">Aucun mot interdit répertorié.</div>';
                return;
            }

            list.innerHTML = data.map(w => `
                <div style="background: rgba(255, 71, 87, 0.1); border: 1px solid rgba(255, 71, 87, 0.3); color: #ff4757; padding: 5px 12px; border-radius: 20px; display: flex; align-items: center; gap: 8px; font-weight: 500;">
                    ${w.word}
                    <i class="fas fa-times" onclick="deleteBannedWord('${w.word}')" style="cursor: pointer; opacity: 0.7; transition: 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7"></i>
                </div>
            `).join('');

        } catch (err) {
            console.error("Unexpected error loading banned words:", err);
            if (err.message === 'Request timed out') {
                list.innerHTML = `<div class="empty-state" style="width: 100%;">Erreur : La requête a expiré après ${TIMEOUT_MS / 1000} secondes. Vérifiez votre connexion ou la disponibilité de Supabase.</div>`;
            } else {
                list.innerHTML = `<div class="empty-state" style="width: 100%;">Une erreur inattendue est survenue : ${err.message}</div>`;
            }
        }
    }

    document.getElementById('add-banned-btn')?.addEventListener('click', async () => {
        const input = document.getElementById('new-banned-word');
        const word = input.value.trim().toLowerCase();

        if (!word) return;

        try {
            const { error } = await supabase
                .from('banned_usernames')
                .insert([{ word: word }]);

            if (error) {
                if (error.code === '23505') {
                    alert('Ce mot est déjà dans la liste.');
                } else {
                    throw error;
                }
            } else {
                input.value = '';
                loadBannedWords();
            }
        } catch (err) {
            console.error("Error adding banned word:", err);
            alert("Erreur: La table existe-t-elle ? (" + err.message + ")");
        }
    });

    window.deleteBannedWord = async (word) => {
        try {
            const { error } = await supabase
                .from('banned_usernames')
                .delete()
                .eq('word', word);

            if (error) throw error;
            loadBannedWords();
        } catch (err) {
            console.error("Error deleting banned word:", err);
            alert("Erreur lors de la suppression.");
        }
    };
});

