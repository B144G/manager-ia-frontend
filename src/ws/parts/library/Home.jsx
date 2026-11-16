import { useState } from 'react';
import { getLocale, useT } from '../../../lib/i18n.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import { Form, Loaded, useLoad } from '../../ui.jsx';
import { BLOCK_ICONS } from './api.js';
import { BlockIcon, LockIcon, bytes, headColor, hm } from './util.jsx';
import { PermsEditor } from './Admin.jsx';

/** Fenêtre de saisie du mot de passe : le mot de passe ne sort que dans le corps d'un POST et n'est conservé nulle part. */
export function UnlockForm({ L, block, close, onDone }) {
  const t = useT();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(ev) {
    ev.preventDefault();
    if (!pw) { setErr(t('Saisissez votre mot de passe.')); return; }
    setBusy(true); setErr('');
    try { await L.lib('POST', `/blocks/${block.id}/unlock`, { password: pw }); setPw(''); close(); onDone(); } catch (e) {
      setPw(''); setErr(tsrv(e.message)); setBusy(false);
      const f = document.getElementById('lib_pw'); if (f) f.focus();
    }
  }
  return (
    <form className="ws-form lib-unlock" noValidate onSubmit={submit}>
      <p>{t('Ce bloc est protégé. Pour y entrer, saisissez le mot de passe de votre compte : il sert uniquement à vérifier que c’est bien vous.')}</p>
      <label className="fld" htmlFor="lib_pw">
        <span>{t('Votre mot de passe')}</span>
        <input id="lib_pw" name="lib-unlock" type="password" autoComplete="current-password" style={{ fontSize: 16 }} value={pw} aria-invalid={err ? 'true' : 'false'} aria-describedby="lib_pw_err" onChange={(e) => setPw(e.target.value)} />
      </label>
      <p id="lib_pw_err" className="ws-err" role="alert">{err}</p>
      <div className="row">
        <button className="btn primary" type="submit" disabled={busy}>{busy ? t('Vérification…') : t('Déverrouiller')}</button>
        <button className="btn" type="button" onClick={close}>{t('Annuler')}</button>
      </div>
    </form>
  );
}

const ICON_LABEL = { folder: 'Dossier', shield: 'Bouclier', cart: 'Panier', wallet: 'Portefeuille', users: 'Équipe', ruler: 'Règle', factory: 'Usine', hardhat: 'Casque', box: 'Colis', scale: 'Balance', book: 'Livre', mail: 'Courrier', target: 'Cible', lock: 'Cadenas', chip: 'Puce', image: 'Image', user: 'Personne', file: 'Fichier', star: 'Étoile', building: 'Immeuble' };

function BlockForm({ L, b, close }) {
  const t = useT();
  const { toast, confirm, modal } = useWs();
  const save = (v) => {
    const body = { name: v.name, color: v.color, icon: v.icon, hidden: v.hidden === '1' };
    return (b ? L.lib('PUT', `/blocks/${b.id}`, body) : L.lib('POST', '/blocks', body)).then(() => { close(); L.reload(); toast(t('Enregistré.')); });
  };
  const fields = [
    { k: 'name', label: t('Nom du bloc'), required: true, value: b ? b.name : '' },
    { k: 'color', label: t('Couleur'), type: 'color', value: b ? b.color : '#2f6f5e' },
    { k: 'icon', label: t('Icône'), type: 'select', options: Object.keys(BLOCK_ICONS).map((k) => [k, t(ICON_LABEL[k] || k)]), value: b ? b.icon : 'folder' },
    { k: 'hidden', label: t('Affichage'), type: 'select', options: [['0', t('Visible')], ['1', t('Masqué pour tout le monde (sauf les administrateurs)')]], value: b && b.hidden ? '1' : '0' },
  ];
  const del = () => confirm(t('Supprimer le bloc « {name} » ? Il doit être vide.', { name: b.name }), () => L.lib('DELETE', `/blocks/${b.id}`).then(() => { close(); L.reload(); toast(t('Bloc supprimé.')); }, (e) => toast(tsrv(e.message), true)), t('Supprimer'));
  const extra = b ? (
    <>
      {!b.personal ? <button type="button" className="btn" onClick={() => { close(); modal(t('Droits du bloc « {name} »', { name: b.name }), (c2) => <PermsEditor L={L} block={b} close={c2} />, { wide: true }); }}>{t("Droits d'accès")}</button> : null}
      {!b.builtin ? <button type="button" className="btn" onClick={del}>{t('Supprimer')}</button> : null}
    </>
  ) : null;
  return <Form fields={fields} submitText={t('Enregistrer')} onSubmit={save} extra={extra} />;
}

export function Home({ L }) {
  const t = useT();
  const { modal, toast, can } = useWs();
  const st = useLoad(() => L.lib('GET', '/overview'), [L.tick]);

  const enter = (b) => {
    if (b.unlocked) { L.openBlock(b); return; }
    modal(t('Entrer dans « {name} »', { name: b.name }), (close) => <UnlockForm L={L} block={b} close={close} onDone={() => L.openBlock(b)} />);
  };
  const lockAll = () => L.lib('POST', '/lock-all', {}).then(() => { L.reload(); toast(t('Tous les blocs sont refermés.')); }, () => {});
  const manage = (b) => modal(b ? t('Modifier le bloc') : t('Nouveau bloc'), (close) => <BlockForm L={L} b={b} close={close} />);

  return (
    <Loaded state={st}>{(j) => {
      const upper = (s) => s.toLocaleUpperCase(getLocale());
      const pct = j.storage.quota ? Math.min(100, Math.round((j.storage.used / j.storage.quota) * 100)) : 0;
      return (
        <>
          <div className="ws-head">
            <div><h1>{t('Bibliothèque')}</h1><p className="muted">{t("Les documents de l'entreprise, rangés par bloc. Chaque bloc est protégé par votre mot de passe.")}</p></div>
            <div className="row">
              {j.blocks.some((b) => b.unlocked) ? <button className="btn small" type="button" onClick={lockAll}>{t('Tout refermer')}</button> : null}
              {can('admin') ? <button className="btn small primary" type="button" onClick={() => manage(null)}>{t('Ajouter un bloc')}</button> : null}
            </div>
          </div>
          <div className="kpis lib-kpis">
            <div className="stat lib-stat"><b>{j.stats.documents}</b><span>{t('Documents')}</span></div>
            <div className="stat lib-stat"><b>{j.stats.modulesUsed}</b><span>{t('Modules utilisés')}</span></div>
            <div className="stat lib-stat"><b>{j.stats.activeProjects}</b><span>{t('Projets actifs')}</span></div>
            <div className="stat lib-stat"><b>{bytes(j.stats.volume, t)}</b><span>{t('Volume')}</span></div>
          </div>
          <p className="muted small lib-space">{t('Espace utilisé : {used} sur {total}', { used: bytes(j.storage.used, t), total: bytes(j.storage.quota, t) })}</p>
          <div className={'meter' + (pct >= 90 ? ' over' : '')} role="img" aria-label={t('Espace utilisé : {pct} %', { pct })}><i style={{ width: pct + '%' }} /></div>
          <h2 className="lib-title">{t('Les modules de la bibliothèque')}</h2>
          {j.blocks.length ? (
            <div className="lib-grid">
              {j.blocks.map((b) => (
                <article key={b.id} className={'lib-card' + (b.hidden ? ' off' : '')} style={{ '--lib-c': headColor(b.color) }}>
                  <div className="lib-card-h"><h3>{upper(b.name)}</h3>{b.hidden ? <span className="lib-chip">{t('Masqué')}</span> : null}</div>
                  <div className="lib-card-b">
                    <span className="lib-badge" style={{ color: headColor(b.color) }}><BlockIcon name={b.icon} /></span>
                    <p className="lib-count"><b>{b.docCount}</b> {b.docCount === 1 ? t('document') : t('documents')}</p>
                    <p className={'lib-prot' + (b.unlocked ? ' open' : '')}><LockIcon />{b.personal ? t('Privé') : b.unlocked ? t('Ouvert') : t('Protégé')}{b.unlocked && b.expiresAt ? <small> · {t("jusqu'à {h}", { h: hm(b.expiresAt) })}</small> : null}</p>
                  </div>
                  <div className="lib-card-f">
                    <button className="lib-enter" type="button" onClick={() => enter(b)} aria-label={t('Entrer dans « {name} »', { name: b.name })}>{t('Entrer')} <span aria-hidden="true">→</span></button>
                    {can('admin') ? <button className="btn small" type="button" onClick={() => manage(b)} aria-label={t('Gérer « {name} »', { name: b.name })}>{t('Gérer')}</button> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="ws-empty">{t("Aucun bloc ne vous est ouvert. Demandez l'accès à un administrateur.")}</p>}
        </>
      );
    }}
    </Loaded>
  );
}
