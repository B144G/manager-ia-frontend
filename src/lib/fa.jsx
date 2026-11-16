import { config, library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faBan,
  faBars,
  faBolt,
  faBoxesStacked,
  faCamera,
  faChartLine,
  faCheck,
  faChevronDown,
  faCircleCheck,
  faCircleInfo,
  faCircleNotch,
  faClock,
  faComments,
  faEnvelope,
  faEye,
  faEyeSlash,
  faFile,
  faFileLines,
  faFilePdf,
  faFilm,
  faGlobe,
  faImage,
  faLock,
  faMicrophone,
  faPaperPlane,
  faPaperclip,
  faPhone,
  faPlus,
  faRobot,
  faRotateRight,
  faShield,
  faStop,
  faTriangleExclamation,
  faUser,
  faUserPlus,
  faWandMagicSparkles,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { faFacebookF, faTiktok, faWhatsapp } from '@fortawesome/free-brands-svg-icons';

/* Registre unique des icônes (Font Awesome Free, SVG auto-hébergé). Ici : les icônes du site public et de la connexion (premier chargement léger).
   Les icônes de l'espace de travail sont dans src/ws/icons.js (chargées avec l'espace de travail) et ajoutées par registerIcons().
   Utilisation : <Icon name="plus" />. */
config.autoAddCss = false;

const ICONS = {
  'stock': faBoxesStacked,
  'menu': faBars,
  'close': faXmark,
  'warn': faTriangleExclamation,
  'ok': faCircleCheck,
  'info': faCircleInfo,
  'spinner': faCircleNotch,
  'retry': faRotateRight,
  'down': faChevronDown,
  'chart': faChartLine,
  'doc': faFileLines,
  'pdf': faFilePdf,
  'mail': faEnvelope,
  'eye-off': faEyeSlash,
  'send': faPaperPlane,
  'clip': faPaperclip,
  'magic': faWandMagicSparkles,
  'video': faFilm,
  'mic': faMicrophone,
  'chat': faComments,
  'robot': faRobot,
  'plus': faPlus,
  'check': faCheck,
  'arrow-up': faArrowUp,
  'arrow-right': faArrowRight,
  'arrow-left': faArrowLeft,
  'clock': faClock,
  'bolt': faBolt,
  'phone': faPhone,
  'globe': faGlobe,
  'lock': faLock,
  'user': faUser,
  'user-plus': faUserPlus,
  'camera': faCamera,
  'image': faImage,
  'file': faFile,
  'eye': faEye,
  'shield': faShield,
  'stop': faStop,
  'ban': faBan,
  facebook: faFacebookF, tiktok: faTiktok, whatsapp: faWhatsapp,
};
library.add(...new Set(Object.values(ICONS)));

/** Ajoute des icônes au registre (utilisé par src/ws/icons.js). */
export function registerIcons(map) { Object.assign(ICONS, map); library.add(...new Set(Object.values(map))); }
export const hasIcon = (name) => Boolean(ICONS[name]);

/** L'unique composant d'icône de l'application. Décorative par défaut (aria-hidden) ; passez `title` pour une icône qui porte un sens seule. */
export function Icon({ name, spin, fixedWidth, className, title, style, size }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return <FontAwesomeIcon icon={icon} spin={spin} fixedWidth={fixedWidth} className={'ui-ico' + (className ? ' ' + className : '')} title={title} style={size ? { ...style, fontSize: size } : style} aria-hidden={title ? undefined : 'true'} />;
}
export const Fa = Icon; // ancien nom, conservé : <Fa name="mic" />
export default Icon;
