/**
 * js/patientGallery.js — Galerie de Patients (Collection)
 *
 * Chaque patient "rencontré" (cas joué) est enregistré dans la galerie.
 * Statut : sauvé ✅ ou non sauvé ❌
 * Affiche : initiales, nom, diagnostic, score, date, difficulté
 * Collection progressive — le joueur voit grandir sa galerie.
 *
 * Stockage : localStorage ('medgame_patient_gallery')
 */

const patientGallery = {
    // Liste des patients rencontrés
    patients: [],

    // Stats globales
    stats: {
        totalPlayed: 0,
        totalSaved: 0,
        totalLost: 0,
        bestScore: 0,
        favoriteSpecialty: '',
        firstPlayed: null,
        lastPlayed: null
    },

    /**
     * Initialiser depuis localStorage
     */
    init() {
        try {
            const saved = localStorage.getItem('medgame_patient_gallery');
            if (saved) {
                const data = JSON.parse(saved);
                this.patients = data.patients || [];
                this.stats = { ...this.stats, ...(data.stats || {}) };
            }
        } catch (e) {
            console.warn('[PatientGallery] Erreur chargement:', e);
            this.patients = [];
        }
    },

    /**
     * Sauvegarder dans localStorage
     */
    save() {
        try {
            localStorage.setItem('medgame_patient_gallery', JSON.stringify({
                patients: this.patients,
                stats: this.stats
            }));
        } catch (e) {
            console.warn('[PatientGallery] Erreur sauvegarde:', e);
        }
    },

    /**
     * Enregistrer un patient après une partie
     * @param {Object} caseData - Le cas clinique joué
     * @param {Object} result - { success, score, diagnostic, treatments, timeSpent, attempts }
     */
    recordPatient(caseData, result) {
        if (!caseData || !caseData.patient) return;

        const patientId = caseData.id;
        const now = new Date().toISOString();

        // Vérifier si ce patient existe déjà
        const existing = this.patients.find(p => p.caseId === patientId);

        const entry = {
            caseId: patientId,
            firstName: caseData.patient.prenom || 'Patient',
            lastName: caseData.patient.nom || 'Inconnu',
            age: caseData.patient.age || '?',
            sexe: caseData.patient.sexe || '?',
            specialty: caseData.specialty || 'Général',
            difficulty: caseData.difficulty || 'moyen',
            motif: (caseData.interrogatoire && caseData.interrogatoire.motifHospitalisation) || 'Non précisé',
            correctDiagnostic: caseData.correctDiagnostic || 'Inconnu',
            playerDiagnostic: result.diagnostic || '',
            saved: result.success === true,
            score: result.score || 0,
            timeSpent: result.timeSpent || 0,
            attempts: result.attempts || 1,
            treatments: result.treatments || [],
            correction: (caseData.correction || '').substring(0, 300),
            firstEncountered: existing ? existing.firstEncountered : now,
            lastPlayed: now,
            playCount: existing ? (existing.playCount || 0) + 1 : 1,
            bestScore: existing ? Math.max(existing.bestScore || 0, result.score || 0) : (result.score || 0)
        };

        if (existing) {
            // Mettre à jour — garder le meilleur résultat
            Object.assign(existing, entry);
            if (existing.bestScore > entry.bestScore) {
                existing.bestScore = existing.bestScore;
            }
            // Si sauvé cette fois mais pas avant
            if (result.success && !existing.saved) {
                existing.saved = true;
            }
        } else {
            this.patients.push(entry);
        }

        // Mettre à jour les stats globales
        this.stats.totalPlayed = this.patients.length;
        this.stats.totalSaved = this.patients.filter(p => p.saved).length;
        this.stats.totalLost = this.stats.totalPlayed - this.stats.totalSaved;
        this.stats.bestScore = Math.max(this.stats.bestScore, result.score || 0);
        this.stats.lastPlayed = now;
        if (!this.stats.firstPlayed) this.stats.firstPlayed = now;

        // Spécialité favorite
        const specCount = {};
        this.patients.forEach(p => {
            specCount[p.specialty] = (specCount[p.specialty] || 0) + 1;
        });
        const sortedSpec = Object.entries(specCount).sort((a, b) => b[1] - a[1]);
        this.stats.favoriteSpecialty = sortedSpec.length > 0 ? sortedSpec[0][0] : '';

        this.save();

        // Retourner l'entry pour feedback visuel
        return {
            isNew: !existing,
            saved: entry.saved,
            totalSaved: this.stats.totalSaved,
            totalPlayed: this.stats.totalPlayed
        };
    },

    /**
     * Obtenir tous les patients, triés par date (plus récent en premier)
     */
    getAll(sorted = 'date') {
        const copy = [...this.patients];
        switch (sorted) {
            case 'date':
                return copy.sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed));
            case 'score':
                return copy.sort((a, b) => b.bestScore - a.bestScore);
            case 'name':
                return copy.sort((a, b) => a.lastName.localeCompare(b.lastName));
            case 'specialty':
                return copy.sort((a, b) => a.specialty.localeCompare(b.specialty));
            default:
                return copy;
        }
    },

    /**
     * Obtenir un patient par caseId
     */
    get(caseId) {
        return this.patients.find(p => p.caseId === caseId) || null;
    },

    /**
     * Obtenir les stats
     */
    getStats() {
        return { ...this.stats };
    },

    /**
     * Obtenir le taux de réussite
     */
    getSuccessRate() {
        if (this.stats.totalPlayed === 0) return 0;
        return Math.round((this.stats.totalSaved / this.stats.totalPlayed) * 100);
    },

    /**
     * Obtenir la couleur de rareté selon la difficulté
     */
    getDifficultyColor(difficulty) {
        switch ((difficulty || '').toLowerCase()) {
            case 'facile': return '#2ecc71';
            case 'moyen': return '#f39c12';
            case 'difficile': return '#e74c3c';
            case 'expert': return '#a855f7';
            default: return '#4facfe';
        }
    },

    /**
     * Obtenir l'icône de spécialité
     */
    getSpecialtyIcon(specialty) {
        const s = (specialty || '').toLowerCase();
        if (s.includes('cardio')) return '❤️';
        if (s.includes('neuro')) return '🧠';
        if (s.includes('pneumo') || s.includes('respir')) return '🫁';
        if (s.includes('digest')) return '🍽️';
        if (s.includes('uro') || s.includes('nephro')) return '🫘';
        if (s.includes('loco') || s.includes('ortho')) return '🦴';
        if (s.includes('orl')) return '👂';
        if (s.includes('urgence') || s.includes('samu')) return '🚑';
        if (s.includes('endo') || s.includes('diabete')) return '💉';
        if (s.includes('psych') || s.includes('edn')) return '🧩';
        return '🏥';
    },

    /**
     * Générer la couleur d'avatar basée sur le nom
     */
    getAvatarColor(firstName, lastName) {
        const str = (firstName + lastName).toLowerCase();
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const colors = [
            'linear-gradient(135deg, #667eea, #764ba2)',
            'linear-gradient(135deg, #f093fb, #f5576c)',
            'linear-gradient(135deg, #4facfe, #00f2fe)',
            'linear-gradient(135deg, #43e97b, #38f9d7)',
            'linear-gradient(135deg, #fa709a, #fee140)',
            'linear-gradient(135deg, #a18cd1, #fbc2eb)',
            'linear-gradient(135deg, #fccb90, #d57eeb)',
            'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
            'linear-gradient(135deg, #f77062, #fe5196)',
            'linear-gradient(135deg, #c471f5, #fa71cd)',
        ];
        return colors[Math.abs(hash) % colors.length];
    },

    /**
     * Formater la date en français
     */
    formatDate(isoString) {
        if (!isoString) return '--';
        const d = new Date(isoString);
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        return d.toLocaleDateString('fr-FR', options);
    },

    /**
     * Formater le temps en mm:ss
     */
    formatTime(seconds) {
        if (!seconds || seconds <= 0) return '--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    /**
     * Obtenir le nombre de patients non vus (pour badge notification)
     */
    getNewCount() {
        try {
            const lastViewed = localStorage.getItem('medgame_gallery_last_viewed');
            if (!lastViewed) return this.patients.length;
            const lastDate = new Date(lastViewed);
            return this.patients.filter(p => new Date(p.lastPlayed) > lastDate).length;
        } catch (e) {
            return 0;
        }
    },

    /**
     * Marquer la galerie comme vue
     */
    markAsViewed() {
        localStorage.setItem('medgame_gallery_last_viewed', new Date().toISOString());
    },

    /**
     * === RENDERING === */

    /**
     * Afficher la galerie en overlay (plein écran)
     */
    show() {
        // Marquer comme vue
        this.markAsViewed();

        // Supprimer l'ancien overlay s'il existe
        const existing = document.getElementById('gallery-overlay');
        if (existing) existing.remove();

        const patients = this.getAll('date');
        const stats = this.getStats();
        const successRate = this.getSuccessRate();

        const overlay = document.createElement('div');
        overlay.id = 'gallery-overlay';
        overlay.innerHTML = `
            <div class="gallery-container">
                <!-- Header -->
                <div class="gallery-header">
                    <div class="gallery-title-row">
                        <h2 class="gallery-title">
                            <i class="fas fa-hospital-user"></i> Galerie de Patients
                        </h2>
                        <button class="gallery-close-btn" id="gallery-close" aria-label="Fermer la galerie">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <!-- Stats Bar -->
                    <div class="gallery-stats-bar">
                        <div class="gallery-stat">
                            <div class="gallery-stat-value">${stats.totalPlayed}</div>
                            <div class="gallery-stat-label">Rencontrés</div>
                        </div>
                        <div class="gallery-stat saved">
                            <div class="gallery-stat-value">${stats.totalSaved}</div>
                            <div class="gallery-stat-label">Sauvés ❤️</div>
                        </div>
                        <div class="gallery-stat lost">
                            <div class="gallery-stat-value">${stats.totalLost}</div>
                            <div class="gallery-stat-label">Perdus</div>
                        </div>
                        <div class="gallery-stat">
                            <div class="gallery-stat-value">${successRate}%</div>
                            <div class="gallery-stat-label">Taux succès</div>
                        </div>
                        <div class="gallery-stat">
                            <div class="gallery-stat-value">${stats.bestScore}%</div>
                            <div class="gallery-stat-label">Meilleur</div>
                        </div>
                        ${stats.favoriteSpecialty ? `
                        <div class="gallery-stat">
                            <div class="gallery-stat-value">${this.getSpecialtyIcon(stats.favoriteSpecialty)}</div>
                            <div class="gallery-stat-label">${stats.favoriteSpecialty}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Filters -->
                    <div class="gallery-filters">
                        <button class="gallery-filter-btn active" data-filter="all">Tous</button>
                        <button class="gallery-filter-btn" data-filter="saved">Sauvés ❤️</button>
                        <button class="gallery-filter-btn" data-filter="lost">Perdus</button>
                        <select class="gallery-sort-select" id="gallery-sort">
                            <option value="date">Plus récent</option>
                            <option value="score">Meilleur score</option>
                            <option value="name">Nom</option>
                            <option value="specialty">Spécialité</option>
                        </select>
                    </div>
                </div>
                
                <!-- Patient Grid -->
                <div class="gallery-grid" id="gallery-grid">
                    ${patients.length === 0 ? this.renderEmptyState() : patients.map(p => this.renderPatientCard(p)).join('')}
                </div>
                
                <!-- Progress bar -->
                <div class="gallery-progress">
                    <div class="gallery-progress-bar">
                        <div class="gallery-progress-fill" style="width: ${successRate}%"></div>
                    </div>
                    <div class="gallery-progress-text">Collection : ${stats.totalSaved} patients sauvés sur ${stats.totalPlayed} rencontrés</div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('gallery-visible');
        });

        // Event listeners
        overlay.querySelector('#gallery-close').addEventListener('click', () => this.hide());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hide();
        });

        // Filter buttons
        overlay.querySelectorAll('.gallery-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                overlay.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.applyFilter(btn.dataset.filter);
            });
        });

        // Sort select
        const sortSelect = overlay.querySelector('#gallery-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.applySort(sortSelect.value);
            });
        }

        // Patient card clicks
        overlay.querySelectorAll('.gallery-patient-card').forEach(card => {
            card.addEventListener('click', () => {
                const caseId = card.dataset.caseId;
                this.showPatientDetail(caseId);
            });
        });

        // Escape key
        this._escHandler = (e) => {
            if (e.key === 'Escape') {
                const detailModal = document.getElementById('gallery-detail-overlay');
                if (detailModal) {
                    detailModal.remove();
                } else {
                    this.hide();
                }
            }
        };
        document.addEventListener('keydown', this._escHandler);

        if (typeof MedGameAudio !== 'undefined') {
            MedGameAudio.play('reveal');
        }
    },

    /**
     * Masquer la galerie
     */
    hide() {
        const overlay = document.getElementById('gallery-overlay');
        if (overlay) {
            overlay.classList.remove('gallery-visible');
            overlay.classList.add('gallery-hiding');
            setTimeout(() => {
                overlay.remove();
                document.body.style.overflow = '';
            }, 300);
        }
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    },

    /**
     * Rendre une carte patient
     */
    renderPatientCard(patient) {
        const initials = (patient.firstName.charAt(0) + patient.lastName.charAt(0)).toUpperCase();
        const avatarColor = this.getAvatarColor(patient.firstName, patient.lastName);
        const diffColor = this.getDifficultyColor(patient.difficulty);
        const specIcon = this.getSpecialtyIcon(patient.specialty);
        const statusIcon = patient.saved ? '❤️' : '💀';
        const statusClass = patient.saved ? 'saved' : 'lost';

        return `
            <div class="gallery-patient-card ${statusClass}" data-case-id="${patient.caseId}" data-saved="${patient.saved}" data-specialty="${patient.specialty}">
                <div class="patient-card-status ${statusClass}">
                    ${statusIcon}
                </div>
                <div class="patient-card-avatar" style="background: ${avatarColor};">
                    ${initials}
                </div>
                <div class="patient-card-info">
                    <div class="patient-card-name">${this.escapeHtml(patient.firstName)} ${this.escapeHtml(patient.lastName)}</div>
                    <div class="patient-card-meta">
                        <span>${patient.age} ans · ${patient.sexe}</span>
                        <span class="patient-card-spec">${specIcon} ${this.escapeHtml(patient.specialty)}</span>
                    </div>
                    <div class="patient-card-diagnostic">
                        ${patient.saved ? '✅ ' : '❌ '}${this.escapeHtml(patient.correctDiagnostic || 'Inconnu')}
                    </div>
                    <div class="patient-card-footer">
                        <span class="patient-card-score" style="color: ${patient.bestScore >= 80 ? '#2ecc71' : patient.bestScore >= 50 ? '#f39c12' : '#e74c3c'}">
                            ${patient.bestScore}%
                        </span>
                        <span class="patient-card-diff" style="color: ${diffColor}; border-color: ${diffColor}40;">
                            ${patient.difficulty || 'moyen'}
                        </span>
                        <span class="patient-card-date">${this.formatDate(patient.lastPlayed)}</span>
                    </div>
                </div>
                ${patient.playCount > 1 ? `<div class="patient-card-replays" title="${patient.playCount} tentatives">×${patient.playCount}</div>` : ''}
            </div>
        `;
    },

    /**
     * Rendre l'état vide
     */
    renderEmptyState() {
        return `
            <div class="gallery-empty">
                <div class="gallery-empty-icon">🏥</div>
                <h3>Aucun patient rencontré</h3>
                <p>Commencez une garde pour remplir votre galerie !</p>
            </div>
        `;
    },

    /**
     * Filtrer les cartes
     */
    applyFilter(filter) {
        const cards = document.querySelectorAll('.gallery-patient-card');
        cards.forEach(card => {
            const saved = card.dataset.saved === 'true';
            switch (filter) {
                case 'saved':
                    card.style.display = saved ? '' : 'none';
                    break;
                case 'lost':
                    card.style.display = !saved ? '' : 'none';
                    break;
                default:
                    card.style.display = '';
            }
        });
    },

    /**
     * Trier les cartes
     */
    applySort(sortBy) {
        const grid = document.getElementById('gallery-grid');
        if (!grid) return;

        const patients = this.getAll(sortBy);
        grid.innerHTML = patients.length === 0
            ? this.renderEmptyState()
            : patients.map(p => this.renderPatientCard(p)).join('');

        // Re-attacher les events
        grid.querySelectorAll('.gallery-patient-card').forEach(card => {
            card.addEventListener('click', () => {
                const caseId = card.dataset.caseId;
                this.showPatientDetail(caseId);
            });
        });

        // Re-apply current filter
        const activeFilter = document.querySelector('.gallery-filter-btn.active');
        if (activeFilter) {
            this.applyFilter(activeFilter.dataset.filter);
        }
    },

    /**
     * Afficher le détail d'un patient
     */
    showPatientDetail(caseId) {
        const patient = this.get(caseId);
        if (!patient) return;

        const initials = (patient.firstName.charAt(0) + patient.lastName.charAt(0)).toUpperCase();
        const avatarColor = this.getAvatarColor(patient.firstName, patient.lastName);
        const diffColor = this.getDifficultyColor(patient.difficulty);
        const specIcon = this.getSpecialtyIcon(patient.specialty);
        const statusText = patient.saved ? 'Patient sauvé ❤️' : 'Patient perdu 💀';
        const statusColor = patient.saved ? '#2ecc71' : '#e74c3c';

        // Remove existing detail modal
        const existing = document.getElementById('gallery-detail-overlay');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'gallery-detail-overlay';
        modal.className = 'gallery-detail-overlay';
        modal.innerHTML = `
            <div class="gallery-detail-modal">
                <button class="gallery-detail-close" id="gallery-detail-close">
                    <i class="fas fa-times"></i>
                </button>
                
                <!-- Patient Header -->
                <div class="gallery-detail-header">
                    <div class="gallery-detail-avatar" style="background: ${avatarColor};">
                        ${initials}
                    </div>
                    <div class="gallery-detail-identity">
                        <h2>${this.escapeHtml(patient.firstName)} ${this.escapeHtml(patient.lastName)}</h2>
                        <div class="gallery-detail-meta">
                            <span>${patient.age} ans · ${patient.sexe}</span>
                            <span style="color: ${statusColor}; font-weight: 700;">${statusText}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Medical Summary -->
                <div class="gallery-detail-section">
                    <h3><i class="fas fa-stethoscope"></i> Résumé Médical</h3>
                    <div class="gallery-detail-grid">
                        <div class="gallery-detail-item">
                            <div class="gallery-detail-item-label">Motif de consultation</div>
                            <div class="gallery-detail-item-value">${this.escapeHtml(patient.motif)}</div>
                        </div>
                        <div class="gallery-detail-item">
                            <div class="gallery-detail-item-label">Spécialité</div>
                            <div class="gallery-detail-item-value">${specIcon} ${this.escapeHtml(patient.specialty)}</div>
                        </div>
                        <div class="gallery-detail-item">
                            <div class="gallery-detail-item-label">Diagnostic correct</div>
                            <div class="gallery-detail-item-value" style="color: #4facfe;">${this.escapeHtml(patient.correctDiagnostic)}</div>
                        </div>
                        ${patient.playerDiagnostic && patient.playerDiagnostic !== patient.correctDiagnostic ? `
                        <div class="gallery-detail-item">
                            <div class="gallery-detail-item-label">Votre diagnostic</div>
                            <div class="gallery-detail-item-value" style="color: ${patient.saved ? '#2ecc71' : '#e74c3c'};">${this.escapeHtml(patient.playerDiagnostic)}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <!-- Performance -->
                <div class="gallery-detail-section">
                    <h3><i class="fas fa-chart-line"></i> Performance</h3>
                    <div class="gallery-detail-grid">
                        <div class="gallery-detail-item">
                            <div class="gallery-detail-item-label">Meilleur score</div>
                            <div class="gallery-detail-item-value" style="color: ${patient.bestScore >= 80 ? '#2ecc71' : patient.bestScore >= 50 ? '#f39c12' : '#e74c3c'}; font-size: 1.8em; font-weight: 900;">
                                ${patient.bestScore}%
                            </div>
                        </div>
                        <div class="gallery-detail-item">
                            <div class="gallery-detail-item-label">Difficulté</div>
                            <div class="gallery-detail-item-value">
                                <span style="color: ${diffColor}; border: 1px solid ${diffColor}60; padding: 2px 10px; border-radius: 12px; font-size: 0.9em;">
                                    ${patient.difficulty || 'moyen'}
                                </span>
                            </div>
                        </div>
                        <div class="gallery-detail-item">
                            <div class="gallery-detail-item-label">Tentatives</div>
                            <div class="gallery-detail-item-value">${patient.playCount || 1}</div>
                        </div>
                        <div class="gallery-detail-item">
                            <div class="gallery-detail-item-label">Première visite</div>
                            <div class="gallery-detail-item-value">${this.formatDate(patient.firstEncountered)}</div>
                        </div>
                        <div class="gallery-detail-item">
                            <div class="gallery-detail-item-label">Dernière visite</div>
                            <div class="gallery-detail-item-value">${this.formatDate(patient.lastPlayed)}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Correction -->
                ${patient.correction ? `
                <div class="gallery-detail-section">
                    <h3><i class="fas fa-book-medical"></i> Protocole & Correction</h3>
                    <div class="gallery-detail-correction">
                        ${patient.correction}
                    </div>
                </div>
                ` : ''}
                
                <!-- Replay button -->
                <div class="gallery-detail-actions">
                    <button class="gallery-replay-btn" onclick="document.getElementById('gallery-detail-overlay').remove();">
                        <i class="fas fa-times"></i> Fermer
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close handlers
        modal.querySelector('#gallery-detail-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('gallery-detail-visible');
        });

        if (typeof MedGameAudio !== 'undefined') {
            MedGameAudio.play('click');
        }
    },

    /**
     * Afficher un popup de nouveau patient après une partie
     */
    showNewPatientPopup(result) {
        if (!result) return;

        const isNew = result.isNew;
        const saved = result.saved;
        const popup = document.createElement('div');
        popup.className = 'new-patient-popup';
        popup.innerHTML = `
            <div class="new-patient-popup-content ${saved ? 'saved' : 'lost'}">
                <div class="new-patient-popup-icon">${saved ? '🏥' : '💀'}</div>
                <div class="new-patient-popup-text">
                    <div class="new-patient-popup-title">${isNew ? 'Nouveau patient' : 'Patient mis à jour'}</div>
                    <div class="new-patient-popup-subtitle">
                        ${saved ? 'Sauvé !' : 'Non sauvé...'} · ${result.totalSaved}/${result.totalPlayed} dans la galerie
                    </div>
                </div>
                <button class="new-patient-popup-btn" id="view-gallery-btn">
                    <i class="fas fa-hospital-user"></i> Voir
                </button>
            </div>
        `;

        popup.style.cssText = `
            position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%) translateY(20px);
            z-index: 9999; opacity: 0; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: auto;
        `;

        document.body.appendChild(popup);

        // Animate in
        requestAnimationFrame(() => {
            popup.style.opacity = '1';
            popup.style.transform = 'translateX(-50%) translateY(0)';
        });

        // Button handler
        popup.querySelector('#view-gallery-btn').addEventListener('click', () => {
            popup.remove();
            this.show();
        });

        // Auto-dismiss after 6s
        setTimeout(() => {
            if (popup.parentElement) {
                popup.style.opacity = '0';
                popup.style.transform = 'translateX(-50%) translateY(20px)';
                setTimeout(() => popup.remove(), 400);
            }
        }, 6000);
    },

    /**
     * Escape HTML helper
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Réinitialiser (admin/debug)
     */
    reset() {
        this.patients = [];
        this.stats = {
            totalPlayed: 0,
            totalSaved: 0,
            totalLost: 0,
            bestScore: 0,
            favoriteSpecialty: '',
            firstPlayed: null,
            lastPlayed: null
        };
        localStorage.removeItem('medgame_patient_gallery');
        localStorage.removeItem('medgame_gallery_last_viewed');
    }
};

// Expose globalement
window.patientGallery = patientGallery;

// Auto-init
patientGallery.init();
