import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Segmented } from '../../ui/index.jsx';
import Mps from './adv/Mps.jsx';
import Mrp from './adv/Mrp.jsx';
import Capacity from './adv/Capacity.jsx';
import Schedule from './adv/Schedule.jsx';

/* Production · techniques avancées. Pour ajouter une technique : créer son composant dans ./adv (avec useDoc de ./adv/common.jsx) puis une ligne dans TECHS.
   Chaque technique charge et enregistre son propre document (/production/adv/:kind) ; le serveur calcule tout. */
const TECHS = (t) => [
  { id: 'mps', label: t('Plan directeur (MPS)'), Comp: Mps },
  { id: 'mrp', label: t('Besoins en matières (MRP)'), Comp: Mrp },
  { id: 'capacity', label: t('Capacités'), Comp: Capacity },
  { id: 'schedule', label: t('Ordonnancement'), Comp: Schedule },
];

export default function Advanced() {
  const t = useT();
  const techs = TECHS(t);
  const [tech, setTech] = useState(techs[0].id);
  const cur = techs.find((x) => x.id === tech) || techs[0];
  return (
    <div className="bp">
      <Segmented label={t('Technique de production')} value={cur.id} onChange={setTech} items={techs.map((x) => ({ id: x.id, label: x.label }))} />
      <div style={{ marginTop: 14 }}><cur.Comp key={cur.id} /></div>
    </div>
  );
}
