import { useCallback, useMemo, useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { useWs } from '../WsContext.jsx';
import ModuleShell from '../ModuleShell.jsx';
import { call } from '../parts/library/api.js';
import { Home } from '../parts/library/Home.jsx';
import BlockView from '../parts/library/Block.jsx';
import { DocList, Search, Trash } from '../parts/library/Lists.jsx';
import { Audit, Settings } from '../parts/library/Admin.jsx';
import Catalog from '../parts/library/Catalog.jsx';
import Classes from '../parts/library/Classes.jsx';
import Loans from '../parts/library/Loans.jsx';
import Vocab from '../parts/library/Vocab.jsx';
import Dash from '../parts/library/Dash.jsx';

/* Bibliothèque : documents de l'entreprise rangés en blocs protégés. Pour entrer dans un bloc, la personne ressaisit SON mot de passe ;
   le serveur crée alors une autorisation courte, liée à sa session, que toutes les routes de documents vérifient.
   Cet écran n'affiche que ce que le serveur renvoie : il ne décide d'aucun droit. */

export default function Library() {
  const t = useT();
  const { orgId, can, toast, fail } = useWs();
  const [screen, setScreen] = useState('home');
  const [open, setOpen] = useState(null); // bloc ouvert : { id, name }
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((x) => x + 1), []);

  const lib = useCallback(async (method, path, body, o) => {
    try { return await call(orgId, method, path, body, o); } catch (e) {
      if (e.code === 'library_locked') { setOpen(null); reload(); toast(t("Le bloc s'est refermé : saisissez à nouveau votre mot de passe."), true); }
      if (e.status === 401) fail(e);
      throw e;
    }
  }, [orgId, reload, toast, fail, t]);
  const L = useMemo(() => ({ lib, orgId, tick, reload, openBlock: (b) => { setScreen('home'); setOpen({ id: b.id, name: b.name }); }, closeBlock: () => { setOpen(null); reload(); } }), [lib, orgId, tick, reload]);

  const groups = [
    { id: 'lib', icon: '🗂️', label: t('Documents'), items: [
      { id: 'home', label: t('Les blocs'), hint: t('Chaque bloc est protégé : vous ressaisissez votre mot de passe pour y entrer.') },
      { id: 'search', label: t('Recherche'), hint: t('Cherchez un document par nom ou étiquette dans les blocs que vous avez ouverts.') },
      { id: 'favorites', label: t('Favoris'), hint: t('Vos documents mis de côté.') },
      { id: 'recent', label: t('Récents'), hint: t('Les derniers documents ouverts.') },
      { id: 'trash', label: t('Corbeille'), hint: t('Les documents supprimés sont gardés 30 jours, puis effacés pour de bon.') }] },
  ];
  groups.unshift({ id: 'cat', icon: '📚', label: t('Catalogue et prêts'), items: [
    { id: 'dash', label: t('Tableau de bord'), hint: t("Chiffres et graphiques du catalogue et des prêts.") },
    { id: 'catalog', label: t('Catalogue'), hint: t('Notices des documents et des ressources physiques : recherche par type, classe, année, langue.') },
    { id: 'loans', label: t('Prêts et retours'), hint: t('Emprunter, rendre, renouveler, réserver ; retards et pénalités.') },
    { id: 'classes', label: t('Plan de classement'), hint: t('Classes (ADM, RH, FIN…), conservation, modèles pour PME.') },
    { id: 'vocab', label: t('Vocabulaire'), hint: t('Mots-clés reconnus et synonymes.') }] });
  if (can('admin')) groups.push({ id: 'admin', icon: '🔒', label: t('Administration'), items: [
    { id: 'audit', label: t("Journal d'audit"), hint: t('Qui est entré dans quel bloc, qui a téléchargé, ajouté ou supprimé.') },
    { id: 'settings', label: t('Sécurité et espace'), hint: t("Durée d'ouverture d'un bloc, taille des fichiers et espace utilisé.") }] });

  const select = (id) => { setOpen(null); setScreen(id); };
  let body;
  if (screen === 'dash') body = <Dash L={L} goto={select} />;
  else if (screen === 'catalog') body = <Catalog L={L} />;
  else if (screen === 'loans') body = <Loans L={L} />;
  else if (screen === 'classes') body = <Classes L={L} />;
  else if (screen === 'vocab') body = <Vocab L={L} />;
  else if (screen === 'home' && open) body = <BlockView L={L} block={open} />;
  else if (screen === 'home') body = <Home L={L} />;
  else if (screen === 'search') body = <Search L={L} />;
  else if (screen === 'favorites') body = <DocList L={L} kind="favorites" title={t('Favoris')} empty={t("Aucun favori dans les blocs ouverts. Ouvrez un bloc et marquez un document avec l'étoile.")} />;
  else if (screen === 'recent') body = <DocList L={L} kind="recent" title={t('Récents')} empty={t('Aucun document récent dans les blocs ouverts.')} />;
  else if (screen === 'trash') body = <Trash L={L} />;
  else if (screen === 'audit') body = <Audit L={L} />;
  else body = <Settings L={L} />;

  return (
    <ModuleShell title={t('Bibliothèque')} groups={groups} active={screen} onSelect={select}>
      {body}
    </ModuleShell>
  );
}
