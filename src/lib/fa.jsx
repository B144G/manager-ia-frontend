import { config, library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faArrowRight, faArrowUp, faBan, faBars, faBolt, faBoxesStacked, faCamera, faChartLine, faCheck, faChevronDown, faCircleCheck, faCircleInfo, faCircleNotch, faClock,
  faComments, faEnvelope, faEye, faEyeSlash, faFile, faFileLines, faFilePdf, faFilm, faGlobe, faImage, faLock, faMicrophone, faPaperclip, faPaperPlane, faPhone, faPlus,
  faRobot, faRotateRight, faShieldHalved, faStop, faTriangleExclamation, faUser, faUserPlus, faWandMagicSparkles, faXmark,
  faGaugeHigh, faHeadset, faListCheck, faWallet, faAddressBook, faUsers, faHandshake, faSitemap, faGears, faPeopleGroup, faMoneyCheckDollar,
  faFileInvoiceDollar, faBullhorn, faTruck, faIndustry, faHelmetSafety, faScrewdriverWrench, faScaleBalanced, faBookOpen, faRightFromBracket, faBell,
  faCalculator, faCartShopping, faCreditCard, faPlug, faGear, faClipboardCheck, faPen, faBuildingColumns, faWarehouse, faCoins, faChartPie, faFilePen,
  faBoxOpen, faMobileScreen, faLink, faFolderTree, faReceipt, faFolder, faChevronRight, faMagnifyingGlass, faBrain, faRoute,
  faShuffle, faCubes, faTags,
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
  ban: faBan, robot: faRobot, 'user-plus': faUserPlus,
  // Menus de l'espace de travail (modules et groupes d'écrans)
  gauge: faGaugeHigh, headset: faHeadset, 'list-check': faListCheck, wallet: faWallet, 'address-book': faAddressBook, users: faUsers, handshake: faHandshake,
  sitemap: faSitemap, gears: faGears, 'people-group': faPeopleGroup, 'money-check': faMoneyCheckDollar, 'file-invoice': faFileInvoiceDollar, bullhorn: faBullhorn,
  truck: faTruck, industry: faIndustry, helmet: faHelmetSafety, tools: faScrewdriverWrench, scale: faScaleBalanced, 'book-open': faBookOpen, logout: faRightFromBracket,
  bell: faBell, calculator: faCalculator, cart: faCartShopping, card: faCreditCard, plug: faPlug, gear: faGear, 'clipboard-check': faClipboardCheck, pen: faPen,
  bank: faBuildingColumns, warehouse: faWarehouse, coins: faCoins, 'chart-pie': faChartPie, 'file-pen': faFilePen, 'box-open': faBoxOpen, mobile: faMobileScreen,
  link: faLink, 'folder-tree': faFolderTree, receipt: faReceipt, folder: faFolder, right: faChevronRight, search: faMagnifyingGlass, brain: faBrain, route: faRoute,
  // Flux spéciaux de l'entrepôt : transbordement, kits, services à valeur ajoutée
  shuffle: faShuffle, cubes: faCubes, tags: faTags,
  facebook: faFacebookF, tiktok: faTiktok, whatsapp: faWhatsapp,
};
library.add(...Object.values(ICONS));

/** Icônes des modules (menu principal) : nom de module → icône Font Awesome. */
export const MODULE_FA = {
  dashboard: 'gauge', support: 'headset', projects: 'list-check', budget: 'wallet', stock: 'stock', crm: 'address-book', hr: 'users', sales: 'handshake',
  aifollow: 'eye', structure: 'sitemap', processes: 'gears', team: 'people-group', payroll: 'money-check', fiscal: 'file-invoice', marketing: 'bullhorn',
  logistics: 'truck', production: 'industry', construction: 'helmet', maintenance: 'tools', legal: 'scale', memory: 'brain', agents: 'robot',
  accounting: 'calculator', library: 'book-open', purchasing: 'cart', billing: 'card', integrations: 'plug', alerts: 'bell', out: 'logout', shield: 'shield', ai: 'magic',
};
/** Ancien menu des modules à émojis → icônes Font Awesome (les modules peuvent aussi donner directement un nom d'icône). */
export const EMOJI_FA = {
  '📊': 'gauge', '📈': 'chart', '📝': 'file-pen', '🛒': 'cart', '🧾': 'receipt', '🏭': 'warehouse', '💰': 'coins', '📦': 'box-open', '✅': 'clipboard-check',
  '📱': 'mobile', '🔗': 'link', '🗂️': 'folder-tree', '🔒': 'lock', '⚙️': 'gear', '✏️': 'pen', '🏗️': 'helmet', '🏦': 'bank', '👥': 'users',
};
export const faName = (v) => (ICONS[v] ? v : EMOJI_FA[v] || 'folder');

/** Icône Font Awesome par nom court. Décorative par défaut (aria-hidden) ; passez `title` pour une icône qui porte un sens seule. */
export function Fa({ name, spin, fixedWidth, className, title, style }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return <FontAwesomeIcon icon={icon} spin={spin} fixedWidth={fixedWidth} className={className} title={title} style={style} aria-hidden={title ? undefined : 'true'} />;
}
export default Fa;
