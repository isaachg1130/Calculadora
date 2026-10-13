/**
 * effects.js — Visual effects layer
 * ─────────────────────────────────────────────────────────────
 * 1. ParticleSystem  — campo de partículas flotantes en canvas
 * 2. CustomCursor    — cursor de puntero personalizado
 * 3. RippleEffect    — ondas al hacer clic en botones
 * 4. ButtonTilt      — micro-tilt 3D al pasar el mouse
 * 5. DisplayGlow     — pulso de brillo en la pantalla al evaluar
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ============================================================
   1. PARTICLE SYSTEM
   ============================================================ */

class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: -9999, y: -9999 };
    this.animId = null;

    this._resize();
    this._populate();
    this._bindEvents();
    this._loop();
  }

  _resize() {
    this.W = this.canvas.width  = window.innerWidth;
    this.H = this.canvas.height = window.innerHeight;
  }

  _populate() {
    const count = Math.min(90, Math.floor((this.W * this.H) / 14000));
    this.particles = Array.from({ length: count }, () => this._make());
  }

  _make(x, y) {
    const size = Math.random() * 1.8 + 0.3;
    return {
      x:   x ?? Math.random() * this.W,
      y:   y ?? Math.random() * this.H,
      vx:  (Math.random() - 0.5) * 0.28,
      vy:  (Math.random() - 0.5) * 0.28,
      size,
      baseSize: size,
      opacity: Math.random() * 0.55 + 0.10,
      // Color: mostly blue-white spectrum
      hue: Math.random() < 0.7
        ? 210 + Math.random() * 30   // blue family
        : 185 + Math.random() * 15,  // cyan family
      sat: 80 + Math.random() * 20,
      life: Math.random() * Math.PI * 2, // phase offset for breathing
    };
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this._resize();
      this._populate();
    }, { passive: true });

    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    }, { passive: true });
  }

  _loop() {
    const tick = () => {
      this._draw();
      this.animId = requestAnimationFrame(tick);
    };
    tick();
  }

  _draw() {
    const { ctx, W, H, particles, mouse } = this;
    ctx.clearRect(0, 0, W, H);

    const now = performance.now() * 0.001;

    particles.forEach((p, i) => {
      // Breathing size
      p.life += 0.008;
      const breathe = Math.sin(p.life) * 0.3 + 1;
      const drawSize = p.baseSize * breathe;

      // Mouse repulsion
      const dx = p.x - mouse.x;
      const dy = p.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const repulseR = 110;
      if (dist < repulseR) {
        const force = (1 - dist / repulseR) * 0.6;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }

      // Velocity damping
      p.vx *= 0.97;
      p.vy *= 0.97;
      // Base drift
      p.x += p.vx + Math.sin(now * 0.3 + i) * 0.06;
      p.y += p.vy + Math.cos(now * 0.3 + i * 1.3) * 0.06;

      // Wrap edges
      if (p.x < -5)  p.x = W + 5;
      if (p.x > W+5) p.x = -5;
      if (p.y < -5)  p.y = H + 5;
      if (p.y > H+5) p.y = -5;

      // Draw particle
      const alpha = p.opacity * (dist < repulseR ? 0.5 + 0.5 * (dist / repulseR) : 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, drawSize, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, 75%, ${alpha})`;
      ctx.fill();

      // Draw connections to nearby particles
      for (let j = i + 1; j < particles.length; j++) {
        const q  = particles[j];
        const ex = p.x - q.x;
        const ey = p.y - q.y;
        const ed = Math.sqrt(ex * ex + ey * ey);
        const maxD = 120;
        if (ed < maxD) {
          const lineAlpha = (1 - ed / maxD) * 0.18;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(74, 154, 255, ${lineAlpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    });
  }

  /** Burst of particles from a point (on button press) */
  burst(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const p = this._make(x, y);
      const angle = (Math.PI * 2 * i) / count;
      const speed = 1.5 + Math.random() * 2;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = p.baseSize = Math.random() * 2 + 0.8;
      p.opacity = 0.8;
      this.particles.push(p);
      // Remove extra particle to keep count stable
      if (this.particles.length > 120) this.particles.shift();
    }
  }
}

/* ============================================================
   2. CUSTOM CURSOR
   ============================================================ */

class CustomCursor {
  constructor() {
    this.dot  = document.getElementById('cursor');
    this.ring = document.getElementById('cursor-ring');
    if (!this.dot || !this.ring) return;

    // Ring follows with lag
    this.rx = 0; this.ry = 0;
    this.mx = 0; this.my = 0;

    document.addEventListener('mousemove', e => {
      this.mx = e.clientX;
      this.my = e.clientY;
      // Dot follows instantly
      this.dot.style.left  = e.clientX + 'px';
      this.dot.style.top   = e.clientY + 'px';
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      this.dot.style.opacity  = '0';
      this.ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      this.dot.style.opacity  = '1';
      this.ring.style.opacity = '1';
    });

    this._animate();
  }

  _animate() {
    const tick = () => {
      // Lag effect for ring
      this.rx += (this.mx - this.rx) * 0.12;
      this.ry += (this.my - this.ry) * 0.12;
      this.ring.style.left = this.rx + 'px';
      this.ring.style.top  = this.ry + 'px';
      requestAnimationFrame(tick);
    };
    tick();
  }

  /** Flash cursor ring on button press */
  flash() {
    if (!this.ring) return;
    this.ring.style.borderColor = 'rgba(0, 212, 255, 0.90)';
    this.ring.style.width  = '52px';
    this.ring.style.height = '52px';
    setTimeout(() => {
      this.ring.style.borderColor = '';
      this.ring.style.width  = '';
      this.ring.style.height = '';
    }, 220);
  }
}

/* ============================================================
   3. RIPPLE EFFECT
   ============================================================ */

class RippleEffect {
  constructor() {
    document.querySelectorAll('.btn').forEach(btn => {
      // Inject ripple container
      const rc = document.createElement('div');
      rc.className = 'ripple-container';
      btn.appendChild(rc);

      btn.addEventListener('pointerdown', e => this._spawn(e, btn, rc));
    });
  }

  _spawn(e, btn, container) {
    const rect   = btn.getBoundingClientRect();
    const cx     = e.clientX - rect.left;
    const cy     = e.clientY - rect.top;
    const size   = Math.max(rect.width, rect.height) * 1.8;

    const circle = document.createElement('span');
    circle.className = 'ripple-circle';
    circle.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${cx - size / 2}px;
      top: ${cy - size / 2}px;
      background: ${this._color(btn)};
    `;
    container.appendChild(circle);

    circle.addEventListener('animationend', () => circle.remove());
  }

  _color(btn) {
    if (btn.classList.contains('btn--equals'))   return 'rgba(120, 190, 255, 0.55)';
    if (btn.classList.contains('btn--operator')) return 'rgba(74, 154, 255, 0.50)';
    if (btn.classList.contains('btn--utility'))  return 'rgba(74, 154, 255, 0.35)';
    return 'rgba(255, 255, 255, 0.22)';
  }
}

/* ============================================================
   4. BUTTON TILT (micro-3D hover)
   ============================================================ */

class ButtonTilt {
  constructor() {
    document.querySelectorAll('.btn--number, .btn--operator, .btn--equals').forEach(btn => {
      btn.addEventListener('mousemove', e => this._tilt(e, btn));
      btn.addEventListener('mouseleave', () => this._reset(btn));
    });
  }

  _tilt(e, btn) {
    const rect = btn.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    const rx   = ((e.clientY - cy) / (rect.height / 2)) * -6;  // degrees
    const ry   = ((e.clientX - cx) / (rect.width  / 2)) *  6;
    btn.style.transform    = `perspective(400px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-1px)`;
    btn.style.transition   = 'transform 0.08s ease';
  }

  _reset(btn) {
    btn.style.transform  = '';
    btn.style.transition = 'transform 0.25s ease';
  }
}

/* ============================================================
   5. DISPLAY GLOW PULSE (on equals press)
   ============================================================ */

class DisplayGlow {
  constructor() {
    this.display = document.querySelector('.display');
    this.resultEl = document.getElementById('result');
  }

  pulse(isError = false) {
    if (!this.display) return;
    const color = isError
      ? 'rgba(255, 100, 130, 0.25)'
      : 'rgba(26, 110, 240, 0.30)';

    const prev = this.display.style.boxShadow;
    this.display.style.boxShadow = `0 0 0 1px ${isError ? 'rgba(255,100,130,0.25)' : 'rgba(74,154,255,0.30)'}, 0 0 32px ${color}, inset 0 0 16px ${color}`;
    this.display.style.transition = 'box-shadow 0.05s ease';
    setTimeout(() => {
      this.display.style.boxShadow = prev || '';
      this.display.style.transition = 'box-shadow 0.50s ease';
    }, 300);
  }
}

/* ============================================================
   6. BOOTSTRAP — hook everything together
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // Init visual subsystems
  const particles = new ParticleSystem('particleCanvas');
  const cursor    = new CustomCursor();
  const ripple    = new RippleEffect();   // eslint-disable-line no-unused-vars
  const tilt      = new ButtonTilt();     // eslint-disable-line no-unused-vars
  const glow      = new DisplayGlow();

  // Hook into calculator events —————————————————————————
  // We listen on the keypad for any button press to trigger burst + cursor flash
  document.addEventListener('pointerdown', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;

    // Particle burst at click position
    particles.burst(e.clientX, e.clientY, btn.classList.contains('btn--equals') ? 14 : 6);

    // Cursor flash
    cursor.flash();

    // Display glow on equals
    if (btn.dataset.action === 'equals') {
      setTimeout(() => glow.pulse(false), 50);
    }
  });

  // Glow on error — listen for the error class appearing on result
  const resultEl = document.getElementById('result');
  if (resultEl) {
    const obs = new MutationObserver(() => {
      if (resultEl.classList.contains('error')) {
        glow.pulse(true);
      }
    });
    obs.observe(resultEl, { attributes: true, attributeFilter: ['class'] });
  }

});
