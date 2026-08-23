import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { I18nProvider } from './i18n/I18n.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<ErrorBoundary><I18nProvider><App /></I18nProvider></ErrorBoundary>);
