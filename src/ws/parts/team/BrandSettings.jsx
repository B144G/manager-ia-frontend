import { useMemo, useRef, useState } from 'react';
import { trBase, useT } from '../../../lib/i18n.jsx';
import { brandVars } from '../../../lib/prefs.js';
import { DASH_WIDGETS, assetUrl, contrastWhite, setBrand } from '../../../lib/brand.js';
import { PRODUCT } from '../../../lib/product.js';
import { hasModule } from '../../registry.js';
import { Alert, Badge, Button, Field, Icon, Segmented } from '../../ui/index.jsx';
import { Loaded, useLoad } from '../../ui.jsx';
import { tsrv } from '../../../lib/srv.js';
import { useWs } from '../../WsContext.jsx';
import '../../../styles/ws-brand.css';

/* « Personnalisation de mon entreprise » : nom affiché, assistant IA, logo et favicon, couleur, thème, pied de page, marque blanche, e-mails, PDF,
   menu, tableau de bord, vocabulaire. Aperçu en direct avant d'enregistrer ; export / import ; retour à la configuration de base.
   Réservé aux administrateurs ; les validations (texte, couleur, image) sont refaites par le serveur. */

const WIDGET_LABEL = { brief: 'Point de situation', health: "Santé de l'entreprise", kpis: 'Indicateurs du mois', chart: 'Entrées et sorties', alerts: 'Alertes', decisions: 'Décisions à prendre', projects: 'Projets en cours', tasks: 'Mes tâches' };
const LANG_LABEL = { fr: 'Français', en: 'English', de: 'Deutsch', es: 'Español' };
const fileToB64 = (f) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = ko; r.readAsDataURL(f); });
const move = (arr, i, d) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };

export default function BrandSettings() {
  const { oapi } = useWs();
  const st = useLoad(() => oapi('GET', '/brand'), []);
  return <Loaded state={st}>{(j) => <Editor data={j} reload={st.reload} />}</Loaded>;
}

function Editor({ data, reload }) {
  const t = useT();
  const { oapi, toast, fail, confirm, info, orgId } = useWs();
  const base = data.config;
  const [cfg, setCfg] = useState(() => JSON.parse(JSON.stringify(base)));
  const [logo, setLogo] = useState(null); // { b64, url } en attente d'envoi ; null = inchangé ; { remove: true }
  const [fav, setFav] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showLog, setShowLog] = useState(false);
  const fileLogo = useRef(null); const fileFav = useRef(null); const fileImp = useRef(null);
  const opt = data.options;
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));

  const mods = useMemo(() => info.modules.filter((m) => hasModule(m.id)), [info.modules]);
  const modOrder = useMemo(() => { const o = cfg.menu.order.filter((id) => mods.some((m) => m.id === id)); return [...o, ...mods.map((m) => m.id).filter((id) => !o.includes(id))]; }, [cfg.menu.order, mods]);
  const wOrder = useMemo(() => { const o = cfg.dashboard.order.filter((id) => DASH_WIDGETS.includes(id)); return [...o, ...DASH_WIDGETS.filter((id) => !o.includes(id))]; }, [cfg.dashboard.order]);
  const titleOf = (id) => { const m = mods.find((x) => x.id === id); return m ? t(m.title) : id; };

  const ratio = cfg.color ? contrastWhite(cfg.color) : 0;
  const lowContrast = Boolean(cfg.color) && ratio < 4.5;
  const dirty = JSON.stringify(cfg) !== JSON.stringify(base) || logo || fav;
  const name = cfg.productName || (cfg.mode === 'white' ? info.org.name : PRODUCT.name);
  const shownName = cfg.mode === 'brij' && !cfg.productName ? PRODUCT.name : name;

  const pick = async (e, kind) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setErr(t('Format non accepté : envoyez une image PNG, JPEG ou WebP.')); return; }
    const max = opt.limits[kind];
    if (f.size > max) { setErr(t('Image trop lourde : {n} Ko au plus.', { n: Math.round(max / 1024) })); return; }
    setErr('');
    const b64 = await fileToB64(f);
    (kind === 'logo' ? setLogo : setFav)({ b64, url: `data:${f.type};base64,${b64}` });
  };

  const save = async () => {
    setBusy(true); setErr('');
    try {
      // Le nom choisi remplace « Brij-IA » : sans nom, le mode reste celui d'origine (ou la marque blanche).
      let j = await oapi('PUT', '/brand', cfg);
      for (const [kind, v] of [['logo', logo], ['favicon', fav]]) {
        if (!v) continue;
        j = v.remove ? await oapi('DELETE', '/brand/image/' + kind) : await oapi('POST', '/brand/image', { kind, data: v.b64 });
      }
      setBrand(j.brand);
      toast(t('Personnalisation enregistrée.'));
      setLogo(null); setFav(null);
      reload();
    } catch (e) { setErr(tsrv(e.message)); } finally { setBusy(false); }
  };
  const reset = () => confirm(t("Revenir à la configuration de base ? Le nom, l'assistant, le logo, les couleurs, le menu, le tableau de bord et le vocabulaire retrouveront leur état d'origine."), async () => {
    try { const j = await oapi('POST', '/brand/reset', { confirm: true }); setBrand(j.brand); toast(t('Configuration de base rétablie.')); reload(); } catch (e) { fail(e); }
  }, t('Oui, rétablir'));
  const exportCfg = async () => {
    try {
      const j = await oapi('GET', '/brand/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'configuration-entreprise.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { fail(e); }
  };
  const importCfg = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      if (f.size > 900 * 1024) throw new Error(t('Fichier trop lourd.'));
      const body = JSON.parse(await f.text());
      const j = await oapi('POST', '/brand/import', body);
      setBrand(j.brand); toast(t('Configuration importée.')); reload();
    } catch (x) { setErr(x instanceof SyntaxError ? t("Ce fichier n'est pas une configuration valide.") : tsrv(x.message)); }
  };

  // ----- Aperçu en direct (jamais enregistré tant qu'on n'a pas cliqué sur « Enregistrer ») -----
  const pv = brandVars(cfg.color || '#4f46e5');
  const logoSrc = logo ? (logo.remove ? '' : logo.url) : data.brand.logoUrl ? assetUrl(data.brand.logoUrl) : '';
  const hidden = new Set(cfg.menu.hidden);
  const previewMods = modOrder.filter((id) => !hidden.has(id)).slice(0, 5);
  const voc = (k) => (cfg.vocab[k] && cfg.vocab[k].fr) || trBase(k);
  const prevTitle = (id) => { const m = mods.find((x) => x.id === id); return m ? voc(m.title) : id; };
  const assistant = cfg.assistantName || PRODUCT.assistantName;
  const mailSig = cfg.mode === 'brij' ? 'Message envoyé avec ' + PRODUCT.name : cfg.mode === 'powered' ? `Message envoyé avec ${shownName}, propulsé par ${PRODUCT.name}` : cfg.productName ? `Message envoyé avec ${shownName}` : '';
  const pdfFoot = cfg.pdfFooter || info.org.name;
  const pdfMention = cfg.mode === 'brij' ? ` · ${PRODUCT.name}` : cfg.mode === 'powered' ? ` · ${PRODUCT.poweredByLabel} ${PRODUCT.name}` : '';

  const ModeOpt = ({ id, title, text }) => (
    <label className={'br-mode' + (cfg.mode === id ? ' on' : '')}>
      <input type="radio" name="brand-mode" checked={cfg.mode === id} onChange={() => set({ mode: id })} />
      <span><b>{title}</b><small>{text}</small></span>
    </label>
  );
  const upDown = (list, i, onMove) => (
    <>
      <button type="button" className="ui-btn ghost sm icon-only" disabled={i === 0} aria-label={t('Monter')} onClick={() => onMove(-1)}><Icon name="up" /></button>
      <button type="button" className="ui-btn ghost sm icon-only" disabled={i === list.length - 1} aria-label={t('Descendre')} onClick={() => onMove(1)}><Icon name="down" /></button>
    </>
  );
  const setVocab = (k, lang, v) => setCfg((c) => { const e = { ...(c.vocab[k] || {}), [lang]: v }; const vocab = { ...c.vocab }; if (Object.values(e).some(Boolean)) vocab[k] = e; else delete vocab[k]; return { ...c, vocab }; });

  return (
    <div className="br">
      <div className="br-main">
        {err ? <Alert tone="danger">{err}</Alert> : null}
        <Alert tone="info">{t("Tant que vous ne changez rien, votre compte reste exactement comme aujourd'hui. Vos réglages ne s'appliquent qu'à votre entreprise.")}</Alert>

        <section className="br-sec">
          <h3>{t('Nom et assistant')}</h3>
          <Field label={t("Nom affiché de l'entreprise ou du produit")} hint={t('Remplace « Brij-IA » dans le menu, les e-mails, les documents et les messages. Laissez vide pour garder Brij-IA.')}>
            {(p) => <input {...p} value={cfg.productName} maxLength={60} onChange={(e) => set({ productName: e.target.value, mode: e.target.value && cfg.mode === 'brij' ? 'powered' : cfg.mode })} placeholder={info.org.name} />}
          </Field>
          <Field label={t("Nom de l'assistant IA")} hint={t("L'assistant reste toujours une IA : il ne se fait jamais passer pour une personne.")}>
            {(p) => <input {...p} value={cfg.assistantName} maxLength={40} onChange={(e) => set({ assistantName: e.target.value })} placeholder={PRODUCT.assistantName} />}
          </Field>
          <div role="radiogroup" aria-label={t('Mention de la plateforme')} className="br-modes">
            <ModeOpt id="brij" title={t('Brij-IA, comme aujourd\'hui')} text={t('Le nom Brij-IA reste affiché.')} />
            <ModeOpt id="powered" title={t('Mon nom + « Propulsé par Brij-IA »')} text={t('Votre nom en premier, une mention discrète de la plateforme.')} />
            <ModeOpt id="white" title={t('Marque blanche')} text={t('Seul votre nom apparaît. Les conditions, la confidentialité et les mentions légales restent accessibles.')} />
          </div>
        </section>

        <section className="br-sec">
          <h3>{t('Logo, favicon et couleur')}</h3>
          <div className="br-row">
            <span className="br-logo">{logoSrc ? <img src={logoSrc} alt="" /> : <Icon name="building" />}</span>
            <input ref={fileLogo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e, 'logo')} />
            <Button size="sm" icon="upload" onClick={() => fileLogo.current.click()}>{t('Choisir un logo')}</Button>
            {logoSrc ? <Button size="sm" variant="ghost" onClick={() => setLogo({ remove: true })}>{t('Retirer')}</Button> : null}
            <small className="muted">{t('PNG, JPEG ou WebP, {n} Ko au plus.', { n: Math.round(opt.limits.logo / 1024) })}</small>
          </div>
          <div className="br-row">
            <span className="br-logo sm">{fav ? (fav.remove ? <Icon name="image" /> : <img src={fav.url} alt="" />) : data.brand.faviconUrl ? <img src={assetUrl(data.brand.faviconUrl)} alt="" /> : <Icon name="image" />}</span>
            <input ref={fileFav} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e, 'favicon')} />
            <Button size="sm" icon="upload" onClick={() => fileFav.current.click()}>{t('Choisir un favicon')}</Button>
            {fav ? <Button size="sm" variant="ghost" onClick={() => setFav(data.brand.hasFavicon ? { remove: true } : null)}>{t('Retirer')}</Button> : null}
            <small className="muted">{t('Image carrée, {n} Ko au plus (icône de l\'onglet).', { n: Math.round(opt.limits.favicon / 1024) })}</small>
          </div>
          <div className="br-row">
            <label className="pz-custom"><input type="color" value={cfg.color || opt.defaultColor} onChange={(e) => set({ color: e.target.value })} aria-label={t('Couleur principale')} /></label>
            <span>{t('Couleur principale')}</span>
            <code>{cfg.color || t('couleur d\'origine')}</code>
            {cfg.color ? <Badge tone={lowContrast ? 'danger' : 'success'}>{t('Contraste {r}:1', { r: String(ratio).replace('.', ',') })}</Badge> : null}
            {cfg.color ? <Button size="sm" variant="ghost" onClick={() => set({ color: '' })}>{t('Retirer')}</Button> : null}
          </div>
          {lowContrast ? <Alert tone="warning">{t('Cette couleur est trop claire pour du texte blanc (minimum 4,5:1). Choisissez une couleur plus foncée : le serveur refusera celle-ci.')}</Alert> : null}
          <Field label={t('Thème par défaut')} hint={t('Chaque personne peut choisir le sien dans « Personnaliser l\'affichage ».')}>
            {() => <Segmented label={t('Thème par défaut')} value={cfg.theme || 'auto'} onChange={(v) => set({ theme: v === 'auto' ? '' : v })} items={[{ id: 'auto', label: t("D'origine") }, { id: 'light', label: t('Clair') }, { id: 'dark', label: t('Sombre') }]} />}
          </Field>
        </section>

        <section className="br-sec">
          <h3>{t('Pied de page, e-mails et documents')}</h3>
          <Field label={t('Texte du pied de page')}>{(p) => <input {...p} value={cfg.footerText} maxLength={200} onChange={(e) => set({ footerText: e.target.value })} />}</Field>
          <div className="br-2">
            <Field label={t("Nom d'expéditeur des e-mails")} hint={t("Par défaut : le nom de l'entreprise.")}>{(p) => <input {...p} value={cfg.mailFromName} maxLength={80} onChange={(e) => set({ mailFromName: e.target.value })} placeholder={info.org.name} />}</Field>
            <Field label={t('Adresse de réponse')} hint={t("Les clients répondent à cette adresse. L'envoi reste fait par la plateforme.")}>{(p) => <input {...p} type="email" value={cfg.mailReplyTo} maxLength={120} onChange={(e) => set({ mailReplyTo: e.target.value })} />}</Field>
          </div>
          <div className="br-2">
            <Field label={t('En-tête des documents PDF')}>{(p) => <input {...p} value={cfg.pdfHeader} maxLength={160} onChange={(e) => set({ pdfHeader: e.target.value })} />}</Field>
            <Field label={t('Pied des documents PDF')}>{(p) => <input {...p} value={cfg.pdfFooter} maxLength={200} onChange={(e) => set({ pdfFooter: e.target.value })} />}</Field>
          </div>
        </section>

        <section className="br-sec">
          <h3>{t('Menu')}</h3>
          <p className="muted small">{t("Ordre et visibilité des modules pour toute l'équipe. Le tableau de bord et l'équipe restent toujours visibles.")}</p>
          <ul className="br-list">
            {modOrder.map((id, i) => {
              const locked = opt.neverHide.includes(id);
              return (
                <li key={id} className={hidden.has(id) ? 'off' : ''}>
                  <span>{titleOf(id)}</span>
                  <button type="button" className="ui-btn ghost sm icon-only" disabled={locked} aria-pressed={!hidden.has(id)} aria-label={(hidden.has(id) ? t('Afficher : {m}', { m: titleOf(id) }) : t('Masquer : {m}', { m: titleOf(id) }))} onClick={() => set({ menu: { ...cfg.menu, hidden: hidden.has(id) ? cfg.menu.hidden.filter((x) => x !== id) : [...cfg.menu.hidden, id] } })}><Icon name={hidden.has(id) ? 'eye-slash' : 'eye'} /></button>
                  {upDown(modOrder, i, (d) => set({ menu: { ...cfg.menu, order: move(modOrder, i, d) } }))}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="br-sec">
          <h3>{t('Tableau de bord')}</h3>
          <ul className="br-list">
            {wOrder.map((id, i) => (
              <li key={id} className={cfg.dashboard.hidden.includes(id) ? 'off' : ''}>
                <span>{t(WIDGET_LABEL[id])}</span>
                <button type="button" className="ui-btn ghost sm icon-only" aria-pressed={!cfg.dashboard.hidden.includes(id)} aria-label={cfg.dashboard.hidden.includes(id) ? t('Afficher : {m}', { m: t(WIDGET_LABEL[id]) }) : t('Masquer : {m}', { m: t(WIDGET_LABEL[id]) })} onClick={() => set({ dashboard: { ...cfg.dashboard, hidden: cfg.dashboard.hidden.includes(id) ? cfg.dashboard.hidden.filter((x) => x !== id) : [...cfg.dashboard.hidden, id] } })}><Icon name={cfg.dashboard.hidden.includes(id) ? 'eye-slash' : 'eye'} /></button>
                {upDown(wOrder, i, (d) => set({ dashboard: { ...cfg.dashboard, order: move(wOrder, i, d) } }))}
              </li>
            ))}
          </ul>
        </section>

        <section className="br-sec">
          <h3>{t('Vocabulaire')}</h3>
          <p className="muted small">{t("Renommez quelques mots clés (par exemple « Clients » en « Adhérents »). Sans réponse dans une langue, la traduction d'origine reste utilisée.")}</p>
          <div className="br-vocab">
            {opt.vocabKeys.map((k) => (
              <details key={k} open={Boolean(cfg.vocab[k])}>
                <summary><span>{trBase(k)}</span><Icon name="right" /> <b>{(cfg.vocab[k] && cfg.vocab[k].fr) || '—'}</b></summary>
                <div className="br-2">
                  {opt.langs.map((l) => <Field key={l} label={LANG_LABEL[l]}>{(p) => <input {...p} value={(cfg.vocab[k] && cfg.vocab[k][l]) || ''} maxLength={40} onChange={(e) => setVocab(k, l, e.target.value)} />}</Field>)}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="br-sec">
          <h3>{t('Configuration')}</h3>
          <div className="br-row">
            <Button size="sm" icon="download" onClick={exportCfg}>{t('Exporter (JSON)')}</Button>
            <input ref={fileImp} type="file" accept="application/json,.json" hidden onChange={importCfg} />
            <Button size="sm" icon="upload" onClick={() => fileImp.current.click()}>{t('Importer')}</Button>
            <Button size="sm" variant="ghost" icon="retry" onClick={reset}>{t('Revenir à la configuration de base')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowLog(!showLog)}>{t('Journal des changements')}</Button>
          </div>
          {showLog ? <Journal /> : null}
        </section>

        <div className="br-bar">
          <Button variant="primary" icon="check" loading={busy} disabled={!dirty || lowContrast} onClick={save}>{t('Enregistrer')}</Button>
          <Button variant="ghost" disabled={!dirty || busy} onClick={() => { setCfg(JSON.parse(JSON.stringify(base))); setLogo(null); setFav(null); setErr(''); }}>{t('Annuler les changements')}</Button>
          {dirty ? <small className="muted">{t('Aperçu : rien n\'est enregistré tant que vous ne cliquez pas sur « Enregistrer ».')}</small> : null}
        </div>
      </div>

      <aside className="br-prev" aria-label={t('Aperçu en direct')} style={{ '--b': pv.brand, '--on-b': pv.onBrand }}>
        <h3>{t('Aperçu en direct')}</h3>
        <div className="br-card side">
          <div className="br-pl"><span className="br-pi">{logoSrc ? <img src={logoSrc} alt="" /> : <img src="/favicon.svg" alt="" />}</span><b>{cfg.mode === 'brij' && !cfg.productName ? <>{PRODUCT.logoMarkup[0]}<i>{PRODUCT.logoMarkup[1]}</i></> : shownName}</b></div>
          <ul>{previewMods.map((id, i) => <li key={id} className={i === 0 ? 'on' : ''}>{prevTitle(id)}</li>)}</ul>
        </div>
        <div className="br-card">
          <div className="br-pa"><button type="button" tabIndex={-1} className="br-btn">{voc('Clients')}</button><span className="muted small">{t('Demandez à {n}…', { n: assistant })}</span></div>
          <div className="br-bub"><Icon name="ai" /> <span>{t("Bonjour, ici {n}, l'assistant IA. Comment puis-je vous aider ?", { n: assistant })}</span></div>
        </div>
        <div className="br-card doc">
          {cfg.pdfHeader ? <small className="muted">{cfg.pdfHeader}</small> : null}
          <b className="br-doc-o">{info.org.name}</b>
          <b>{voc('Factures')} — F-0001</b>
          <small className="br-doc-f">{pdfFoot}{pdfMention}</small>
        </div>
        <div className="br-card mail">
          <small className="muted">{t('De')} : {cfg.mailFromName || info.org.name}{cfg.mailReplyTo ? ' · ' + t('Réponse à {a}', { a: cfg.mailReplyTo }) : ''}</small>
          <p>{t('Bonjour, voici votre document.')}</p>
          <small className="muted">—<br />{info.org.name}{mailSig ? <><br />{mailSig}</> : null}</small>
        </div>
        <div className="br-card foot">
          <small>© {new Date().getFullYear()} {shownName}{cfg.footerText ? ' · ' + cfg.footerText : ''}{cfg.mode === 'powered' ? ' · ' + t('Propulsé par {name}', { name: PRODUCT.name }) : ''}{cfg.mode !== 'brij' ? ' · ' + t('Mentions légales') : ''}</small>
        </div>
        <small className="muted">{t('Organisation : {n}', { n: info.org.name })} · #{orgId}</small>
      </aside>
    </div>
  );
}

function Journal() {
  const t = useT();
  const { oapi, dateFr } = useWs();
  const st = useLoad(() => oapi('GET', '/brand/log'), []);
  return (
    <Loaded state={st}>
      {(j) => (j.log.length ? (
        <ul className="br-log">{j.log.map((l) => <li key={l.id}><b>{l.action}</b> {l.detail ? <span>{l.detail}</span> : null}<small className="muted"> {l.who} · {dateFr(String(l.at).slice(0, 10))}</small></li>)}</ul>
      ) : <p className="muted small">{t('Aucun changement pour le moment.')}</p>)}
    </Loaded>
  );
}
