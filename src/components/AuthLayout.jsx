import Logo from './Logo.jsx';
import LangSwitch from './LangSwitch.jsx';
import { useT } from '../lib/i18n.jsx';

/** Page d'identification : colonne d'argumentaire à gauche (grands écrans), carte au centre. */
export default function AuthLayout({ pitch, bullets, image = true, children }) {
  const t = useT();
  return (
    <div className="au-grid">
      <aside className="au-side" aria-hidden="false">
        <Logo />
        <div className="au-pitch"><h2>{pitch}</h2><ul>{bullets.map((b) => <li key={b}>{b}</li>)}</ul></div>
        {image ? <img src="/assets/img/gestion.svg" alt={t("Aperçu du tableau de bord MANAGER-IA")} width="640" height="420" /> : null}
      </aside>
      <main className="au-main">
        <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}><LangSwitch /></div>
        <Logo className="au-logo" />
        {children}
      </main>
    </div>
  );
}
