import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
      <div><h1>Page introuvable</h1><p>Cette adresse n'existe pas.</p><Link className="s-btn pri" to="/">Retour à l'accueil</Link></div>
    </main>
  );
}
