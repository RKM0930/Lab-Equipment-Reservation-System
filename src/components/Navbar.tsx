import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { FlaskConical, GraduationCap, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import type { UserRole } from '../types/lab';
import { clerkAfterSignOutUrl, useSession } from '../lib/auth';
import { getInitials, roleLabel } from '../lib/format';

interface NavbarProps {
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

function RoleSwitcher({ activeRole, onRoleChange }: NavbarProps) {
  const { user } = useSession();
  const borrowerRole: UserRole = user?.role === 'faculty' ? 'faculty' : 'student';
  const isCustodian = activeRole === 'custodian';

  return (
    <div className="flex items-center gap-2" aria-label="Demo view switcher">
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 min-[360px]:inline">
        Demo view
      </span>
      <div
        className="flex items-center rounded-lg bg-slate-100 p-0.5"
        role="group"
        aria-label="Demo view"
      >
        <button
          type="button"
          onClick={() => onRoleChange(borrowerRole)}
          aria-pressed={!isCustodian}
          aria-label="Demo View: Student/Faculty"
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            !isCustodian
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Student/Faculty</span>
        </button>
        <button
          type="button"
          onClick={() => onRoleChange('custodian')}
          aria-pressed={isCustodian}
          aria-label="Demo View: Custodian"
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            isCustodian
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Custodian</span>
        </button>
      </div>
    </div>
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
        <div className="hidden text-right md:block">
          <p className="max-w-[150px] truncate text-xs font-medium text-slate-800">
            {user?.fullName ?? 'Laboratory user'}
          </p>
          <p className="text-[10px] text-slate-500">{user ? roleLabel(user.role) : ''}</p>
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
      <div className="hidden max-w-[150px] text-left sm:block">
        <p className="truncate text-xs font-medium text-slate-800">{user.fullName}</p>
        <p className="truncate text-[10px] text-slate-500">{roleLabel(user.role)}</p>
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

export function Navbar({ activeRole, onRoleChange }: NavbarProps) {
  const { authMode } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight tracking-tight text-slate-900">
              Lab Equipment
            </p>
            <p className="text-[10px] leading-tight text-slate-500">Reservation system</p>
          </div>
        </div>

        <div className="order-3 w-full sm:order-none sm:ml-auto sm:w-auto">
          <RoleSwitcher activeRole={activeRole} onRoleChange={onRoleChange} />
        </div>

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {authMode === 'clerk' ? <ClerkAuthControls /> : <DemoAuthControls />}
        </div>
      </div>
    </header>
  );
}
