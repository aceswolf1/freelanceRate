import { definePreset } from '@primeuix/themes'
import Material from '@primeuix/themes/material'

import { radii, red, violet, zinc } from './tokens'

/**
 * PrimeVue preset built on the Material base, re-tokenised from DESIGN.md.
 *
 * DESIGN.md rules honoured here:
 * - primary = soft violet, used only for interactive elements / focus rings
 * - tertiary (emerald) carries success and positive money figures
 * - error red for errors only, never decoration
 * - 8px radius on cards and inputs
 * - separation by `outline-variant` borders rather than heavy shadows
 * - focus ring: 2px solid violet, 2px offset
 */
const BillFlowPreset = definePreset(Material, {
  primitive: {
    // DESIGN.md: cards and inputs use an 8px radius.
    borderRadius: { ...radii },
  },

  semantic: {
    primary: { ...violet },

    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{violet.400}',
      offset: '2px',
      shadow: 'none',
    },

    colorScheme: {
      light: {
        surface: { ...zinc },

        primary: {
          color: violet[600],
          contrastColor: '#ffffff',
          hoverColor: violet[700],
          activeColor: violet[800],
        },

        highlight: {
          background: `${violet[600]}1f`,
          focusBackground: `${violet[600]}33`,
          color: violet[700],
          focusColor: violet[700],
        },

        text: {
          color: zinc[900],
          hoverColor: zinc[800],
          mutedColor: zinc[500],
          hoverMutedColor: zinc[600],
        },

        content: {
          background: '#ffffff',
          hoverBackground: zinc[50],
          borderColor: zinc[200],
          color: zinc[900],
          hoverColor: zinc[800],
        },

        overlay: {
          select: {
            borderRadius: radii.md,
            shadow: '0 1px 8px rgba(0, 0, 0, 0.08)',
            background: '#ffffff',
            borderColor: zinc[200],
            color: zinc[900],
          },
          popover: {
            borderRadius: radii.md,
            padding: '0.5rem',
            shadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            background: '#ffffff',
            borderColor: zinc[200],
            color: zinc[900],
          },
          modal: {
            borderRadius: radii.lg,
            padding: '1.25rem',
            shadow: '0 24px 48px rgba(0, 0, 0, 0.16)',
            background: zinc[50],
            borderColor: zinc[200],
            color: zinc[900],
          },
        },

        formField: {
          fontSize: '0.8125rem',
          paddingX: '0.75rem',
          paddingY: '0.5rem',
          borderRadius: radii.md,
          background: zinc[50],
          disabledBackground: zinc[100],
          filledBackground: zinc[50],
          filledHoverBackground: zinc[100],
          filledFocusBackground: '#ffffff',
          borderColor: zinc[200],
          hoverBorderColor: zinc[300],
          focusBorderColor: violet[600],
          invalidBorderColor: red[600],
          color: zinc[900],
          disabledColor: zinc[400],
          placeholderColor: zinc[400],
          invalidPlaceholderColor: red[400],
          iconColor: zinc[500],
          shadow: 'none',
        },

        list: {
          option: { selectedBackground: zinc[200], selectedColor: zinc[900] },
        },
      },

      dark: {
        surface: { ...zinc },

        primary: {
          color: violet[400],
          contrastColor: '#0a0012',
          hoverColor: violet[300],
          activeColor: violet[500],
        },

        highlight: {
          background: `${violet[400]}29`,
          focusBackground: `${violet[400]}3d`,
          color: violet[300],
          focusColor: violet[200],
        },

        text: {
          color: '#fafafa',
          hoverColor: '#ffffff',
          mutedColor: zinc[400],
          hoverMutedColor: zinc[300],
        },

        content: {
          background: zinc[900],
          hoverBackground: zinc[800],
          borderColor: zinc[800],
          color: '#fafafa',
          hoverColor: '#ffffff',
        },

        overlay: {
          select: {
            borderRadius: radii.md,
            shadow: '0 1px 8px rgba(0, 0, 0, 0.4)',
            background: zinc[900],
            borderColor: zinc[800],
            color: '#fafafa',
          },
          popover: {
            borderRadius: radii.md,
            padding: '0.5rem',
            shadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            background: zinc[900],
            borderColor: zinc[800],
            color: '#fafafa',
          },
          modal: {
            borderRadius: radii.lg,
            padding: '1.25rem',
            shadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
            background: zinc[950],
            borderColor: zinc[800],
            color: '#fafafa',
          },
        },

        formField: {
          fontSize: '0.8125rem',
          paddingX: '0.75rem',
          paddingY: '0.5rem',
          borderRadius: radii.md,
          background: '#0f0f12',
          disabledBackground: zinc[900],
          filledBackground: '#0f0f12',
          filledHoverBackground: zinc[800],
          filledFocusBackground: zinc[900],
          borderColor: zinc[800],
          hoverBorderColor: zinc[700],
          focusBorderColor: violet[400],
          invalidBorderColor: red[500],
          color: '#fafafa',
          disabledColor: zinc[600],
          placeholderColor: zinc[500],
          invalidPlaceholderColor: red[400],
          iconColor: zinc[400],
          shadow: 'none',
        },

        list: {
          option: { selectedBackground: zinc[800], selectedColor: '#fafafa' },
        },
      },
    },
  },
})

export default BillFlowPreset