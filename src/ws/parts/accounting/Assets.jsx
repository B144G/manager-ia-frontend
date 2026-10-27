import { useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Empty, Form, Loaded, useLoad } from '../../ui.jsx';
import { BTN, TAP, WorkNotice } from '../finance/util.jsx';

/* Registre des immobilisations : plan d'amortissement linéaire (durée choisie par vous) et dotation mensuelle en un clic. */

const CAT = { building: 'Bâtiments', equipment: 'Matériel et outillage', office: 'Mobilier et matériel de bureau', transport: 'Matériel de transport', it: 'Matériel informatique', software: 'Logiciels' };

function Plan({ id }) {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/accounting/assets/' + id + '/plan'), [id]);
  return (
    <Loaded state={st}>
      {(j) => (
        <>
          <p className="muted small">{t('{monthly} par mois sur {n} mois ; valeur nette actuelle {nbv}.', { monthly: money(j.asset.monthly), n: j.asset.lifeMonths, nbv: money(j.asset.netBookValue) })}</p>
          {j.plan.map((r) => <div className="line" key={r.period}><span>{r.period}{' '}{r.posted ? <span className="pill good">{t('Comptabilisée')}</span> : null}</span><span>{money(r.amount) + ' · ' + t('valeur nette {v}', { v: money(r.netBookValue) })}</span></div>)}
          <p className="muted small">{t("Document de travail : à faire valider par un expert-comptable.")}</p>
        </>
      )}
    </Loaded>
  );
}

export default function AssetsTab() {
  const t = useT();
  const { oapi, money, dateFr, modal, toast, fail, today, confirm } = useWs();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const st = useLoad(() => oapi('GET', '/accounting/assets'), []);
  const reload = st.reload;
  const add = (cats) => modal(t('Nouvelle immobilisation'), (close) => (
    <Form submitText={t('Enregistrer')} fields={[
      { k: 'label', label: t('Désignation'), required: true },
      { k: 'category', label: t('Catégorie'), type: 'select', options: cats.map((c) => [c.key, t(CAT[c.key] || c.label) + ' (' + c.assetAccount + ')']) },
      { k: 'cost', label: t("Coût d'acquisition"), required: true }, { k: 'residual', label: t('Valeur résiduelle'), value: '' },
      { k: 'lifeMonths', label: t("Durée d'amortissement (mois)"), required: true, hint: t("À choisir avec votre expert-comptable : aucune durée n'est imposée par le logiciel.") },
      { k: 'acquiredOn', label: t("Date d'acquisition"), type: 'date', value: today() },
      { k: 'startMonth', label: t('Premier mois d\'amortissement'), type: 'month', value: today().slice(0, 7) }]}
    onSubmit={(v) => oapi('POST', '/accounting/assets', { ...v, lifeMonths: Number(v.lifeMonths) }).then(() => { close(); reload(); })} />
  ));
  const depreciate = (catchUp) => oapi('POST', '/accounting/assets/depreciate', { month, catchUp }).then((r) => {
    toast(r.entries.length ? t('{n} écriture(s) de dotation, total {amount}.', { n: r.entries.length, amount: money(r.total) }) + (r.skipped.length ? ' ' + t('Ignorées : {n}.', { n: r.skipped.length }) : '') : (r.skipped.length ? t('Aucune dotation passée : {reason}', { reason: r.skipped[0].reason }) : t('Rien à comptabiliser pour cette période.')));
    reload();
  }).catch(fail);
  return (
    <Loaded state={st}>
      {(j) => (
        <>
          <WorkNotice>{t("Document de travail : les durées et les dotations sont à faire valider par un expert-comptable.")}</WorkNotice>
          <div className="kpis">
            <div className="stat"><b>{money(j.totals.cost)}</b><span>{t("valeur d'acquisition")}</span></div>
            <div className="stat"><b>{money(j.totals.accumulated)}</b><span>{t('amortissements cumulés')}</span></div>
            <div className="stat"><b>{money(j.totals.netBookValue)}</b><span>{t('valeur nette comptable')}</span></div>
          </div>
          <div className="ws-card">
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <h2 className="grow">{t('Dotation aux amortissements')}</h2>
              <input type="month" style={{ fontSize: 16 }} value={month} aria-label={t('Mois')} onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} />
              <button className="btn primary small" type="button" style={BTN} onClick={() => depreciate(false)}>{t('Comptabiliser le mois')}</button>
              <button className="btn small" type="button" style={BTN} onClick={() => depreciate(true)}>{t('Rattraper les mois précédents')}</button>
            </div>
            <p className="muted small">{t('Une seule écriture par mois (débit 681, crédit des comptes d\'amortissement). Une dotation déjà comptabilisée ne l\'est jamais deux fois.')}</p>
          </div>
          <div className="ws-card">
            <div className="row"><h2 className="grow">{t('Registre des immobilisations')}</h2><button className="btn primary small" type="button" style={BTN} onClick={() => add(j.categories)}>{t('Nouvelle immobilisation')}</button></div>
            {!j.assets.length ? <Empty text={t('Aucune immobilisation enregistrée.')} /> : null}
            {j.assets.map((a) => (
              <div className="line" key={a.id} style={{ flexWrap: 'wrap' }}>
                <span><b>{a.label}</b>{a.status === 'disposed' ? <>{' '}<span className="pill bad">{t('Sortie du registre')}</span></> : null}<br /><small className="muted">{t(CAT[a.category] || a.categoryLabel) + ' · ' + t('acquise le {date}', { date: dateFr(a.acquiredOn) }) + ' · ' + t('{n} mois', { n: a.lifeMonths }) + ' · ' + t('coût {cost}, net {net}', { cost: money(a.cost), net: money(a.netBookValue) })}</small></span>
                <span className="row" style={{ flexWrap: 'wrap' }}>
                  <button className="link" type="button" style={TAP} onClick={() => modal(t('Plan d\'amortissement : {name}', { name: a.label }), () => <Plan id={a.id} />, { wide: true })}>{t("Plan d'amortissement")}</button>
                  {a.status === 'active' ? <button className="link" type="button" style={TAP} onClick={() => confirm(t('Sortir ce bien du registre ? Les dotations futures s\'arrêtent.'), () => { oapi('POST', '/accounting/assets/' + a.id + '/dispose', {}).then(reload).catch(fail); })}>{t('Sortir du registre')}</button> : null}
                  {!a.postedMonths ? <button className="link" type="button" style={TAP} onClick={() => confirm(t('Supprimer cette immobilisation ?'), () => { oapi('DELETE', '/accounting/assets/' + a.id).then(reload).catch(fail); })}>{t('Supprimer')}</button> : null}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Loaded>
  );
}
