import { useCallback, useState } from 'react';
import { useWs } from '../WsContext.jsx';
import { useT } from '../../lib/i18n.jsx';
import ModuleShell from '../ModuleShell.jsx';
import { useLoad } from '../ui.jsx';
import '../../styles/ws-meetings.css';
import Home from '../parts/meetings/Home.jsx';
import CalendarView from '../parts/meetings/Calendar.jsx';
import MeetingForm from '../parts/meetings/Form.jsx';
import Detail from '../parts/meetings/Detail.jsx';
import TemplatesScreen from '../parts/meetings/Templates.jsx';
import SettingsScreen from '../parts/meetings/Settings.jsx';
import { ActionsScreen, SearchScreen } from '../parts/meetings/Lists.jsx';

/* Réunions : convocation, réponses, déroulé, compte rendu validé, actions suivies dans Projets. Le responsable du compte (propriétaire) désigne
   qui convoque et qui valide (écran « Réglages des réunions ») ; le serveur applique ces droits à chaque action. */

export default function Meetings() {
  const t = useT();
  const { oapi } = useWs();
  const rights = useLoad(() => oapi('GET', '/meetings/settings'), []);
  const mem = useLoad(() => oapi('GET', '/members'), []);
  const [tab, setTab] = useState('home');
  const [openId, setOpenId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [prefill, setPrefill] = useState(null);
  const me = rights.data ? rights.data.me : { convene: [], validate: [], isOwner: false };
  const canConvene = me.convene.length > 0;
  const members = (mem.data && mem.data.members) || [];

  const GROUPS = [
    { id: 'pilot', icon: 'chart-pie', label: t('Pilotage'), items: [
      { id: 'home', label: t('Tableau de bord'), hint: t('Réunions du mois, actions en retard, présence et comptes rendus à valider.') },
      { id: 'actions', label: t('Suivi des actions'), hint: t('Les actions décidées en réunion, leur responsable et leur échéance.') }] },
    { id: 'meet', icon: 'calendar-days', label: t('Réunions'), items: [
      { id: 'calendar', label: t('Calendrier'), hint: t('Vos réunions par mois, par semaine ou en liste.') },
      ...(canConvene ? [{ id: 'new', label: t('Convoquer une réunion'), hint: t("Date, participants, ordre du jour, lien de visioconférence et invitations.") }] : []),
      ...(openId ? [{ id: 'detail', label: t('Réunion ouverte'), hint: t('Convocation, réponses, déroulé et compte rendu.') }] : []),
      ...(editId ? [{ id: 'edit', label: t('Modifier la convocation'), hint: t('Date, lieu, participants et ordre du jour.') }] : [])] },
    { id: 'hist', icon: 'folder-open', label: t('Historique'), items: [
      { id: 'search', label: t('Recherche et exports'), hint: t("Retrouvez une décision ou une action, exportez en CSV.") },
      { id: 'templates', label: t("Modèles d'ordre du jour"), hint: t('Modèles intégrés et modèles de votre organisation.') }] },
    { id: 'ctl', icon: 'gear', label: t('Réglages'), items: [
      { id: 'settings', label: t('Réglages des réunions'), hint: me.isOwner ? t('Choisissez qui peut convoquer et qui peut valider un compte rendu.') : t("Vos droits de convocation et de validation.") }] },
  ];

  const open = useCallback((id) => { setOpenId(id); setEditId(null); setTab('detail'); }, []);
  const startEdit = (id) => { oapi('GET', '/meetings/' + id).then((j) => { setEditData(j); setEditId(id); setTab('edit'); }).catch(() => {}); };
  const newOn = (date) => { setPrefill(date || null); setTab('new'); };

  let content;
  if (rights.error) content = <p className="ws-err" role="alert">{rights.error.message}</p>;
  else if (tab === 'calendar') content = <CalendarView openMeeting={open} newOn={newOn} canConvene={canConvene} />;
  else if (tab === 'actions') content = <ActionsScreen openMeeting={open} />;
  else if (tab === 'new' && canConvene) content = <MeetingForm key={'new' + prefill} prefillDate={prefill} cancel={() => setTab('calendar')} done={(id) => open(id)} />;
  else if (tab === 'edit' && editData) content = <MeetingForm key={'edit' + editId} meeting={editData.meeting} detail={editData} cancel={() => open(editId)} done={(id) => open(id)} />;
  else if (tab === 'detail' && openId) content = <Detail key={openId} id={openId} back={() => setTab('calendar')} edit={startEdit} members={members} />;
  else if (tab === 'search') content = <SearchScreen openMeeting={open} />;
  else if (tab === 'templates') content = <TemplatesScreen canConvene={canConvene} />;
  else if (tab === 'settings') content = <SettingsScreen />;
  else content = <Home go={setTab} openMeeting={open} />;
  return (
    <ModuleShell title={t('Réunions')} groups={GROUPS} active={tab} onSelect={setTab}>
      <div key={tab} className="mtg-root">{content}</div>
    </ModuleShell>
  );
}
