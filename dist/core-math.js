'use strict';

// Small expression parser. Expressions never execute JavaScript.
((root) => {
  function compile(source, options = {}) {
    const text = String(source).toLowerCase().replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt');
    if (text.length > 240) throw new Error('Expression is too long.');
    const tokens = [];
    const pattern = /\s+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[()+\-*/^%]/gy;
    let pos = 0;
    while (pos < text.length) {
      pattern.lastIndex = pos;
      const match = pattern.exec(text);
      if (!match) throw new Error('Use numbers and supported math functions.');
      if (match[0].trim()) tokens.push(match[0]);
      pos = pattern.lastIndex;
    }
    let i = 0;
    const factor = options.angle === 'deg' ? Math.PI / 180 : 1;
    const functions = {sin: x => Math.sin(x * factor), cos: x => Math.cos(x * factor), tan: x => Math.abs(Math.cos(x * factor)) < 1e-12 ? NaN : Math.tan(x * factor), sqrt: Math.sqrt, abs: Math.abs, log: Math.log10, ln: Math.log, exp: Math.exp};
    const isNumber = s => /^(?:\d|\.\d)/.test(s || '');
    function atom() {
      const token = tokens[i++];
      if (isNumber(token)) { const n = Number(token); return () => n; }
      if (token === '(') { const value = sum(); if (tokens[i++] !== ')') throw new Error('Close the parenthesis.'); return value; }
      if (token === 'x' && options.variable) return x => x;
      if (['pi', 'e', 'ans'].includes(token)) { const n = token === 'pi' ? Math.PI : token === 'e' ? Math.E : (options.ans || 0); return () => n; }
      if (Object.prototype.hasOwnProperty.call(functions, token)) {
        if (tokens[i++] !== '(') throw new Error('Use ' + token + '(…).');
        const value = sum();
        if (tokens[i++] !== ')') throw new Error('Close the parenthesis.');
        return x => functions[token](value(x));
      }
      throw new Error(token ? 'Unknown value: ' + token : 'Complete the expression.');
    }
    function power() {
      let value = atom();
      while (tokens[i] === '%') { i++; const left = value; value = x => left(x) / 100; }
      if (tokens[i] === '^') { i++; const left = value, right = unary(); value = x => left(x) ** right(x); }
      return value;
    }
    function unary() {
      if (tokens[i] === '+' || tokens[i] === '-') { const sign = tokens[i++] === '-' ? -1 : 1; const value = unary(); return x => sign * value(x); }
      return power();
    }
    function product() {
      let value = unary();
      while (i < tokens.length) {
        const t = tokens[i];
        const implicit = t === '(' || /^[a-z]/.test(t) || isNumber(t);
        if (t !== '*' && t !== '/' && !implicit) break;
        if (!implicit) i++;
        const left = value, right = unary();
        value = t === '/' ? x => left(x) / right(x) : x => left(x) * right(x);
      }
      return value;
    }
    function sum() {
      let value = product();
      while (tokens[i] === '+' || tokens[i] === '-') {
        const op = tokens[i++], left = value, right = product();
        value = op === '+' ? x => left(x) + right(x) : x => left(x) - right(x);
      }
      return value;
    }
    const result = sum();
    if (i !== tokens.length) throw new Error('Check the parentheses.');
    return result;
  }
  function evaluate(source, options) {
    const value = compile(source, options)(0);
    if (!Number.isFinite(value)) throw new Error('No real, finite result.');
    return Math.abs(value) < 1e-14 ? 0 : value;
  }
  function triangle(unknown, values) {
    const known = ['a', 'b', 'c'].filter(side => side !== unknown);
    if (!known.every(side => Number.isFinite(values[side]) && values[side] > 0)) throw new Error('Enter two positive side lengths.');
    const result = {...values};
    if (unknown === 'c') result.c = Math.hypot(values.a, values.b);
    else {
      const leg = unknown === 'a' ? values.b : values.a;
      if (values.c <= leg) throw new Error('C must be longer than either leg.');
      result[unknown] = Math.sqrt((values.c - leg) * (values.c + leg));
    }
    if (!Number.isFinite(result[unknown])) throw new Error('Use smaller lengths.');
    return result;
  }
  const api = {compile, evaluate, triangle, format: n => Number(n.toPrecision(10)).toString()};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoreMath = api;
})(typeof window === 'undefined' ? globalThis : window);
