import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Loaded, useLoad } from '../../ui.jsx';
import Pill from './Pill.jsx';
import { qty } from './common.js';

/* Inventaire physique : on compte, l'écart est valorisé, un responsable valide, et le stock est ajusté avec une trace. */
const CS = { open: ['En cours de comptage', 'mid'], submitted: ['À valider', 'mid'], validated: ['Validé', 'good'], rejected: ['Rejeté', 'bad'] };

function CountSheet({ id, back }) {
  const t = useT();
  const { oapi, can, money, fail, toast, confirm, modal } = useWs();
  const st = useLoad(() => oapi('GET', '/stock/counts/' + id), []);
  const [vals, setVals] = useState({});
  const mgr = can('manager');
  const reload = st.reload;
  const save = (c) => {
    const lines = Object.entries(vals).map(([itemId, counted]) => ({ itemId: Number(itemId), counted }));
    return lines.length ? oapi('PUT', '/stock/counts/' + id + '/lines', { lines }).then(() => { setVals({}); reload(); }) : Promise.resolve();
  };
  const submit = (c) => save(c).then(() => oapi('POST', '/stock/counts/' + id + '/submit')).then(() => { toast(t('Comptage soumis à validation.')); reload(); }).catch(fail);
  const decide = (action) => oapi('POST', '/stock/counts/' + id + '/' + action, {}).then((j) => { toast(action === 'validate' ? t('Inventaire validé : {n} ajustement(s).', { n: j.adjusted }) : t('Inventaire rejeté.')); reload(); }).catch(fail);
  return (
    <Loaded state={st}>{({ count: c }) => (
      <div className="ws-card">
        <div className="ws-head"><h2>{c.code}</h2><span className="row"><Pill t={CS[c.status]} /><button className="link" type="button" onClick={back}>{t('Retour')}</button></span></div>
        {c.note ? <p className="muted small">{c.note}</p> : null}
        {mgr ? <p className="small">{t('Écart valorisé : {total} (manquants {short}, surplus {surplus})', { total: money(c.gapValue), short: money(c.shortValue), surplus: money(c.surplusValue) })}</p> : null}
        {c.items.map((l) => {
          const v = vals[l.itemId] !== undefined ? vals[l.itemId] : (l.counted === null ? '' : l.counted);
          return (
            <div className="line" key={l.itemId}>
              <span><b>{l.name}</b><small>{' ' + t('attendu {n} {unit}', { n: qty(l.expected), unit: l.unit })}</small>{l.gap ? <span className={'pill ' + (l.gap < 0 ? 'bad' : 'mid')}>{(l.gap > 0 ? '+' : '') + qty(l.gap) + (mgr && l.gapValue !== undefined ? ' · ' + money(l.gapValue) : '')}</span> : null}</span>
              {c.status === 'open'
                ? <input type="text" inputMode="decimal" style={{ width: 90, fontSize: 16 }} aria-label={t('Quantité comptée : {name}', { name: l.name })} value={v} onChange={(e) => setVals((s) => ({ ...s, [l.itemId]: e.target.value }))} />
                : <b>{l.counted === null ? '—' : qty(l.counted)}</b>}
            </div>
          );
        })}
        <div className="row" style={{ marginTop: 10 }}>
          {c.status === 'open' ? <button className="btn small" type="button" onClick={() => save(c).then(() => toast(t('Comptage enregistré.'))).catch(fail)}>{t('Enregistrer le comptage')}</button> : null}
          {c.status === 'open' ? <button className="btn primary small" type="button" onClick={() => submit(c)}>{t('Soumettre à validation')}</button> : null}
          {c.status === 'open' && mgr ? <button className="btn small" type="button" onClick={() => confirm(t('Abandonner cet inventaire ?'), () => { oapi('DELETE', '/stock/counts/' + id).then(back).catch(fail); })}>{t('Abandonner')}</button> : null}
          {c.status === 'submitted' && mgr ? <button className="btn primary small" type="button" onClick={() => modal(t("Valider l'inventaire"), (close) => (
            <>
              <p>{t('Le stock sera ajusté aux quantités comptées ({n} article(s) avec écart), avec une ligne d’historique par ajustement. Écart valorisé : {total}.', { n: c.withGap, total: money(c.gapValue) })}</p>
              <div className="row"><button className="btn primary" type="button" onClick={() => { close(); decide('validate'); }}>{t('Valider et ajuster le stock')}</button></div>
            </>
          ))}>{t('Valider')}</button> : null}
          {c.status === 'submitted' && mgr ? <button className="btn small" type="button" onClick={() => decide('reject')}>{t('Rejeter')}</button> : null}
        </div>
        <p className="muted small">{t('Les articles suivis par numéro de série ne sont pas comptés ici : leur liste de numéros fait foi. La personne qui a ouvert l’inventaire ne peut pas le valider seule (sauf administrateur).')}</p>
      </div>
    )}
    </Loaded>
  );
}

export default function Counts() {
  const t = useT();
  const { oapi, can, money, dateFr, fail } = useWs();
  const [open, setOpen] = useState(null);
  const st = useLoad(() => oapi('GET', '/stock/counts'), []);
  if (open) return <CountSheet id={open} back={() => { setOpen(null); st.reload(); }} />;
  const create = () => oapi('POST', '/stock/counts', {}).then((j) => setOpen(j.id)).catch(fail);
  return (
    <div className="ws-card">
      <div className="ws-head"><h2>{t('Inventaires physiques')}</h2>{can('manager') ? <button className="btn primary small" type="button" onClick={create}>{t('Ouvrir un inventaire')}</button> : null}</div>
      <Loaded state={st}>{(j) => (
        <>
          {!j.counts.length ? <Empty text={t("Aucun inventaire. Ouvrez-en un pour compter vos articles, voir les écarts valorisés et corriger le stock.")} /> : null}
          {j.counts.map((c) => (
            <div className="line" key={c.id}>
              <span><b>{c.code}</b>{' '}<Pill t={CS[c.status]} /><small>{' ' + dateFr(c.createdAt) + ' · ' + t('{n} article(s) comptés sur {m}', { n: c.counted, m: c.lines }) + (c.gapValue !== undefined && c.counted ? ' · ' + t('écart {amount}', { amount: money(c.gapValue) }) : '')}</small></span>
              <button className="link" type="button" onClick={() => setOpen(c.id)}>{c.status === 'open' ? t('Compter') : t('Voir')}</button>
            </div>
          ))}
        </>
      )}
      </Loaded>
    </div>
  );
}
