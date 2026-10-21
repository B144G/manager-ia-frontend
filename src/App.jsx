import { lazy, Suspense } from 'react';
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

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<StyleLayout group="site" body="site" />}>
          <Route path="/" element={<Home />} />
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
