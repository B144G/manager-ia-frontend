import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { loadTheme } from './lib/theme.js';
import { initViewport } from './lib/viewport.js';
import { I18nProvider, initLang } from './lib/i18n.jsx';

loadTheme();
initViewport();
if (import.meta.env.DEV) window.__miaMissing = new Set();
// Le français est la langue par défaut ; le choix enregistré est rechargé avant le premier affichage.
initLang().catch(() => {}).then(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <I18nProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </I18nProvider>
    </StrictMode>,
  );
});
