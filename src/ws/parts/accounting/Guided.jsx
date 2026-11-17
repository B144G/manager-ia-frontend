import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Loading, useLoad } from '../../ui.jsx';

/* Saisie guidée : on choisit un modèle (loyer, salaire, vente au comptant…), on donne la date et le montant, le serveur choisit les comptes. */

const opt = (o) => (Array.isArray(o) ? [o[0], o[1]] : o && typeof o === 'object' ? [o.value !== undefined ? o.value : o.k, o.label !== undefined ? o.label : o.value] : [o, o]);

function TemplateForm({ tpl, sections, close, onSaved, back }) {
  const t = useT();
  const { oapi, today, toast } = useWs();
  const fields = tpl.fields || [];
  const amountKey = (fields.find((f) => f.type === 'amount') || { k: 'amount' }).k;
  const [vals, setVals] = useState(() => Object.fromEntries(fields.map((f) => [f.k, f.type === 'select' && f.options && f.options[0] ? String(opt(f.options[0])[0]) : ''])));
  const [date, setDate] = useState(today());
  const [piece, setPiece] = useState('');
  const [section, setSection] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const secs = (sections || []).filter((s) => s.active);
  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));

  function save() {
    setErr('');
    const amount = Number(vals[amountKey]);
    if (!(amount > 0)) { setErr(t('Indiquez un montant supérieur à zéro.')); return; }
    const options = {};
    fields.forEach((f) => { if (f.k !== amountKey && f.k !== 'label' && vals[f.k] !== '') options[f.k] = f.type === 'amount' ? Number(vals[f.k]) : vals[f.k]; });
    const body = { template: tpl.id, date, amount, options };
    if (vals.label && vals.label.trim()) body.label = vals.label.trim();
    if (piece.trim()) body.piece = piece.trim();
    if (section) body.section = section;
    setBusy(true);
    oapi('POST', '/accounting/entries/from-template', body)
      .then((r) => { close(); toast(t('Écriture {number} enregistrée.', { number: r.number })); onSaved(); }, (e) => { setErr(tsrv(e.message)); setBusy(false); });
  }

  return (
    <>
      <div className="row"><button className="link" type="button" onClick={back}>{t('← Autres modèles')}</button></div>
      <h3>{tsrv(tpl.label)}</h3>
      {tpl.hint ? <p className="muted small">{tsrv(tpl.hint)}</p> : null}
      <div className="ws-form">
        <label className="fld"><span>{t('Date')}</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {fields.map((f) => (
          <label className="fld" key={f.k}>
            <span>{tsrv(f.label)}</span>
            {f.type === 'select'
              ? <select value={vals[f.k]} onChange={(e) => set(f.k, e.target.value)}>{(f.options || []).map((o) => { const [v, l] = opt(o); return <option key={v} value={v}>{tsrv(String(l))}</option>; })}</select>
              : <input type={f.type === 'amount' ? 'number' : 'text'} min={f.type === 'amount' ? '0' : undefined} step={f.type === 'amount' ? '1' : undefined} inputMode={f.type === 'amount' ? 'numeric' : undefined} value={vals[f.k]} onChange={(e) => set(f.k, e.target.value)} />}
          </label>
        ))}
        <label className="fld"><span>{t('Pièce (facultatif)')}</span><input type="text" maxLength={60} value={piece} onChange={(e) => setPiece(e.target.value)} /></label>
        {secs.length ? (
          <label className="fld"><span>{t('Section analytique')}</span>
            <select value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="">{t('Sans section')}</option>
              {secs.map((s) => <option key={s.code} value={s.code}>{s.code + ' · ' + s.label}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary small" type="button" disabled={busy} onClick={save}>{t("Enregistrer l'écriture")}</button></div>
      <p className="muted small">{t('Les comptes sont choisis pour vous d\'après votre plan comptable et le taux de TVA des réglages.')}</p>
    </>
  );
}

export default function Guided({ sections, close, onSaved, back }) {
  const t = useT();
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/templates'), []);
  const [tpl, setTpl] = useState(null);
  if (st.loading) return <Loading />;
  if (st.error) return <p className="ws-err" role="alert">{tsrv(st.error.message)}</p>;
  if (tpl) return <TemplateForm tpl={tpl} sections={sections} close={close} onSaved={onSaved} back={() => setTpl(null)} />;
  const list = st.data.templates || [];
  return (
    <>
      <div className="row"><button className="link" type="button" onClick={back}>{t('← Saisie libre')}</button></div>
      <p className="muted small">{t('Choisissez ce qui s\'est passé : il suffit d\'indiquer la date et le montant.')}</p>
      {!list.length ? <Empty text={t('Aucun modèle disponible.')} /> : null}
      {list.map((x) => (
        <button key={x.id} type="button" className="line" style={{ width: '100%', textAlign: 'left', minHeight: 44, background: 'none', cursor: 'pointer' }} onClick={() => setTpl(x)}>
          <span><b>{tsrv(x.label)}</b>{x.hint ? <><br /><small className="muted">{tsrv(x.hint)}</small></> : null}</span>
          <span className="pill">{x.journal}</span>
        </button>
      ))}
    </>
  );
}
