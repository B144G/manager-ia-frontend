import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { StyleLayout } from './lib/styles.jsx';

// Chaque groupe de pages ne charge que son code et ses styles.
const Home = lazy(() => import('./pages/Home.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Reset = lazy(() => import('./pages/Reset.jsx'));
const ContactForm = lazy(() => import('./pages/ContactForm.jsx'));
const PublicChat = lazy(() => import('./pages/PublicChat.jsx'));
const Workspace = lazy(() => import('./ws/Workspace.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Privacy = lazy(() => import('./pages/Legal.jsx').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Legal.jsx').then((m) => ({ default: m.Terms })));

export default function App() {
  // Le programme a démarré : l'écran de secours d'index.html n'a plus lieu d'être.
  useEffect(() => { window.__miaStarted = true; const box = document.getElementById('mia-fail'); if (box) box.remove(); }, []);
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<StyleLayout group="site" body="site" />}>
          <Route path="/" element={<Home />} />
          <Route path="/confidentialite" element={<Privacy />} />
          <Route path="/conditions" element={<Terms />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route element={<StyleLayout group="auth" body="site au" mode="login" />}>
          <Route path="/connexion" element={<Login />} />
          <Route path="/connexion.html" element={<Navigate to="/connexion" replace />} />
        </Route>
        <Route element={<StyleLayout group="auth" body="site au" mode="register" />}>
          <Route path="/inscription" element={<Register />} />
          <Route path="/inscription.html" element={<Navigate to="/inscription" replace />} />
        </Route>
        <Route element={<StyleLayout group="auth" body="site au" />}>
          <Route path="/reinitialiser" element={<Reset />} />
          <Route path="/form" element={<ContactForm />} />
        </Route>
        <Route element={<StyleLayout group="ws" body="ws" />}>
          <Route path="/app/*" element={<Workspace />} />
        </Route>
        <Route element={<StyleLayout group="chat" body="" />}>
          <Route path="/chat" element={<PublicChat />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
