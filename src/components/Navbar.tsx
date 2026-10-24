import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { GraduationCap, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import type { UserRole } from '../types/lab';
import { clerkAfterSignOutUrl, useSession } from '../lib/auth';
import { getInitials } from '../lib/format';
import { BrandMark } from './BrandMark';

function RoleBadge({ role }: { role: UserRole }) {
  const isCustodian = role === 'custodian';

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
        isCustodian
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {isCustodian ? (
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
      ) : (
        <GraduationCap className="h-3 w-3" aria-hidden="true" />
      )}
      {isCustodian ? 'Laboratory Custodian' : 'Student / Faculty Borrower'}
    </span>
  );
}

function ClerkAuthControls() {
  const { ready, user } = useSession();

  if (!ready) {
    return <div className="skeleton h-8 w-20" aria-label="Loading account" />;
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs sm:text-sm">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <div className="hidden items-center gap-2 sm:flex">
          <p className="max-w-[130px] truncate text-xs font-medium text-slate-800">
            {user?.fullName ?? 'Laboratory user'}
          </p>
          {user ? <RoleBadge role={user.role} /> : null}
        </div>
        <UserButton afterSignOutUrl={clerkAfterSignOutUrl} />
      </SignedIn>
    </>
  );
}

function DemoAuthControls() {
  const { user, signIn, signOut } = useSession();

  if (!user) {
    return (
      <button
        type="button"
        onClick={signIn}
        className="btn-secondary px-3 py-1.5 text-xs sm:text-sm"
        title="Sign in with the built-in demo identity"
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Demo sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white"
        aria-hidden="true"
      >
        {getInitials(user.fullName)}
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <p className="max-w-[130px] truncate text-xs font-medium text-slate-800">
          {user.fullName}
        </p>
        <RoleBadge role={user.role} />
      </div>
      <button
        type="button"
        onClick={signOut}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
        aria-label="Sign out of demo account"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Navbar() {
  const { authMode, user } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="h-8 w-8 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight tracking-tight text-slate-900">
              ReserveLab
            </p>
            <p className="text-[10px] leading-tight text-slate-500">
              Equipment reservations
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {authMode === 'clerk' ? <ClerkAuthControls /> : <DemoAuthControls />}
        </div>

        {user ? (
          <div className="order-3 flex w-full items-center justify-end gap-2 sm:hidden">
            <p className="max-w-[130px] truncate text-xs font-medium text-slate-700">
              {user.fullName}
            </p>
            <RoleBadge role={user.role} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
