import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store/StoreContext';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Не найден корневой элемент');

createRoot(container).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
