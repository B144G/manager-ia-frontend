import { useState } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { Tabs } from '../ui.jsx';
import Partners from '../parts/partners/Partners.jsx';
import Spaces from '../parts/partners/Spaces.jsx';
import '../../styles/ws-entreprise.css';

/* Sous-application : Partenaires et espaces partagés (compte d'entreprise, étape 5). */
export default function PartnersModule() {
  const t = useT();
  const [tab, setTab] = useState('spaces');
  const [openId, setOpenId] = useState(null);
  return (
    <div className="ent">
      <div className="ws-head"><div><h1>{t('Partenaires et espaces partagés')}</h1><p className="muted">{t("Travaillez avec vos partenaires et vos organisations liées : discussions, réunions et documents partagés, avec des personnes désignées et un journal visible des deux côtés.")}</p></div></div>
      <Tabs items={[{ id: 'spaces', label: t('Espaces partagés'), icon: 'comments' }, { id: 'partners', label: t('Partenaires'), icon: 'handshake' }]} value={tab} onChange={(x) => { setTab(x); setOpenId(null); }} label={t('Partenaires et espaces partagés')} />
      <div className="ent-tabbody">
        {tab === 'spaces' ? <Spaces openId={openId} setOpenId={setOpenId} /> : <Partners onSpace={(id) => { setTab('spaces'); setOpenId(id); }} />}
      </div>
    </div>
  );
}
