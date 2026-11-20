import { Suspense, lazy, useMemo, useState } from 'react';
import { useWs } from '../../WsContext.jsx';
import { useT } from '../../../lib/i18n.jsx';
import { Loaded, Loading, useLoad } from '../../ui.jsx';
import { PT, SHORT, TYPES } from './common.jsx';

const GeoMap = lazy(() => import('../geo/GeoMap.jsx'));

/* Carte de vos clients (ou fournisseurs) localisés, colorés par type. */
const GLYPH = { simple: '•', temporary: '⏱', permanent: '■', vip: '★' };
export default function PartyMap() {
  const t = useT();
  const { oapi } = useWs();
  const [kind, setKind] = useState('customers'); const [type, setType] = useState('');
  const st = useLoad(() => oapi('GET', PT + '/' + kind + '?located=1&limit=500' + (type ? '&type=' + type : '')), [kind, type]);
  const pts = useMemo(() => (st.data ? st.data.items.filter((p) => p.location).map((p) => ({ lat: p.location.lat, lng: p.location.lng, cls: p.type, glyph: GLYPH[p.type], label: p.name + ' · ' + t(SHORT[p.type]) })) : []), [st.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="pty-chips" role="group" aria-label={t('Filtrer')}>
        <button type="button" className="pty-chip" aria-pressed={kind === 'customers'} onClick={() => setKind('customers')}>{t('Clients')}</button>
        <button type="button" className="pty-chip" aria-pressed={kind === 'suppliers'} onClick={() => setKind('suppliers')}>{t('Fournisseurs')}</button>
        <span style={{ width: 12 }} />
        <button type="button" className="pty-chip" aria-pressed={!type} onClick={() => setType('')}>{t('Tous')}</button>
        {TYPES.map((x) => <button key={x} type="button" className="pty-chip" aria-pressed={type === x} onClick={() => setType(type === x ? '' : x)}>{GLYPH[x]} {t(SHORT[x])}</button>)}
      </div>
      <Loaded state={st}>{(j) => (
        <>
          <p className="muted small" role="status">{t('{n} fiche(s) localisée(s).', { n: j.total })}</p>
          <Suspense fallback={<Loading />}><GeoMap points={pts} height={420} ariaLabel={t('Carte des fiches localisées')} /></Suspense>
        </>
      )}</Loaded>
    </div>
  );
}
