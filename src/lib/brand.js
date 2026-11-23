import { useEffect, useSyncExternalStore } from 'react';
import { API_BASE } from './api.js';
import { setTextHook } from './i18n.jsx';
import { setServerBrand } from './prefs.js';

/* Marque de l'entreprise : nom affiché, nom de l'assistant IA, logo, couleur, pied de page, menu, tableau de bord, vocabulaire.
   Point d'accès unique pour toute l'interface : `useBrand()` (composants) ou `getBrand()` (hors composant). Le serveur est la source (GET /orgs/:id → `brand`) ;
   tant que l'entreprise n'a rien personnalisé, tout reste exactement comme avant (« Brij-IA », logo et couleurs d'origine).
   Aucun texte de l'entreprise n'est jamais injecté comme HTML : React échappe tout. */

export const PLATFORM = 'Brij-IA';
export const BRAND_DEFAULT = Object.freeze({
  customized: false, mode: 'brij', productName: '', name: PLATFORM, assistantName: '', color: '', theme: '', footerText: '',
  mailFromName: '', mailReplyTo: '', pdfHeader: '', pdfFooter: '', menu: { order: [], hidden: [] }, dashboard: { order: [], hidden: [] }, vocab: {},
  poweredBy: false, whiteLabel: false, platformName: PLATFORM, hasLogo: false, hasFavicon: false, logoUrl: '', faviconUrl: '', version: 0,
});

/* Textes qui parlent de la plateforme elle-même (son éditeur, ses conditions, le partage de données avec elle) : le nom « Brij-IA » y reste. */
const PLATFORM_ONLY = /partager la position|fondateur de Brij-IA|administration de Brij-IA|Informations et offres|Ils utilisent|ourni par Brij-IA|ournis par Brij-IA|Un utilisateur de Brij-IA|améliorer Brij-IA|Recommanderiez-vous|abonnement Brij-IA|Offre gratuite|Bienvenue sur Brij-IA|responsable de traitement|éditeur|Propulsé par|comme aujourd'hui|reste affiché|Remplace « Brij-IA »|garder Brij-IA/;
/* Textes où « Brij-IA » désigne l'assistant (et non le logiciel) : on y met le nom choisi pour l'assistant. */
const ASSISTANT_TEXT = /^(Demandez à|Demander à|Point de situation de|Alertes de|Ce que) Brij-IA/;

let state = BRAND_DEFAULT;
const subs = new Set();
const emit = () => subs.forEach((f) => f());
export const getBrand = () => state;
export const assetUrl = (u) => (u ? (/^https?:/i.test(u) ? u : API_BASE + u) : '');

/** Nom du produit affiché (menu, pied de page, titre) : « Brij-IA » par défaut. */
export const brandName = (b = state) => b.name || PLATFORM;
/** Nom de l'assistant IA affiché : celui choisi par l'entreprise, sinon « Brij-IA » (comme avant) ou « Assistant IA » selon le texte. */
export const assistantLabel = (b = state) => b.assistantName || '';

function hook(s, out, lang) {
  const b = state;
  if (!b.customized) return out;
  const v = b.vocab && b.vocab[s];
  if (v && v[lang]) return v[lang]; // vocabulaire de l'entreprise (exact, par langue ; sans entrée pour la langue : traduction d'origine)
  if (b.assistantName) {
    if (s === 'Assistant IA') return b.assistantName;
    if (ASSISTANT_TEXT.test(s) && out.includes(PLATFORM)) return out.split(PLATFORM).join(b.assistantName);
  }
  if (b.mode !== 'brij' && out.includes(PLATFORM) && !PLATFORM_ONLY.test(s)) return out.split(PLATFORM).join(b.name);
  return out;
}

let origTitle = null; let origIcon = null; let origManifest = null; let titleSet = false;
function head(b) {
  if (typeof document === 'undefined') return;
  try {
    const icon = document.querySelector('link[rel~="icon"]');
    const man = document.querySelector('link[rel="manifest"]');
    if (origTitle === null) { origTitle = document.title; origIcon = icon ? icon.getAttribute('href') : null; origManifest = man ? man.getAttribute('href') : null; }
    if (b.customized && b.mode !== 'brij') { document.title = b.name; titleSet = true; } else if (titleSet) { document.title = origTitle; titleSet = false; } // le titre n'est touché que si l'entreprise a choisi un autre nom
    if (icon) { if (b.faviconUrl || b.logoUrl) icon.setAttribute('href', assetUrl(b.faviconUrl || b.logoUrl)); else if (origIcon) icon.setAttribute('href', origIcon); }
    const tok = /\/brand\/([a-f0-9]{36})\//.exec(b.logoUrl || b.faviconUrl || '');
    if (man) { if (tok && b.customized) man.setAttribute('href', assetUrl(`/api/ws/public/brand/${tok[1]}/manifest.webmanifest`)); else if (origManifest) man.setAttribute('href', origManifest); }
  } catch { /* en-tête indisponible */ }
}

/** Applique la marque d'une entreprise (appelé quand on charge ou change d'entreprise, ou après un enregistrement). `null` = marque d'origine. */
export function setBrand(next) {
  const b = next && typeof next === 'object' ? { ...BRAND_DEFAULT, ...next } : BRAND_DEFAULT;
  if (JSON.stringify(b) === JSON.stringify(state)) return;
  state = b;
  setServerBrand({ color: b.color, theme: b.theme });
  setTextHook(b.customized ? hook : null);
  head(b);
  emit();
}
export function useBrand() { return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state); }

/** Menu : ordre choisi par l'entreprise, puis modules masqués (jamais le tableau de bord ni l'équipe). L'ordre personnel de chacun s'applique ensuite. */
export function brandOrder(mods, brand = state) {
  const order = (brand.menu && brand.menu.order) || [];
  if (!order.length) return mods;
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...mods].sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 999) - (pos.has(b.id) ? pos.get(b.id) : 999));
}
export function brandHide(mods, brand = state) {
  const hidden = (brand.menu && brand.menu.hidden) || [];
  return hidden.length ? mods.filter((m) => !hidden.includes(m.id) || m.id === 'dashboard' || m.id === 'team') : mods;
}

export const DASH_WIDGETS = ['brief', 'health', 'kpis', 'chart', 'alerts', 'decisions', 'projects', 'tasks'];
/** Éléments du tableau de bord : { show(id), order(ids) } ; sans réglage, tout est visible dans l'ordre d'origine. */
export function dashPlan(brand = state) {
  const hidden = new Set((brand.dashboard && brand.dashboard.hidden) || []);
  const order = (brand.dashboard && brand.dashboard.order) || [];
  return { custom: Boolean(order.length) || hidden.size > 0, show: (id) => !hidden.has(id), order: (ids) => { const pos = new Map(order.map((id, i) => [id, i])); return [...ids].sort((a, b) => (pos.has(a) ? pos.get(a) : 99) - (pos.has(b) ? pos.get(b) : 99)); } };
}

/** Pages publiques (formulaire, discussion, suivi, devis, localisation, satisfaction) : marque de l'entreprise du lien, sans compte. */
export function usePublicBrand(kind, token) {
  useEffect(() => {
    let off = false;
    if (!token) return undefined;
    fetch(`${API_BASE}/api/ws/public/brand-of/${kind}/${encodeURIComponent(token)}`).then((r) => r.json()).then((j) => {
      if (off || !j || !j.brand) return;
      const pb = j.brand;
      // Marque d'origine : on ne touche à rien (les pages publiques gardent leur logo et leur titre).
      setBrand(pb.name === PLATFORM && !pb.logoUrl && !pb.color && pb.mode === 'brij' ? null : { ...pb, customized: true });
    }).catch(() => {});
    return () => { off = true; setBrand(null); };
  }, [kind, token]);
  return useBrand();
}

/** Contraste d'une couleur avec le blanc (texte blanc sur fond de marque) : même calcul que le serveur. */
export function contrastWhite(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 0;
  const n = parseInt(m[1], 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return Math.round((1.05 / (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] + 0.05)) * 100) / 100;
}
