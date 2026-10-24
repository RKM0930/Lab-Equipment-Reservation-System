import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import {
  ClerkAuthProvider,
  DemoAuthProvider,
  clerkAfterSignOutUrl,
  clerkPublishableKey,
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
        publishableKey={clerkPublishableKey}
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
