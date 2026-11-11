import { Button, createTheme, type MantineColorsTuple } from '@mantine/core';

const brand: MantineColorsTuple = [
  '#eef5ff',
  '#dceaff',
  '#b8d4ff',
  '#8bb8ff',
  '#5a98ff',
  '#287bff',
  '#0065fc',
  '#0056db',
  '#0048b8',
  '#073d85',
];

export const deepVisorTheme = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 6 },
  // Keep the existing alias for components; semantic statuses use green/red/amber.
  colors: {
    brand,
    signal: brand,
    // Navy dark palette (matches --dv-* dark values in src/globals.css) so Mantine inputs,
    // tables and menus sit on the same surfaces as the rest of the app in dark mode.
    dark: ['#edf4ff', '#c9d4e3', '#afc1d8', '#8aa3c2', '#2a4361', '#1f3a5a', '#172e49', '#10233c', '#09172a', '#050f1d'],
    gray: ['#f7f9fd', '#eef2f8', '#dfe7f2', '#c4d0e0', '#8c9eb8', '#5f748f', '#53677d', '#405570', '#283e58', '#142a43'],
  },
  fontFamily: 'var(--font-body), Arial, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  headings: {
    fontFamily: 'var(--font-display), var(--font-body), Arial, sans-serif',
    fontWeight: '700',
  },
  defaultRadius: 'sm',
  focusRing: 'auto',
  components: {
    Button: Button.extend({
      defaultProps: {
        radius: 'sm',
      },
      // Default filled buttons use the --dv-action token (src/globals.css); an explicit color keeps its own.
      vars: (_theme, props) => (!props.color && (!props.variant || props.variant === 'filled')
        ? { root: { '--button-bg': 'var(--dv-action)', '--button-hover': 'var(--dv-action-hover)', '--button-color': 'var(--dv-action-text)' } }
        : { root: {} }),
    }),
    ActionIcon: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Card: {
      defaultProps: {
        radius: 'md',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Select: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});
