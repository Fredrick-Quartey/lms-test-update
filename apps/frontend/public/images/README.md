# Image slots

Until these files exist the pages show a neutral gradient with an icon, so nothing breaks.
Use **licensed photos only** and record each one in `docs/design/IMAGE_CREDITS.md`. Never copy images from the reference screenshots.

| Slot | Files | Export size | Weight |
|---|---|---|---|
| Home hero | `home/hero.webp`, `home/hero.jpg`, `home/hero-mobile.webp` | 1920×1080 (mobile 800×1000) | ≤ 180 KB |
| How it works | `home/step-1.webp` … `home/step-5.webp` | 600×450 | ≤ 60 KB each |
| Customer sign-in panel | `auth/customer.webp`, `auth/customer.jpg` | 900×1200 | ≤ 120 KB |
| Staff sign-in panel | `auth/staff.webp`, `auth/staff.jpg` | 900×1200 | ≤ 120 KB |
| Empty states | `empty/*.svg` | SVG | small |

When you add a photo, update its `alt` text in the component (`Home.tsx`, `AuthLayout.tsx`) to describe what it actually shows.
