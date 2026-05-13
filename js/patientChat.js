(function () {
    class PatientChat {
        constructor() {
            this.caseData = null;
            this.messages = [];
            this.panel = null;
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
                this.append('Patient', 'Bonjour docteur. Qu\'est-ce que vous voulez savoir ?');
            }
            const input = document.getElementById('dialogue-input');
            if (input) input.focus();
        }

        close() {
            if (!this.panel) return;
            this.panel.classList.remove('active');
            this.panel.setAttribute('aria-hidden', 'true');
        }

        buildSystemPrompt() {
            const c = this.caseData || {};
            const patient = c.patient || {};
            const interrogatoire = c.interrogatoire || {};
            return `
Tu es ${patient.prenom || ''} ${patient.nom || ''}, un patient de ${patient.age || '?'} ans.
Motif : ${interrogatoire.motifHospitalisation || ''}
Histoire : ${JSON.stringify(interrogatoire.histoireMaladie || {})}
Antécédents : ${JSON.stringify(interrogatoire.antecedents || {})}
Mode de vie : ${JSON.stringify(interrogatoire.modeDeVie || {})}
Traitements : ${JSON.stringify(interrogatoire.traitements || [])}
Allergies : ${JSON.stringify(interrogatoire.allergies || {})}
Constantes : ${JSON.stringify(c.examenClinique?.constantes || {})}

Réponds naturellement comme un patient à l'hôpital.
Ne révèle jamais toutes les informations en une fois.
Ne fais pas de diagnostic.
Si tu ne sais pas, dis "Je ne sais pas docteur".
Réponds en français, en 1 à 4 phrases.
            `.trim();
        }

        async ask(question) {
            if (!question.trim()) return;
            this.append('Vous', question);
            this.messages.push({ role: 'user', content: question });
            if (window.scoringState) window.scoringState.hasAskedPatient = true;
            const loading = this.append('Patient', '<span class="spinner-inline"><i class="fas fa-spinner fa-spin"></i></span>', true);
            const answer = await this.fetchAnswer(question);
            loading.textContent = answer;
            loading.classList.add('answer-fade-in');
            this.messages.push({ role: 'assistant', content: answer });
        }

        async fetchAnswer(question) {
            const endpoint = window.CONFIG?.OLLAMA_CHAT_URL || 'http://localhost:11434/api/chat';
            const model = window.CONFIG?.OLLAMA_MODEL || 'deepseek-r1:latest';
            const isOpenAI = endpoint.includes('/v1/');
            // this.messages contient déjà le message user (ajouté dans ask())
            const messages = [
                { role: 'system', content: this.buildSystemPrompt() },
                ...this.messages.slice(-8)
            ];
            const payload = isOpenAI
                ? { model, messages, stream: false }
                : { model, messages, stream: false };
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8000);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });
                clearTimeout(timer);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                return data.message?.content || data.choices?.[0]?.message?.content || this.fallback(question);
            } catch {
                return this.fallback(question);
            }
        }

        fallback(question) {
            const c = this.caseData || {};
            const q = normalizeText(question || '');
            const i = c.interrogatoire || {};
            if (q.includes('douleur')) return i.histoireMaladie?.descriptionDouleur || i.histoireMaladie?.symptomesAssocies || 'J\'ai mal, mais j\'ai du mal à préciser docteur.';
            if (q.includes('antecedent') || q.includes('antécédent')) return this.stringifyPatient(i.antecedents) || 'Je ne crois pas avoir d\'antécédent particulier.';
            if (q.includes('traitement') || q.includes('medicament') || q.includes('médicament')) return this.stringifyPatient(i.traitements) || 'Je ne prends pas de traitement habituel.';
            if (q.includes('allerg')) return this.stringifyPatient(i.allergies) || 'Pas d\'allergie connue.';
            if (q.includes('depuis') || q.includes('commence') || q.includes('début')) return i.histoireMaladie?.debutSymptomes || 'Ça a commencé récemment, je ne sais plus exactement.';
            return i.motifHospitalisation || 'Je ne sais pas docteur.';
        }

        stringifyPatient(value) {
            if (!value) return '';
            if (typeof value === 'string') return value;
            if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? item : Object.values(item).filter(Boolean).join(' ')).join(', ');
            if (typeof value === 'object') return Object.values(value).flat().filter(Boolean).map((item) => typeof item === 'string' ? item : Object.values(item).filter(Boolean).join(' ')).join(', ');
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

