/* Sous-application : Gestion des affaires (le dossier d'un marché, de la prospection à la clôture financière, qui relie les directions). */
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { Badge, Button, Card, EmptyState, Form, Loaded, useLoad } from '../ui.jsx';
import { useWs } from '../WsContext.jsx';
import { MODULE_TITLES } from '../parts/entreprise/lib.js';
import '../../styles/ws-entreprise.css';

const STAGE = { prospection: 'Prospection', negociation: 'Négociation', contrat: 'Contrat signé', etude: 'Étude technique', execution: 'Exécution', reception: 'Réception', cloture_fin: 'Clôture financière', close: 'Clôturée', perdu: 'Perdue' };
const NEXT = { prospection: 'negociation', negociation: 'contrat', contrat: 'etude', etude: 'execution', execution: 'reception', reception: 'cloture_fin', cloture_fin: 'close' };

function Detail({ id }) {
  const t = useT();
  const { oapi, money } = useWs();
  const st = useLoad(() => oapi('GET', '/affaires/' + id), []);
  return (
    <Loaded state={st}>{(j) => (
      <div className="ws-form">
        <p><b>{t(STAGE[j.affaire.stage])}</b>{j.affaire.dir ? ' · ' + tsrv(MODULE_TITLES[j.affaire.dir] || j.affaire.dir) : ''}</p>
        <div className="line"><span>{t('Montant du marché')}</span><b>{money(j.affaire.amount)}</b></div>
        <div className="line"><span>{t('Budget de réalisation')}</span><b>{money(j.affaire.budget)}</b></div>
        <div className="line"><span>{t('Marge prévue')}</span><b>{j.margin ? money(j.margin.planned) + ' (' + j.margin.pct + ' %)' : t('Non disponible')}</b></div>
        <div className="line"><span>{t('Validation du marché')}</span><b>{j.affaire.marketStatus ? t(j.affaire.marketStatus === 'approved' ? 'Approuvée' : j.affaire.marketStatus === 'pending' ? 'En attente' : 'Refusée') : t('Non demandée')}</b></div>
        <div className="line"><span>{t('Clôture financière')}</span><b>{j.affaire.closureStatus ? t(j.affaire.closureStatus === 'approved' ? 'Approuvée' : j.affaire.closureStatus === 'pending' ? 'En attente' : 'Refusée') : t('Non demandée')}</b></div>
        <div className="line"><span>{t('Chantier')}</span><b>{j.site ? j.site.name + (j.site.progress !== null ? ' · ' + j.site.progress + ' %' : '') : t('Non relié')}</b></div>
        <div className="line"><span>{t('Projet')}</span><b>{j.project ? j.project.name : t('Non relié')}</b></div>
        <div className="line"><span>{t('Fiches qualité ouvertes')}</span><b>{String(j.qhse.open) + ' / ' + j.qhse.total}</b></div>
      </div>
    )}</Loaded>
  );
}

export default function Affaires() {
  const t = useT();
  const { oapi, modal, money, fail, toast } = useWs();
  const st = useLoad(() => oapi('GET', '/affaires'), []);
  const go = (a, stage) => oapi('POST', '/affaires/' + a.id + '/stage', { stage }).then(() => { toast(t('Étape enregistrée.')); st.reload(); }).catch(fail);
  return (
    <Loaded state={st}>{(j) => (
      <>
        <div className="ws-head">
          <div><h1>{t('Gestion des affaires')}</h1><p className="muted">{t('Le dossier d’un marché relie les directions, du commercial à la clôture financière. Le contrat et la clôture exigent une validation du circuit de l’entreprise.')}</p></div>
          <Button variant="primary" onClick={() => modal(t('Nouvelle affaire'), (close) => (
            <Form submitText={t('Créer')} fields={[{ k: 'name', label: t('Nom de l’affaire'), required: true }, { k: 'client', label: t('Client') }, { k: 'amount', label: t('Montant du marché'), type: 'number' }, { k: 'budget', label: t('Budget de réalisation'), type: 'number' }]}
              onSubmit={(v) => oapi('POST', '/affaires', v).then(() => { close(); st.reload(); })} />))}>{t('Nouvelle affaire')}</Button>
        </div>
        <div className="kpis">
          <div className="stat"><b>{String(j.stats.open)}</b><span>{t('affaire(s) en cours')}</span></div>
          <div className="stat"><b>{money(j.stats.portfolio)}</b><span>{t('portefeuille en cours')}</span></div>
          <div className="stat"><b>{String(j.stats.won)}</b><span>{t('marché(s) obtenu(s)')}</span></div>
          <div className="stat"><b>{String(j.stats.lost)}</b><span>{t('affaire(s) perdue(s)')}</span></div>
        </div>
        {j.affaires.length === 0 ? <EmptyState icon="briefcase" title={t('Aucune affaire')}>{t('Ouvrez une affaire dès qu’un marché se présente.')}</EmptyState> : (
          <Card>{j.affaires.map((a) => (
            <div className="line" key={a.id}>
              <span><b>{a.ref + ' · ' + a.name}</b> <Badge tone={a.stage === 'perdu' ? 'bad' : a.stage === 'close' ? 'ok' : 'neutral'}>{t(STAGE[a.stage])}</Badge><small className="muted">{' · ' + a.client + ' · ' + money(a.amount)}</small></span>
              <span className="ent-actions">
                <Button size="sm" onClick={() => modal(a.name, () => <Detail id={a.id} />)}>{t('Synthèse')}</Button>
                {j.canManage && NEXT[a.stage] ? <Button size="sm" variant="primary" onClick={() => go(a, NEXT[a.stage])}>{t('Étape suivante : {s}', { s: t(STAGE[NEXT[a.stage]]) })}</Button> : null}
                {j.canManage && ['prospection', 'negociation'].includes(a.stage) ? <Button size="sm" onClick={() => go(a, 'perdu')}>{t('Perdue')}</Button> : null}
              </span>
            </div>))}</Card>
        )}
      </>
    )}</Loaded>
  );
}
