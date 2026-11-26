import { registerIcons } from '../lib/fa.jsx';
import {
  faArrowUpRightFromSquare, faBuilding, faCheck, faCircleCheck, faCircleInfo, faClockRotateLeft, faCopy, faDownload, faEye, faEyeSlash, faFileArrowDown, faFingerprint, faGauge,
  faKey, faLaptop, faLock, faMagnifyingGlass, faMobileScreen, faQrcode, faRightLeft, faShieldHalved, faSort, faSortDown, faSortUp, faTrash, faTriangleExclamation, faUserShield, faXmark, faSliders, faSitemap,
} from '@fortawesome/free-solid-svg-icons';

/* Icônes du centre de confidentialité, de la sécurité du compte et de la gestion des organisations (le registre est partagé avec l'espace de travail). */
registerIcons({
  'pv-link-out': faArrowUpRightFromSquare, 'pv-building': faBuilding, 'pv-check': faCheck, 'pv-ok': faCircleCheck, 'pv-info': faCircleInfo, 'pv-history': faClockRotateLeft, 'pv-copy': faCopy,
  'pv-download': faDownload, 'pv-eye': faEye, 'pv-eye-off': faEyeSlash, 'pv-file': faFileArrowDown, 'pv-finger': faFingerprint, 'pv-gauge': faGauge, 'pv-key': faKey, 'pv-laptop': faLaptop,
  'pv-lock': faLock, 'pv-search': faMagnifyingGlass, 'pv-mobile': faMobileScreen, 'pv-qr': faQrcode, 'pv-swap': faRightLeft, 'pv-shield': faShieldHalved, 'pv-sort': faSort, 'pv-sort-down': faSortDown,
  'pv-sort-up': faSortUp, 'pv-trash': faTrash, 'pv-warn': faTriangleExclamation, 'pv-user-shield': faUserShield, 'pv-x': faXmark, 'pv-sliders': faSliders, 'pv-sitemap': faSitemap,
});
