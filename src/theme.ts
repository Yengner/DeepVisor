import { createTheme, type MantineColorsTuple } from '@mantine/core';

const signal: MantineColorsTuple = [
  '#ecfff5',
  '#d9fbe9',
  '#aff4d0',
  '#81ecb5',
  '#59e49d',
  '#38d889',
  '#20c979',
  '#14a866',
  '#0b7a4b',
  '#075f3b',
];

export const deepVisorTheme = createTheme({
  primaryColor: 'signal',
  primaryShade: { light: 8, dark: 5 },
  colors: { signal },
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
