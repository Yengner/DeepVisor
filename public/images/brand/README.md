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
