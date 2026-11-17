import { SUPPORT_WHATSAPP } from '../../lib/api.js';

// Coordonnées publiques : une seule définition pour tout le pied de page et les boutons.
export const WA_NUMBER = SUPPORT_WHATSAPP;
export const WA_DISPLAY = '+237 653 62 13 88';
export const EMAIL = 'tendabrandon9@gmail.com';
export const waLink = (text) => `https://wa.me/${WA_NUMBER}` + (text ? `?text=${encodeURIComponent(text)}` : '');

/** Chemin des captures de l'application (WebP, données d'exemple) : voir scripts/vitrine-captures.mjs. */
export const shot = (id, w) => `/vitrine/app-${id}-${w}.webp`;
