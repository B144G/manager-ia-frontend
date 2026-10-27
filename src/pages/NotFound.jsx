import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n.jsx';

export default function NotFound() {
  const t = useT();
  useEffect(() => { document.title = t('Page introuvable') + ' · Brij-IA'; }, [t]);
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
      <div><h1>{t('Page introuvable')}</h1><p>{t("Cette adresse n'existe pas.")}</p><Link className="s-btn pri" to="/" style={{ overflowWrap: 'anywhere' }}>{t("Retour à l'accueil")}</Link></div>
    </main>
  );
}
