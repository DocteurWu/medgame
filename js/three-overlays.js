/**
 * three-overlays.js — Calques cinématiques
 *
 * CE QUE C'EST
 *
 * Trois calques DOM posés par-dessus le canvas 3D :
 *
 *  - le GRAIN : une texture de bruit animée. C'est le défaut le moins cher
 *    et le plus efficace pour que l'image cesse d'être « un rendu 3D » et
 *    devienne « une image de moniteur » ;
 *  - les LIGNES DE BALAYAGE : la trame horizontale d'un scope ;
 *  - le HALO D'ALARME : un liseré rouge qui pulse quand le patient va mal.
 *
 * Le halo n'est pas décoratif : il est piloté par les VRAIES constantes du
 * jeu (`window.vitalSigns.props`). C'est un signal clinique, pas un effet.
 * Le joueur n'a pas besoin de lire les chiffres du HUD pour sentir que le
 * patient lâche.
 *
 * POURQUOI EN DOM, ET PAS EN POST-TRAITEMENT
 *
 * Un bruit de grain en post-traitement coûterait une passe plein écran de
 * plus — sur une page où le nombre de passes est justement le point
 * sensible. En DOM, c'est une texture que le compositeur du navigateur
 * pose par-dessus : le GPU s'en charge, et le coût pour three.js est nul.
 *
 * AUCUN CLIC INTERCEPTÉ
 *
 * `pointer-events: none` sur les trois calques : le joueur doit pouvoir
 * cliquer sur le patient, le bureau, le lit d'examen.
 *
 * LA SOURCE DES CONSTANTES
 *
 * `window.vitalSigns.props` — la même source unique que le HUD 3D et que la
 * boucle vitale du manager. Jamais une copie.
 */

const CADENCE_MS = 1000 / 12;

/**
 * Crée les calques et les branche sur les constantes du jeu.
 *
 * @returns {{element: HTMLElement, maj: Function, dispose: Function}}
 */
export function creerOverlays() {
    const racine = document.createElement('div');
    racine.className = 'cine-overlays';
    racine.setAttribute('aria-hidden', 'true');

    const grain = document.createElement('div');
    grain.className = 'cine-grain';

    const scanlines = document.createElement('div');
    scanlines.className = 'cine-scanlines';

    const alarme = document.createElement('div');
    alarme.className = 'cine-alarm';

    const calme = document.createElement('div');
    calme.className = 'cine-calme';

    racine.append(grain, scanlines, alarme, calme);
    document.body.appendChild(racine);

    let etatAlarme = false;
    let etatCalme = false;

    /**
     * Traduit les constantes en gravité d'alerte (0 = rien, 1 = critique).
     * @param {object} props
     */
    function gravite(props) {
        if (!props) return 0;
        const spo2 = Number(props.spo2);
        const hr = Number(props.heartRate);
        const sys = Number(props.systolic);
        const dia = Number(props.diastolic);
        const map = Number.isFinite(sys) && Number.isFinite(dia)
            ? (sys + 2 * dia) / 3
            : NaN;

        let gravite = 0;
        if (Number.isFinite(spo2)) {
            if (spo2 < 85) gravite = Math.max(gravite, 1);
            else if (spo2 < 90) gravite = Math.max(gravite, 0.75);
            else if (spo2 < 93) gravite = Math.max(gravite, 0.4);
        }
        if (Number.isFinite(map)) {
            if (map < 50) gravite = Math.max(gravite, 1);
            else if (map < 65) gravite = Math.max(gravite, 0.7);
        }
        if (Number.isFinite(hr)) {
            if (hr > 140) gravite = Math.max(gravite, 0.85);
            else if (hr > 120) gravite = Math.max(gravite, 0.45);
            else if (hr < 45) gravite = Math.max(gravite, 0.6);
        }
        return gravite;
    }

    /**
     * Met à jour le halo d'alerte à partir des constantes courantes.
     * @param {object} [props] constantes ; par défaut, on lit la source unique
     */
    function maj(props) {
        const source = props || window.vitalSigns?.props;
        const g = gravite(source);

        const doitAlarmer = g >= 0.4;
        if (doitAlarmer !== etatAlarme) {
            etatAlarme = doitAlarmer;
            alarme.classList.toggle('active', doitAlarmer);
        }
        // L'intensité suit la gravité : l'alarme s'installe doucement.
        alarme.style.opacity = doitAlarmer ? String(0.25 + g * 0.6) : '0';

        // Halo vert discret quand tout va bien : on n'alerte jamais pour rien.
        const toutVaBien = g === 0 && source && Number(source.spo2) >= 95
            && Number(source.heartRate) <= 100;
        if (toutVaBien !== etatCalme) {
            etatCalme = toutVaBien;
            calme.style.opacity = toutVaBien ? '1' : '0';
        }
    }

    const minuteur = setInterval(() => maj(), CADENCE_MS);
    maj();

    function dispose() {
        clearInterval(minuteur);
        racine.remove();
    }

    return { element: racine, maj, dispose };
}
