import { useT } from '../../../lib/i18n.jsx';
import { Icon } from '../../ui.jsx';

/* Clients et fournisseurs typés : libellés, pastille de type, appels communs. */
export const PT = '/parties';
export const TYPES = ['simple', 'temporary', 'permanent', 'vip'];
export const STATUSES = ['active', 'inactive', 'archived'];
export const LABEL = {
  customers: { simple: 'Client simple', temporary: 'Client temporaire', permanent: 'Client permanent', vip: 'Client haut de gamme (VIP)' },
  suppliers: { simple: 'Fournisseur simple', temporary: 'Fournisseur temporaire', permanent: 'Fournisseur permanent', vip: 'Fournisseur haut de gamme (VIP)' },
};
export const SHORT = { simple: 'Simple', temporary: 'Temporaire', permanent: 'Permanent', vip: 'Haut de gamme' };
export const STATUS_LABEL = { active: 'Actif', inactive: 'Inactif', archived: 'Archivé', blocked: 'Bloqué' };
export const TYPE_ICON = { simple: 'user', temporary: 'clock', permanent: 'shield', vip: 'star' };

export function TypeBadge({ type, kind }) {
  const t = useT();
  return <span className={'pty-type ' + type} title={t(LABEL[kind][type])}><Icon name={TYPE_ICON[type]} />{t(SHORT[type])}</span>;
}
export function Tags({ tags }) { return tags && tags.length ? <span className="pty-tags">{tags.map((x) => <span key={x} className="pty-tag">{x}</span>)}</span> : null; }
