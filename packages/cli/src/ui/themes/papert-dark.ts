/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { darkSemanticColors } from './semantic-tokens.js';

const papertDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#0b0e14',
  Foreground: '#bfbdb6',
  LightBlue: '#59C2FF',
  AccentBlue: '#39BAE6',
  AccentPurple: '#D2A6FF',
  AccentCyan: '#95E6CB',
  AccentGreen: '#AAD94C',
  AccentYellow: '#FFD700',
  AccentRed: '#F26D78',
  DiffAdded: '#AAD94C',
  DiffRemoved: '#F26D78',
  Comment: '#646A71',
  Gray: '#3D4149',
  GradientColors: ['#FFD700', '#da7959'],
};

export const PapertDark: Theme = new Theme(
  'Papert Dark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: papertDarkColors.Background,
      color: papertDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: papertDarkColors.AccentYellow,
    },
    'hljs-literal': {
      color: papertDarkColors.AccentPurple,
    },
    'hljs-symbol': {
      color: papertDarkColors.AccentCyan,
    },
    'hljs-name': {
      color: papertDarkColors.LightBlue,
    },
    'hljs-link': {
      color: papertDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: papertDarkColors.AccentYellow,
    },
    'hljs-subst': {
      color: papertDarkColors.Foreground,
    },
    'hljs-string': {
      color: papertDarkColors.AccentGreen,
    },
    'hljs-title': {
      color: papertDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: papertDarkColors.AccentBlue,
    },
    'hljs-attribute': {
      color: papertDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: papertDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: papertDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: papertDarkColors.Foreground,
    },
    'hljs-template-tag': {
      color: papertDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: papertDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: papertDarkColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: papertDarkColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: papertDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: papertDarkColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  papertDarkColors,
  darkSemanticColors,
);
