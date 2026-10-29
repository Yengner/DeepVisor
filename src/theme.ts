import { createTheme, type MantineColorsTuple } from '@mantine/core';

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
    Button: {
      defaultProps: {
        radius: 'sm',
      },
    },
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
