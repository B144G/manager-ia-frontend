import { lazy, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LangSwitch from '../components/LangSwitch.jsx';
import Logo from '../components/Logo.jsx';
import { openCookieSettings } from '../lib/consent.js';
import { getLang, useT } from '../lib/i18n.jsx';
import { Markdown, outline, parse } from './markdown.jsx';

/* Centre légal : les textes sont des fichiers Markdown dans src/legal/content/<fr|en>/<page>.md.
   Français et anglais ; l'allemand et l'espagnol affichent la version anglaise avec une mention. */
const FILES = import.meta.glob('./content/*/*.md', { query: '?raw', import: 'default' });

export const LEGAL_PAGES = [
  { slug: 'confidentialite', title: 'Politique de confidentialité' },
  { slug: 'conditions', title: "Conditions d'utilisation" },
  { slug: 'cookies', title: 'Cookies' },
  { slug: 'mentions-legales', title: 'Mentions légales' },
  { slug: 'sous-traitants', title: 'Sous-traitants' },
  { slug: 'securite', title: 'Sécurité' },
];
/** Vrai si au moins un texte de cette page est publié (sinon l'ancienne page ou la page « introuvable » prend le relais). */
export const hasLegalContent = (slug) => Boolean(FILES[`./content/fr/${slug}.md`] || FILES[`./content/en/${slug}.md`]);

const Fallback = lazy(() => import('../pages/NotFound.jsx'));

export default function LegalCenter({ slug, legacy: Legacy }) {
  const t = useT();
  const lang = getLang();
  const wanted = lang === 'fr' ? 'fr' : 'en';
  const [state, setState] = useState({ loading: true, md: null, lang: wanted });
  const page = LEGAL_PAGES.find((p) => p.slug === slug);
  useEffect(() => {
    let off = false;
    const load = FILES[`./content/${wanted}/${slug}.md`] || FILES[`./content/fr/${slug}.md`];
    if (!load) { setState({ loading: false, md: null, lang: wanted }); return undefined; }
    const used = FILES[`./content/${wanted}/${slug}.md`] ? wanted : 'fr';
    load().then((md) => { if (!off) setState({ loading: false, md, lang: used }); }, () => { if (!off) setState({ loading: false, md: null, lang: used }); });
    return () => { off = true; };
  }, [slug, wanted]);
  const blocks = useMemo(() => parse(state.md), [state.md]);
  const toc = useMemo(() => outline(blocks), [blocks]);
  const ttl = page ? t(page.title) : '';
  useEffect(() => { if (page) document.title = ttl + ' · Brij-IA'; }, [ttl, page]);
  useEffect(() => { window.scrollTo(0, 0); }, [slug]);
  if (!page) return <Fallback />;
  if (!state.loading && !state.md) return Legacy ? <Legacy /> : <Fallback />;
  const mention = lang !== 'fr' && lang !== 'en' && state.lang === 'en';
  const h1 = blocks.find((b) => b.type === 'h' && b.level === 1);
  const body = h1 ? blocks.filter((b) => b !== h1) : blocks;
  return (
    <>
      <header className="s-nav"><div className="s-wrap">
        <Logo />
        <div className="s-act"><LangSwitch /><Link className="s-btn" to="/" style={{ overflowWrap: 'anywhere' }}>{t("Retour à l'accueil")}</Link></div>
      </div></header>
      <main className="s-legal"><div className="s-wrap">
        <h1>{h1 ? h1.text : ttl}</h1>
        {mention ? <p className="muted" role="note">{t("Ce document n'est disponible qu'en français et en anglais : la version anglaise est affichée.")}</p> : null}
        {toc.length > 2 ? (
          <nav aria-label={t('Sommaire')} style={{ margin: '16px 0' }}>
            <b>{t('Sommaire')}</b>
            <ul>{toc.map((x) => <li key={x.id}><a href={'#' + x.id}>{x.text}</a></li>)}</ul>
          </nav>
        ) : null}
        {state.loading ? null : <Markdown blocks={body} />}
      </div></main>
      <footer className="s-foot"><div className="s-wrap">
        <div><Logo footer /></div>
        <nav aria-label={t('Liens du pied de page')}>
          {LEGAL_PAGES.map((p) => <Link key={p.slug} to={'/' + p.slug}>{t(p.title)}</Link>)}
          <button type="button" className="link" onClick={openCookieSettings}>{t('Gérer mes cookies')}</button>
          <Link to="/">{t('Accueil')}</Link>
        </nav>
      </div></footer>
    </>
  );
}
