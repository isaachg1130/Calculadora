/**
 * CALCULADORA PRO — calculator.js
 * ─────────────────────────────────────────────────────────────
 * Arquitectura:
 *   - CalcEngine  : lógica pura de cálculo (sin DOM)
 *   - CalcDisplay : actualización de la pantalla
 *   - CalcApp     : coordinador de eventos y estado
 *
 * Sin eval(). Parser propio basado en Pratt parsing
 * (precedencia de operadores) con soporte para paréntesis.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

/* ============================================================
   1. MOTOR DE CÁLCULO — CalcEngine
   ============================================================ */

class CalcEngine {

  /**
   * Evalúa una expresión matemática en texto.
   * Soporta: +  −  ×  ÷  ^  funciones científicas  paréntesis.
   * NO usa eval().
   * @param {string} expr
   * @returns {number}
   */
  static evaluate(expr) {
    const tokens = CalcEngine._tokenize(expr);
    const result = CalcEngine._parseExpr(tokens, 0).value;
    return result;
  }

  /* ── Tokenizer ─────────────────────────────────────── */

  static _tokenize(expr) {
    const re = /\s*(\d+\.?\d*|[+\-×÷^%()\u2212]|sin|cos|tan|log|ln|sqrt|π|e)\s*/gy;
    const tokens = [];
    let m;
    while ((m = re.exec(expr)) !== null) {
      tokens.push(m[1]);
    }
    // Replace visual minus with ASCII
    return tokens.map(t => t === '\u2212' ? '-' : t);
  }

  /* ── Recursive descent parser (Pratt style) ────────── */

  static _parseExpr(tokens, pos, minPrec = 0) {
    let { value, pos: p } = CalcEngine._parseUnary(tokens, pos);

    while (p < tokens.length) {
      const op = tokens[p];
      const prec = CalcEngine._infixPrec(op);
      if (prec === null || prec <= minPrec) break;

      p++;
      const right = CalcEngine._parseExpr(tokens, p, prec);
      value = CalcEngine._applyBinary(op, value, right.value);
      p = right.pos;
    }

    return { value, pos: p };
  }

  static _parseUnary(tokens, pos) {
    if (pos >= tokens.length) throw new Error('Expresión incompleta');

    const tok = tokens[pos];

    // Unary minus
    if (tok === '-') {
      const { value, pos: p } = CalcEngine._parseUnary(tokens, pos + 1);
      return { value: -value, pos: p };
    }

    // Unary plus
    if (tok === '+') {
      return CalcEngine._parseUnary(tokens, pos + 1);
    }

    // Parenthesis
    if (tok === '(') {
      const inner = CalcEngine._parseExpr(tokens, pos + 1, 0);
      if (tokens[inner.pos] !== ')') throw new Error('Paréntesis sin cerrar');
      return { value: inner.value, pos: inner.pos + 1 };
    }

    // Scientific functions
    const SCI_FNS = ['sin','cos','tan','log','ln','sqrt'];
    if (SCI_FNS.includes(tok)) {
      pos++;
      let arg;
      if (tokens[pos] === '(') {
        const inner = CalcEngine._parseExpr(tokens, pos + 1, 0);
        if (tokens[inner.pos] !== ')') throw new Error('Paréntesis sin cerrar');
        arg = inner.value;
        pos = inner.pos + 1;
      } else {
        const r = CalcEngine._parseUnary(tokens, pos);
        arg = r.value;
        pos = r.pos;
      }
      return { value: CalcEngine._applyFunction(tok, arg), pos };
    }

    // Constants
    if (tok === 'π') return { value: Math.PI, pos: pos + 1 };
    if (tok === 'e')  return { value: Math.E,  pos: pos + 1 };

    // Number
    const n = parseFloat(tok);
    if (isNaN(n)) throw new Error(`Token inesperado: "${tok}"`);
    return { value: n, pos: pos + 1 };
  }

  static _infixPrec(op) {
    const P = { '+': 1, '-': 1, '×': 2, '÷': 2, '%': 2, '^': 3 };
    return P[op] ?? null;
  }

  static _applyBinary(op, a, b) {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷':
        if (b === 0) throw new Error('DIV/0');
        return a / b;
      case '%': return a % b;
      case '^': return Math.pow(a, b);
      default:  throw new Error(`Operador desconocido: ${op}`);
    }
  }

  static _applyFunction(fn, x) {
    switch (fn) {
      case 'sin':  return CalcEngine._round(Math.sin(CalcEngine._toRad(x)));
      case 'cos':  return CalcEngine._round(Math.cos(CalcEngine._toRad(x)));
      case 'tan':  {
        const r = CalcEngine._round(Math.tan(CalcEngine._toRad(x)));
        if (!isFinite(r)) throw new Error('tan indefinida');
        return r;
      }
      case 'log':
        if (x <= 0) throw new Error('log: dominio inválido');
        return CalcEngine._round(Math.log10(x));
      case 'ln':
        if (x <= 0) throw new Error('ln: dominio inválido');
        return CalcEngine._round(Math.log(x));
      case 'sqrt':
        if (x < 0) throw new Error('√ negativa');
        return CalcEngine._round(Math.sqrt(x));
      default:
        throw new Error(`Función desconocida: ${fn}`);
    }
  }

  static _toRad(deg) { return deg * (Math.PI / 180); }

  /**
   * Corrección de errores de punto flotante.
   * Redondea a 12 decimales significativos.
   */
  static _round(n) {
    return parseFloat(n.toPrecision(12));
  }

  /**
   * Formatea un número para la pantalla.
   * Evita notación científica cuando es posible.
   */
  static format(n) {
    if (!isFinite(n)) return n > 0 ? '∞' : '-∞';
    if (isNaN(n))     return 'Error';

    // Very large / very small → exponential
    if (Math.abs(n) >= 1e13 || (Math.abs(n) < 1e-7 && n !== 0)) {
      return n.toExponential(6).replace('e+', 'e').replace('e0', 'e0');
    }

    // Remove trailing zeros after decimal
    const str = parseFloat(n.toPrecision(12)).toString();
    return str;
  }
}

/* ============================================================
   2. DISPLAY — CalcDisplay
   ============================================================ */

class CalcDisplay {
  constructor() {
    this.exprEl   = document.getElementById('expression');
    this.resultEl = document.getElementById('result');
    this.infoEl   = document.getElementById('displayInfo');
  }

  setExpression(text) {
    this.exprEl.textContent = text || '';
  }

  setResult(text, isError = false) {
    const el = this.resultEl;

    // Adapt font size to content length
    el.className = 'display__result';
    if (isError) {
      el.classList.add('error');
    } else if (text.length > 14) {
      el.classList.add('xsmall');
    } else if (text.length > 10) {
      el.classList.add('small');
    }

    el.textContent = text;
  }

  setInfo(text) {
    this.infoEl.textContent = text || '';
  }

  /** Animate the result value */
  animatePop() {
    const el = this.resultEl;
    el.classList.remove('pop');
    void el.offsetWidth; // reflow
    el.classList.add('pop');
  }

  /** Shake display on error */
  shakeError() {
    const card = document.querySelector('.display');
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
  }

  /** Highlight active operator button */
  setActiveOperator(op) {
    document.querySelectorAll('.btn--operator').forEach(b => b.classList.remove('active'));
    if (op) {
      document.querySelectorAll('.btn--operator').forEach(b => {
        if (b.dataset.op === op) b.classList.add('active');
      });
    }
  }
}

/* ============================================================
   3. APP — CalcApp (coordinador principal)
   ============================================================ */

class CalcApp {
  constructor() {
    this.display = new CalcDisplay();

    // ── State ──────────────────────────────────────────
    this._reset();

    // ── Mode ───────────────────────────────────────────
    this.sciMode = false;

    // ── Wire up UI ────────────────────────────────────
    this._bindButtons();
    this._bindKeyboard();
    this._bindModeToggle();

    // Initial render
    this._render();
  }

  /* ── State management ──────────────────────────────── */

  _reset() {
    this.currentInput   = '0';  // what's shown on screen
    this.expression     = '';   // the full expression string being built
    this.pendingOperator= null; // last operator pressed
    this.storedValue    = null; // left-hand operand
    this.justEvaluated  = false;// did we just press =?
    this.openParens     = 0;    // count of unclosed (
    this.hasError       = false;
  }

  /* ── Button binding ────────────────────────────────── */

  _bindButtons() {
    document.getElementById('keypad').addEventListener('click', e => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      this._handleAction(btn.dataset);
    });

    const sciPanel = document.getElementById('sciPanel');
    sciPanel.addEventListener('click', e => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      this._handleAction(btn.dataset);
    });
  }

  _handleAction({ action, digit, op, fn, paren }) {
    if (this.hasError && action !== 'reset') {
      if (action === 'clear') { this._doReset(); return; }
      // Allow typing new number after error
      if (action === 'digit') { this._doReset(); }
      else { this._shakeAndReturn(); return; }
    }

    switch (action) {
      case 'digit':    this._inputDigit(digit);  break;
      case 'operator': this._inputOperator(op);  break;
      case 'decimal':  this._inputDecimal();     break;
      case 'negate':   this._inputNegate();      break;
      case 'percent':  this._inputPercent();     break;
      case 'equals':   this._inputEquals();      break;
      case 'delete':   this._inputDelete();      break;
      case 'clear':    this._inputClear();       break;
      case 'reset':    this._doReset();          break;
      case 'paren':    this._inputParen(paren);  break;
      case 'sci':      this._inputSci(fn);       break;
    }

    this._render();
  }

  /* ── Core input handlers ───────────────────────────── */

  _inputDigit(d) {
    if (this.justEvaluated) {
      // Start fresh after =
      this.expression   = '';
      this.currentInput = d;
      this.justEvaluated= false;
      this.pendingOperator = null;
      this.storedValue  = null;
    } else if (this.currentInput === '0' || this.currentInput === '-0') {
      const neg = this.currentInput.startsWith('-');
      this.currentInput = neg ? '-' + d : d;
    } else {
      if (this.currentInput.replace('-','').replace('.','').length >= 16) return; // digit limit
      this.currentInput += d;
    }
  }

  _inputOperator(op) {
    const current = parseFloat(this.currentInput);

    if (this.justEvaluated) {
      // Continue from last result
      this.expression = CalcEngine.format(current);
      this.justEvaluated = false;
    } else if (this.pendingOperator && this.expression !== '' && !this._endsWithOperator()) {
      // Chain: evaluate before applying new operator
      try {
        const expr = this.expression + this.currentInput;
        const result = CalcEngine.evaluate(expr);
        this.expression = CalcEngine.format(result);
        this.currentInput = CalcEngine.format(result);
      } catch {
        this.expression += this.currentInput;
      }
    } else {
      this.expression += this.currentInput;
    }

    this.pendingOperator = op;
    this.expression     += op;
    this.currentInput    = '0';

    this.display.setActiveOperator(op);
  }

  _inputDecimal() {
    if (this.justEvaluated) {
      this.currentInput  = '0.';
      this.justEvaluated = false;
      this.expression    = '';
      this.pendingOperator = null;
      this.storedValue   = null;
    } else if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
  }

  _inputNegate() {
    if (this.currentInput === '0' || this.currentInput === '') return;
    if (this.currentInput.startsWith('-')) {
      this.currentInput = this.currentInput.slice(1);
    } else {
      this.currentInput = '-' + this.currentInput;
    }
  }

  _inputPercent() {
    const val = parseFloat(this.currentInput);
    if (isNaN(val)) return;

    if (this.storedValue !== null || this.expression !== '') {
      // Relative percent: 200 + 10% → 200 + (200 × 0.10)
      let base = this.storedValue;
      if (base === null) {
        try { base = CalcEngine.evaluate(this.expression); } catch { base = val; }
      }
      this.currentInput = CalcEngine.format(CalcEngine._round(base * val / 100));
    } else {
      // Absolute percent
      this.currentInput = CalcEngine.format(CalcEngine._round(val / 100));
    }
  }

  _inputEquals() {
    if (this.justEvaluated) {
      // Repeat last operation
      if (this.pendingOperator && this.storedValue !== null) {
        const expr = CalcEngine.format(parseFloat(this.currentInput))
                   + this.pendingOperator
                   + CalcEngine.format(this.storedValue);
        this._computeExpression(expr);
      }
      return;
    }

    if (this.expression === '') {
      this.display.animatePop();
      return;
    }

    // Save right operand for repeat
    this.storedValue = parseFloat(this.currentInput);

    const fullExpr = this.expression + this.currentInput;
    this._computeExpression(fullExpr);
  }

  _computeExpression(expr) {
    try {
      const result = CalcEngine.evaluate(expr);
      const formatted = CalcEngine.format(result);

      this.display.setExpression(expr + ' =');
      this.display.setResult(formatted);
      this.display.animatePop();
      this.display.setActiveOperator(null);

      this.currentInput    = formatted;
      this.expression      = '';
      this.pendingOperator = null;
      this.justEvaluated   = true;
      this.openParens      = 0;

    } catch (err) {
      this._showError(err.message);
    }
  }

  _inputDelete() {
    if (this.justEvaluated) { this._doReset(); return; }
    if (this.currentInput.length <= 1 || this.currentInput === '-0') {
      this.currentInput = '0';
    } else {
      this.currentInput = this.currentInput.slice(0, -1);
      if (this.currentInput === '-') this.currentInput = '0';
    }
  }

  _inputClear() {
    this.currentInput    = '0';
    this.justEvaluated   = false;
  }

  _doReset() {
    this._reset();
    this.display.setActiveOperator(null);
  }

  _inputParen(p) {
    if (p === '(') {
      if (this.justEvaluated) {
        this.expression    = '';
        this.justEvaluated = false;
      }
      // If a digit is typed before '(', insert implicit ×
      if (this.currentInput !== '0' && this.currentInput !== '') {
        this.expression += this.currentInput + '×';
        this.currentInput = '0';
      }
      this.expression += '(';
      this.openParens++;
    } else if (p === ')') {
      if (this.openParens <= 0) return;
      this.expression += this.currentInput + ')';
      this.currentInput = '0';
      this.openParens--;
    }
  }

  _inputSci(fn) {
    const val = parseFloat(this.currentInput);
    if (isNaN(val)) return;

    switch (fn) {
      case 'sin': case 'cos': case 'tan':
      case 'log': case 'ln': case 'sqrt': {
        try {
          const result = CalcEngine._applyFunction(fn, val);
          const label  = fn + '(' + CalcEngine.format(val) + ')';
          this.display.setExpression(label + ' =');
          this.currentInput  = CalcEngine.format(result);
          this.justEvaluated = true;
          this.expression    = '';
          this.display.animatePop();
        } catch (e) { this._showError(e.message); }
        break;
      }
      case 'pow2': {
        const result = CalcEngine._round(val * val);
        this.display.setExpression(CalcEngine.format(val) + '² =');
        this.currentInput  = CalcEngine.format(result);
        this.justEvaluated = true;
        this.expression    = '';
        this.display.animatePop();
        break;
      }
      case 'powy': {
        // Start a ^ expression
        this._inputOperator('^');
        break;
      }
      case 'pi':
        this.currentInput  = CalcEngine.format(Math.PI);
        this.justEvaluated = false;
        break;
      case 'euler':
        this.currentInput  = CalcEngine.format(Math.E);
        this.justEvaluated = false;
        break;
    }
  }

  /* ── Keyboard ──────────────────────────────────────── */

  _bindKeyboard() {
    document.addEventListener('keydown', e => {
      // Ignore modifier combos except Shift
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const k = e.key;

      if (k >= '0' && k <= '9')          { this._handleAction({ action:'digit', digit:k });    e.preventDefault(); return; }
      if (k === '.' || k === ',')         { this._handleAction({ action:'decimal' });            e.preventDefault(); return; }
      if (k === '+')                      { this._handleAction({ action:'operator', op:'+' });   e.preventDefault(); return; }
      if (k === '-')                      { this._handleAction({ action:'operator', op:'−' });   e.preventDefault(); return; }
      if (k === '*')                      { this._handleAction({ action:'operator', op:'×' });   e.preventDefault(); return; }
      if (k === '/')                      { this._handleAction({ action:'operator', op:'÷' });   e.preventDefault(); return; }
      if (k === '^')                      { this._handleAction({ action:'operator', op:'^' });   e.preventDefault(); return; }
      if (k === '%')                      { this._handleAction({ action:'percent' });             e.preventDefault(); return; }
      if (k === 'Enter' || k === '=')     { this._handleAction({ action:'equals' });             e.preventDefault(); return; }
      if (k === 'Backspace')              { this._handleAction({ action:'delete' });             e.preventDefault(); return; }
      if (k === 'Escape')                 { this._handleAction({ action:'reset' });              e.preventDefault(); return; }
      if (k === 'Delete')                 { this._handleAction({ action:'clear' });              e.preventDefault(); return; }
      if (k === '(')                      { this._handleAction({ action:'paren', paren:'(' });   e.preventDefault(); return; }
      if (k === ')')                      { this._handleAction({ action:'paren', paren:')' });   e.preventDefault(); return; }
      if (k === 'n' || k === 'N')         { this._handleAction({ action:'negate' });             e.preventDefault(); return; }

      // Visual button press feedback
      this._flashKeyboardHint(k);
    });
  }

  _flashKeyboardHint(k) {
    const map = {
      '0':'btn0','1':'btn1','2':'btn2','3':'btn3','4':'btn4',
      '5':'btn5','6':'btn6','7':'btn7','8':'btn8','9':'btn9',
      '.':'btnDot',',':'btnDot',
      '+':'btnAdd','-':'btnSub','*':'btnMul','/':'btnDiv',
      'Enter':'btnEquals','=':'btnEquals',
      'Backspace':'btnDel','Escape':'btnAC','Delete':'btnCE',
      '%':'btnPct','(':'btnParenOpen',')':'btnParenClose',
    };
    const id = map[k];
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 120);
  }

  /* ── Mode toggle ───────────────────────────────────── */

  _bindModeToggle() {
    document.getElementById('modeToggle').addEventListener('click', () => {
      this.sciMode = !this.sciMode;
      const btn   = document.getElementById('modeToggle');
      const panel = document.getElementById('sciPanel');
      btn.setAttribute('aria-pressed', this.sciMode);
      panel.setAttribute('aria-hidden', !this.sciMode);
      panel.classList.toggle('visible', this.sciMode);
      btn.title = this.sciMode ? 'Desactivar modo científico' : 'Activar modo científico';
    });
  }

  /* ── Render ────────────────────────────────────────── */

  _render() {
    if (this.hasError) return; // error state already rendered

    // Expression line
    if (!this.justEvaluated) {
      const exprText = this.expression
        + (this.expression === '' ? '' : this.currentInput === '0' ? '' : this.currentInput);
      this.display.setExpression(exprText);
    }

    // Result / current input
    if (!this.justEvaluated) {
      this.display.setResult(this.currentInput || '0');
    }

    // Info: open parens
    this.display.setInfo(this.openParens > 0 ? `( × ${this.openParens}` : '');
  }

  /* ── Helpers ───────────────────────────────────────── */

  _endsWithOperator() {
    return /[+\-×÷^%]$/.test(this.expression);
  }

  _showError(msg) {
    this.hasError = true;
    let label = 'Error';
    if (msg === 'DIV/0')              label = 'Error: ÷ 0';
    else if (msg.includes('dominio')) label = 'Dominio inválido';
    else if (msg.includes('negativa'))label = 'Raíz negativa';
    else if (msg.includes('indefinida')) label = 'Indefinido';
    else if (msg.includes('incompleta')) label = 'Incompleta';
    else if (msg.includes('Paréntesis')) label = 'Paréntesis';

    this.display.setResult(label, true);
    this.display.setExpression(this.expression + this.currentInput);
    this.display.shakeError();
    this.display.setActiveOperator(null);

    // Auto-recover: clear error after 2 s on next digit
    setTimeout(() => { this.hasError = false; }, 50);
  }

  _shakeAndReturn() {
    this.display.shakeError();
  }
}

/* ============================================================
   4. BOOTSTRAP
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  window._calcApp = new CalcApp();
});
