(function () {
    class PatientChat {
        constructor() {
            this.caseData = null;
            this.messages = [];
            this.panel = null;
            this.suggestedOpen = false;
            /** @type {import('./llm-patient.js').LLMPatient|null} */
            this._llm = null;
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

        setCase(caseData) {
            this.caseData = caseData;
            this.messages = [];
            this.panel = document.getElementById('dialogue-panel');
            const messagesEl = document.getElementById('dialogue-messages');
            if (messagesEl) messagesEl.innerHTML = '';
            this.isAsking = false;

            // Re-enable UI inputs
            const input = document.getElementById('dialogue-input');
            const submitBtn = document.querySelector('#dialogue-form button[type="submit"]');
            if (input) input.disabled = false;
            if (submitBtn) submitBtn.disabled = false;

            this._llm = null;
            if (window.LLMPatient) {
                try {
                    this._llm = new window.LLMPatient(caseData);
                } catch (e) {
                    console.warn('[PatientChat] LLMPatient init failed, using fallback:', e);
                }
            }
        }

        open() {
            this.panel = document.getElementById('dialogue-panel');
            if (!this.panel) return;
            this.panel.classList.add('active');
            this.panel.setAttribute('aria-hidden', 'false');
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
        }

        close() {
            if (!this.panel) return;
            this.panel.classList.remove('active');
            this.panel.setAttribute('aria-hidden', 'true');
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
            // Supprimer les blocs "PS ..." jusqu'à la fin
            t = t.replace(/\n\s*PS\s*[:\.].*$/s, '');
            // Supprimer les blocs "Note:" ou "(Note: ...)"
            t = t.replace(/\n\s*Note\s*[:\.].*$/s, '');
            t = t.replace(/\(Note\s*:[^)]*\)/gi, '');
            // Supprimer les "system-reminder" ou "Plan Mode"
            t = t.replace(/\n\s*(system[- ]reminder|Plan Mode|Operational Mode).*$/s, '');
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
            toggleBtn.textContent = this.suggestedOpen ? '📋 Questions suggérées ▲' : '📋 Questions suggérées ▼';
            toggleBtn.style.cssText = `
                background: rgba(0,242,254,0.12); border: 1px solid rgba(0,242,254,0.3);
                color: #00f2fe; padding: 6px 12px; border-radius: 20px; cursor: pointer;
                font-size: 0.82rem; font-family: 'Outfit', sans-serif; width: 100%;
                text-align: left; transition: all 0.2s;
            `;
            toggleBtn.addEventListener('mouseenter', () => toggleBtn.style.background = 'rgba(0,242,254,0.22)');
            toggleBtn.addEventListener('mouseleave', () => toggleBtn.style.background = 'rgba(0,242,254,0.12)');

            const list = document.createElement('div');
            list.style.cssText = `display:${this.suggestedOpen ? 'flex' : 'none'}; margin-top:6px; max-height:180px; overflow-y:auto; flex-wrap:wrap; gap:4px;`;

            toggleBtn.addEventListener('click', () => {
                this.suggestedOpen = !this.suggestedOpen;
                list.style.display = this.suggestedOpen ? 'flex' : 'none';
                toggleBtn.textContent = this.suggestedOpen ? '📋 Questions suggérées ▲' : '📋 Questions suggérées ▼';
            });

            // Boutons de questions (slice 8)
            questions.slice(0, 8).forEach(item => {
                const btn = document.createElement('button');
                btn.textContent = item.q;
                btn.style.cssText = `
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15);
                    color: rgba(255,255,255,0.85); padding: 5px 10px; border-radius: 14px;
                    cursor: pointer; font-size: 0.78rem; font-family: 'Outfit', sans-serif;
                    text-align: left; transition: all 0.2s; flex: 1 1 auto; min-width: 0;
                `;
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = 'rgba(0,242,254,0.15)';
                    btn.style.borderColor = 'rgba(0,242,254,0.4)';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'rgba(255,255,255,0.06)';
                    btn.style.borderColor = 'rgba(255,255,255,0.15)';
                });
                btn.addEventListener('click', () => {
                    if (this.isAsking) return;
                    this.askSuggested(item.q, item.fieldPath);
                    this.suggestedOpen = false;
                    list.style.display = 'none';
                    toggleBtn.textContent = '📋 Questions suggérées ▼';
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

            // Deduplication / loading guard
            if (this.isAsking) {
                console.warn("[PatientChat] Already waiting for patient response, ignoring input.");
                return;
            }
            this.isAsking = true;

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

            // call centralized LLMPatient module
            if (this._llm) {
                try {
                    await new Promise((resolve, reject) => {
                        this._llm.ask(
                            question,
                            (token, reset) => {
                                if (reset) {
                                    loading.setAttribute('data-raw-text', '');
                                    loading.innerHTML = `
                                        <span class="typing-indicator">
                                            <span class="typing-indicator-label">Le patient réfléchit</span>
                                            <span class="typing-dots"><span></span><span></span><span></span></span>
                                        </span>`;
                                } else {
                                    // Premier token reçu : transition fluide
                                    if (loading.getAttribute('data-is-typing') === 'true') {
                                        loading.setAttribute('data-is-typing', 'false');
                                        const indicator = loading.querySelector('.typing-indicator');
                                        if (indicator) {
                                            indicator.remove();
                                        }
                                    }

                                    const currentText = loading.getAttribute('data-raw-text') || '';
                                    const newText = currentText + token;
                                    loading.setAttribute('data-raw-text', newText);
                                    
                                    // Render markdown safely with trailing cursor
                                    loading.innerHTML = this._safeMarkdown(newText) + '<span class="typing-cursor">|</span>';
                                }
                                const root = document.getElementById('dialogue-messages');
                                if (root) root.scrollTop = root.scrollHeight;
                            },
                            (fullText) => {
                                // complete: render clean markdown
                                loading.innerHTML = this._safeMarkdown(fullText);
                                loading.classList.add('answer-fade-in');
                                this.messages.push({ role: 'assistant', content: fullText });
                                resolve();
                            },
                            (err) => reject(new Error(err))
                        );
                    });
                } catch (err) {
                    console.warn('[PatientChat] LLMPatient error, calling fallback:', err);
                    const localAnswer = this.fallback(question);
                    loading.removeAttribute('data-is-typing');
                    loading.innerHTML = this._safeMarkdown(localAnswer);
                    loading.classList.add('answer-fade-in');
                    this.messages.push({ role: 'assistant', content: localAnswer });
                }
            } else {
                const localAnswer = this.fallback(question);
                loading.removeAttribute('data-is-typing');
                loading.innerHTML = this._safeMarkdown(localAnswer);
                loading.classList.add('answer-fade-in');
                this.messages.push({ role: 'assistant', content: localAnswer });
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

        fallback(question) {
            if (window.llmFallback && this.caseData) {
                return window.llmFallback.answer(question, this.caseData);
            }
            return `[Erreur : Le moteur de simulation du patient (LLM) n'est pas disponible.]`;
        }

        stringifyPatient(value) {
            if (!value) return '';
            if (typeof value === 'string') return value;
            if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : Object.values(item).filter(Boolean).join(' ')).join(', ');
            if (typeof value === 'object') return Object.values(value).flat().filter(Boolean).map(item => typeof item === 'string' ? item : Object.values(item).filter(Boolean).join(' ')).join(', ');
            return String(value);
        }

        append(speaker, text, returnTextNode = false) {
            const root = document.getElementById('dialogue-messages');
            if (!root) return document.createTextNode('');
            const row = document.createElement('div');
            row.className = `dialogue-message ${speaker === 'Vous' ? 'from-user' : 'from-patient'}`;
            const label = document.createElement('strong');
            label.textContent = `${speaker} : `;
            const body = document.createElement('span');
            body.innerHTML = this._safeMarkdown(text);
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
