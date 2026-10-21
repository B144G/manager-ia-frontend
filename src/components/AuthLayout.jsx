import Logo from './Logo.jsx';

/** Page d'identification : colonne d'argumentaire à gauche (grands écrans), carte au centre. */
export default function AuthLayout({ pitch, bullets, image = true, children }) {
  return (
    <div className="au-grid">
      <aside className="au-side" aria-hidden="false">
        <Logo />
        <div className="au-pitch"><h2>{pitch}</h2><ul>{bullets.map((b) => <li key={b}>{b}</li>)}</ul></div>
        {image ? <img src="/assets/img/gestion.svg" alt="Aperçu du tableau de bord MANAGER-IA" width="640" height="420" /> : null}
      </aside>
      <main className="au-main">
        <Logo className="au-logo" />
        {children}
      </main>
    </div>
  );
}
