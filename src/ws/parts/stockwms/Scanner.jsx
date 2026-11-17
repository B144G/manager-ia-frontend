import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';

/* Saisie d'un code : caméra du téléphone (API BarcodeDetector quand le navigateur la propose, sur une page en HTTPS),
   sinon saisie manuelle. Un lecteur USB ou Bluetooth « tape » dans le champ puis Entrée : cela marche aussi.
   onCode(code) est appelé avec le texte lu. Rien n'est envoyé ailleurs : l'image reste dans le navigateur. */
export const cameraSupported = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

function Camera({ onCode, onClose }) {
  const t = useT();
  const video = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let stream; let stop = false; let timer;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stop) { stream.getTracks().forEach((x) => x.stop()); return; }
        const v = video.current; v.srcObject = stream; await v.play();
        let formats;
        try { formats = await window.BarcodeDetector.getSupportedFormats(); } catch { formats = undefined; }
        const det = formats && formats.length ? new window.BarcodeDetector({ formats }) : new window.BarcodeDetector();
        const tick = async () => {
          if (stop) return;
          try { const found = await det.detect(v); if (found && found[0] && found[0].rawValue) { stop = true; onCode(String(found[0].rawValue)); return; } } catch { /* image pas prête */ }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (e) {
        setErr(e && e.name === 'NotAllowedError' ? t("La caméra n'est pas autorisée : autorisez-la dans le navigateur, ou saisissez le code.") : t("La caméra n'est pas disponible : saisissez le code."));
      }
    })();
    return () => { stop = true; clearTimeout(timer); if (stream) stream.getTracks().forEach((x) => x.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="wms-cam">
      {err ? <p className="ws-err" role="alert">{err}</p> : <video ref={video} playsInline muted aria-label={t('Caméra : visez le code-barres')} />}
      <button className="btn" type="button" onClick={onClose}>{t('Fermer la caméra')}</button>
    </div>
  );
}

export default function Scanner({ onCode, label, hint, autoFocus }) {
  const t = useT();
  const [val, setVal] = useState('');
  const [cam, setCam] = useState(false);
  const send = (c) => { const x = String(c || '').trim(); if (x) { setVal(''); setCam(false); onCode(x); } };
  return (
    <div className="wms-scan-box">
      <form className="wms-scan-row" onSubmit={(e) => { e.preventDefault(); send(val); }}>
        <label className="fld"><span>{label || t('Code lu ou saisi')}</span>
          <input type="text" inputMode="text" autoCapitalize="characters" autoComplete="off" autoFocus={autoFocus} value={val} onChange={(e) => setVal(e.target.value)} placeholder={t('Scannez ou tapez le code')} />
        </label>
        <button className="btn primary" type="submit">{t('Valider')}</button>
        {cameraSupported() ? <button className="btn" type="button" onClick={() => setCam(!cam)}>{cam ? t('Fermer la caméra') : t('Scanner avec la caméra')}</button> : null}
      </form>
      {hint ? <p className="muted small">{hint}</p> : null}
      {!cameraSupported() ? <p className="muted small">{t("Votre navigateur ne lit pas les codes avec la caméra : saisissez le code, ou utilisez un lecteur.")}</p> : null}
      {cam ? <Camera onCode={send} onClose={() => setCam(false)} /> : null}
    </div>
  );
}
