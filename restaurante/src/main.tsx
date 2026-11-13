import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App';
import { ouvirToqueNativo, registrarServiceWorker } from './lib/push';

registrarServiceWorker();
ouvirToqueNativo();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
