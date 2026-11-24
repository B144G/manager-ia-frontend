import { faVideo, faDisplay, faReply, faFaceSmile, faPhoneSlash, faPhone, faMicrophoneSlash, faMicrophone, faVideoSlash, faFileWord, faFileExcel, faFilePowerpoint, faFileAudio, faFileVideo, faFileImage, faFilePdf, faFile, faSquarePollVertical, faAt, faLock, faLockOpen, faUserPlus, faClockRotateLeft, faBellSlash, faCheckDouble, faCheck, faBoxArchive, faKey, faFingerprint, faLocationCrosshairs, faCalendarPlus, faStop, faPlay, faPause, faUserMinus, faCrown, faArrowDown, faPhoneVolume, faBolt, faLanguage, faListCheck, faThumbtack, faLocationDot, faMap, faUsers, faUserGroup, faEllipsisVertical, faCirclePlus, faRightFromBracket, faFolderOpen, faRobot, faEye } from '@fortawesome/free-solid-svg-icons';
import { registerIcons } from '../../../lib/fa.jsx';

/* Icônes du chat interne : ajoutées au registre unique (src/lib/fa.jsx) avec registerIcons, comme les autres modules. */
registerIcons({
  'c-video': faVideo, 'c-screen': faDisplay, 'c-reply': faReply, 'c-smile': faFaceSmile, 'c-phone-off': faPhoneSlash, 'c-phone': faPhone, 'c-mic-off': faMicrophoneSlash, 'c-mic': faMicrophone, 'c-video-off': faVideoSlash,
  'c-word': faFileWord, 'c-excel': faFileExcel, 'c-ppt': faFilePowerpoint, 'c-audio': faFileAudio, 'c-film': faFileVideo, 'c-image': faFileImage, 'c-pdf': faFilePdf, 'c-file': faFile, 'c-poll': faSquarePollVertical,
  'c-at': faAt, 'c-lock': faLock, 'c-unlock': faLockOpen, 'c-user-plus': faUserPlus, 'c-history': faClockRotateLeft, 'c-bell-off': faBellSlash, 'c-checks': faCheckDouble, 'c-check': faCheck, 'c-archive': faBoxArchive,
  'c-key': faKey, 'c-fingerprint': faFingerprint, 'c-locate': faLocationCrosshairs, 'c-cal-plus': faCalendarPlus, 'c-stop': faStop, 'c-play': faPlay, 'c-pause': faPause, 'c-user-minus': faUserMinus, 'c-crown': faCrown,
  'c-down': faArrowDown, 'c-ring': faPhoneVolume, 'c-bolt': faBolt, 'c-lang': faLanguage, 'c-tasks': faListCheck, 'c-pin': faThumbtack, 'c-pos': faLocationDot, 'c-map': faMap, 'c-users': faUsers, 'c-group': faUserGroup,
  'c-more': faEllipsisVertical, 'c-plus': faCirclePlus, 'c-leave': faRightFromBracket, 'c-folder': faFolderOpen, 'c-robot': faRobot, 'c-eye': faEye,
});
