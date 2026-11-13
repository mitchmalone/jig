# www-next

Static-first Next.js marketing/public site at `apps/www`. `output: 'export'` — fully prerendered, no server surface. Step up to dynamic rendering only when the site genuinely needs it, and record it in `DEVIATIONS.md`.

Deploy: its own Vercel project with Root Directory `apps/www` (the app project owns the repo root). `apps/www/vercel.json` carries the Ignored Build Step, so the site only rebuilds when `apps/www` or the lockfile changed.

Optional conventions for designed sites: **design tokens only** (colors come from the CSS vars in `globals.css`); the design source of truth is a named design project whose id is recorded in `AGENTS.md`, and visual changes round-trip through it. Sanctioned exception: a component may hard-code a palette when it deliberately renders a fixed artifact (e.g. a screenshot-like demo panel identical in both themes).
