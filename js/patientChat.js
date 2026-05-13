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
                a: i.motifHospitalisation || 'Je ne me sens pas bien docteur, c\'est pour ça qu\'on m\'a amené.'
            });

            if (i.histoireMaladie) {
                if (i.histoireMaladie.debutSymptomes) {
                    questions.push({
                        q: 'Depuis quand avez-vous ces symptômes ?',
                        a: i.histoireMaladie.descriptionDouleur
                            ? `Ça a commencé ${i.histoireMaladie.debutSymptomes.toLowerCase()}. ${i.histoireMaladie.descriptionDouleur}.`
                            : `Ça a commencé ${i.histoireMaladie.debutSymptomes.toLowerCase()}.`
                    });
                }
                if (i.histoireMaladie.symptomesAssocies) {
                    const symps = Array.isArray(i.histoireMaladie.symptomesAssocies)
                        ? i.histoireMaladie.symptomesAssocies.join(', ')
                        : i.histoireMaladie.symptomesAssocies;
                    questions.push({
                        q: 'Avez-vous d\'autres symptômes ?',
                        a: `Oui docteur, j'ai aussi ${symps?.toLowerCase() || 'des choses qui me gênent'}.`
                    });
                }
                if (i.histoireMaladie.descriptionDouleur) {
                    questions.push({
                        q: 'Où avez-vous mal ?',
                        a: i.histoireMaladie.descriptionDouleur
                    });
                }
            }

            if (i.antecedents) {
                const atcd = i.antecedents;
                if (atcd.medicaux && atcd.medicaux.length > 0) {
                    questions.push({
                        q: 'Avez-vous des antécédents médicaux ?',
                        a: `Oui, ${Array.isArray(atcd.medicaux) ? atcd.medicaux.join(', ') : atcd.medicaux}.`
                    });
                }
                if (atcd.chirurgicaux && atcd.chirurgicaux.length > 0) {
                    questions.push({
                        q: 'Avez-vous été opéré ?',
                        a: `Oui, ${Array.isArray(atcd.chirurgicaux) ? atcd.chirurgicaux.join(', ') : atcd.chirurgicaux}.`
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
                    })()
                });
            }

            if (i.traitements && (Array.isArray(i.traitements) ? i.traitements.length > 0 : i.traitements)) {
                questions.push({
                    q: 'Prenez-vous des médicaments ?',
                    a: Array.isArray(i.traitements)
                        ? `Oui, je prends ${i.traitements.join(', ')}.`
                        : `Oui, ${i.traitements}.`
                });
            }

            if (i.modeDeVie) {
                if (i.modeDeVie.tabac) {
                    questions.push({
                        q: 'Fumez-vous ?',
                        a: `${i.modeDeVie.tabac.quantite || 'Je préfère ne pas en parler.'}`
                    });
                }
                if (i.modeDeVie.alcool) {
                    questions.push({
                        q: 'Consommez-vous de l\'alcool ?',
                        a: `${i.modeDeVie.alcool.quantite || 'Occasionnellement.'}`
                    });
                }
            }

            // Question examen physique
            questions.push({
                q: 'Comment vous sentez-vous en ce moment ?',
                a: c.examenClinique?.aspectGeneral || 'Ça va... enfin, c\'est pour ça que je suis là.'
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
                    this.askSuggested(item.q, item.a);
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

        askSuggested(question, prebuiltAnswer) {
            if (!question.trim()) return;
            this.append('Vous', question);
            this.messages.push({ role: 'user', content: question });
            if (window.scoringState) window.scoringState.hasAskedPatient = true;

            // Réponse pré-construite : pas d'appel LLM
            this.append('Patient', prebuiltAnswer);
            this.messages.push({ role: 'assistant', content: prebuiltAnswer });
        }

        buildSystemPrompt() {
            const c = this.caseData || {};
            const patient = c.patient || {};
            const interrogatoire = c.interrogatoire || {};
            return `Tu es ${patient.prenom || ''} ${patient.nom || ''}, un patient de ${patient.age || '?'} ans, sexe ${patient.sexe || '?'}.
Motif d'hospitalisation : ${interrogatoire.motifHospitalisation || 'Non précisé'}
Histoire de la maladie : ${JSON.stringify(interrogatoire.histoireMaladie || {})}
Antécédents : ${JSON.stringify(interrogatoire.antecedents || {})}
Mode de vie : ${JSON.stringify(interrogatoire.modeDeVie || {})}
Traitements : ${JSON.stringify(interrogatoire.traitements || [])}
Allergies : ${JSON.stringify(interrogatoire.allergies || {})}

RÈGLES :
- Tu es un PATIENT, pas un médecin. Tu ne fais JAMAIS de diagnostic.
- Réponds naturellement, comme un vrai patient, en 1 à 3 phrases.
- Ne révèle pas tout d'un coup. Le médecin doit poser les bonnes questions.
- Si tu ne sais pas, dis "Je ne sais pas docteur".
- Réponds TOUJOURS en français.`.trim();
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
            const endpoint = window.CONFIG?.LLM_API_URL || 'http://localhost:11434/v1/chat/completions';
            const model = window.CONFIG?.LLM_MODEL || 'deepseek-v4-flash';
            const apiKey = window.CONFIG?.LLM_API_KEY || '';

            // D'abord vérifier si une question suggérée correspond (match exact uniquement)
            const suggestions = this._getSuggestedQuestions();
            const normalizedQ = question.toLowerCase().replace(/[?!.,;:'"]/g, '').trim();
            for (const s of suggestions) {
                const normalizedS = s.q.toLowerCase().replace(/[?!.,;:'"]/g, '').trim();
                if (normalizedQ === normalizedS) {
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
                        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
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

            if (q.includes('douleur') || q.includes('mal')) return i.histoireMaladie?.descriptionDouleur || 'J\'ai mal, mais j\'ai du mal à préciser docteur.';
            if (q.includes('antécédent') || q.includes('antecedent') || q.includes('opéré')) return this.stringifyPatient(i.antecedents) || 'Je n\'ai pas d\'antécédent particulier.';
            if (q.includes('traitement') || q.includes('médicament') || q.includes('medicament')) return this.stringifyPatient(i.traitements) || 'Je ne prends pas de traitement habituel.';
            if (q.includes('allerg')) return this.stringifyPatient(i.allergies) || 'Pas d\'allergie connue.';
            if (q.includes('depuis') || q.includes('commenc') || q.includes('début')) return i.histoireMaladie?.debutSymptomes || 'Ça a commencé récemment.';
            if (q.includes('sentez') || q.includes('se sent')) return c.examenClinique?.aspectGeneral || 'Ça va... enfin, c\'est pour ça que je suis là.';
            return i.motifHospitalisation || 'Je ne sais pas docteur, c\'est pour ça que je suis là.';
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
