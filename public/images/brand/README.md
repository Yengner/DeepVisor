# DeepVisor brand assets

The supplied originals are preserved byte-for-byte in `source/`:

| Original asset | Purpose |
| --- | --- |
| `deepvisor-symbol-transparent.png` | Standalone symbol with transparency |
| `deepvisor-app-icon-light.png` | App icon on a light background |
| `deepvisor-app-icon-dark.png` | App icon on a dark background |
| `deepvisor-logo-stacked-transparent.png` | Stacked symbol and name with transparency |

The website uses these existing optimized derivatives:

- `deepvisor-wordmark-horizontal.webp`: horizontal header/sidebar wordmark.
- `deepvisor-app-icon-light-128.png`: compact UI and light-mode browser icon.
- `deepvisor-app-icon-dark-128.png`: compact UI and dark-mode browser icon.
- `deepvisor-symbol-128.webp` and `deepvisor-symbol-256.webp`: standalone symbol sizes.

Use `src/components/brand/Brand.tsx` for shared UI branding. Browser metadata is
configured in `src/app/layout.tsx`. Next.js requires the conventional filenames
`src/app/favicon.ico` and `src/app/apple-icon.png`; those remain unchanged.

This asset organization preserves the existing artwork, dimensions and transparency.

## Website palette

The supplied symbol defines the application palette: royal blue **#0065FC** for
primary actions, ocean blue **#0369CC** for secondary accents, and navy **#082D56**
for headings and dark surfaces. Midnight navy **#07182D** anchors navigation; white
and **#F4F7FC** keep the workspace readable. Soft periwinkle **#BDCEFF** highlights
dark surfaces, with quieter lavender accents around the decorative pixel companion.

Shared CSS roles live in `src/globals.css`; Mantine's matching blue ramp is in
`src/theme.ts`, with the existing `signal` name retained as a compatibility alias.
Tailwind and exported chart colors follow the same palette. Green success,
amber warnings, red errors, and third-party platform logos retain their meanings.
The pixel companion is decorative artwork, not a live-status indicator or a new
logo. Keep pixel details and the hero grid away from body copy and form surfaces.
