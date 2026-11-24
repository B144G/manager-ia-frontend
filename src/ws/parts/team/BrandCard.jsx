import { useT } from '../../../lib/i18n.jsx';
import { Button, Icon } from '../../ui/index.jsx';
import { useWs } from '../../WsContext.jsx';
import BrandSettings from './BrandSettings.jsx';
import '../../../styles/ws-brand.css';

/* Carte « Personnalisation de mon entreprise » (Équipe et antennes) : ouvre l'écran complet avec aperçu en direct. Réservée aux administrateurs. */
export function openBrandSettings(modal, t) {
  return modal(t('Personnalisation de mon entreprise'), () => <BrandSettings />, { wide: true });
}

export default function BrandCard() {
  const t = useT();
  const { modal } = useWs();
  return (
    <section className="ws-card" aria-label={t('Personnalisation de mon entreprise')}>
      <div className="team-brand">
        <div>
          <h3><Icon name="brand" /> {t('Personnalisation de mon entreprise')}</h3>
          <p className="muted">{t("Votre nom, le nom de votre assistant IA, votre logo, vos couleurs, le menu, le tableau de bord et le vocabulaire. Tant que vous ne changez rien, rien ne change.")}</p>
        </div>
        <Button variant="primary" icon="brand" onClick={() => openBrandSettings(modal, t)}>{t('Personnaliser')}</Button>
      </div>
    </section>
  );
}
