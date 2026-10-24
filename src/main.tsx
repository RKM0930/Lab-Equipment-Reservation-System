import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import { ENV } from './config/env';
import {
  ClerkAuthProvider,
  DemoAuthProvider,
  clerkAfterSignOutUrl,
  isClerkConfigured,
} from './lib/auth';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    {isClerkConfigured ? (
      <ClerkProvider
        publishableKey={ENV.CLERK_PUBLISHABLE_KEY}
        afterSignOutUrl={clerkAfterSignOutUrl}
      >
        <ClerkAuthProvider>
          <App />
        </ClerkAuthProvider>
      </ClerkProvider>
    ) : (
      <DemoAuthProvider>
        <App />
      </DemoAuthProvider>
    )}
  </StrictMode>,
);
