import { useRef } from 'react';
import { useT } from '../../lib/i18n.jsx';
import { ACCENTS, resetPrefs, setBrand, setOrder, setPrefs, toggleFavorite, usePrefs } from '../../lib/prefs.js';
import { Alert, Button, Icon, Segmented } from '../ui/index.jsx';
import { MODULE_ICONS } from '../registry.js';
import { useBrand } from '../../lib/brand.js';
import { useWs } from '../WsContext.jsx';
import { openBrandSettings } from '../parts/team/BrandCard.jsx';

/* Panneau « Personnaliser » : thème, couleur d'accent, marque de l'entreprise (logo + couleur), densité, favoris et ordre du menu.
   Tout est enregistré dans le navigateur (src/lib/prefs.js). */
export function sortMods(mods, order) {
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...mods].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 999) - (pos.has(b.id) ? pos.get(b.id) : 999));
}

async function logoData(file) { // réduit l'image à 256 px max, en PNG (léger, stocké dans le navigateur)
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const k = Math.min(1, 256 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

export default function Personalize({ mods, orgId, orgName, canBrand }) {
  const t = useT();
  const p = usePrefs();
  const file = useRef(null);
  const cb = useBrand();
  const { modal } = useWs();
  const company = cb.customized && (cb.color || cb.logoUrl); // la marque vient alors de l'entreprise (écran « Personnalisation de mon entreprise »)
  const ordered = sortMods(mods, p.order);
  const brand = p.brand[orgId] || {};
  const move = (id, d) => {
    const ids = ordered.map((m) => m.id); const i = ids.indexOf(id); const j = i + d;
    if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; setOrder(ids);
  };
  const custom = /^#[0-9a-f]{6}$/i.test(p.accent) ? p.accent : '#4f46e5';
  return (
    <div className="pz">
      <section>
        <h3>{t('Thème')}</h3>
        <Segmented label={t('Thème')} value={p.theme} onChange={(v) => setPrefs({ theme: v })} items={[{ id: 'auto', label: t('Automatique'), icon: 'desktop' }, { id: 'light', label: t('Clair'), icon: 'sun' }, { id: 'dark', label: t('Sombre'), icon: 'moon' }]} />
      </section>
      <section>
        <h3>{t('Couleur d\'accent')}</h3>
        <div className="pz-sw" role="radiogroup" aria-label={t('Couleur d\'accent')}>
          {ACCENTS.map(([id, hex]) => <button key={id} type="button" role="radio" aria-checked={p.accent === id && !brand.color} aria-label={id} className="pz-dot" style={{ background: hex }} onClick={() => setPrefs({ accent: id })}>{p.accent === id && !brand.color ? <Icon name="check" /> : null}</button>)}
          <label className="pz-custom" title={t('Couleur libre')}><input type="color" value={custom} onChange={(e) => setPrefs({ accent: e.target.value })} aria-label={t('Couleur libre')} /></label>
        </div>
        <p className="muted small">{t('Le contraste du texte est ajusté automatiquement pour rester lisible.')}</p>
      </section>
      <section>
        <h3>{t('Densité')}</h3>
        <Segmented label={t('Densité')} value={p.density} onChange={(v) => setPrefs({ density: v })} items={[{ id: 'comfortable', label: t('Confortable') }, { id: 'compact', label: t('Compacte') }]} />
      </section>
      <section>
        <h3>{t('Marque de l\'entreprise')}</h3>
        {company ? <Alert tone="info">{t("Le logo et la couleur viennent de la personnalisation de l'entreprise.")}</Alert> : null}
        {canBrand ? <Button size="sm" icon="brand" onClick={() => openBrandSettings(modal, t)}>{t('Personnalisation de mon entreprise')}</Button> : null}
        <p className="muted small">{t('Logo et couleur de {org} : affichés dans le menu et utilisés comme couleur principale sur cet appareil.', { org: orgName })}</p>
        <div className="row">
          <span className="pz-logo">{brand.logo ? <img src={brand.logo} alt="" /> : <Icon name="building" />}</span>
          <input ref={file} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={async (e) => { const f = e.target.files[0]; if (f) { try { setBrand(orgId, { logo: await logoData(f) }); } catch { /* image illisible */ } } e.target.value = ''; }} />
          <Button size="sm" icon="upload" onClick={() => file.current.click()} disabled={!canBrand}>{t('Choisir un logo')}</Button>
          {brand.logo ? <Button size="sm" variant="ghost" onClick={() => setBrand(orgId, { logo: null })}>{t('Retirer')}</Button> : null}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <label className="pz-custom"><input type="color" value={brand.color || custom} disabled={!canBrand} onChange={(e) => setBrand(orgId, { color: e.target.value })} aria-label={t('Couleur de marque')} /></label>
          <span className="small">{t('Couleur de marque')}</span>
          {brand.color ? <Button size="sm" variant="ghost" onClick={() => setBrand(orgId, { color: null })}>{t('Retirer')}</Button> : null}
        </div>
        {!canBrand ? <Alert tone="info">{t('Seul un administrateur peut changer la marque.')}</Alert> : null}
      </section>
      <section>
        <h3>{t('Favoris et ordre du menu')}</h3>
        <ul className="pz-list">
          {ordered.map((m, i) => (
            <li key={m.id}>
              <Icon name={MODULE_ICONS[m.id] || m.id} fixedWidth /><span>{t(m.title)}</span>
              <button type="button" className="ui-btn ghost sm icon-only" aria-pressed={p.favorites.includes(m.id)} aria-label={t('Favori : {m}', { m: t(m.title) })} onClick={() => toggleFavorite(m.id)}><Icon name={p.favorites.includes(m.id) ? 'star' : 'star-o'} /></button>
              <button type="button" className="ui-btn ghost sm icon-only" disabled={i === 0} aria-label={t('Monter : {m}', { m: t(m.title) })} onClick={() => move(m.id, -1)}><Icon name="up" /></button>
              <button type="button" className="ui-btn ghost sm icon-only" disabled={i === ordered.length - 1} aria-label={t('Descendre : {m}', { m: t(m.title) })} onClick={() => move(m.id, 1)}><Icon name="down" /></button>
            </li>
          ))}
        </ul>
      </section>
      <Button variant="ghost" icon="retry" onClick={resetPrefs}>{t('Rétablir les réglages par défaut')}</Button>
    </div>
  );
}
