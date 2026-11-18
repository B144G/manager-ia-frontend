import { useState } from 'react';
import { useT } from '../../../lib/i18n.jsx';
import { Segmented } from '../../ui/index.jsx';
import Mps from './adv/Mps.jsx';
import Mrp from './adv/Mrp.jsx';
import Capacity from './adv/Capacity.jsx';
import Schedule from './adv/Schedule.jsx';
import Lean from './adv/Lean.jsx';
import Toc from './adv/Toc.jsx';
import Jit from './adv/Jit.jsx';
import Kanban from './adv/Kanban.jsx';
import Fives from './adv/Fives.jsx';
import SixSigma from './adv/SixSigma.jsx';
import Tpm from './adv/Tpm.jsx';
import Quality from './adv/Quality.jsx';

/* Production · techniques avancées. Pour ajouter une technique : créer son composant dans ./adv (avec useDoc de ./adv/common.jsx) puis une ligne dans TECHS.
   Chaque technique charge et enregistre son propre document (/production/adv/:kind) ; le serveur calcule tout. */
const TECHS = (t) => [
  { id: 'mps', label: t('Plan directeur (MPS)'), Comp: Mps },
  { id: 'mrp', label: t('Besoins en matières (MRP)'), Comp: Mrp },
  { id: 'capacity', label: t('Capacités'), Comp: Capacity },
  { id: 'schedule', label: t('Ordonnancement'), Comp: Schedule },
  { id: 'lean', label: t('Lean'), Comp: Lean, row: 2 },
  { id: 'toc', label: t('Théorie des contraintes (TOC)'), Comp: Toc, row: 2 },
  { id: 'jit', label: t('Juste-à-temps (JIT)'), Comp: Jit, row: 2 },
  { id: 'kanban', label: t('Kanban'), Comp: Kanban, row: 2 },
  { id: 'fives', label: t('5S'), Comp: Fives, row: 2 },
  { id: 'sixsigma', label: t('Six Sigma'), Comp: SixSigma, row: 3 },
  { id: 'tpm', label: t('TPM'), Comp: Tpm, row: 3 },
  { id: 'quality', label: t('Qualité'), Comp: Quality, row: 3 },
];

export default function Advanced() {
  const t = useT();
  const techs = TECHS(t);
  const [tech, setTech] = useState(techs[0].id);
  const cur = techs.find((x) => x.id === tech) || techs[0];
  return (
    <div className="bp">
      <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
        <Segmented label={t('Planification de la production')} value={cur.id} onChange={setTech} items={techs.filter((x) => !x.row).map((x) => ({ id: x.id, label: x.label }))} />
        <Segmented label={t('Amélioration continue et flux')} value={cur.id} onChange={setTech} items={techs.filter((x) => x.row === 2).map((x) => ({ id: x.id, label: x.label }))} />
        <Segmented label={t('Qualité et fiabilité')} value={cur.id} onChange={setTech} items={techs.filter((x) => x.row === 3).map((x) => ({ id: x.id, label: x.label }))} />
      </div>
      <div style={{ marginTop: 14 }}><cur.Comp key={cur.id} go={setTech} /></div>
    </div>
  );
}
