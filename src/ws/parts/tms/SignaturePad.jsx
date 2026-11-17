import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';

/* Signature au doigt (ou à la souris) sur un canevas ; renvoie une image PNG. Fond blanc pour rester lisible une fois imprimée. */
export default function SignaturePad({ onChange }) {
  const t = useT();
  const ref = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const w = c.clientWidth || 320; const h = c.clientHeight || 180;
    c.width = w * ratio; c.height = h * ratio;
    const g = c.getContext('2d');
    g.scale(ratio, ratio);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0f172a';
  }, []);

  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); drawing.current = true; const g = ref.current.getContext('2d'); const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.1, y + 0.1); g.stroke(); };
  const move = (e) => { if (!drawing.current) return; e.preventDefault(); const g = ref.current.getContext('2d'); const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false; setEmpty(false);
    ref.current.toBlob((b) => onChange(b), 'image/png');
  };
  const clear = () => {
    const c = ref.current; const g = c.getContext('2d');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.restore();
    setEmpty(true); onChange(null);
  };
  return (
    <div className="tms-sign">
      <canvas ref={ref} className="tms-sign-pad" aria-label={t('Zone de signature')} role="img" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      <div className="row"><small className="muted">{empty ? t('Faites signer le client avec le doigt.') : t('Signature enregistrée à l\'envoi.')}</small><button className="btn small" type="button" onClick={clear}>{t('Effacer')}</button></div>
    </div>
  );
}
