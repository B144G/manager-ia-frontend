// Clavier virtuel : sur iPhone et Android récents, le clavier recouvre le bas de la page sans la redimensionner.
// On mesure la hauteur recouverte (--kb) et on la met à disposition du CSS (panneaux fixes, barre de saisie du chat, fenêtres).
// On fait aussi défiler le champ actif pour qu'il reste visible. Tout est protégé : sans visualViewport, rien ne change.
export function initViewport() {
  try {
    const root = document.documentElement;
    const vv = window.visualViewport;
    const update = () => {
      let kb = 0;
      if (vv) kb = Math.max(0, Math.round(root.clientHeight - vv.height - vv.offsetTop));
      // petite marge d'erreur : une barre d'adresse qui se replie n'est pas un clavier
      root.style.setProperty('--kb', (kb > 80 ? kb : 0) + 'px');
      root.classList.toggle('kb-open', kb > 80);
    };
    if (vv) { vv.addEventListener('resize', update); vv.addEventListener('scroll', update); }
    update();
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || /^(checkbox|radio|button|submit|range|color|file)$/.test(el.type || '')) return;
      // après l'ouverture du clavier (animation), on recentre le champ s'il est caché
      setTimeout(() => {
        try {
          const h = vv ? vv.height : window.innerHeight; const top = vv ? vv.offsetTop : 0;
          const r = el.getBoundingClientRect();
          if (r.bottom > top + h - 8 || r.top < top + 8) el.scrollIntoView({ block: 'center', behavior: 'auto' });
        } catch { /* ignore */ }
      }, 320);
    });
  } catch { /* ignore */ }
}
