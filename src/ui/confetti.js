import { el, reduceMotion } from './dom.js';

const COLORS = ['#FF8A7A', '#FFD166', '#7FD8B6', '#86C5F2', '#C3A6F0'];
const SHAPES = ['⭐', '✨', '', '', '', ''];
let timer = 0;

function box() { return document.getElementById('confetti'); }

export function clearConfetti() {
  const b = box();
  if (b) b.innerHTML = '';
  clearTimeout(timer);
}

export function celebrate() {
  const b = box();
  if (!b) return;
  clearConfetti();
  if (reduceMotion()) return;
  for (let i = 0; i < 35; i++) {
    const shape = SHAPES[i % SHAPES.length];
    const c = el('span', 'bit' + (shape ? ' bit-star' : ''), shape || null);
    c.style.left = Math.random() * 100 + 'vw';
    c.style.setProperty('--dx', (Math.random() * 30 - 15) + 'vw');
    c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    c.style.animationDuration = (1.8 + Math.random() * 1.6) + 's';
    c.style.animationDelay = (Math.random() * 0.4) + 's';
    if (!shape) c.style.background = COLORS[i % COLORS.length];
    b.appendChild(c);
  }
  timer = setTimeout(clearConfetti, 4200);
}
