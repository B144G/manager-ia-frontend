import { LANGS, setLang, useLang, useT } from '../lib/i18n.jsx';

/** Sélecteur de langue : français (par défaut), anglais, allemand, espagnol. */
export default function LangSwitch({ className = '' }) {
  const lang = useLang();
  const t = useT();
  return (
    <label className={'lang-switch ' + className}>
      <span className="sr-only">{t('Langue')}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></svg>
      <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('Langue')}>
        {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </label>
  );
}
