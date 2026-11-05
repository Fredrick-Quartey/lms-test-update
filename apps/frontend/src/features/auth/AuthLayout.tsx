/**
 * One sign-in design for every portal (REDESIGN §6.1, D2): a centred split card, image panel on the left
 * with pill tabs that notch into the form, the form on the right. Not full screen. No Google button (F-04).
 */
import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/layout';

export interface AuthTab {
  to: string;
  label: string;
}

export function AuthLayout({ image, tagline, tabs, badge, title, subtitle, children, below, homeTo = '/' }: {
  image: 'customer' | 'staff';
  tagline: string;
  tabs: AuthTab[];
  badge: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  below?: ReactNode;
  homeTo?: string;
}) {
  return (
    <div className="min-h-dvh bg-mist bg-[radial-gradient(circle_at_1px_1px,rgb(24_70_200/.07)_1px,transparent_0)] [background-size:22px_22px]">
      <div className="mx-auto flex min-h-dvh max-w-[1000px] flex-col px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between">
          <Link to={homeTo} aria-label="Home"><Logo /></Link>
          <Link to={homeTo} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-blue hover:bg-white">
            <ArrowLeft size={16} aria-hidden /> Home
          </Link>
        </div>
        <main id="main" className="flex flex-1 items-center">
          <div className="raised grid w-full overflow-hidden rounded-[24px] bg-white md:min-h-[560px] md:grid-cols-[42%_1fr]">
            <ImagePanel image={image} tagline={tagline} tabs={tabs} />
            <div className="flex flex-col justify-center px-5 py-7 sm:px-10 md:py-10">
              {tabs.length > 1 && <MobileTabs tabs={tabs} />}
              <div className="mx-auto w-full max-w-sm">
                <div className="mb-6 text-center">
                  <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue to-aqua text-white shadow-[0_10px_24px_-10px_rgb(24_70_200/.7)]" aria-hidden>
                    {badge}
                  </span>
                  <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
                  {subtitle && <p className="mt-1 text-sm text-slate">{subtitle}</p>}
                </div>
                {children}
              </div>
            </div>
          </div>
        </main>
        {below && <div className="mx-auto mt-4 w-full max-w-[960px]">{below}</div>}
      </div>
    </div>
  );
}

/** Left panel: photo (owner-supplied, §13) with a blue overlay; until the file exists a drawn placeholder shows. */
function ImagePanel({ image, tagline, tabs }: { image: 'customer' | 'staff'; tagline: string; tabs: AuthTab[] }) {
  const [missing, setMissing] = useState(false);
  return (
    <div className="relative h-36 overflow-hidden bg-blue-dark md:h-auto">
      <Placeholder />
      {!missing && (
        <picture>
          <source srcSet={`/images/auth/${image}.webp`} type="image/webp" />
          <img
            src={`/images/auth/${image}.jpg`}
            alt=""
            width={900}
            height={1200}
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setMissing(true)}
          />
        </picture>
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-blue-dark/55 via-blue-dark/50 to-blue-dark/85" />
      <div className="relative flex h-full flex-col justify-end p-5 md:justify-between md:p-8">
        <p className="hidden max-w-[16rem] text-2xl font-bold leading-snug text-white md:block">{tagline}</p>
        <p className="text-sm font-semibold text-white md:hidden">{tagline}</p>
        {tabs.length > 0 && (
          <nav aria-label="Sign-in options" className="absolute right-0 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-3 md:flex">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end className={({ isActive }) => `relative block min-w-[8.5rem] py-3 pl-7 pr-8 text-right text-sm font-bold ${isActive ? 'rounded-l-full bg-white text-navy' : 'mr-4 rounded-full text-white/85 ring-1 ring-white/35 hover:bg-white/10 hover:text-white'}`}>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <>
                        <span aria-hidden className="absolute -top-5 right-0 h-5 w-5 bg-[radial-gradient(circle_at_0_0,transparent_19.5px,#fff_20px)]" />
                        <span aria-hidden className="absolute -bottom-5 right-0 h-5 w-5 bg-[radial-gradient(circle_at_0_100%,transparent_19.5px,#fff_20px)]" />
                      </>
                    )}
                    {t.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

function MobileTabs({ tabs }: { tabs: AuthTab[] }) {
  return (
    <nav aria-label="Sign-in options" className="mx-auto mb-6 flex w-full max-w-sm rounded-full bg-mist p-1 md:hidden">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end className={({ isActive }) => `flex-1 rounded-full py-2.5 text-center text-sm font-bold ${isActive ? 'bg-white text-navy shadow-sm' : 'text-slate'}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

/** Decorative stand-in for the photo: soft concentric arcs and bubbles in the brand blues. */
function Placeholder() {
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="ph-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1846c8" />
          <stop offset="1" stopColor="#0b1b3f" />
        </linearGradient>
      </defs>
      <rect width="400" height="600" fill="url(#ph-bg)" />
      {[260, 210, 160, 110].map((r, i) => (
        <circle key={r} cx="60" cy="430" r={r} fill="none" stroke="#19a7b8" strokeOpacity={0.18 + i * 0.08} strokeWidth="18" />
      ))}
      {[[300, 120, 26], [340, 200, 12], [250, 70, 9], [320, 300, 18], [200, 160, 7]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#ffffff" fillOpacity="0.12" stroke="#ffffff" strokeOpacity="0.35" />
      ))}
    </svg>
  );
}
