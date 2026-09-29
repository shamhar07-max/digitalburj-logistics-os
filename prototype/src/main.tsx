import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against third-party extension injection failures (MetaMask, web3 wallets, etc.)
if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const msg = event?.message || event?.error?.message || '';
      if (
        typeof msg === 'string' &&
        (msg.includes('MetaMask') ||
          msg.includes('ethereum') ||
          msg.includes('web3') ||
          msg.includes('chrome-extension://'))
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return true;
      }
    },
    true
  );

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason?.message || String(event?.reason || '');
    if (
      typeof reason === 'string' &&
      (reason.includes('MetaMask') ||
        reason.includes('ethereum') ||
        reason.includes('web3') ||
        reason.includes('chrome-extension://'))
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
