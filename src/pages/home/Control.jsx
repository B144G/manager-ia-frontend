export default function Control() {
  return (
    <>
      <section className="s-sec s-dark" id="securite"><div className="s-wrap">
        <div className="s-head rv"><span className="s-eyebrow">Vous gardez le contrôle</span><h2>Elle propose, vous décidez</h2><p>Chaque action est encadrée par votre rôle. Pour les décisions sensibles, comme une commande, un responsable doit valider.</p></div>
        <ol className="s-flow rv"><li>Informe</li><li>Analyse</li><li>Recommande</li><li>Prépare l'action</li><li className="go">Exécute après votre accord</li></ol>
        <div className="s-sec-grid">
          <div className="rv"><h3>Vérification à l'inscription</h3><p>Un code envoyé par e-mail, valable une minute, confirme chaque nouveau compte.</p></div>
          <div className="rv" style={{ '--d': '.06s' }}><h3>Mots de passe protégés</h3><p>Mots de passe chiffrés, mots de passe trop faciles refusés, blocage après des essais répétés.</p></div>
          <div className="rv" style={{ '--d': '.12s' }}><h3>Accès par rôle</h3><p>Propriétaire, administrateur, responsable, membre : chacun voit seulement ce qui le concerne.</p></div>
          <div className="rv" style={{ '--d': '.18s' }}><h3>Données séparées et sauvegardées</h3><p>Les données de chaque organisation sont séparées. Les écritures comptables ne se modifient pas.</p></div>
        </div>
      </div></section>
    </>
  );
}
