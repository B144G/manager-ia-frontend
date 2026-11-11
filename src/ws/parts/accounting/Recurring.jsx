import { useEffect, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import LinesEditor, { cleanLines } from './LinesEditor.jsx';

/* Écritures récurrentes (loyer, abonnements, amortissements courants…) : un modèle, une écriture par échéance, jamais en double. */

const FREQ = { monthly: 'Chaque mois', quarterly: 'Chaque trimestre', yearly: 'Chaque année' };

function RecurringForm({ item, accs, JN, sections, close, onSaved }) {
  const t = useT();
  const { oapi, today, toast } = useWs();
  const [label, setLabel] = useState(item ? item.label : '');
  const [journal, setJournal] = useState(item ? item.journal : 'OD');
  const [frequency, setFrequency] = useState(item ? item.frequency : 'monthly');
  const [dayOfMonth, setDay] = useState(item ? String(item.dayOfMonth) : '5');
  const [startDate, setStart] = useState(item ? item.startDate : today());
  const [endDate, setEnd] = useState(item && item.endDate ? item.endDate : '');
  const [section, setSection] = useState(item && item.section ? item.section : '');
  const [lines, setLines] = useState(() => ((item && item.lines) || [{}, {}]).map((v) => ({ account: v.account || '', debit: v.debit ? String(v.debit) : '', credit: v.credit ? String(v.credit) : '', section: v.section || '' })));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const secs = (sections || []).filter((s) => s.active);
  let d = 0;
  let c = 0;
  lines.forEach((l) => { d += Number(l.debit) || 0; c += Number(l.credit) || 0; });

  function save() {
    setErr('');
    if (!label.trim()) { setErr(t('Donnez un libellé.')); return; }
    if (d !== c || d <= 0) { setErr(t("L'écriture doit être équilibrée (total des débits = total des crédits).")); return; }
    const body = { label: label.trim(), journal, frequency, dayOfMonth: Number(dayOfMonth) || 1, startDate, endDate: endDate || null, lines: cleanLines(lines), section, active: item ? item.active : true };
    setBusy(true);
    oapi(item ? 'PUT' : 'POST', '/accounting/recurring' + (item ? '/' + item.id : ''), body)
      .then(() => { close(); toast(t('Modèle enregistré.')); onSaved(); }, (e) => { setErr(tsrv(e.message)); setBusy(false); });
  }
  return (
    <div className="ws-form">
      <label className="fld"><span>{t('Libellé')}</span><input type="text" style={{ fontSize: 16 }} maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <select aria-label={t('Journal')} value={journal} style={{ fontSize: 16 }} onChange={(e) => setJournal(e.target.value)}>{Object.keys(JN).filter((k) => k !== 'AN').map((k) => <option key={k} value={k}>{t(JN[k])}</option>)}</select>
        <select aria-label={t('Fréquence')} value={frequency} style={{ fontSize: 16 }} onChange={(e) => setFrequency(e.target.value)}>{Object.entries(FREQ).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <label className="fld"><span>{t('Jour du mois (1 à 28)')}</span><input type="number" min="1" max="28" style={{ fontSize: 16, width: 90 }} value={dayOfMonth} onChange={(e) => setDay(e.target.value)} /></label>
        <label className="fld"><span>{t('Début')}</span><input type="date" style={{ fontSize: 16 }} value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="fld"><span>{t('Fin (facultatif)')}</span><input type="date" style={{ fontSize: 16 }} value={endDate} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      {secs.length ? (
        <label className="fld"><span>{t('Section analytique par défaut')}</span>
          <select style={{ fontSize: 16 }} value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">{t('Sans section')}</option>
            {secs.map((s) => <option key={s.code} value={s.code}>{s.code + ' · ' + s.label}</option>)}
          </select>
        </label>
      ) : null}
      <LinesEditor accs={accs} lines={lines} setLines={setLines} sections={sections} />
      <p className="ws-err" role="alert">{err}</p>
      <div className="row"><button className="btn primary small" type="button" disabled={busy} onClick={save}>{t('Enregistrer')}</button></div>
    </div>
  );
}

export default function RecurringTab() {
  const t = useT();
  const { oapi, money, dateFr, today, modal, confirm, toast, fail } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/recurring'), []);
  const [meta, setMeta] = useState(null); // plan comptable, journaux, sections : chargés une fois
  const [upTo, setUpTo] = useState(today());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let off = false;
    Promise.all([
      oapi('GET', '/accounting/accounts'), oapi('GET', '/accounting'),
      oapi('GET', '/accounting/analytics/sections').catch(() => ({ sections: [] })),
    ]).then(([a, o, s]) => { if (!off) setMeta({ accs: a.accounts, JN: o.journals || {}, sections: s.sections || [] }); }).catch(() => {});
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edit = (item) => {
    if (!meta) return;
    modal(item ? t('Modifier le modèle') : t('Nouveau modèle récurrent'), (close) => <RecurringForm item={item} accs={meta.accs} JN={meta.JN} sections={meta.sections} close={close} onSaved={st.reload} />, { wide: true });
  };
  const toggle = (x) => oapi('PUT', '/accounting/recurring/' + x.id, { active: !x.active }).then(() => { toast(x.active ? t('Modèle mis en pause.') : t('Modèle réactivé.')); st.reload(); }).catch(fail);
  const del = (x) => confirm(t('Supprimer le modèle « {label} » ? Les écritures déjà passées sont conservées.', { label: x.label }), () => oapi('DELETE', '/accounting/recurring/' + x.id).then(() => { toast(t('Modèle supprimé.')); st.reload(); }).catch(fail), t('Supprimer'));
  const run = () => {
    setBusy(true);
    oapi('POST', '/accounting/recurring/run', { upTo }).then((r) => {
      setBusy(false);
      toast(t('{n} écriture(s) générée(s).', { n: r.created }) + ((r.skipped || []).length ? ' ' + t('Ignorées : {n} (période clôturée).', { n: r.skipped.length }) : ''));
      st.reload();
    }).catch((e) => { setBusy(false); fail(e); });
  };
  const amount = (x) => (x.lines || []).reduce((a, l) => a + (Number(l.debit) || 0), 0);

  return (
    <>
      <div className="ws-card">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <h2 className="grow">{t('Écritures récurrentes')}</h2>
          <button className="btn primary small" type="button" style={{ minHeight: 44 }} disabled={!meta} onClick={() => edit(null)}>{t('Nouveau modèle')}</button>
        </div>
        <p className="muted small">{t("Pour les écritures qui se répètent (loyer, assurance, abonnement, redevance…). Créez le modèle une fois : l'écriture est générée à chaque échéance, sans jamais être passée deux fois.")}</p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <label className="muted small" htmlFor="rec_upto">{t("Générer jusqu'au")}</label>
          <input id="rec_upto" type="date" style={{ fontSize: 16, minHeight: 44 }} value={upTo} onChange={(e) => setUpTo(e.target.value)} />
          <button className="btn small" type="button" style={{ minHeight: 44 }} disabled={busy} onClick={run}>{t('Générer les échéances dues')}</button>
        </div>
      </div>
      <Loaded state={st}>
        {(j) => (
          <div className="ws-card">
            {!(j.items || []).length ? <Empty text={t("Aucun modèle récurrent. Exemple : le loyer de 150 000 payé le 5 de chaque mois.")} /> : null}
            {(j.items || []).map((x) => (
              <div className="line" key={x.id} style={{ flexWrap: 'wrap' }}>
                <span><b>{tsrv(x.label)}</b><br /><small className="muted">{t(FREQ[x.frequency] || 'Chaque mois') + ' · ' + t('le {d}', { d: x.dayOfMonth }) + ' · ' + money(amount(x)) + ' · ' + x.journal}</small>
                  <br /><small className="muted">{(x.lastRun ? t('Dernière génération : {date}', { date: dateFr(x.lastRun) }) : t('Jamais générée')) + (x.nextDue && x.active ? ' · ' + t('prochaine échéance : {date}', { date: dateFr(x.nextDue) }) : '')}</small></span>
                <span className="row" style={{ flexWrap: 'wrap' }}>
                  <span className={'pill ' + (x.active ? 'good' : '')}>{x.active ? t('Active') : t('En pause')}</span>
                  <button className="link" type="button" style={{ minHeight: 44 }} onClick={() => edit(x)}>{t('Modifier')}</button>
                  <button className="link" type="button" style={{ minHeight: 44 }} onClick={() => toggle(x)}>{x.active ? t('Mettre en pause') : t('Réactiver')}</button>
                  <button className="link" type="button" style={{ minHeight: 44 }} onClick={() => del(x)}>{t('Supprimer')}</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Loaded>
    </>
  );
}
