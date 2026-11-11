const CSS = `
#ecos3d-tooltip{
  position:fixed;top:0;left:0;z-index:10000;pointer-events:none;
  opacity:0;transform:translate3d(-9999px,-9999px,0);
  transition:opacity .16s ease;will-change:transform,opacity;
  max-width:300px;padding:10px 13px;border-radius:8px;
  font:400 14px/1.45 var(--font-ui,'Atkinson Hyperlegible','Segoe UI',system-ui,sans-serif);
  color:#fff;
  background:#17242C;
  border-left:3px solid #6FB3D2;
  box-shadow:0 6px 18px rgba(0,0,0,.35);
}
#ecos3d-tooltip .tt-title{font-weight:700;font-size:15px;color:#fff;margin-bottom:2px}
#ecos3d-tooltip .tt-icon:empty{display:none}
#ecos3d-tooltip .tt-desc{color:rgba(255,255,255,.78);font-size:13px}
#ecos3d-tooltip .tt-desc:empty{display:none}
#ecos3d-tooltip .tt-hint{margin-top:6px;font-size:12.5px;color:#9CCFE6;font-weight:700}
#ecos3d-tooltip.is-done{border-left-color:#5BC08A}
@media (prefers-reduced-motion: reduce){#ecos3d-tooltip{transition:none}}
`;

export class HudTooltip {
    constructor() {
        if (typeof document !== 'undefined') {
            if (!document.getElementById('ecos3d-hud-style')) {
                const s = document.createElement('style');
                s.id = 'ecos3d-hud-style';
                s.textContent = CSS;
                document.head.appendChild(s);
            }
            const el = document.createElement('div');
            el.id = 'ecos3d-tooltip';
            el.setAttribute('role', 'tooltip');
            el.innerHTML = `
                <div class="tt-title"><span class="tt-icon"></span><span class="tt-label"></span></div>
                <div class="tt-desc"></div><div class="tt-hint"></div>`;
            document.body.appendChild(el);

            const live = document.createElement('div');
            live.className = 'sr-only';
            live.setAttribute('aria-live', 'polite');
            live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';
            document.body.appendChild(live);

            this.el = el;
            this.live = live;
            this._label = el.querySelector('.tt-label');
            this._icon = el.querySelector('.tt-icon');
            this._desc = el.querySelector('.tt-desc');
            this._hint = el.querySelector('.tt-hint');
        } else {
            this.el = null;
            this.live = null;
        }

        this._visible = false;
        this._lastKey = null;
        this._pending = null;
        this._raf = 0;
    }

    /** @param {{label?: string, desc?: string, hint?: string, icon?: string, done?: boolean}} data */
    show(data, x, y) {
        if (!this.el) return;
        const key = `${data.label}|${data.desc}|${data.hint}|${data.done}`;
        if (key !== this._lastKey) {
            this._lastKey = key;
            if (this._icon) this._icon.textContent = data.icon ?? '';
            if (this._label) this._label.textContent = data.label ?? '';
            if (this._desc) this._desc.textContent = data.desc ?? '';
            if (this._hint) {
                this._hint.textContent = data.hint ?? '';
                this._hint.style.display = data.hint ? '' : 'none';
            }
            this.el.classList.toggle('is-done', !!data.done);
            if (this.live) this.live.textContent = `${data.label}. ${data.desc ?? ''}`;
        }
        this._pending = { x, y };
        if (!this._raf) this._raf = requestAnimationFrame(() => this._flush());
    }

    hide() {
        if (!this._visible) return;
        this._visible = false;
        this._lastKey = null;
        if (this.el) this.el.style.opacity = '0';
    }

    _flush() {
        this._raf = 0;
        if (!this._pending || !this.el) return;
        const r = this.el.getBoundingClientRect();
        let { x, y } = this._pending;
        x += 18;
        y -= 8;
        const winW = typeof window !== 'undefined' ? window.innerWidth : 800;
        const winH = typeof window !== 'undefined' ? window.innerHeight : 600;
        if (x + r.width > winW - 8) x = winW - r.width - 8;
        if (y + r.height > winH - 8) y = winH - r.height - 8;
        if (y < 8) y = 8;
        this.el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
        if (!this._visible) {
            this._visible = true;
            this.el.style.opacity = '1';
        }
    }

    dispose() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this.el?.remove();
        this.live?.remove();
    }
}
