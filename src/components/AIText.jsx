import { useEffect, useRef, useState } from 'react';

// Trois points qui sautillent pendant que l'IA prépare sa réponse.
export function Dots() {
  return <span className="ai-dots" role="status" aria-label="…"><i /><i /><i /></span>;
}

// Affiche le texte comme s'il s'écrivait vite (environ 1,5 s au plus). Sans animation si le système la déconseille.
export function Typed({ text, animate = true }) {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [n, setN] = useState(animate && !reduce ? 0 : text.length);
  const box = useRef(null);
  useEffect(() => {
    if (n >= text.length) return undefined;
    const step = Math.max(2, Math.ceil(text.length / 70));
    const id = setTimeout(() => setN((v) => Math.min(text.length, v + step)), 20);
    return () => clearTimeout(id);
  }, [n, text]);
  useEffect(() => { if (box.current && n < text.length) box.current.scrollIntoView({ block: 'nearest' }); }, [n, text.length]);
  return <span ref={box}>{text.slice(0, n)}</span>;
}
