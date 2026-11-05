import { config, library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faArrowRight, faArrowUp, faBars, faBolt, faBoxesStacked, faCamera, faChartLine, faCheck, faChevronDown, faCircleCheck, faCircleInfo, faCircleNotch, faClock,
  faComments, faEnvelope, faEye, faEyeSlash, faFile, faFileLines, faFilePdf, faFilm, faGlobe, faImage, faLock, faMicrophone, faPaperclip, faPaperPlane, faPhone, faPlus,
  faRotateRight, faShieldHalved, faStop, faTriangleExclamation, faUser, faWandMagicSparkles, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { faFacebookF, faTiktok, faWhatsapp } from '@fortawesome/free-brands-svg-icons';

/* Font Awesome (Free) : icônes en SVG, auto-hébergées et réduites aux seules icônes utilisées ci-dessous (aucun service externe, aucune police à charger).
   Le CSS de Font Awesome est importé une fois dans main.jsx ; on désactive donc l'injection automatique (compatible avec une politique de sécurité stricte).
   Pour ajouter une icône : l'importer ici et lui donner un nom court. Utilisation : <Fa name="mic" />. */
config.autoAddCss = false;

const ICONS = {
  'arrow-left': faArrowLeft, 'arrow-right': faArrowRight, 'arrow-up': faArrowUp, menu: faBars, bolt: faBolt, stock: faBoxesStacked, camera: faCamera, chart: faChartLine,
  check: faCheck, down: faChevronDown, ok: faCircleCheck, info: faCircleInfo, spinner: faCircleNotch, clock: faClock, chat: faComments, mail: faEnvelope, eye: faEye, 'eye-off': faEyeSlash,
  file: faFile, doc: faFileLines, pdf: faFilePdf, video: faFilm, globe: faGlobe, image: faImage, lock: faLock, mic: faMicrophone, clip: faPaperclip, send: faPaperPlane, phone: faPhone,
  plus: faPlus, retry: faRotateRight, shield: faShieldHalved, stop: faStop, warn: faTriangleExclamation, user: faUser, magic: faWandMagicSparkles, close: faXmark,
  facebook: faFacebookF, tiktok: faTiktok, whatsapp: faWhatsapp,
};
library.add(...Object.values(ICONS));

/** Icône Font Awesome par nom court. Décorative par défaut (aria-hidden) ; passez `title` pour une icône qui porte un sens seule. */
export function Fa({ name, spin, fixedWidth, className, title, style }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return <FontAwesomeIcon icon={icon} spin={spin} fixedWidth={fixedWidth} className={className} title={title} style={style} aria-hidden={title ? undefined : 'true'} />;
}
export default Fa;
