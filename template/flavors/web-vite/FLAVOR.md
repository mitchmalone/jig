# web-vite

Vite + React product web app at `apps/web`. Deliberately bare — add shadcn (`pnpm dlx shadcn@latest init`), TanStack Router/Query, and Tailwind when the product needs them. Apps with an admin panel start from [shadcn-admin](https://github.com/satnaing/shadcn-admin) instead of this seed: replace `apps/web` with it, prune its upstream cruft (changelog, license, deploy configs), and let it keep its own eslint config. Talks to the API via same-origin `/api/*`; the browser never touches the database.
