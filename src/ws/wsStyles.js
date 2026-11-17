// Feuilles de style propres à l'espace de travail : chargées avec lui (et non avec le premier écran), puis retirées en le quittant.
import ui from '../styles/ui.css?inline';
import ws from '../styles/ws.css?inline';
import wsPlus from '../styles/ws-plus.css?inline';
import wsGuide from '../styles/ws-guide.css?inline';
import wsAifollow from '../styles/ws-aifollow.css?inline';
import composer from '../styles/composer.css?inline';
import wsResponsive from '../styles/responsive.css?inline';
import wsPro from '../styles/ws-pro.css?inline';
import charts from '../styles/charts.css?inline';
import shell from '../styles/shell.css?inline';

export default [ui, ws, wsPlus, wsGuide, wsAifollow, composer, wsResponsive, wsPro, charts, shell];
