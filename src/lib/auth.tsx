import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/clerk-react';
import { GraduationCap } from 'lucide-react';
import type { AuthUser, UserRole } from '../types/lab';
import { Modal } from '../components/ui/Modal';

export const clerkPublishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim();

/** A publishable key is the only requirement for enabling real Clerk auth. */
export const isClerkConfigured =
  clerkPublishableKey.startsWith('pk_') &&
  clerkPublishableKey.length > 30 &&
  !clerkPublishableKey.toLowerCase().includes('your_') &&
  !clerkPublishableKey.toLowerCase().includes('placeholder');

export type AuthMode = 'clerk' | 'demo';

interface AuthContextValue {
  ready: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
  authMode: AuthMode;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useSession must be used inside an authentication provider.');
  }
  return context;
}

/* -------------------------------------------------------------------------- */
/*                              Clerk-backed auth                             */
/* -------------------------------------------------------------------------- */

interface ProviderProps {
  children: ReactNode;
}

function normalizeClerkRole(value: unknown): UserRole {
  if (value === 'custodian') return 'custodian';
  if (value === 'faculty') return 'faculty';
  return 'student';
}

export function ClerkAuthProvider({ children }: ProviderProps) {
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const mappedUser = useMemo<AuthUser | null>(() => {
    if (!isSignedIn || !userId) return null;

    const email = user?.primaryEmailAddress?.emailAddress ?? '';
    const metadataRole = user?.publicMetadata?.role;
    const fallbackName = email ? email.split('@')[0] : 'Laboratory User';

    return {
      id: userId,
      fullName: user?.fullName || user?.username || fallbackName,
      email,
      role: normalizeClerkRole(metadataRole),
      avatarUrl: user?.imageUrl,
      isClerkUser: true,
    };
  }, [isSignedIn, userId, user]);

  const signIn = useCallback(() => {
    void clerk.openSignIn();
  }, [clerk]);

  const signOut = useCallback(() => {
    void clerk.signOut();
  }, [clerk]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: isLoaded,
      isSignedIn: Boolean(mappedUser),
      user: mappedUser,
      authMode: 'clerk',
      signIn,
      signOut,
    }),
    [isLoaded, mappedUser, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* -------------------------------------------------------------------------- */
/*                               Demo fallback                                */
/* -------------------------------------------------------------------------- */

const DEMO_SESSION_KEY = 'lers.demo-session.v1';
const DEMO_PROFILE_KEY = 'lers.demo-profile.v1';

const DEFAULT_DEMO_PROFILE: AuthUser = {
  id: 'demo-user',
  fullName: 'Rico Alipit',
  email: 'rico.alipit@university.edu',
  role: 'student',
};

function readStoredDemoUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.fullName === 'string' &&
      typeof parsed.email === 'string' &&
      (parsed.role === 'student' || parsed.role === 'faculty' || parsed.role === 'custodian')
    ) {
      return { ...parsed, id: parsed.id, fullName: parsed.fullName, email: parsed.email, role: parsed.role };
    }
  } catch {
    // Corrupt or unavailable storage: start signed out.
  }
  return null;
}

function readStoredDemoProfile(): AuthUser {
  const sessionUser = readStoredDemoUser();
  if (sessionUser) return sessionUser;

  try {
    const raw = window.localStorage.getItem(DEMO_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AuthUser>;
      if (
        typeof parsed.fullName === 'string' &&
        typeof parsed.email === 'string' &&
        (parsed.role === 'student' || parsed.role === 'faculty')
      ) {
        return { ...DEFAULT_DEMO_PROFILE, ...parsed } as AuthUser;
      }
    }
  } catch {
    // Use the default profile.
  }

  return DEFAULT_DEMO_PROFILE;
}

interface DemoSignInDialogProps {
  open: boolean;
  initialProfile: AuthUser;
  onClose: () => void;
  onSubmit: (user: AuthUser) => void;
}

function DemoSignInDialog({ open, initialProfile, onClose, onSubmit }: DemoSignInDialogProps) {
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [email, setEmail] = useState(initialProfile.email);
  const [role, setRole] = useState<'student' | 'faculty'>(
    initialProfile.role === 'faculty' ? 'faculty' : 'student',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName(initialProfile.fullName);
    setEmail(initialProfile.email);
    setRole(initialProfile.role === 'faculty' ? 'faculty' : 'student');
    setError(null);
  }, [open, initialProfile]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    onSubmit({
      id: `demo-${normalizedEmail}`,
      fullName: trimmedName,
      email: normalizedEmail,
      role,
      isClerkUser: false,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sign in to your lab account"
      description="Clerk is not configured, so this demo uses a local identity. No password is required."
      icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
      iconTone="emerald"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="demo-full-name" className="field-label">
            Full name
          </label>
          <input
            id="demo-full-name"
            className="field-input"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setError(null);
            }}
            placeholder="e.g., Rico Alipit"
            autoComplete="name"
            autoFocus
            required
          />
        </div>

        <div>
          <label htmlFor="demo-email" className="field-label">
            Email address
          </label>
          <input
            id="demo-email"
            type="email"
            className="field-input"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
            placeholder="name@university.edu"
            autoComplete="email"
            required
          />
        </div>

        <fieldset>
          <legend className="field-label">Borrower type</legend>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(['student', 'faculty'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setRole(option);
                  setError(null);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
                  role === option
                    ? 'bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}

        <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">
          Custodian tools are available through the Demo view switch after signing in.
        </p>

        <button type="submit" className="btn-primary w-full">
          Continue as demo user
        </button>
      </form>
    </Modal>
  );
}

export function DemoAuthProvider({ children }: ProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredDemoUser());
  const [loginOpen, setLoginOpen] = useState(false);
  const [initialProfile, setInitialProfile] = useState<AuthUser>(() => readStoredDemoProfile());

  const signIn = useCallback(() => {
    if (user) return;
    setInitialProfile(readStoredDemoProfile());
    setLoginOpen(true);
  }, [user]);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }, []);

  const handleDemoLogin = useCallback((nextUser: AuthUser) => {
    setUser(nextUser);
    setLoginOpen(false);
    try {
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(nextUser));
      window.localStorage.setItem(
        DEMO_PROFILE_KEY,
        JSON.stringify({
          fullName: nextUser.fullName,
          email: nextUser.email,
          role: nextUser.role,
        }),
      );
    } catch {
      // The session remains active in memory even when storage is blocked.
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: true,
      isSignedIn: Boolean(user),
      user,
      authMode: 'demo',
      signIn,
      signOut,
    }),
    [user, signIn, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <DemoSignInDialog
        open={loginOpen}
        initialProfile={initialProfile}
        onClose={() => setLoginOpen(false)}
        onSubmit={handleDemoLogin}
      />
    </AuthContext.Provider>
  );
}

/** Small helper used by Clerk's UserButton to keep sign-out routing consistent. */
export const clerkAfterSignOutUrl = (import.meta.env.VITE_CLERK_AFTER_SIGN_OUT_URL ?? '').trim() || '/';
