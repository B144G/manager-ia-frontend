import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { tsrv } from '../../lib/srv.js';
import { Badge, Button, Card, Icon, Loading, Tabs } from '../ui.jsx';
import { useWs } from '../WsContext.jsx';
import Chart from '../parts/entreprise/Chart.jsx';
import InfoForm from '../parts/entreprise/InfoForm.jsx';
import People from '../parts/entreprise/People.jsx';
import Wizard from '../parts/entreprise/Wizard.jsx';
import Links from '../parts/entreprise/Links.jsx';
import Usage from '../parts/entreprise/Usage.jsx';
import ProfileEditor from '../parts/entreprise/ProfileEditor.jsx';
import { CompanyAccess } from '../parts/entreprise/EmployeeAccess.jsx';
import '../../styles/ws-entreprise.css';

/* Sous-application : Entreprise et organigramme (espace Compte). Structure, personnes, postes vacants, informations de l'entreprise, journal. */
const STEPS = ['info', 'dg', 'directions', 'departments', 'people'];

export default function Entreprise() {
  const { oapi, can, modal, orgId, fail, reloadOrg } = useWs();
  const t = useT();
  const [ov, setOv] = useState(null);
  const [chart, setChart] = useState(null);
  const [tab, setTab] = useState('chart');
  const load = useCallback(() => Promise.all([oapi('GET', '/entreprise'), oapi('GET', '/entreprise/chart')]).then(([o, c]) => { setOv(o); setChart(c); }).catch(fail), [oapi, fail]);
  useEffect(() => { load(); }, [load, orgId]);
  const wizard = useCallback(() => modal(t('Configurer mon entreprise'), (close) => <Wizard close={() => { close(); load(); }} onChange={load} />, { wide: true, onclose: load }), [modal, t, load]);

  // Entreprise qui vient d'être créée : l'assistant s'ouvre tout seul, une seule fois.
  useEffect(() => {
    if (!ov || !orgId) return;
    const key = 'mabah.ent.wizard.' + orgId;
    if (sessionStorage.getItem(key) && can('admin')) { sessionStorage.removeItem(key); wizard(); }
  }, [ov, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ov || !chart) return <Loading />;
  const done = STEPS.filter((s) => ov.setup.steps[s] === 'done' || ov.setup.steps[s] === 'skipped').length;
  const tabs = [
    { id: 'chart', label: t('Organigramme'), icon: 'sitemap' },
    { id: 'people', label: t('Personnes'), icon: 'users', count: chart.people.length },
    { id: 'info', label: t('Entreprise'), icon: 'building' },
  ];
  if (can('admin')) tabs.push({ id: 'links', label: t('Organisations liées'), icon: 'link' });
  if (can('admin')) tabs.push({ id: 'usage', label: t('Abonnement et usage'), icon: 'gauge' });
  tabs.push({ id: 'profiles', label: t('Profils'), icon: 'briefcase' });
  if (can('admin')) tabs.push({ id: 'log', label: t('Journal'), icon: 'history' });
  return (
    <div className="ent">
      <div className="ws-head">
        <div>
          <h1>{t('Entreprise et organigramme')}</h1>
          <p className="muted">{ov.entreprise.name}{ov.entreprise.sectorLabel ? ' · ' + tsrv(ov.entreprise.sectorLabel) : ''}</p>
        </div>
        {can('admin') ? <div className="row"><Button variant="primary" icon="wand-magic-sparkles" onClick={wizard}>{done === 0 ? t('Configurer mon entreprise') : done < STEPS.length ? t('Reprendre la configuration') : t("Revoir la configuration")}</Button></div> : null}
      </div>
      {can('admin') && done < STEPS.length ? (
        <div className="ent-banner" role="note"><Icon name="circle-info" /><p>{done === 0 ? t("Votre entreprise n'est pas encore configurée. L'assistant vous guide en cinq étapes, toutes facultatives : rien ne change tant que vous n'affectez personne.") : t('Configuration commencée : {done} étape(s) sur {n}. Vous pouvez la reprendre quand vous voulez.', { done, n: STEPS.length })}</p></div>
      ) : null}
      <ul className="ent-tiles">
        <Tile n={ov.counts.directions} l={t('Directions')} />
        <Tile n={ov.counts.departments} l={t('Départements')} />
        <Tile n={ov.counts.posts} l={t('Postes')} />
        <Tile n={ov.counts.people} l={t('Personnes')} />
        <Tile n={ov.counts.vacancies} l={t('Places vacantes')} tone={ov.counts.vacancies ? 'warn' : 'ok'} />
      </ul>
      <Tabs items={tabs} value={tab} onChange={setTab} label={t('Entreprise et organigramme')} />
      <div className="ent-tabbody">
        {tab === 'chart' ? <Chart chart={chart} reload={load} people={chart.people} /> : null}
        {tab === 'people' ? <People chart={chart} reload={load} /> : null}
        {tab === 'info' ? <><Card title={t("Informations de l'entreprise")}><InfoForm ov={ov} onSaved={load} /></Card>{can('admin') ? <CompanyAccess ov={ov} reload={load} /> : null}{can('owner') ? <RightsCard ov={ov} reload={() => { load(); reloadOrg(); }} /> : null}</> : null}
        {tab === 'links' ? <Links /> : null}
        {tab === 'usage' ? <Usage /> : null}
        {tab === 'profiles' ? <ProfileEditor /> : null}
        {tab === 'log' ? <Log /> : null}
      </div>
    </div>
  );
}

const Tile = ({ n, l, tone }) => <li className={'ent-tile' + (tone ? ' ' + tone : '')}><b>{n}</b><span>{l}</span></li>;

/** Retour arrière par entreprise : couper le lien affectation → espaces (la structure reste). */
function RightsCard({ ov, reload }) {
  const { oapi, fail, toast, confirm } = useWs();
  const t = useT();
  const on = ov.setup.rightsLink;
  const set = (v) => oapi('PUT', '/entreprise/settings', { rightsLink: v }).then(() => { toast(t('Réglage enregistré.')); reload(); }).catch(fail);
  return (
    <Card title={t('Affectations et droits')}>
      <p className="muted">{t("Quand une personne est affectée à un poste, elle reçoit les espaces et niveaux de ce poste (membre ; responsable de l'espace pour un directeur ou un responsable). Une personne sans poste garde exactement ses accès actuels.")}</p>
      {ov.setup.globalOff ? <p><b>{t("Le lien entre postes et droits est suspendu pour toutes les entreprises par un réglage du service.")}</b></p> : null}
      <div className="line"><span><b>{on ? t('Lien actif') : t('Lien coupé')}</b> <small>{on ? t('Les postes donnent leurs espaces.') : t('Les postes sont de simples fiches : les accès reviennent à ce qu’ils étaient sans la structure.')}</small></span>
        <Button size="sm" variant={on ? 'secondary' : 'primary'} onClick={() => (on ? confirm(t('Couper le lien ? Les personnes affectées retrouvent leurs accès d’avant (la structure est conservée).'), () => set(false), t('Couper')) : set(true))}>{on ? t('Couper le lien') : t('Rétablir le lien')}</Button></div>
    </Card>
  );
}

function Log() {
  const { oapi, fail, dateFr } = useWs();
  const t = useT();
  const [rows, setRows] = useState(null);
  useEffect(() => { oapi('GET', '/entreprise/log').then((j) => setRows(j.log), fail); }, [oapi, fail]);
  if (!rows) return <Loading />;
  const what = { ent_info: 'Informations', ent_template: 'Modèle par secteur', ent_dg: 'Direction générale', ent_direction: 'Direction', ent_department: 'Département', ent_post: 'Poste', ent_person: 'Personne', ent_assignment: 'Affectation', ent_settings: 'Réglage' };
  const act = { create: 'créé', update: 'modifié', delete: 'supprimé', apply: 'appliqué', assign: 'affectation', unassign: 'affectation retirée', reinvite: 'nouveau code' };
  return (
    <Card title={t("Journal des changements de structure et d'affectation")}>
      {rows.length === 0 ? <p className="muted">{t('Aucun changement enregistré.')}</p> : (
        <ul className="ent-log">{rows.map((r, i) => <li key={i}><Badge>{tsrv(what[r.entity] || r.entity)}</Badge> <b>{tsrv(act[r.action] || r.action)}</b> <span className="muted">{r.name || ''} · {dateFr(r.at)}</span></li>)}</ul>
      )}
    </Card>
  );
}
