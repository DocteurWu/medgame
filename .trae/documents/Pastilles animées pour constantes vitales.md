## Objectif

Intégrer un monitor animé (ECG, SpO₂, grille des constantes) à la place des 5 `p` actuels dans `#examen-clinique`, en gardant exactement la même taille visuelle et sans casser le reste de l’interface.

## Pourquoi sans Tailwind

* L’inclusion de Tailwind via CDN applique un "preflight" de reset CSS global qui affecte les styles de base et peut casser votre mise en page existante.

* Nous reproduisons vos classes (bg, grid, font-mono, etc.) via des styles dédiés dans `css/game.css` pour éviter tout conflit global.

## Emplacements

* HTML: `game.html` (section `#examen-clinique`, lignes 85–115)

* CSS: `css/game.css`

* JS: `js/game.js` — fonctions `loadCase()` (243+), `displayValue()` (237–241)

## Intégration HTML (sans déplacer la section)

* Laisser la structure `h2.section-title` et les `details` intactes.

* Remplacer dynamiquement les 5 `p` par un conteneur `#vital-monitor` via JS au même endroit.

* Mesurer la hauteur du bloc original et l’appliquer au monitor pour "LA MEME TAILLE".

## Styles CSS (à ajouter dans `css/game.css`)

* Conteneur monitor: `.vm` (fond noir, arrondis, padding, `font-family:ui-monospace`)

* Grille: `.vm-grid` (2 cols mobile, 3 cols desktop), cartes `.vm-card`

* Couleurs utilitaires locales: `.vm-text-green`, `.vm-text-cyan`, `.vm-text-white`, etc.

* Animations: `@keyframes ecg-scroll`, `@keyframes pulse`, `@keyframes beat`, `@keyframes spo2-wave`

* Exemple:

```css
#vital-monitor { overflow:hidden; }
.vm { background:#000; border-radius:12px; padding:10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; position:relative }
.vm-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px }
.vm-text-green { color:#2ecc71 } .vm-text-cyan{ color:#00d1ff } .vm-text-white{ color:#fff }
.vm-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:8px }
@media(min-width:768px){ .vm-grid{ grid-template-columns:repeat(3,1fr) } }
.vm-card{ background:#111; border-radius:8px; padding:8px; text-align:center }
@keyframes ecg-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes spo2-wave{0%{transform:translateX(0)}100%{transform:translateX(-150px)}}
```

## Markup monitor (généré par JS)

* Reprend votre structure: header LIVE, bloc ECG avec grille SVG et 2 paths animés, bloc SpO₂ avec sinusoïde, grille BP/TEMP/RESP.

* IDs: `hr-value`, `bp-value`, `spo2-value`, `temp-value`, `resp-value`, plus `spo2-path`, `heart-line-1`, `heart-line-2`, `heart-group`, `pulse-indicator`.

## Logique JS (dans `js/game.js`)

1. Parsing des valeurs existantes

```js
function parseBP(text){ const m=(text||'').match(/(\d{2,3})\/(\d{2,3})/); return m?{systolic:+m[1],diastolic:+m[2]}:{systolic:120,diastolic:80}; }
function parseNum(text){ const m=(text||'').match(/[\d]+(?:[\.,][\d]+)?/); return m?parseFloat(m[0].replace(',','.')):NaN; }
```

1. Classe monitor (adaptée de votre code)

```js
class VitalSignsMonitor{
  constructor(props){ this.props=props; }
  mount(root){ this.root=root; this.root.innerHTML=this.template(); this.initStaticWaves(); this.updateDisplay(); this.startAnimations(); }
  template(){ return `
    <div class="vm">
      <div class="vm-header"><div class="vm-text-green">ECG</div><div class="vm-text-white">HR: <span id="hr-value">${this.props.heartRate}</span> BPM</div></div>
      <div class="vm-ecg" style="position:relative;height:128px;background:#111;border-radius:8px;overflow:hidden">
        <svg class="vm-ecg-grid" style="position:absolute;inset:0;width:100%;height:100%;opacity:.2">
          <defs><pattern id="vm-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0 L0 0 0 20" fill="none" stroke="green" stroke-width="0.5"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#vm-grid)"/>
        </svg>
        <svg class="vm-ecg-lines" viewBox="0 0 400 128" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">
          <defs><linearGradient id="vm-heartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="green" stop-opacity="0"/><stop offset="50%" stop-color="green"/><stop offset="100%" stop-color="green" stop-opacity="0"/>
          </linearGradient></defs>
          <g id="heart-group" style="animation:ecg-scroll var(--ecg-speed,4s) linear infinite;will-change:transform">
            <path id="heart-line-1" stroke="url(#vm-heartGradient)" stroke-width="2" fill="none" d=""/>
            <path id="heart-line-2" stroke="url(#vm-heartGradient)" stroke-width="2" fill="none" d=""/>
          </g>
        </svg>
        <div id="pulse-indicator" style="position:absolute;top:8px;right:8px;width:10px;height:10px;background:#e74c3c;border-radius:50%;animation:pulse calc(60s / var(--heart-rate,72)) infinite"></div>
      </div>
      <div class="vm-spo2" style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div id="spo2-label" class="vm-text-cyan" style="font-weight:700">SpO₂</div>
          <div id="spo2-value" class="vm-text-white">${this.props.spo2}%</div>
        </div>
        <div style="position:relative;height:64px;background:#111;border-radius:8px;overflow:hidden">
          <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:.2">
            <defs><pattern id="vm-spo2-grid" width="15" height="15" patternUnits="userSpaceOnUse"><path d="M15 0 L0 0 0 15" fill="none" stroke="cyan" stroke-width="0.3"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#vm-spo2-grid)"/>
          </svg>
          <svg class="spo2-wave" style="position:absolute;inset:0;width:100%;height:100%">
            <defs><linearGradient id="vm-spo2Gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="cyan" stop-opacity="0"/><stop offset="50%" stop-color="cyan"/><stop offset="100%" stop-color="cyan" stop-opacity="0"/>
            </linearGradient></defs>
            <path id="spo2-path" stroke="url(#vm-spo2Gradient)" stroke-width="2" fill="none" d=""/>
          </svg>
        </div>
      </div>
      <div class="vm-grid" style="margin-top:10px">
        <div class="vm-card"><div class="vm-label" style="color:#999;font-size:12px;margin-bottom:4px">BP</div><div id="bp-value" class="vm-text-white" style="font-weight:700;font-size:18px">${this.props.systolic}/${this.props.diastolic}</div><div style="color:#2ecc71;font-size:11px">mmHg</div></div>
        <div class="vm-card"><div class="vm-label" style="color:#999;font-size:12px;margin-bottom:4px">TEMP</div><div id="temp-value" class="vm-text-white" style="font-weight:700;font-size:18px">${this.props.temperature.toFixed(1)}°C</div><div style="color:#3498db;font-size:11px">CORE</div></div>
        <div class="vm-card"><div class="vm-label" style="color:#999;font-size:12px;margin-bottom:4px">RESP</div><div id="resp-value" class="vm-text-white" style="font-weight:700;font-size:18px">${this.props.respiratoryRate}</div><div style="color:#f1c40f;font-size:11px">bpm</div></div>
      </div>
    </div>`; }
  initStaticWaves(){ const spo2Path=document.getElementById('spo2-path'); const width=200, baseY=32, amp=10; let p=`M0,${baseY}`; for(let x=0;x<=width;x+=10){ const y=baseY+Math.sin((x/width)*Math.PI*2)*amp; p+=` L${x},${y}`;} spo2Path.setAttribute('d',p); }
  updateDisplay(){ document.getElementById('hr-value').textContent=this.props.heartRate; document.getElementById('bp-value').textContent=`${this.props.systolic}/${this.props.diastolic}`; document.getElementById('spo2-value').textContent=`${this.props.spo2}%`; document.getElementById('temp-value').textContent=`${this.props.temperature.toFixed(1)}°C`; document.getElementById('resp-value').textContent=this.props.respiratoryRate; document.documentElement.style.setProperty('--heart-rate', this.props.heartRate);
    const spo2Label=document.getElementById('spo2-label'); const spo2Value=document.getElementById('spo2-value'); const low=this.props.spo2<=92; spo2Label.classList.toggle('vm-text-cyan',!low); spo2Label.classList.toggle('vm-text-red',low); spo2Value.classList.toggle('vm-text-white',!low); spo2Value.classList.toggle('vm-text-red',low);
  }
  startAnimations(){ const pulse=document.getElementById('pulse-indicator'); const hr=this.props.heartRate; const bpm=60/hr; pulse.style.animationDuration=`${bpm}s`; const l1=document.getElementById('heart-line-1'); const l2=document.getElementById('heart-line-2'); const amp=Math.min(25+(hr-60)*0.3,40); const path=this.generateECGPath(amp); l1.setAttribute('d',path); l2.setAttribute('d',path); l2.setAttribute('transform','translate(400 0)'); const grp=document.getElementById('heart-group'); const speed=6-((hr-60)*0.04); const dur=Math.max(2.5, Math.min(7, speed)); document.documentElement.style.setProperty('--ecg-speed', `${dur}s`); grp.style.animationDuration=`${dur}s`; }
  generateECGPath(amp){ const baseY=64, beatWidth=70, beats=6; let p=`M0,${baseY}`; for(let i=0;i<beats;i++){ const x=i*beatWidth; p+=` L${x+5},${baseY}`; p+=` Q${x+10},${baseY-amp*.25} ${x+15},${baseY}`; p+=` L${x+22},${baseY+amp*.25}`; p+=` L${x+30},${baseY-amp}`; p+=` L${x+38},${baseY+amp*.5}`; p+=` L${x+48},${baseY}`; p+=` Q${x+55},${baseY-amp*.35} ${x+62},${baseY}`; p+=` L${x+beatWidth},${baseY}`; } return p; }
  updateProps(np){ this.props={...this.props,...np}; this.updateDisplay(); this.startAnimations(); }
}
```

1. Montage au bon endroit et conservation de la taille

```js
function mountVitalMonitorAtConstants(){
  const container=document.querySelector('#examen-clinique > div');
  if(!container) return;
  const original=Array.from(container.querySelectorAll('p')).slice(0,5); // les 5 constantes
  const h=original.reduce((sum,p)=>sum+p.offsetHeight,0) || container.offsetHeight;
  const text={
    bp:(tension?.textContent||''), hr:(pouls?.textContent||''), spo2:(saturationO2?.textContent||''), temp:(temperature?.textContent||''), resp:(frequenceRespiratoire?.textContent||'')
  };
  const bp=parseBP(text.bp);
  const monitorProps={ systolic:bp.systolic, diastolic:bp.diastolic, heartRate:parseNum(text.hr)||72, spo2:parseNum(text.spo2)||98, temperature:parseNum(text.temp)||36.6, respiratoryRate:parseNum(text.resp)||16 };
  // Remplacement visuel
  original.forEach(p=>p.remove());
  const mount=document.createElement('div'); mount.id='vital-monitor'; mount.style.minHeight=`${h}px`; container.prepend(mount);
  const monitor=new VitalSignsMonitor(monitorProps); monitor.mount(mount);
}
```

1. Appel dans `loadCase()` une fois les valeurs injectées

```js
// après les displayValue(...tension/pouls/saturationO2/temperature/frequenceRespiratoire)
mountVitalMonitorAtConstants();
```

## Compatibilité et non-régression

* Pas d’import Tailwind, pas de reset global.

* Classes pré

