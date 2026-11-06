/**
 * One sign-in design for every portal (round 2): a box split in two. Left: a picture with a light sweeping
 * across it (a licensed photo from public/images/auth/ when supplied, otherwise a drawn scene). Right: the form.
 * Customers and staff get different pictures so each can tell at a glance whose page it is.
 * On phones the picture becomes a short banner above the form. No Google button (F-04).
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/layout';
import { MachinesScene, RailScene } from '@/features/portal/Scenes';

export function AuthLayout({ image, tagline, kicker, title, subtitle, children, below, homeTo = '/', homeLabel = 'Home' }: {
  image: 'customer' | 'staff';
  tagline: string;
  kicker?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  below?: ReactNode;
  homeTo?: string;
  homeLabel?: string;
}) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(90%_60%_at_100%_0%,#dfe9ff_0%,transparent_60%),radial-gradient(70%_60%_at_0%_100%,#e2f6f8_0%,transparent_55%)] bg-mist">
      <div className="mx-auto flex min-h-dvh max-w-[1040px] flex-col px-4 py-4 sm:px-6 sm:py-8">
        <main id="main" className="flex flex-1 items-center">
          <div className="grid w-full overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-40px_rgb(11_27_63/.45),0_2px_8px_-2px_rgb(11_27_63/.08)] md:min-h-[600px] md:grid-cols-[46%_1fr]">
            <Picture image={image} tagline={tagline} kicker={kicker ?? (image === 'staff' ? 'Staff portal' : 'For customers')} />
            <div className="flex flex-col px-5 pb-8 pt-5 sm:px-10 md:py-8">
              <div className="flex items-center justify-between">
                <Link to={homeTo} aria-label="LDY Laundry home" className="md:invisible"><Logo /></Link>
                <Link to={homeTo} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-slate hover:bg-mist hover:text-navy">
                  <ArrowLeft size={16} aria-hidden /> {homeLabel}
                </Link>
              </div>
              <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-6">
                <h1 className="font-display rise-in text-[2rem] font-extrabold leading-tight text-navy">{title}</h1>
                {subtitle && <p className="rise-in mt-2 text-slate" style={{ animationDelay: '60ms' }}>{subtitle}</p>}
                <div className="rise-in mt-7" style={{ animationDelay: '120ms' }}>{children}</div>
              </div>
            </div>
          </div>
        </main>
        {below && <div className="mx-auto mt-4 w-full max-w-[1000px]">{below}</div>}
      </div>
    </div>
  );
}

function Picture({ image, tagline, kicker }: { image: 'customer' | 'staff'; tagline: string; kicker: string }) {
  const [photo, setPhoto] = useState(true);
  return (
    <div className="sweep relative h-40 bg-blue-dark sm:h-48 md:h-auto">
      {image === 'staff' ? <MachinesScene /> : <RailScene />}
      {photo && (
        <picture>
          <source srcSet={`/images/auth/${image}.webp`} type="image/webp" />
          <img src={`/images/auth/${image}.jpg`} alt="" width={900} height={1200} className="drift absolute inset-0 h-full w-full object-cover" onError={() => setPhoto(false)} />
        </picture>
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#06102a]/90 via-[#06102a]/25 to-transparent" />
      <div className="relative z-[3] flex h-full flex-col justify-between p-5 md:p-9">
        <Link to="/" aria-label="LDY Laundry home" className="hidden md:block"><Logo light /></Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8fe3ec]">{kicker}</p>
          <p className="font-display mt-1 max-w-[18rem] text-xl font-extrabold leading-snug text-white md:mt-3 md:text-[1.9rem]">{tagline}</p>
        </div>
      </div>
    </div>
  );
}
