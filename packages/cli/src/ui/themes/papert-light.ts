/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';

const papertLightColors: ColorsTheme = {
  type: 'light',
  Background: '#f8f9fa',
  Foreground: '#5c6166',
  LightBlue: '#55b4d4',
  AccentBlue: '#399ee6',
  AccentPurple: '#a37acc',
  AccentCyan: '#4cbf99',
  AccentGreen: '#86b300',
  AccentYellow: '#f2ae49',
  AccentRed: '#f07171',
  DiffAdded: '#86b300',
  DiffRemoved: '#f07171',
  Comment: '#ABADB1',
  Gray: '#CCCFD3',
  GradientColors: ['#65a30d', '#059669'],
};

export const PapertLight: Theme = new Theme(
  'Papert Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: papertLightColors.Background,
      color: papertLightColors.Foreground,
    },
    'hljs-comment': {
      color: papertLightColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: papertLightColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-string': {
      color: papertLightColors.AccentGreen,
    },
    'hljs-constant': {
      color: papertLightColors.AccentCyan,
    },
    'hljs-number': {
      color: papertLightColors.AccentPurple,
    },
    'hljs-keyword': {
      color: papertLightColors.AccentYellow,
    },
    'hljs-selector-tag': {
      color: papertLightColors.AccentYellow,
    },
    'hljs-attribute': {
      color: papertLightColors.AccentYellow,
    },
    'hljs-variable': {
      color: papertLightColors.Foreground,
    },
    'hljs-variable.language': {
      color: papertLightColors.LightBlue,
      fontStyle: 'italic',
    },
    'hljs-title': {
      color: papertLightColors.AccentBlue,
    },
    'hljs-section': {
      color: papertLightColors.AccentGreen,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: papertLightColors.LightBlue,
    },
    'hljs-class .hljs-title': {
      color: papertLightColors.AccentBlue,
    },
    'hljs-tag': {
      color: papertLightColors.LightBlue,
    },
    'hljs-name': {
      color: papertLightColors.AccentBlue,
    },
    'hljs-builtin-name': {
      color: papertLightColors.AccentYellow,
    },
    'hljs-meta': {
      color: papertLightColors.AccentYellow,
    },
    'hljs-symbol': {
      color: papertLightColors.AccentRed,
    },
    'hljs-bullet': {
      color: papertLightColors.AccentYellow,
    },
    'hljs-regexp': {
      color: papertLightColors.AccentCyan,
    },
    'hljs-link': {
      color: papertLightColors.LightBlue,
    },
    'hljs-deletion': {
      color: papertLightColors.AccentRed,
    },
    'hljs-addition': {
      color: papertLightColors.AccentGreen,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: papertLightColors.AccentCyan,
    },
    'hljs-built_in': {
      color: papertLightColors.AccentRed,
    },
    'hljs-doctag': {
      color: papertLightColors.AccentRed,
    },
    'hljs-template-variable': {
      color: papertLightColors.AccentCyan,
    },
    'hljs-selector-id': {
      color: papertLightColors.AccentRed,
    },
  },
  papertLightColors,
  lightSemanticColors,
);
