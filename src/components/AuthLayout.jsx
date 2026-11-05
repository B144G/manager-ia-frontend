import Logo from './Logo.jsx';
import LangSwitch from './LangSwitch.jsx';
import { Fa } from '../lib/fa.jsx';

/** Page d'identification : un message en haut, puis le formulaire. Rien d'autre (pas de colonne de présentation). */
export default function AuthLayout({ pitch, children }) {
  return (
    <div className="au-shell">
      <header className="au-top">
        <Logo />
        <LangSwitch />
      </header>
      <main className="au-main">
        <div className="au-msg" role="note"><Fa name="magic" /><p>{pitch}</p></div>
        {children}
      </main>
    </div>
  );
}
