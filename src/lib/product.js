/* SEUL endroit où le nom du produit par défaut et ses variantes sont écrits pour le code de la marque d'entreprise (site).
   Renommer le produit = changer ce fichier (et src/services/product.js côté serveur) ; voir docs/marque-entreprise.md pour les textes encore écrits en dur ailleurs. */
export const PRODUCT = Object.freeze({
  name: 'MABAH',                // nom du produit affiché par défaut
  shortName: 'MABAH',           // nom court
  assistantName: 'MABAH IA',       // nom par défaut de l'assistant IA
  poweredByLabel: 'Propulsé par', // « Propulsé par <nom> »
  publicUrl: 'https://mabah.vercel.app',
  legacyUrls: ['https://brij-ia.vercel.app'], // ancienne adresse : redirigée vers publicUrl (vercel.json) et acceptée comme origine pendant la transition
  logoMarkup: ['MABAH', ''],    // logo texte : « MABAH » ou « Brij » + partie accentuée « -IA »
});
