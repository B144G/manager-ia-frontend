import { useT } from '../../../lib/i18n.jsx';
import { Badge, Button, Card } from '../../ui.jsx';
import { useWs } from '../../WsContext.jsx';

/* Entreprise › onglet Entreprise : activer ou couper les espaces de direction de département (propriétaire). Tant qu'ils sont coupés, rien ne change pour personne. */
export default function DirectionCard({ ov, reload }) {
  const { oapi, can, confirm, fail, toast, reloadOrg } = useWs();
  const t = useT();
  const d = ov.direction;
  if (!d) return null;
  const done = (msg) => () => { toast(msg); reload(); reloadOrg(); };
  const enable = () => confirm(t("Activer les espaces de direction ? Chaque directeur aura son propre espace (pilotage, validations, tâches), et son espace opérationnel passera en consultation seule. Le personnel ne change pas. Vous pouvez revenir en arrière à tout moment."), () => oapi('POST', '/entreprise/direction/enable').then((j) => done(t('Espaces de direction activés ({n} poste(s) de directeur mis à jour).', { n: j.converted }))()).catch(fail), t('Activer'));
  const disable = () => confirm(t("Couper les espaces de direction ? Les directeurs perdent leur espace de direction ; leurs accès reviennent à ce que leur poste leur donne sans cet espace."), () => oapi('POST', '/entreprise/direction/disable').then(done(t('Espaces de direction coupés.'))).catch(fail), t('Couper'));
  return (
    <Card title={t('Espaces de direction')} actions={<Badge tone={d.enabled ? 'ok' : 'neutral'}>{d.enabled ? t('Actifs') : t('Coupés')}</Badge>}>
      <p className="muted">{t("Le directeur de chaque département a son PROPRE espace : pilotage, validations, tâches, dossiers et objectifs, invisibles du personnel. Il ne voit l'espace de son équipe qu'en consultation seule (relevable poste par poste). Le personnel ne reçoit jamais l'espace de direction.")}</p>
      {d.globalOff ? <p><b>{t('Les espaces de direction sont suspendus pour toutes les entreprises par un réglage du service.')}</b></p> : null}
      {can('owner') ? <div className="row">{d.enabled ? <Button onClick={disable}>{t('Couper les espaces de direction')}</Button> : <Button variant="primary" disabled={d.globalOff} onClick={enable}>{t('Activer les espaces de direction')}</Button>}</div> : <p className="muted small">{t('Seul le propriétaire modifie ce réglage.')}</p>}
    </Card>
  );
}
