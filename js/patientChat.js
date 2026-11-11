(function () {
    class PatientChat {
        constructor() {
            this.caseData = null;
            this.messages = [];
            this.panel = null;
            this.suggestedOpen = false;
            this.isAsking = false; // Deduplication guard

            // Dynamically inject styles for the typing indicator and cursor
            if (typeof document !== 'undefined' && !document.getElementById('patient-chat-styles')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'patient-chat-styles';
                styleEl.textContent = `
                    @keyframes blink {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0; }
                    }
                    .typing-cursor {
                        font-weight: bold;
                        color: #00f2fe;
                        animation: blink 0.8s infinite;
                        margin-left: 2px;
                    }
                    /* === Typing indicator animé === */
                    .typing-indicator {
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 12px;
                        background: rgba(0, 242, 254, 0.08);
                        border: 1px solid rgba(0, 242, 254, 0.15);
                        border-radius: 16px;
                        font-family: 'Outfit', sans-serif;
                        font-size: 0.82rem;
                        color: rgba(0, 242, 254, 0.7);
                    }
                    .typing-indicator-label {
                        white-space: nowrap;
                    }
                    .typing-dots {
                        display: inline-flex;
                        gap: 3px;
                        align-items: center;
                    }
                    .typing-dots span {
                        display: inline-block;
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background: #00f2fe;
                        animation: typingBounce 1.4s infinite ease-in-out;
                    }
                    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
                    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
                    @keyframes typingBounce {
                        0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
                        30% { transform: translateY(-6px); opacity: 1; }
                    }
                    /* Transition fluide vers le texte streaming */
                    .typing-indicator.fade-out {
                        opacity: 0;
                        transform: scale(0.95);
                        transition: opacity 0.25s ease, transform 0.25s ease;
                    }
                `;
                document.head.appendChild(styleEl);
            }
        }

        setCase(caseData, force = false) {
            const isSameCase = this.caseData && caseData && (this.caseData.id === caseData.id);
            this.caseData = caseData;
            
            // Si c'est un rafraîchissement partiel du même cas en cours, ne pas vider les messages
            if (isSameCase && !force && this.messages.length > 0) {
                return;
            }

            this.messages = [];
            this.panel = document.getElementById('dialogue-panel');
            // L'exemple de saisie nomme le collègue de garde sur ce cas.
            const inputEl = document.getElementById('dialogue-input');
            const nurse = window.PatientBrain?.staffFor?.(caseData)?.infirmier;
            if (inputEl && nurse) inputEl.placeholder = `Parlez au patient ou à l'équipe (ex. « ${nurse}, un ECG s'il vous plaît »)`;
            const messagesEl = document.getElementById('dialogue-messages');
            if (messagesEl) messagesEl.innerHTML = '';
            this.isAsking = false;

            // Re-enable UI inputs (sauf verrou quota actif)
            const input = document.getElementById('dialogue-input');
            const submitBtn = document.querySelector('#dialogue-form button[type="submit"]');
            if (input) input.disabled = false;
            if (submitBtn) submitBtn.disabled = false;
            if (window.QuotaGuard?.reapplyLock) window.QuotaGuard.reapplyLock();

            // Consultation en direct (js/patient-live.js) : nouvelle alliance.
            document.dispatchEvent(new CustomEvent('medgame:case-set', { detail: { caseData } }));
        }

        open() {
            this.panel = document.getElementById('dialogue-panel');
            if (!this.panel) return;
            this.panel.classList.add('active');
            this.panel.setAttribute('aria-hidden', 'false');
            this.panel.style.display = 'flex';
            if (this.messages.length === 0) {
                const patient = this.caseData?.patient || {};
                const nom = `${patient.prenom || ''} ${patient.nom || 'le patient'}`.trim();
                const ecosData = this.caseData?.ecos?.patientStandardise;
                
                let intro = '';
                if (ecosData?.phraseOuverture) {
                    intro = ecosData.phraseOuverture;
                } else {
                    const motif = this.caseData?.interrogatoire?.motifHospitalisation || '';
                    intro = motif
                        ? `Bonjour docteur. Je m'appelle ${nom}, je suis ici pour ${motif.toLowerCase()}.`
                        : `Bonjour docteur, je suis ${nom}. Qu'est-ce que vous voulez savoir ?`;
                }
                
                this.append('Patient', intro);
                // Sync starting message to message array so LLM receives it in history
                this.messages.push({ role: 'assistant', content: intro });
            }
            const input = document.getElementById('dialogue-input');
            if (input) input.focus();
            this._renderSuggestions();
            this._mountTutorButton();
        }

        _mountTutorButton() {
            if (document.getElementById('btn-dialogue-tutor')) return;
            const header = this.panel?.querySelector('.communicator-header');
            if (!header) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'btn-dialogue-tutor';
            btn.className = 'btn-dialogue-tutor';
            btn.title = "Demander un conseil d'orientation sémiologique au Tuteur Clinique R2C";
            btn.innerHTML = '<i class="fas fa-graduation-cap"></i> Conseil Tuteur R2C';
            btn.addEventListener('click', () => this.giveTutorAdvice());
            header.appendChild(btn);
        }

        giveTutorAdvice() {
            const caseData = this.caseData || window.gameState?.currentCase;
            if (!caseData) return;

            const userMsgCount = this.messages.filter(m => m.role === 'user').length;
            let advice = '';

            if (userMsgCount === 0) {
                advice = "Commencez par vous présenter poliment (*« Bonjour, je suis l'externe... »*) et posez une question ouverte sur le motif d'hospitalisation.";
            } else {
                const motif = (caseData.interrogatoire?.motifHospitalisation || caseData.id || '').toLowerCase();
                const badgeText = document.getElementById('notebook-badge-count')?.textContent || '0/5';

                if (badgeText.startsWith('0/') || badgeText.startsWith('1/') || badgeText.startsWith('2/')) {
                    advice = "Pensez à explorer méthodiquement le **PQRST** de la douleur : facteurs déclenchants/calmants (effort, trinitrine, repas), qualité (étau, brûlure, déchirement) et irradiations précises.";
                } else if (/thorac|angor|coeur/i.test(motif)) {
                    advice = "Devant une douleur thoracique, le réflexe R2C immédiat est d'éliminer les **5 urgences vitales (PIED)** : Infarctus/SCA, Dissection aortique, Embolie pulmonaire, Pneumothorax et Péricardite. Vérifiez l'heure de début et demandez un ECG per-critique sans délai !";
                } else if (/cephal|tete/i.test(motif)) {
                    advice = "Devant une céphalée aiguë, la question capitale est le **mode d'installation** : était-elle brutale en « coup de tonnerre » (< 1 min) évoquant une HSA, ou progressive ? Pensez à vérifier la nuque et la température !";
                } else if (/dyspnee|souffle/i.test(motif)) {
                    advice = "Devant une dyspnée aiguë, évaluez d'abord la tolérance (parole, FR, tirage) puis recherchez des antécédents cardiorespiratoires et des signes d'insuffisance cardiaque (orthopnée, râles crépitants).";
                } else if (/abdo|ventre/i.test(motif)) {
                    advice = "Devant une douleur abdominale, recherchez immédiatement les signes d'urgence chirurgicale : défense, contracture (« ventre de bois »), arrêt des matières et des gaz, et l'heure du dernier repas.";
                } else {
                    advice = "N'oubliez pas d'explorer le terrain complet : antécédents personnels/familiaux, traitements habituels et allergies avant de passer à l'examen physique méthodique.";
                }
            }

            this.append('Tuteur R2C', `💡 **Conseil pédagogique :** ${advice}`);
            if (typeof MedGameAudio !== 'undefined') MedGameAudio.play('paper');
        }

        close() {
            if (!this.panel) return;
            this.panel.classList.remove('active');
            this.panel.setAttribute('aria-hidden', 'true');
            this.panel.style.display = 'none';
        }

        _safeMarkdown(text) {
            if (!text) return '';
            // Filtre anti-fuite de prompt — strip PS, notes, méta-texte
            text = this._stripPromptLeaks(text);

            // Escape HTML for XSS safety
            let esc = text.replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;')
                          .replace(/"/g, '&quot;')
                          .replace(/'/g, '&#039;');
            
            // Safe inline markdown replacement
            esc = esc.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            esc = esc.replace(/\*(.*?)\*/g, '<em>$1</em>');
            return esc;
        }

        /**
         * Filtre côté client pour stripper tout texte qui fuite du prompt système.
         * Filet de sécurité — le prompt devrait déjà empêcher ça.
         */
        _stripPromptLeaks(text) {
            if (!text) return '';
            let t = text;
            // Supprimer uniquement les blocs PS/Note en fin de message (une ligne), pas glouton sur tout le reste
            t = t.replace(/\n\s*PS\s*[:\.][^\n]*$/i, '');
            t = t.replace(/\n\s*Note\s*[:\.][^\n]*$/i, '');
            t = t.replace(/\(Note\s*:[^)]*\)/gi, '');
            // Supprimer les "system-reminder" ou "Plan Mode" uniquement s'ils sont en fin
            t = t.replace(/\n\s*(system[- ]reminder|Plan Mode|Operational Mode)[^\n]*$/i, '');
            // Supprimer les blocs entre crochets [action], [thinking], etc.
            t = t.replace(/\[(thinking|action|note|context|system)[^\]]*\]/gi, '');
            return t.trim();
        }

        // ===== QUESTIONS SUGGÉRÉES =====

        _getSuggestedQuestions() {
            const c = this.caseData || {};
            const i = c.interrogatoire || {};
            const questions = [];

            // Add questions only if corresponding clinical facts exist in the JSON
            if (i.motifHospitalisation) {
                questions.push({
                    q: 'Qu\'est-ce qui vous amène ?',
                    fieldPath: 'interrogatoire.motifHospitalisation'
                });
            }

            if (i.histoireMaladie) {
                if (i.histoireMaladie.debutSymptomes) {
                    questions.push({
                        q: 'Depuis quand avez-vous ces symptômes ?',
                        fieldPath: 'interrogatoire.histoireMaladie.debutSymptomes'
                    });
                }
                if (i.histoireMaladie.symptomesAssocies && 
                    (Array.isArray(i.histoireMaladie.symptomesAssocies) ? i.histoireMaladie.symptomesAssocies.length > 0 : i.histoireMaladie.symptomesAssocies)) {
                    questions.push({
                        q: 'Avez-vous d\'autres symptômes associés ?',
                        fieldPath: 'interrogatoire.histoireMaladie.symptomesAssocies'
                    });
                }
                if (i.histoireMaladie.descriptionDouleur) {
                    questions.push({
                        q: 'Où avez-vous mal / pouvez-vous décrire la douleur ?',
                        fieldPath: 'interrogatoire.histoireMaladie.descriptionDouleur'
                    });
                }
                if (i.histoireMaladie.evolution) {
                    questions.push({
                        q: 'Comment ont évolué vos symptômes ?',
                        fieldPath: 'interrogatoire.histoireMaladie.evolution'
                    });
                }
                if (i.histoireMaladie.facteursDeclenchants) {
                    questions.push({
                        q: 'Quels facteurs déclenchent ou aggravent vos symptômes ?',
                        fieldPath: 'interrogatoire.histoireMaladie.facteursDeclenchants'
                    });
                }
            }

            if (i.antecedents) {
                const atcd = i.antecedents;
                if (atcd.medicaux && atcd.medicaux.length > 0) {
                    questions.push({
                        q: 'Avez-vous des antécédents médicaux ?',
                        fieldPath: 'interrogatoire.antecedents.medicaux'
                    });
                }
                if (atcd.chirurgicaux && atcd.chirurgicaux.length > 0) {
                    questions.push({
                        q: 'Avez-vous été opéré par le passé ?',
                        fieldPath: 'interrogatoire.antecedents.chirurgicaux'
                    });
                }
                if (atcd.familiaux && atcd.familiaux.length > 0) {
                    questions.push({
                        q: 'Y a-t-il des antécédents notables dans votre famille ?',
                        fieldPath: 'interrogatoire.antecedents.familiaux'
                    });
                }
            }

            if (i.allergies && i.allergies.presence) {
                questions.push({
                    q: 'Avez-vous des allergies ?',
                    fieldPath: 'interrogatoire.allergies'
                });
            }

            if (i.traitements && (Array.isArray(i.traitements) ? i.traitements.length > 0 : i.traitements)) {
                questions.push({
                    q: 'Prenez-vous des médicaments régulièrement ?',
                    fieldPath: 'interrogatoire.traitements'
                });
            }

            if (i.modeDeVie) {
                if (i.modeDeVie.tabac) {
                    questions.push({
                        q: 'Fumez-vous du tabac ?',
                        fieldPath: 'interrogatoire.modeDeVie.tabac'
                    });
                }
                if (i.modeDeVie.alcool) {
                    questions.push({
                        q: 'Consommez-vous de l\'alcool ?',
                        fieldPath: 'interrogatoire.modeDeVie.alcool.quantite'
                    });
                }
            }

            if (c.examenClinique?.aspectGeneral) {
                questions.push({
                    q: 'Comment vous sentez-vous en ce moment ?',
                    fieldPath: 'interrogatoire.histoireMaladie.descriptionDouleur'
                });
            }

            // Exclude already asked questions from suggestions (checked via scoringState)
            const asked = window.scoringState?.demarche?.interrogatoireAsked || new Set();
            let filteredQuestions = questions.filter(item => !asked.has(item.fieldPath));

            // Prioritize questions so critical diagnostic info appears first
            const priority = {
                'interrogatoire.motifHospitalisation': 10,
                'interrogatoire.histoireMaladie.descriptionDouleur': 9,
                'interrogatoire.histoireMaladie.debutSymptomes': 8,
                'interrogatoire.histoireMaladie.symptomesAssocies': 7,
                'interrogatoire.histoireMaladie.evolution': 6,
                'interrogatoire.histoireMaladie.facteursDeclenchants': 5,
                'interrogatoire.antecedents.medicaux': 4,
                'interrogatoire.antecedents.chirurgicaux': 3,
                'interrogatoire.traitements': 2,
                'interrogatoire.allergies': 1,
                'default': 0
            };

            filteredQuestions.sort((a, b) => {
                const prioA = priority[a.fieldPath] || 0;
                const prioB = priority[b.fieldPath] || 0;
                return prioB - prioA;
            });

            return filteredQuestions;
        }

        _renderSuggestions() {
            let container = document.getElementById('chat-suggestions');
            if (!container) {
                container = document.createElement('div');
                container.id = 'chat-suggestions';
                container.style.cssText = 'margin-top:8px;padding:4px 0;';
                const formParent = document.getElementById('dialogue-form')?.parentNode;
                if (formParent) {
                    const form = document.getElementById('dialogue-form');
                    if (form && form.nextSibling) {
                        formParent.insertBefore(container, form.nextSibling);
                    } else if (form) {
                        formParent.appendChild(container);
                    }
                }
            }
            container.innerHTML = '';

            const questions = this._getSuggestedQuestions();
            if (questions.length === 0) return;

            // Bouton déroulant
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'suggested-questions-toggle';
            toggleBtn.innerHTML = this.suggestedOpen ? '<i class="fas fa-lightbulb"></i> Questions suggérées <i class="fas fa-chevron-up" style="float:right;margin-top:2px;"></i>' : '<i class="fas fa-lightbulb"></i> Questions suggérées <i class="fas fa-chevron-down" style="float:right;margin-top:2px;"></i>';
            toggleBtn.style.cssText = `
                width: 100%; text-align: left; margin-top: 8px;
            `;

            const list = document.createElement('div');
            list.style.cssText = `display:${this.suggestedOpen ? 'flex' : 'none'}; margin-top:8px; max-height:180px; overflow-y:auto; flex-wrap:wrap; gap:6px;`;

            toggleBtn.addEventListener('click', () => {
                this.suggestedOpen = !this.suggestedOpen;
                list.style.display = this.suggestedOpen ? 'flex' : 'none';
                toggleBtn.innerHTML = this.suggestedOpen ? '<i class="fas fa-lightbulb"></i> Questions suggérées <i class="fas fa-chevron-up" style="float:right;margin-top:2px;"></i>' : '<i class="fas fa-lightbulb"></i> Questions suggérées <i class="fas fa-chevron-down" style="float:right;margin-top:2px;"></i>';
            });

            // Boutons de questions (slice 8)
            questions.slice(0, 8).forEach(item => {
                const btn = document.createElement('button');
                btn.className = 'suggested-question-chip';
                btn.textContent = item.q;
                btn.addEventListener('click', () => {
                    if (this.isAsking) return;
                    this.askSuggested(item.q, item.fieldPath);
                    this.suggestedOpen = false;
                    list.style.display = 'none';
                    toggleBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Questions suggérées <i class="fas fa-chevron-down" style="float:right;margin-top:2px;"></i>';
                });
                list.appendChild(btn);
            });

            container.appendChild(toggleBtn);
            container.appendChild(list);
        }

        askSuggested(question, fieldPath) {
            if (!question || !question.trim()) return;
            if (this.isAsking) return;
            // Let the main ask() function handle the rendering and tracking
            this.ask(question);
        }

        async ask(question) {
            if (!question || !question.trim()) return;
            if (window.gameState && window.gameState.isPatientDead) {
                this.append('Système', '💀 Le patient est décédé — aucune réponse possible. Consultez la correction.');
                if (typeof showNotification === 'function') showNotification('Patient décédé', 'error');
                return;
            }

            if (window.PatientLive?.isLocked?.()) {
                this.append('Système', 'Le patient a quitté le box : il ne vous répondra plus. Poursuivez le dossier.');
                return;
            }

            // Deduplication / loading guard
            if (this.isAsking) {
                console.warn("[PatientChat] Already waiting for patient response, ignoring input.");
                return;
            }
            this.isAsking = true;
            document.dispatchEvent(new CustomEvent('medgame:student-said', { detail: { text: question } }));

            // Disable UI inputs
            const input = document.getElementById('dialogue-input');
            const submitBtn = document.querySelector('#dialogue-form button[type="submit"]');
            if (input) input.disabled = true;
            if (submitBtn) submitBtn.disabled = true;

            this.append('Vous', question);
            this.messages.push({ role: 'user', content: question });
            if (window.scoringState) window.scoringState.hasAskedPatient = true;

            // Track clinical progress (scoring) if typed question matches a suggestion
            const suggestions = this._getSuggestedQuestions();
            const normalizedQ = question.toLowerCase().replace(/[?!.,;:\s'"]/g, '').trim();
            for (const s of suggestions) {
                const normalizedS = s.q.toLowerCase().replace(/[?!.,;:\s'"]/g, '').trim();
                if (normalizedQ === normalizedS) {
                    if (s.fieldPath) {
                        if (typeof trackInterrogatoire === 'function') {
                            trackInterrogatoire(s.fieldPath);
                        }
                        document.dispatchEvent(new CustomEvent('interrogatoire-asked', { detail: { path: s.fieldPath } }));
                    }
                    break;
                }
            }

            const loading = this.append('Patient', '...', true);
            loading.setAttribute('data-raw-text', '');
            loading.setAttribute('data-is-typing', 'true');

            // Indicateur de typing visible avec animation
            loading.innerHTML = `
                <span class="typing-indicator">
                    <span class="typing-indicator-label">Le patient réfléchit</span>
                    <span class="typing-dots"><span></span><span></span><span></span></span>
                </span>`;

            const cleanUpAskingState = () => {
                this.isAsking = false;
                if (input) input.disabled = false;
                if (submitBtn) submitBtn.disabled = false;
                
                if (input) input.focus();
                this._renderSuggestions();
            };

            // call centralized MedicalGameManager module
            if (window.medicalGameManager) {
                // Le Maître du Jeu stream sa réponse : la parole du patient
                // s'affiche (et se dit) pendant que le reste du JSON s'écrit.
                const onProgress = (e) => {
                    const t = e.detail?.text;
                    if (!t || loading.getAttribute('data-is-typing') === null) return;
                    loading.innerHTML = this._safeMarkdown(t) + '<span class="typing-cursor">|</span>';
                    const root = document.getElementById('dialogue-messages');
                    if (root) root.scrollTop = root.scrollHeight;
                };
                document.addEventListener('medgame:patient-dialogue-progress', onProgress);
                try {
                    const result = await window.medicalGameManager.processAction(question);
                    document.removeEventListener('medgame:patient-dialogue-progress', onProgress);
                    loading.removeAttribute('data-is-typing');

                    let displayHTML = "";
                    let rawTextForHistory = "";
                    const team = Array.isArray(result.team) ? result.team : [];
                    const teamOnly = team.length && !result.narrative && !result.dialogue;

                    if (teamOnly) {
                        // Seul un collègue répond : pas de ligne « patient ».
                        loading.closest('.dialogue-message')?.remove();
                    } else if (result.narrative && result.dialogue) {
                        const safeNarr = this._safeMarkdown(result.narrative);
                        const safeDial = this._safeMarkdown(result.dialogue);
                        displayHTML = `<span class="clinical-stage-direction">${safeNarr}</span>${safeDial}`;
                        rawTextForHistory = `*(${result.narrative})* "${result.dialogue}"`;
                    } else if (result.narrative) {
                        const safeNarr = this._safeMarkdown(result.narrative);
                        displayHTML = `<span class="clinical-stage-direction">${safeNarr}</span>`;
                        rawTextForHistory = `*${result.narrative}*`;
                        
                        // Modifier l'étiquette pour "Maître du Jeu" s'il n'y a pas de dialogue direct
                        const labelEl = loading.parentNode?.querySelector('.ecos-msg-speaker');
                        if (labelEl) labelEl.textContent = "Observation";
                        loading.parentNode?.classList.replace('from-patient', 'from-system');
                    } else if (result.dialogue) {
                        const safeDial = this._safeMarkdown(result.dialogue);
                        displayHTML = safeDial;
                        rawTextForHistory = `"${result.dialogue}"`;
                    } else {
                        displayHTML = `<span class="clinical-stage-direction">Le patient ne réagit pas.</span>`;
                        rawTextForHistory = `Le patient ne réagit pas.`;
                        const labelEl = loading.parentNode?.querySelector('.ecos-msg-speaker');
                        if (labelEl) labelEl.textContent = "Observation";
                        loading.parentNode?.classList.replace('from-patient', 'from-system');
                    }

                    if (!teamOnly) {
                        loading.innerHTML = displayHTML;
                        loading.classList.add('answer-fade-in');
                    }
                    // Les collègues sollicités répondent chacun sur leur ligne.
                    const teamText = this.appendTeam(team);
                    if (teamText) rawTextForHistory = rawTextForHistory ? `${rawTextForHistory}\n${teamText}` : teamText;
                    this.messages.push({ role: 'assistant', content: rawTextForHistory });
                    const root = document.getElementById('dialogue-messages');
                    if (root) root.scrollTop = root.scrollHeight;

                } catch (err) {
                    document.removeEventListener('medgame:patient-dialogue-progress', onProgress);
                    document.dispatchEvent(new CustomEvent('medgame:patient-error'));
                    console.error('[PatientChat] MedicalGameManager error:', err);
                    // Quota épuisé → verrou tablette + bannière/modale (pas d'erreur technique)
                    if (window.QuotaGuard?.blocksTablet?.(err)) {
                        window.QuotaGuard.lockTablet({
                            reason: err.reason || 'quota',
                            remaining_day: err.remaining_day ?? null,
                            remaining_week: err.remaining_week ?? null
                        });
                        loading.removeAttribute('data-is-typing');
                        loading.remove();
                        this.isAsking = false; // libérer le guard SANS réactiver les inputs (verrou quota)
                        return;
                    }
                    const errMsg = err?.message || String(err);
                    // Plus de fallback silencieux : afficher l'erreur technique
                    const errorAnswer = `⚠️ [ERREUR LLM] ${errMsg}\n→ Vérifiez : proxy LLM démarré ? .env → LLM_API_KEY / LLM_API_URL ? Console (F12) → Network`;
                    loading.removeAttribute('data-is-typing');
                    loading.innerHTML = this._safeMarkdown(errorAnswer);
                    loading.classList.add('answer-fade-in');
                    { const row = loading.closest('.dialogue-message'); if (row) { row.classList.add('is-error'); row.classList.replace('from-patient', 'from-system'); const lab = row.querySelector('.ecos-msg-speaker'); if (lab) lab.textContent = 'Système'; } }
                    this.messages.push({ role: 'assistant', content: errorAnswer });
                }
            } else {
                // Maître du Jeu absent (js/MedicalGameManager.js non chargé)
                const errorAnswer = `⚠️ [ERREUR LLM] Maître du Jeu absent (window.medicalGameManager manquant).
→ Vérifiez que js/MedicalGameManager.js est chargé et ouvrez via http://localhost (pas file://).`;
                loading.removeAttribute('data-is-typing');
                loading.innerHTML = this._safeMarkdown(errorAnswer);
                loading.classList.add('answer-fade-in');
                { const row = loading.closest('.dialogue-message'); if (row) { row.classList.add('is-error'); row.classList.replace('from-patient', 'from-system'); const lab = row.querySelector('.ecos-msg-speaker'); if (lab) lab.textContent = 'Système'; } }
                this.messages.push({ role: 'assistant', content: errorAnswer });
            }

            // ECOS semantic evaluation hook
            if (window.EcosMode && typeof window.EcosMode.classifyAndCheck === 'function') {
                const lastAssistantMsg = this.messages[this.messages.length - 1];
                if (lastAssistantMsg && lastAssistantMsg.role === 'assistant') {
                    window.EcosMode.classifyAndCheck(question, lastAssistantMsg.content);
                }
            }

            cleanUpAskingState();
        }

        /**
         * Affiche la réponse des collègues (infirmier, radiologue, laboratoire…)
         * décidée par le Maître du Jeu. Renvoie le texte pour l'historique.
         */
        appendTeam(team) {
            const root = document.getElementById('dialogue-messages');
            if (!root || !Array.isArray(team) || !team.length) return '';
            const lines = [];
            for (const m of team) {
                if (!m || !m.says) continue;
                const row = document.createElement('div');
                row.className = 'dialogue-message from-team answer-fade-in';
                row.dataset.teamRole = m.role || '';
                const label = document.createElement('span');
                label.className = 'ecos-msg-speaker';
                label.textContent = m.speaker || 'Équipe';
                if (m.delayMin) {
                    const delay = document.createElement('span');
                    delay.className = 'team-delay';
                    delay.textContent = `${m.delayMin} min plus tard`;
                    label.append(' ', delay);
                }
                const body = document.createElement('span');
                body.className = 'ecos-msg-text';
                body.textContent = m.says;
                row.append(label, body);
                root.appendChild(row);
                lines.push(`${m.speaker || 'Équipe'} : "${m.says}"`);
            }
            root.scrollTop = root.scrollHeight;
            return lines.join('\n');
        }

        append(speaker, text, returnTextNode = false) {
            const root = document.getElementById('dialogue-messages');
            if (!root) return document.createTextNode('');
            const row = document.createElement('div');
            const roleClass = (typeof speakerRoleClass === 'function') ? speakerRoleClass(speaker) : (speaker === 'Vous' ? 'from-user' : 'from-patient');
            row.className = `dialogue-message ${roleClass}`;
            const isUser = roleClass === 'from-user';
            const speakerLabel = (typeof speakerDisplayName === 'function') ? speakerDisplayName(speaker) : (isUser ? 'Vous' : (speaker || 'Patient'));
            const label = document.createElement('span');
            label.className = 'ecos-msg-speaker';
            label.textContent = speakerLabel;
            const body = document.createElement('span');
            body.className = 'ecos-msg-text';
            const formatted = isUser ? this._safeMarkdown(text) : this._safeMarkdown(text).replace(/\(([^)]+)\)/g, '<span class="clinical-stage-direction">$1</span>');
            body.innerHTML = formatted;
            row.append(label, body);
            root.appendChild(row);
            root.scrollTop = root.scrollHeight;
            return returnTextNode ? body : row;
        }
    }

    window.patientChat = new PatientChat();
    document.addEventListener('DOMContentLoaded', () => {
        const form = document.getElementById('dialogue-form');
        if (form) {
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                const input = document.getElementById('dialogue-input');
                const value = input?.value || '';
                if (input) input.value = '';
                window.patientChat.ask(value);
            });
        }
        document.querySelectorAll('[data-close-panel="dialogue-panel"]').forEach((button) => {
            button.addEventListener('click', () => window.patientChat.close());
        });
    });
})();
