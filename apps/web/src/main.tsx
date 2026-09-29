import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { useSession } from './store/session';
import { applyLocale, applyTheme } from './lib/i18n';
import { ApiError } from './lib/api';
import { toast } from './ui/kit';
import './styles.css';

const { theme, locale } = useSession.getState();
applyTheme(theme);
applyLocale(locale);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (n, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && n < 2,
    },
    mutations: { onError: (e: any) => e instanceof ApiError && e.details ? undefined : toast.error(e?.message || 'Something went wrong') },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Offline shell for the driver app (see public/sw.js). Registered only in production builds.
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
