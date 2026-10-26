import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { connect, getState, useAppState } from './data/store';
import { loadLang } from './i18n';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { ProjectPage } from './pages/project/ProjectPage';
import './styles.css';
import { tr } from './i18n';

const NewProject = lazy(() => import('./pages/NewProject'));
const Profile = lazy(() => import('./pages/Profile'));
const ForYou = lazy(() => import('./pages/ForYou'));
const Settings = lazy(() => import('./pages/Settings'));
const About = lazy(() => import('./pages/About'));
const Messages = lazy(() => import('./pages/Messages'));

function NotFound() {
  return (
    <div className="page narrow">
      <h1 className="h1">{tr('Такой страницы нет')}</h1>
      <p className="lead">{tr('Возможно, проект переименовали или ссылка устарела.')}</p>
      <p><a className="btn btn-primary" href="#/projects">{tr('Открыть каталог проектов')}</a></p>
    </div>
  );
}

/** При смене языка пересобираем интерфейс целиком — все подписи берутся заново. */
function App() {
  const lang = useAppState().lang;
  return (
    <HashRouter key={lang}>
      <Suspense fallback={<div className="page loading">{tr('Загружаем…')}</div>}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="projects" element={<Catalog />} />
            <Route path="projects/new" element={<NewProject />} />
            <Route path="p/:slug" element={<ProjectPage />} />
            <Route path="p/:slug/:tab" element={<ProjectPage />} />
            <Route path="p/:slug/:tab/:sub" element={<ProjectPage />} />
            <Route path="u/:handle" element={<Profile />} />
            <Route path="for-you" element={<ForYou />} />
            <Route path="settings" element={<Settings />} />
            <Route path="about" element={<About />} />
            <Route path="messages" element={<Messages />} />
            <Route path="messages/:handle" element={<Messages />} />
            <Route path="home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

// словарь языка и первая загрузка общей базы (не дольше 10 секунд — потом показываем, что есть)
const connected = Promise.race([connect().catch((e) => console.error(e)), new Promise((r) => setTimeout(r, 10000))]);
Promise.all([loadLang(getState().lang).catch(() => undefined), connected]).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
