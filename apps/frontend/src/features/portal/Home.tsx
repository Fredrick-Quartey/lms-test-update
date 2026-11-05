/**
 * Public home page (REDESIGN §5, D24). Hero photo cut by a curved wave, the service steps moving along the
 * curve (with a Pause control: WCAG 2.2.2), how it works, a track strip and a slim footer.
 * This is an internal project system: no prices, testimonials, promotions or invented business details.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bell, CalendarClock, ClipboardCheck, Menu, Pause, Play, Search, Shirt, Tag, Truck, WashingMachine, X } from 'lucide-react';
import { http, type Catalogue } from '@ldy/api-client';
import { useAuth } from '@/auth/session';
import { Logo } from '@/components/layout';
import { useSettings } from '@/config/settings';

const PHRASES = ['Drop off or book a pickup', 'Tagged at the counter', 'Washed, dried and ironed', 'Checked', "Packed and you're notified", 'Collect or get it delivered'];

const STEPS: { title: string; text: string; icon: ReactNode }[] = [
  { title: 'Book or drop off', text: 'Book a pickup from your address, or bring your laundry to the branch.', icon: <CalendarClock size={26} /> },
  { title: 'Tagged and priced', text: 'Every piece gets its own tag and the price is worked out for you.', icon: <Tag size={26} /> },
  { title: 'Washed, dried, ironed', text: 'Each stage is recorded as it happens, so nothing goes missing.', icon: <WashingMachine size={26} /> },
  { title: 'Checked and packed', text: 'Every item is checked before packing. You get a message when it is ready.', icon: <ClipboardCheck size={26} /> },
  { title: 'Collect or get it delivered', text: 'Pick it up at the counter, or a rider brings it to you.', icon: <Truck size={26} /> },
];

export function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const isCustomer = Boolean(user?.roles.includes('CUSTOMER'));
  const request = () => (isCustomer ? nav('/me/book') : nav('/signup', { state: { from: '/me/book' } }));
  return (
    <div className="min-h-dvh bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to main content</a>
      <TopBar isCustomer={isCustomer} />
      <main id="main">
        <Hero onRequest={request} />
        <HowItWorks />
        <TrackStrip />
        <Services />
      </main>
      <Footer />
    </div>
  );
}

function TopBar({ isCustomer }: { isCustomer: boolean }) {
  const [open, setOpen] = useState(false);
  const links = (
    <>
      <Link to="/track" className="rounded-full px-4 py-2 font-semibold text-navy hover:bg-mist">Track an order</Link>
      {isCustomer ? (
        <Link to="/me/orders" className="btn-primary rounded-full">My orders</Link>
      ) : (
        <>
          <Link to="/login" className="rounded-full px-4 py-2 font-semibold text-navy hover:bg-mist">Sign in</Link>
          <Link to="/signup" className="btn-primary rounded-full">Create account</Link>
        </>
      )}
    </>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="LDY home"><Logo /></Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">{links}</nav>
        <button className="btn-ghost h-11 w-11 px-0 md:hidden" aria-expanded={open} aria-controls="home-menu" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>
          {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
      </div>
      {open && (
        <nav id="home-menu" aria-label="Main" className="sheet-in grid gap-1 border-t border-line bg-white p-3 md:hidden">
          {links}
        </nav>
      )}
    </header>
  );
}

function Hero({ onRequest }: { onRequest: () => void }) {
  const [paused, setPaused] = useState(false);
  const [noImage, setNoImage] = useState(false);
  return (
    <section aria-labelledby="hero-title" className={`relative isolate overflow-hidden bg-blue-dark ${paused ? 'marquee-paused' : ''}`}>
      {/* Owner-supplied photo (§13). Until the file exists, a drawn placeholder shows. */}
      <HeroPlaceholder />
      {!noImage && (
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/home/hero-mobile.webp" type="image/webp" />
          <source srcSet="/images/home/hero.webp" type="image/webp" />
          <img src="/images/home/hero.jpg" alt="Freshly folded laundry in baskets" width={1920} height={1080} fetchPriority="high" className="absolute inset-0 -z-0 h-full w-full object-cover" onError={() => setNoImage(true)} />
        </picture>
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-navy/35 via-navy/25 to-navy/55" />

      <div className="relative mx-auto flex min-h-[540px] max-w-7xl items-center justify-center px-4 pb-32 pt-12 sm:min-h-[600px] md:pb-44">
        <div className="raised w-full max-w-xl rounded-[24px] bg-white/85 p-6 text-center backdrop-blur-md sm:p-9">
          <p className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-sky px-3 py-1 text-sm font-semibold text-blue-dark">
            <Shirt size={16} aria-hidden /> LDY laundry service
          </p>
          <h1 id="hero-title" className="text-[34px] font-bold leading-[1.1] tracking-tight text-navy sm:text-5xl">Fresh laundry, tracked tag by tag.</h1>
          <p className="mx-auto mt-4 max-w-md text-lg text-slate">Drop it off or book a pickup. Every piece gets its own tag, so you always know where it is.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={onRequest} className="btn-primary min-h-12 rounded-full px-6 text-base">
              Request laundry service <ArrowRight size={18} aria-hidden />
            </button>
            <Link to="/track" className="btn min-h-12 rounded-full px-6 text-base">
              <Search size={18} aria-hidden /> Track my order
            </Link>
          </div>
        </div>
      </div>

      <Wave paused={paused} />
      <button
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        className="absolute bottom-[4.5rem] right-3 z-10 inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-semibold text-navy shadow-sm hover:bg-white md:bottom-[150px] md:right-6"
      >
        {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
        {paused ? 'Play moving text' : 'Pause moving text'}
      </button>
    </section>
  );
}

/** The curved divider with the service steps moving along it. */
function Wave({ paused }: { paused: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const measure = useRef<SVGTextElement>(null);
  const [unit, setUnit] = useState(0);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const block = PHRASES.join('   •   ') + '   •   ';
  useEffect(() => {
    const len = measure.current?.getComputedTextLength?.() ?? 0;
    if (len > 0) setUnit(len);
  }, []);
  useEffect(() => {
    const s = svg.current;
    if (!s?.pauseAnimations) return;
    if (paused) s.pauseAnimations();
    else s.unpauseAnimations();
  }, [paused]);
  const curve = 'M0,118 C240,40 480,40 720,96 C960,152 1200,152 1440,82';
  return (
    <>
      <svg ref={svg} aria-hidden viewBox="0 0 1440 220" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 hidden h-[200px] w-full md:block">
        <path d={`${curve} L1440,220 L0,220 Z`} fill="#ffffff" />
        <path d={curve} fill="none" stroke="#19a7b8" strokeOpacity=".5" strokeWidth="2" transform="translate(0,-14)" />
        <path id="wave-text-path" d={curve} fill="none" transform="translate(0,-26)" />
        <text ref={measure} x="-9999" y="-9999" fontSize="22" fontWeight="700">{block}</text>
        <text fontSize="22" fontWeight="700" fill="#ffffff" style={{ paintOrder: 'stroke' }} stroke="#0b1b3f" strokeOpacity=".25" strokeWidth="3">
          <textPath href="#wave-text-path" startOffset="0">
            {block.repeat(6)}
            {!reduce && unit > 0 && <animate attributeName="startOffset" values={`0;-${unit}`} dur="40s" repeatCount="indefinite" />}
          </textPath>
        </text>
      </svg>
      {/* Narrow screens: the same words as a band hugging the curve */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 md:hidden">
        <svg viewBox="0 0 360 60" preserveAspectRatio="none" className="block h-14 w-full">
          <path d="M0,36 C90,8 180,10 260,30 C300,40 330,40 360,30 L360,60 L0,60 Z" fill="#ffffff" />
        </svg>
        <div className="overflow-hidden bg-white pb-2">
          <div className="marquee-track flex w-max whitespace-nowrap text-sm font-bold text-blue-dark" style={reduce ? { animation: 'none' } : undefined}>
            {[0, 1].map((k) => (
              <span key={k} className="flex">
                {PHRASES.map((p) => (
                  <span key={p} className="flex items-center gap-3 px-3">
                    <Tag size={14} className="text-aqua" /> {p}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function HeroPlaceholder() {
  return (
    <svg aria-hidden className="absolute inset-0 -z-0 h-full w-full" viewBox="0 0 1440 700" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="hero-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a5be0" />
          <stop offset="0.55" stopColor="#1846c8" />
          <stop offset="1" stopColor="#0f2f8f" />
        </linearGradient>
        <radialGradient id="hero-glow" cx="0.75" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#19a7b8" stopOpacity=".55" />
          <stop offset="1" stopColor="#19a7b8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="700" fill="url(#hero-bg)" />
      <rect width="1440" height="700" fill="url(#hero-glow)" />
      {/* folded towel stacks */}
      {[[120, 360], [1160, 330], [1270, 410]].map(([x, y], s) => (
        <g key={s} transform={`translate(${x},${y})`} opacity=".9">
          {['#f2c94c', '#ffffff', '#9fd8df', '#ffffff', '#c9d8ff'].slice(0, 4 + (s % 2)).map((c, i) => (
            <rect key={i} x={i % 2 ? 6 : 0} y={-i * 34} width="150" height="30" rx="14" fill={c} opacity={0.85 - i * 0.08} />
          ))}
        </g>
      ))}
      {Array.from({ length: 18 }).map((_, i) => {
        const x = (i * 211) % 1440;
        const y = 60 + ((i * 137) % 420);
        const r = 6 + ((i * 7) % 22);
        return <circle key={i} cx={x} cy={y} r={r} fill="#ffffff" fillOpacity=".1" stroke="#ffffff" strokeOpacity=".35" />;
      })}
    </svg>
  );
}

function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-12">
      <h2 id="how-title" className="text-center text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-lg text-slate">From your door to clean and folded, in five steps you can follow.</p>
      {/* Desktop: horizontal stepper. Phone: vertical timeline. */}
      <ol className="mt-12 grid gap-0 md:grid-cols-5 md:gap-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative flex gap-4 pb-8 md:flex-col md:items-center md:pb-0 md:text-center">
            {i < STEPS.length - 1 && (
              <>
                <span aria-hidden className="absolute left-7 top-14 h-[calc(100%-3.5rem)] w-0.5 bg-line md:hidden" />
                <span aria-hidden className="absolute left-[calc(50%+2.25rem)] top-7 hidden h-0.5 w-[calc(100%-4.5rem+1rem)] bg-[repeating-linear-gradient(90deg,#dce3f0_0_8px,transparent_8px_14px)] md:block" />
              </>
            )}
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-sky text-blue" aria-hidden>
              {s.icon}
              <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue text-xs font-bold text-white">{i + 1}</span>
            </span>
            <span className="md:mt-4">
              <span className="block text-lg font-bold">{s.title}</span>
              <span className="mt-1 block text-slate">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mx-auto mt-12 flex max-w-2xl items-center gap-3 rounded-[16px] bg-mist p-4 text-sm text-slate">
        <Bell size={20} aria-hidden className="shrink-0 text-blue" />
        You get a message when your order is received, when it is ready, and when it is on its way.
      </div>
    </section>
  );
}

function TrackStrip() {
  const nav = useNavigate();
  const [no, setNo] = useState('');
  return (
    <section aria-labelledby="track-title" className="bg-blue px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 md:flex-row md:justify-between">
        <div className="text-center md:text-left">
          <h2 id="track-title" className="text-2xl font-bold text-white">Where's my laundry?</h2>
          <p className="text-white/85">Enter the order number from your receipt.</p>
        </div>
        <form className="flex w-full max-w-md gap-2" onSubmit={(e) => { e.preventDefault(); if (no.trim()) nav(`/track?order=${encodeURIComponent(no.trim().toUpperCase())}`); }}>
          <label htmlFor="home-track" className="sr-only">Order number</label>
          <input id="home-track" className="input min-h-12 rounded-full border-0 uppercase" placeholder="LDY-000012" value={no} onChange={(e) => setNo(e.target.value)} />
          <button className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-white px-5 font-bold text-blue-dark hover:bg-sky">Track</button>
        </form>
      </div>
    </section>
  );
}

function Services() {
  const q = useQuery({ queryKey: ['catalogue', 'public'], queryFn: () => http.get<Catalogue>('/public/catalogue'), staleTime: 300_000 });
  const list = q.data?.serviceTypes.filter((s) => s.active) ?? [];
  if (!list.length) return null;
  return (
    <section aria-labelledby="services-title" className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6">
      <h2 id="services-title" className="text-lg font-bold">Services</h2>
      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {list.map((s) => (
          <li key={s.id} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">{s.name}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-slate">Prices are confirmed when your items are counted.</p>
    </section>
  );
}

function Footer() {
  const settings = useSettings();
  return (
    <footer className="bg-blue-dark px-4 py-10 text-white/85 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <Logo light />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to="/track" className="hover:text-white">Track an order</Link>
          <Link to="/login" className="hover:text-white">Sign in</Link>
          <Link to="/signup" className="hover:text-white">Create account</Link>
          <Link to="/staff/login" className="hover:text-white">Staff sign-in</Link>
          <Link to="/privacy" className="hover:text-white">Privacy notice</Link>
        </nav>
        <p className="text-sm">© LDY{settings.data?.organisation?.name ? `. ${settings.data.organisation.name}` : ''}</p>
      </div>
    </footer>
  );
}
