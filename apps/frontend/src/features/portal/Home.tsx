/**
 * Public home page (round 2): one screen, no scrolling. A background video when one is supplied
 * (public/media/hero.mp4 / .webm, licensed: see public/media/README.md), otherwise a drawn washing-machine
 * scene. In the centre: Request laundry service, Create account, Log in.
 * NFR-U3 (3G): the video is skipped on slow connections, Data Saver and "reduce motion"; the poster or scene shows.
 * WCAG 2.2.2: one Pause button stops all movement. No prices, testimonials or invented business claims.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Pause, Play, Search } from 'lucide-react';
import { useAuth } from '@/auth/session';
import { Logo } from '@/components/layout';
import { useSettings } from '@/config/settings';
import { DrumScene } from './Scenes';

type NetInfo = { saveData?: boolean; effectiveType?: string };

function canPlayVideo() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  const c = (navigator as Navigator & { connection?: NetInfo }).connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && /(^|-)2g$|^3g$/.test(c.effectiveType)) return false;
  return true;
}

export function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const settings = useSettings();
  const isCustomer = Boolean(user?.roles.includes('CUSTOMER'));
  const bookingsOn = settings.data?.features?.bookings !== false;
  const [paused, setPaused] = useState(false);
  const [videoOk, setVideoOk] = useState(canPlayVideo);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, videoOk]);

  // A signed-in customer books straight away; anyone else creates an account first and lands on booking.
  const target = bookingsOn ? '/me/book' : '/me/orders';
  const request = () => (isCustomer ? nav(target) : nav('/signup', { state: { from: target } }));

  return (
    <div className={`relative flex min-h-dvh flex-col overflow-hidden bg-navy text-white ${paused ? 'motion-paused' : ''}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-navy">Skip to main content</a>

      {/* background: drawn scene always underneath; the video covers it once it plays */}
      <DrumScene />
      {videoOk && (
        <video
          ref={video}
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-700"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/media/hero.jpg"
          onPlaying={(e) => e.currentTarget.classList.replace('opacity-0', 'opacity-100')}
          onError={() => setVideoOk(false)}
        >
          <source src="/media/hero.webm" type="video/webm" />
          <source src="/media/hero.mp4" type="video/mp4" onError={() => setVideoOk(false)} />
        </video>
      )}
      {videoOk && <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(8_25_68/.55)_0%,rgb(6_15_38/.85)_100%)]" />}

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" aria-label="LDY Laundry home"><Logo light /></Link>
        <Link to="/track" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white/90 ring-1 ring-white/25 backdrop-blur hover:bg-white/10">
          <Search size={16} aria-hidden /> Track an order
        </Link>
      </header>

      <main id="main" className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 pt-4">
        <div className="mx-auto w-full max-w-xl text-center">
          <p className="rise-in mx-auto inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-tag" aria-hidden /> Washed, dried, ironed, delivered
          </p>
          <h1 className="font-display rise-in mt-5 text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl" style={{ animationDelay: '80ms' }}>
            Fresh clothes.
            <br />
            <span className="text-[#8fe3ec]">No queue.</span>
          </h1>
          <p className="rise-in mx-auto mt-4 max-w-md text-base text-white/85 sm:text-lg" style={{ animationDelay: '160ms' }}>
            {bookingsOn ? 'Request a pickup from home or drop off at the branch,' : 'Drop off at the branch,'} then follow every stage until your clothes are ready.
          </p>

          <div className="rise-in mx-auto mt-8 flex max-w-sm flex-col gap-3" style={{ animationDelay: '240ms' }}>
            <button
              onClick={request}
              className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-white px-6 text-lg font-bold text-navy shadow-[0_18px_40px_-16px_rgb(0_0_0/.6)] transition hover:bg-[#eaf6ff]"
            >
              {bookingsOn ? 'Request laundry service' : 'Get started'}
              <ArrowRight size={20} aria-hidden className="transition-transform group-hover:translate-x-1" />
            </button>
            {isCustomer ? (
              <Link to="/me/orders" className="inline-flex min-h-12 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/40 hover:bg-white/10">
                My orders
              </Link>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link to="/signup" className="inline-flex min-h-12 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/40 backdrop-blur hover:bg-white/10">
                  Create account
                </Link>
                <Link to="/login" className="inline-flex min-h-12 items-center justify-center rounded-full font-semibold text-white ring-1 ring-white/40 backdrop-blur hover:bg-white/10">
                  Log in
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 pb-4 text-xs text-white/65 sm:px-6">
        <span>© {new Date().getFullYear()} LDY Laundry</span>
        <span className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-white">Privacy</Link>
          <button
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 font-semibold text-white/80 ring-1 ring-white/20 hover:bg-white/10"
          >
            {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />} {paused ? 'Play' : 'Pause'} motion
          </button>
        </span>
      </footer>
    </div>
  );
}
