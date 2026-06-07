(function () {
    class PatientChat {
        constructor() {
            this.caseData = null;
            this.messages = [];
            this.panel = null;
            this.suggestedOpen = false;
        }

        setCase(caseData) {
            this.caseData = caseData;
            this.messages = [];
            this.panel = document.getElementById('dialogue-panel');
            const messagesEl = document.getElementById('dialogue-messages');
            if (messagesEl) messagesEl.innerHTML = '';
        }

        open() {
            this.panel = document.getElementById('dialogue-panel');
            if (!this.panel) return;
            this.panel.classList.add('active');
            this.panel.setAttribute('aria-hidden', 'false');
            if (this.messages.length === 0) {
                const patient = this.caseData?.patient || {};
                const nom = `${patient.prenom || ''} ${patient.nom || 'le patient'}`.trim();
                const motif = this.caseData?.interrogatoire?.motifHospitalisation || '';
                const intro = motif
                    ? `Bonjour docteur. Je m'appelle ${nom}, je suis ici pour ${motif.toLowerCase()}.`
                    : `Bonjour docteur, je suis ${nom}. Qu'est-ce que vous voulez savoir ?`;
                this.append('Patient', intro);
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

        // ===== QUESTIONS SUGGÉRÉES =====

        _getSuggestedQuestions() {
            const c = this.caseData || {};
            const i = c.interrogatoire || {};
            const p = c.patient || {};
            const questions = [];

        // Questions de base toujours disponibles
        questions.push({
            q: 'Qu\'est-ce qui vous amène ?',
            a: i.motifHospitalisation || 'Je ne me sens pas bien docteur, c\'est pour ça qu\'on m\'a amené.',
            fieldPath: 'interrogatoire.motifHospitalisation'
        });

            if (i.histoireMaladie) {
                if (i.histoireMaladie.debutSymptomes) {
                    questions.push({
                        q: 'Depuis quand avez-vous ces symptômes ?',
                        a: i.histoireMaladie.descriptionDouleur
                            ? `Ça a commencé ${i.histoireMaladie.debutSymptomes.toLowerCase()}. ${i.histoireMaladie.descriptionDouleur}.`
                            : `Ça a commencé ${i.histoireMaladie.debutSymptomes.toLowerCase()}.`,
                        fieldPath: 'interrogatoire.histoireMaladie.debutSymptomes'
                    });
                }
                if (i.histoireMaladie.symptomesAssocies) {
                    const symps = Array.isArray(i.histoireMaladie.symptomesAssocies)
                        ? i.histoireMaladie.symptomesAssocies.join(', ')
                        : i.histoireMaladie.symptomesAssocies;
                    questions.push({
                        q: 'Avez-vous d\'autres symptômes ?',
                        a: `Oui docteur, j'ai aussi ${symps?.toLowerCase() || 'des choses qui me gênent'}.`,
                        fieldPath: 'interrogatoire.histoireMaladie.symptomesAssocies'
                    });
                }
                if (i.histoireMaladie.descriptionDouleur) {
                    questions.push({
                        q: 'Où avez-vous mal ?',
                        a: i.histoireMaladie.descriptionDouleur,
                        fieldPath: 'interrogatoire.histoireMaladie.descriptionDouleur'
                    });
                }
            }

            if (i.antecedents) {
                const atcd = i.antecedents;
                if (atcd.medicaux && atcd.medicaux.length > 0) {
                    questions.push({
                        q: 'Avez-vous des antécédents médicaux ?',
                        a: `Oui, ${Array.isArray(atcd.medicaux) ? atcd.medicaux.join(', ') : atcd.medicaux}.`,
                        fieldPath: 'interrogatoire.antecedents.medicaux'
                    });
                }
                if (atcd.chirurgicaux && atcd.chirurgicaux.length > 0) {
                    questions.push({
                        q: 'Avez-vous été opéré ?',
                        a: `Oui, ${Array.isArray(atcd.chirurgicaux) ? atcd.chirurgicaux.join(', ') : atcd.chirurgicaux}.`,
                        fieldPath: 'interrogatoire.antecedents.chirurgicaux'
                    });
                }
            }

            if (i.allergies && i.allergies.presence) {
                questions.push({
                    q: 'Avez-vous des allergies ?',
                    a: (() => {
                        const liste = i.allergies.liste;
                        if (Array.isArray(liste)) {
                            return liste.map(a => a.allergene ? `Je suis allergique à ${a.allergene}` : 'Je ne sais pas trop').join('. ');
                        }
                        return 'Oui, j\'ai des allergies.';
                    })(),
                    fieldPath: 'interrogatoire.allergies'
                });
            }

            if (i.traitements && (Array.isArray(i.traitements) ? i.traitements.length > 0 : i.traitements)) {
                questions.push({
                    q: 'Prenez-vous des médicaments ?',
                    a: Array.isArray(i.traitements)
                        ? `Oui, je prends ${i.traitements.join(', ')}.`
                        : `Oui, ${i.traitements}.`,
                    fieldPath: 'interrogatoire.traitements'
                });
            }

            if (i.modeDeVie) {
                if (i.modeDeVie.tabac) {
                    questions.push({
                        q: 'Fumez-vous ?',
                        a: `${i.modeDeVie.tabac.quantite || 'Je préfère ne pas en parler.'}`,
                        fieldPath: 'interrogatoire.modeDeVie.tabac'
                    });
                }
                if (i.modeDeVie.alcool) {
                    questions.push({
                        q: 'Consommez-vous de l\'alcool ?',
                        a: `${i.modeDeVie.alcool.quantite || 'Occasionnellement.'}`,
                        fieldPath: 'interrogatoire.modeDeVie.alcool.quantite'
                    });
                }
                if (i.modeDeVie.activitePhysique) {
                    questions.push({
                        q: 'Quelle est votre activité physique ?',
                        a: i.modeDeVie.activitePhysique?.description || 'Je ne fais pas beaucoup de sport.',
                        fieldPath: 'interrogatoire.modeDeVie.activitePhysique.description'
                    });
                }
            }

            // Question examen physique
            questions.push({
                q: 'Comment vous sentez-vous en ce moment ?',
                a: c.examenClinique?.aspectGeneral || 'Ça va... enfin, c\'est pour ça que je suis là.',
                fieldPath: 'interrogatoire.histoireMaladie.symptomesActuels'
            });

            return questions;
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
            toggleBtn.textContent = '📋 Questions suggérées ▼';
            toggleBtn.style.cssText = `
                background: rgba(0,242,254,0.12); border: 1px solid rgba(0,242,254,0.3);
                color: #00f2fe; padding: 6px 12px; border-radius: 20px; cursor: pointer;
                font-size: 0.82rem; font-family: 'Outfit', sans-serif; width: 100%;
                text-align: left; transition: all 0.2s;
            `;
            toggleBtn.addEventListener('mouseenter', () => toggleBtn.style.background = 'rgba(0,242,254,0.22)');
            toggleBtn.addEventListener('mouseleave', () => toggleBtn.style.background = 'rgba(0,242,254,0.12)');

            const list = document.createElement('div');
            list.style.cssText = 'display:none; margin-top:6px; max-height:180px; overflow-y:auto;';

            toggleBtn.addEventListener('click', () => {
                this.suggestedOpen = !this.suggestedOpen;
                list.style.display = this.suggestedOpen ? 'flex' : 'none';
                toggleBtn.textContent = this.suggestedOpen ? '📋 Questions suggérées ▲' : '📋 Questions suggérées ▼';
            });

            // Boutons de questions
            list.style.cssText += 'flex-wrap:wrap; gap:4px;';
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
                    this.askSuggested(item.q, item.a, item.fieldPath);
                    // Fermer le dropdown après clic
                    this.suggestedOpen = false;
                    list.style.display = 'none';
                    toggleBtn.textContent = '📋 Questions suggérées ▼';
                });
                list.appendChild(btn);
            });

            container.appendChild(toggleBtn);
            container.appendChild(list);
        }

        askSuggested(question, prebuiltAnswer, fieldPath) {
            if (!question.trim()) return;
            this.append('Vous', question);
            this.messages.push({ role: 'user', content: question });
            if (window.scoringState) window.scoringState.hasAskedPatient = true;

            // Suivi démarche pour le scoring composite — tracer le fieldPath
            if (fieldPath) {
                if (typeof trackInterrogatoire === 'function') {
                    trackInterrogatoire(fieldPath);
                }
                document.dispatchEvent(new CustomEvent('interrogatoire-asked', { detail: { path: fieldPath } }));
            }

            // Réponse pré-construite : pas d'appel LLM
            this.append('Patient', prebuiltAnswer);
            this.messages.push({ role: 'assistant', content: prebuiltAnswer });
        }

        buildSystemPrompt() {
            const c = this.caseData || {};
            const patient = c.patient || {};
            const interrogatoire = c.interrogatoire || {};
            const examClinique = c.examenClinique || {};
            const specialty = (c.specialty || c.id || '').toUpperCase();
            const difficulty = c.difficulty || 1;

            // Index de gravité basé sur les constantes
            const constantes = examClinique.constantes || {};
            const spo2 = this._parseVitalNum(constantes.saturationO2);
            const fc = this._parseVitalNum(constantes.pouls);
            const temp = this._parseVitalNum(constantes.temperature);
            let severityHint = '';
            if (spo2 !== null && spo2 < 90) severityHint = 'Vous êtes en détresse respiratoire, vous parlez avec difficulté et essoufflement. Réponses très courtes.';
            else if (fc !== null && fc > 120) severityHint = 'Votre cœur bat très vite, vous êtes angoissé(e). Réponses courtes et nerveuses.';
            else if (temp !== null && temp >= 38.5) severityHint = 'Vous avez de la fièvre, vous vous sentez mal. Réponses un peu décousues.';

            // Personnalité en fonction du cas
            const age = patient.age || 50;
            let personalityHint = '';
            if (age < 30) personalityHint = 'Vous êtes jeune, un peu inquiet mais essayez de rester calme. Vous utilisez un langage familier.';
            else if (age > 75) personalityHint = 'Vous êtes âgé(e), vous parlez lentement avec des hésitations. Vous mélangez parfois les mots medicaux.';

            return `Tu es ${patient.prenom || ''} ${patient.nom || ''}, un patient de ${patient.age || '?'} ans, sexe ${patient.sexe || '?'}. Tu es un VRAI PATIENT, pas un médecin.
Motif d'hospitalisation : ${interrogatoire.motifHospitalisation || 'Non précisé'}
Histoire de la maladie : ${JSON.stringify(interrogatoire.histoireMaladie || {})}
Antécédents : ${JSON.stringify(interrogatoire.antecedents || {})}
Mode de vie : ${JSON.stringify(interrogatoire.modeDeVie || {})}
Traitements : ${JSON.stringify(interrogatoire.traitements || [])}
Allergies : ${JSON.stringify(interrogatoire.allergies || {})}
Examen clinique (ce que le patient ressent) : ${examClinique.aspectGeneral || 'Non précisé'}
Constantes vitales : FC=${constantes.pouls || 'N/A'}, TA=${constantes.tension || 'N/A'}, SpO2=${constantes.saturationO2 || 'N/A'}, T°=${constantes.temperature || 'N/A'}

${severityHint}
${personalityHint}

RÈGLES STRICTES :
- Tu es un PATIENT, pas un médecin. Tu ne fais JAMAIS de diagnostic ni de suggestion thérapeutique.
- Réponds naturellement, comme un vrai patient, en 1 à 3 phrases max.
- Ne révèle pas tout d'un coup. Le médecin doit poser les BONNES questions pour obtenir les infos.
- Si le médecin pose une question que tu ne comprends pas, dis-le naturellement ("Euh... c'est-à-dire ?").
- Si tu ne sais pas quelque chose, dis "Je ne sais pas docteur" ou "Je ne suis pas sûr(e)".
- Si le médecin est froid ou direct, tu peux montrer de l'anxiété.
- Adapte ton langage à ton âge et ton état de santé.
- Réponds TOUJOURS en français.`.trim();
        }

        /**
         * Parse un nombre depuis une valeur vitale (pour enrichir le prompt système)
         */
        _parseVitalNum(str) {
            if (typeof str === 'number') return str;
            const m = (str || '').match(/[\d]+(?:[.,]\d+)?/);
            return m ? parseFloat(m[0].replace(',', '.')) : null;
        }

        async ask(question) {
            if (!question.trim()) return;
            this.append('Vous', question);
            this.messages.push({ role: 'user', content: question });
            if (window.scoringState) window.scoringState.hasAskedPatient = true;

            const loading = this.append('Patient', '...', true);
            const answer = await this.fetchAnswer(question);
            loading.textContent = answer;
            loading.classList.add('answer-fade-in');
            this.messages.push({ role: 'assistant', content: answer });
        }

        async fetchAnswer(question) {
            const endpoint = window.CONFIG?.LLM_API_URL || '/api/llm/chat/completions';
            const model = window.CONFIG?.LLM_MODEL || 'openrouter/owl-alpha';
            const apiKey = window.CONFIG?.LLM_API_KEY || '';

            // D'abord vérifier si une question suggérée correspond (match exact uniquement)
            const suggestions = this._getSuggestedQuestions();
            const normalizedQ = question.toLowerCase().replace(/[?!.,;:'"]/g, '').trim();
            for (const s of suggestions) {
                const normalizedS = s.q.toLowerCase().replace(/[?!.,;:'"]/g, '').trim();
                if (normalizedQ === normalizedS) {
                    // Suivi démarche pour le scoring composite
                    if (s.fieldPath) {
                        if (typeof trackInterrogatoire === 'function') {
                            trackInterrogatoire(s.fieldPath);
                        }
                        document.dispatchEvent(new CustomEvent('interrogatoire-asked', { detail: { path: s.fieldPath } }));
                    }
                    return s.a;
                }
            }

            // Sinon, appeler le LLM
            const messages = [
                { role: 'system', content: this.buildSystemPrompt() },
                ...this.messages.slice(-10)
            ];

            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 20000);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
                        'HTTP-Referer': window.location.origin || 'http://localhost',
                        'X-Title': 'MedGame'
                    },
                    body: JSON.stringify({ model, messages, stream: false, max_tokens: 200, temperature: 0.85 }),
                    signal: controller.signal
                });
                clearTimeout(timer);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                let content = data.choices?.[0]?.message?.content || data.message?.content || '';
                content = content.trim();

                // Si le contenu est vide mais qu'il y a du reasoning, le fallback
                if (!content) {
                    throw new Error('Réponse vide du modèle');
                }

                return content;
            } catch (err) {
                console.warn('[PatientChat] LLM indisponible, fallback local:', err.message);
                return this.fallback(question);
            }
        }

        fallback(question) {
            const c = this.caseData || {};
            const q = question.toLowerCase();
            const i = c.interrogatoire || {};
            const exam = c.examenClinique || {};
            const hm = i.histoireMaladie || {};

            // Questions sur la douleur
            if (q.includes('douleur') || q.includes('mal ') || q.includes('aie') || q.includes('souffrir') || q.includes('ça fait mal')) {
                const desc = hm.descriptionDouleur;
                if (desc) {
                    const debut = hm.debutSymptomes ? ` Ça a commencé ${hm.debutSymptomes.toLowerCase()}.` : '';
                    return `${desc}.${debut}`;
                }
                return hm.debutSymptomes ? `Ça fait mal, ça a commencé ${hm.debutSymptomes.toLowerCase()}.` : 'J\'ai mal, docteur.';
            }

            // Questions sur le début / l'évolution
            if (q.includes('depuis') || q.includes('commenc') || q.includes('début') || q.includes('quand')) {
                return hm.debutSymptomes
                    ? `Ça a commencé ${hm.debutSymptomes.toLowerCase()}. ${hm.evolution ? `Et depuis, ${hm.evolution.toLowerCase()}.` : ''}`
                    : 'Je ne sais plus trop... récemment, je dirais.';
            }

            // Questions sur les antécédents
            if (q.includes('antécédent') || q.includes('antecedent') || q.includes('opéré') || q.includes('maladie avant') || q.includes('déjà été')) {
                const parts = [];
                if (i.antecedents?.medicaux?.length) parts.push(`Oui, ${Array.isArray(i.antecedents.medicaux) ? i.antecedents.medicaux.join(', ') : i.antecedents.medicaux}.`);
                if (i.antecedents?.chirurgicaux?.length) parts.push(`J'ai été opéré(e) : ${Array.isArray(i.antecedents.chirurgicaux) ? i.antecedents.chirurgicaux.join(', ') : i.antecedents.chirurgicaux}.`);
                if (i.antecedents?.familiaux?.length) parts.push(`Dans ma famille, il y a ${Array.isArray(i.antecedents.familiaux) ? i.antecedents.familiaux.join(', ') : i.antecedents.familiaux}.`);
                return parts.length > 0 ? parts.join(' ') : 'Non, rien de particulier docteur.';
            }

            // Questions sur les traitements
            if (q.includes('traitement') || q.includes('médicament') || q.includes('medicament') || q.includes('prends') || q.includes('pilule')) {
                return i.traitements?.length
                    ? `Oui, je prends ${Array.isArray(i.traitements) ? i.traitements.join(', ') : i.traitements}. ${i.traitements.length > 2 ? 'Tous les jours, oui.' : ''}`
                    : 'Non docteur, je ne prends rien habituellement.';
            }

            // Questions sur les allergies
            if (q.includes('allerg') || q.includes('allergie')) {
                if (i.allergies?.presence) {
                    const liste = i.allergies.liste;
                    if (Array.isArray(liste) && liste.length > 0) {
                        const noms = liste.map(a => typeof a === 'string' ? a : (a.allergene || 'quelque chose')).join(', ');
                        return `Oui, je suis allergique à ${noms}. Il faut faire attention.`;
                    }
                    return 'Oui, j\'ai des allergies.';
                }
                return 'Non, pas d\'allergie que je sache docteur.';
            }

            // Questions sur les symptômes associés
            if (q.includes('autre symptôme') || q.includes('autres symptômes') || q.includes('aut chose') || q.includes('d\'autres symptômes') || q.includes('symptomes asso')) {
                return hm.symptomesAssocies
                    ? `Oui, j'ai aussi ${Array.isArray(hm.symptomesAssocies) ? hm.symptomesAssocies.join(', ').toLowerCase() : hm.symptomesAssocies.toLowerCase()}.`
                    : 'Non, juste ce que je vous ai dit.';
            }

            // Questions sur le mode de vie
            if (q.includes('tabac') || q.includes('fume') || q.includes('cigarette')) {
                return i.modeDeVie?.tabac ? `Oui, ${i.modeDeVie.tabac.quantite || i.modeDeVie.tabac}.` : 'Non, je ne fume pas docteur.';
            }
            if (q.includes('alcool') || q.includes('boit') || q.includes('consommez')) {
                return i.modeDeVie?.alcool ? `${i.modeDeVie.alcool.quantite || 'Occasionnellement, oui.'}` : 'Non, pas du tout docteur.';
            }
            if (q.includes('activité') || q.includes('sport') || q.includes('exercice') || q.includes('physique')) {
                return i.modeDeVie?.activitePhysique?.description || 'Je ne fais pas beaucoup de sport, non.';
            }

            // Questions sur l'état actuel
            if (q.includes('sentez') || q.includes('se sent') || q.includes('comment allez') || q.includes('comment vous sentez')) {
                return exam.aspectGeneral || 'Ça va... enfin, c\'est pour ça que je suis là docteur.';
            }

            // Questions sur les facteurs déclenchants
            if (q.includes('déclench') || q.includes('quand ça') || q.includes('factor')) {
                return hm.facteursDeclenchants
                    ? `Ça se déclenche quand ${hm.facteursDeclenchants.toLowerCase()}.`
                    : 'Je ne sais pas trop ce qui le déclenche...';
            }

            // Fallback générique sur le motif
            return i.motifHospitalisation ? `Je suis ici parce que ${i.motifHospitalisation.toLowerCase()}.` : 'Je ne sais pas trop comment vous expliquer, docteur...';
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
            body.textContent = text;
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
