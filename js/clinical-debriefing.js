/**
 * js/clinical-debriefing.js — Débriefing Universitaire ECOS & Flashcards Anki R2C
 *
 * Conçu pour les étudiants en médecine et candidats aux ECOS / EDN :
 * 1. Bilan d'aptitudes cliniques ECOS sur 5 piliers de compétences.
 * 2. Synthèse pédagogique R2C avec pièges du concours et items officiels.
 * 3. Générateur de Flashcards Anki interactives (avec mini-lecteur intégré et export .txt).
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    /**
     * Génère les flashcards ciblées pour la révision espacée du cas.
     */
    function generateFlashcardsForCase(caseData) {
        if (!caseData) return [];
        const cards = [];
        const diag = caseData.correctDiagnostic || 'Diagnostic';
        const motif = caseData.interrogatoire?.motifHospitalisation || 'Motif';
        const hdm = caseData.interrogatoire?.histoireMaladie || {};

        // Carte 1 : Diagnostic & Sémiologie clé
        cards.push({
            id: 'card_diag',
            front: `Devant : « ${motif} » (${hdm.facteursDeclenchants || 'effort'}, évolution ${hdm.evolution || 'stable'}), quel est le diagnostic principal et ses arguments sémiologiques ?`,
            back: `<strong>${diag}</strong><br>• Signes cardinaux : ${hdm.descriptionDouleur || hdm.remarques || 'Caractéristiques typiques de l’affection'}.<br>• Terrain : ${caseData.patient?.age || '--'} ans, ${caseData.patient?.sexe || ''}.`
        });

        // Carte 2 : Stratégie d'examen paraclinique
        if (caseData.relevantExams && caseData.relevantExams.length) {
            cards.push({
                id: 'card_exams',
                front: `Quels sont les examens complémentaires de 1ère intention à prescrire dans : <em>${diag}</em> ?`,
                back: `Examens recommandés R2C :<br>• <strong>${caseData.relevantExams.join('</strong><br>• <strong>')}</strong>`
            });
        }

        // Carte 3 : Prise en charge thérapeutique & pièges
        if (caseData.correctTreatments && caseData.correctTreatments.length) {
            const fatalMsg = caseData.fatalTreatments && caseData.fatalTreatments.length
                ? `<br><br><span style="color:#b91c1c;">⚠️ CONTRE-INDICATIONS / TRAITEMENTS DANGEREUX : <strong>${caseData.fatalTreatments.join(', ')}</strong></span>`
                : '';
            cards.push({
                id: 'card_treatment',
                front: `Quel est le traitement de 1ère ligne dans : <em>${diag}</em> ?`,
                back: `Traitements indiqués :<br>• <strong>${caseData.correctTreatments.join('</strong><br>• <strong>')}</strong>${fatalMsg}`
            });
        }

        return cards;
    }

    /**
     * Calcule le profil d'aptitudes cliniques sur 5 piliers
     */
    function computeCompetencyProfile(caseData) {
        const demarche = window.scoringState?.demarche || {};
        const ecosChecked = window.ecosState?.gridChecked ? Array.from(window.ecosState.gridChecked) : [];

        // 1. Anamnèse (interrogatoire)
        const askedCount = demarche.interrogatoireAsked ? demarche.interrogatoireAsked.size : 0;
        const scoreAnamnese = Math.min(100, Math.round((askedCount / 6) * 100));

        // 2. Examen physique
        const examsPerfCount = window.scoringState?.examsPerformed ? window.scoringState.examsPerformed.size : 0;
        const scoreExamen = Math.min(100, Math.round((examsPerfCount / 4) * 100));

        // 3. Paraclinique
        const ordered = demarche.examsOrdered || [];
        const relevant = caseData?.relevantExams || [];
        const relevantCount = ordered.filter(e => relevant.some(r => r.toLowerCase().includes(e.toLowerCase()) || e.toLowerCase().includes(r.toLowerCase()))).length;
        const scoreParaclinique = relevant.length ? Math.min(100, Math.round((relevantCount / relevant.length) * 100)) : 80;

        // 4. Traitement & Décision
        const selTreatments = window.gameState?.selectedTreatments || [];
        const correctTreat = caseData?.correctTreatments || [];
        const correctCount = selTreatments.filter(t => correctTreat.includes(t)).length;
        const hasFatal = selTreatments.some(t => (caseData?.fatalTreatments || []).includes(t));
        const scoreTherapeutique = hasFatal ? 10 : (correctTreat.length ? Math.min(100, Math.round((correctCount / correctTreat.length) * 100)) : 85);

        // 5. Communication & Alliance
        // L'alliance vit dans l'orchestrateur (PatientLive), pas dans le cœur pur.
        const alliance = window.PatientLive && typeof window.PatientLive.snapshot === 'function' ? window.PatientLive.snapshot() : null;
        const trust = alliance ? alliance.trust : 65;
        const scoreComm = Math.min(100, Math.max(0, Math.round(trust)));

        return {
            anamnese: scoreAnamnese,
            examen: scoreExamen,
            paraclinique: scoreParaclinique,
            therapeutique: scoreTherapeutique,
            communication: scoreComm
        };
    }

    /**
     * Rendu HTML du bilan ECOS enrichi
     */
    function renderDebriefingHTML(caseData) {
        if (!caseData) return '';
        const profile = computeCompetencyProfile(caseData);
        const flashcards = generateFlashcardsForCase(caseData);

        const ICONS = {
            anamnese: 'fa-comments', examen: 'fa-stethoscope', paraclinique: 'fa-vial',
            therapeutique: 'fa-prescription', communication: 'fa-heart'
        };
        const STATUS = {
            acquis: { cls: 'high', text: 'Attendu atteint' },
            en_cours: { cls: 'medium', text: 'Presque' },
            a_travailler: { cls: 'low', text: 'À travailler' },
            decouverte: { cls: 'discovery', text: 'Découverte' }
        };
        // Le profil est lu avec les attendus de l'année du joueur
        // (js/study-level.js) : seuil par domaine, poids, conseil ciblé.
        const SL = window.StudyLevel;
        const bilan = SL ? SL.expectations(SL.currentId(), profile) : null;
        const rows = bilan ? bilan.rows : [
            { key: 'anamnese', label: 'Interrogatoire', value: profile.anamnese },
            { key: 'examen', label: 'Examen clinique', value: profile.examen },
            { key: 'paraclinique', label: 'Examens complémentaires', value: profile.paraclinique },
            { key: 'therapeutique', label: 'Décision thérapeutique', value: profile.therapeutique },
            { key: 'communication', label: 'Relation avec le patient', value: profile.communication }
        ];

        return `
            <div class="clinical-debriefing-container">
                <!-- Section 1 : Bilan de compétences, lu avec les attendus de l'année -->
                <div class="debriefing-card">
                    <div class="debriefing-card-head">
                        <div>
                            <span class="debriefing-badge"><i class="fas fa-chart-line"></i> ${bilan ? `Attendus de ${escapeHtml(bilan.level.label)}` : 'Bilan de compétences'}</span>
                            <h3 class="debriefing-card-title">${bilan ? `Bilan de l'année : ${bilan.score} %` : 'Bilan par domaine de compétence'}</h3>
                        </div>
                        ${bilan ? `<span class="sl-debrief-count">${bilan.acquired}/${bilan.total} attendus atteints</span>` : ''}
                    </div>
                    ${bilan ? `<p class="sl-debrief-verdict">${escapeHtml(bilan.verdict)}</p>` : ''}
                    <div class="debriefing-pillars-list">
                        ${rows.map(p => {
                            const st = p.status ? STATUS[p.status] : { cls: p.value >= 75 ? 'high' : p.value >= 50 ? 'medium' : 'low', text: '' };
                            const target = p.expected != null ? `attendu ${p.expected} %` : (p.status === 'decouverte' ? 'non exigé cette année' : '');
                            return `
                                <div class="pillar-row">
                                    <div class="pillar-info">
                                        <span class="pillar-name"><i class="fas ${ICONS[p.key]}"></i> ${escapeHtml(p.label)}</span>
                                        <span class="pillar-val ${st.cls}">${p.value} %${target ? ` <span class="sl-debrief-target">· ${target}</span>` : ''}</span>
                                    </div>
                                    <div class="pillar-progress-track">
                                        <div class="pillar-progress-fill ${st.cls}" style="width: ${p.value}%;"></div>
                                        ${p.expected != null ? `<span class="sl-debrief-marker" style="left: ${p.expected}%;" title="Attendu : ${p.expected} %"></span>` : ''}
                                    </div>
                                    ${st.text ? `<div class="sl-debrief-status ${st.cls}">${st.text}${p.advice ? ` — ${escapeHtml(p.advice)}` : ''}</div>` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                    ${bilan ? `<p class="sl-debrief-next"><i class="fas fa-arrow-trend-up"></i> ${escapeHtml(bilan.next)} <span class="sl-debrief-note">La note du cas ne dépend pas de l'année.</span></p>` : ''}
                </div>

                <!-- Section 2 : Mini-lecteur de Flashcards Anki -->
                <div class="debriefing-card">
                    <div class="debriefing-card-head" style="justify-content: space-between; flex-wrap:wrap;">
                        <div>
                            <span class="debriefing-badge" style="color:#0284c7;"><i class="fas fa-brain"></i> Mémorisation Active R2C</span>
                            <h3 class="debriefing-card-title">Flashcards de Révision Espacée</h3>
                        </div>
                        <button type="button" id="btn-export-anki" class="btn-anki-download">
                            <i class="fas fa-download"></i> Exporter pour Anki (.txt)
                        </button>
                    </div>

                    <div class="debriefing-flashcards-viewer" id="flashcards-viewer-mount">
                        ${renderFlashcardWidget(flashcards, 0)}
                    </div>
                </div>
            </div>
        `;
    }

    function renderFlashcardWidget(cards, activeIdx) {
        if (!cards.length) return '<p>Aucune flashcard disponible.</p>';
        const currentCard = cards[activeIdx] || cards[0];

        return `
            <div class="anki-widget" data-card-idx="${activeIdx}" data-total-cards="${cards.length}">
                <div class="anki-widget-nav">
                    <span>Carte ${activeIdx + 1} sur ${cards.length}</span>
                    <div class="anki-nav-buttons">
                        <button type="button" class="btn-card-prev" ${activeIdx === 0 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>
                        <button type="button" class="btn-card-next" ${activeIdx >= cards.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>
                    </div>
                </div>

                <div class="anki-card-box" id="anki-active-card-box">
                    <div class="anki-card-front">
                        <span class="card-prompt-label">Question EDN / ECOS :</span>
                        <p>${currentCard.front}</p>
                    </div>

                    <div class="anki-card-back" id="anki-card-back" style="display:none;">
                        <span class="card-answer-label">Réponse & Synthèse R2C :</span>
                        <div class="card-back-content">${currentCard.back}</div>
                    </div>
                </div>

                <div class="anki-actions-bar">
                    <button type="button" id="btn-reveal-card" class="btn-reveal-answer">
                        <i class="fas fa-eye"></i> Afficher la réponse
                    </button>
                    <div id="anki-rating-buttons" class="anki-ratings" style="display:none;">
                        <button type="button" class="rating-btn again" data-rating="1">À revoir</button>
                        <button type="button" class="rating-btn hard" data-rating="2">Difficile</button>
                        <button type="button" class="rating-btn good" data-rating="3">Bon</button>
                        <button type="button" class="rating-btn easy" data-rating="4">Facile</button>
                    </div>
                </div>
            </div>
        `;
    }

    function downloadAnkiPackage(caseData) {
        const cards = generateFlashcardsForCase(caseData);
        if (!cards.length) return;

        // Format Anki TSV : Front \t Back \t Tags
        const lines = cards.map(c => {
            const cleanFront = c.front.replace(/\t/g, ' ').replace(/\n/g, '<br>');
            const cleanBack = c.back.replace(/\t/g, ' ').replace(/\n/g, '<br>');
            return `${cleanFront}\t${cleanBack}\tMedGame::${caseData.id || 'R2C'}`;
        });

        const fileContent = lines.join('\n');
        const blob = new Blob([fileContent], { type: 'text/tab-separated-values;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MedGame_Anki_${caseData.id || 'case'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof window.showNotification === 'function') {
            window.showNotification('📥 Fichier Anki téléchargé ! Glissez-le dans Anki pour réviser.');
        }
        if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('correct');
    }

    /**
     * Branche les événements du widget Flashcard dans la modale de correction
     */
    function bindDebriefingEvents(containerEl, caseData) {
        if (!containerEl) return;

        const cards = generateFlashcardsForCase(caseData);
        let currentIndex = 0;

        const updateCardView = () => {
            const mount = containerEl.querySelector('#flashcards-viewer-mount');
            if (mount) {
                mount.innerHTML = renderFlashcardWidget(cards, currentIndex);
                bindInnerEvents();
            }
        };

        const bindInnerEvents = () => {
            const revealBtn = containerEl.querySelector('#btn-reveal-card');
            const backEl = containerEl.querySelector('#anki-card-back');
            const ratingsBar = containerEl.querySelector('#anki-rating-buttons');

            if (revealBtn && backEl) {
                revealBtn.addEventListener('click', () => {
                    backEl.style.display = 'block';
                    revealBtn.style.display = 'none';
                    if (ratingsBar) ratingsBar.style.display = 'flex';
                    if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('card_flip');
                });
            }

            containerEl.querySelectorAll('.rating-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('click');
                    if (currentIndex < cards.length - 1) {
                        currentIndex++;
                        updateCardView();
                    } else {
                        if (typeof window.showNotification === 'function') {
                            window.showNotification('🎉 Toutes les flashcards du cas ont été révisées !');
                        }
                    }
                });
            });

            const prevBtn = containerEl.querySelector('.btn-card-prev');
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (currentIndex > 0) {
                        currentIndex--;
                        updateCardView();
                    }
                });
            }

            const nextBtn = containerEl.querySelector('.btn-card-next');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    if (currentIndex < cards.length - 1) {
                        currentIndex++;
                        updateCardView();
                    }
                });
            }
        };

        bindInnerEvents();

        const exportBtn = containerEl.querySelector('#btn-export-anki');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                downloadAnkiPackage(caseData);
            });
        }
    }

    window.ClinicalDebriefing = {
        generateFlashcardsForCase,
        computeCompetencyProfile,
        renderDebriefingHTML,
        downloadAnkiPackage,
        bindDebriefingEvents
    };

})();
