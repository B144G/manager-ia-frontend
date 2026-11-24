/* SEUL endroit où le nom du produit par défaut et ses variantes sont écrits pour le code de la marque d'entreprise (site).
   Renommer le produit = changer ce fichier (et src/services/product.js côté serveur) ; voir docs/marque-entreprise.md pour les textes encore écrits en dur ailleurs. */
export const PRODUCT = Object.freeze({
  name: 'Brij-IA',                // nom du produit affiché par défaut
  shortName: 'Brij-IA',           // nom court
  assistantName: 'Brij-IA',       // nom par défaut de l'assistant IA
  poweredByLabel: 'Propulsé par', // « Propulsé par <nom> »
  publicUrl: 'https://brij-ia.vercel.app',
  logoMarkup: ['Brij', '-IA'],    // logo texte : « Brij » + partie accentuée « -IA »
});
