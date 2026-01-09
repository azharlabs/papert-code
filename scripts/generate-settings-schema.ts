#!/usr/bin/env node

/**
 * @license
 * * Copyright 2026 Papert-code
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getSettingsSchema,
  SETTINGS_SCHEMA_DEFINITIONS,
  type SettingDefinition,
  type SettingCollectionDefinition,
  type SettingsSchema,
  type SettingEnumOption,
} from '../packages/cli/src/config/settingsSchema.js';

type JsonSchema = Record<string, unknown>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'schemas', 'settings.schema.json');

function buildEnumSchema(options: readonly SettingEnumOption[]): JsonSchema {
  if (!options || options.length === 0) {
    return { type: 'string' };
  }

  const types = new Set(options.map((option) => typeof option.value));
  const schema: JsonSchema = {
    oneOf: options.map((option) => ({
      const: option.value,
      title: option.label,
    })),
  };

  if (types.size === 1) {
    schema.type = types.values().next().value;
  }

  return schema;
}

function buildSettingMetadata(definition: SettingDefinition): JsonSchema {
  const metadata: JsonSchema = {};

  if (definition.label) {
    metadata.title = definition.label;
  }

  if (definition.description) {
    metadata.description = definition.description;
  }

  if (definition.default !== undefined) {
    metadata.default = definition.default;
  }

  const papertMetadata: Record<string, unknown> = {};

  if (definition.category) {
    papertMetadata.category = definition.category;
  }

  papertMetadata.requiresRestart = definition.requiresRestart;

  if (definition.showInDialog !== undefined) {
    papertMetadata.showInDialog = definition.showInDialog;
  }

  if (definition.mergeStrategy) {
    papertMetadata.mergeStrategy = definition.mergeStrategy;
  }

  if (definition.parentKey) {
    papertMetadata.parentKey = definition.parentKey;
  }

  if (definition.childKey) {
    papertMetadata.childKey = definition.childKey;
  }

  if (definition.key) {
    papertMetadata.key = definition.key;
  }

  if (Object.keys(papertMetadata).length > 0) {
    metadata['x-papert'] = papertMetadata;
  }

  return metadata;
}

function buildCollectionMetadata(
  collection: SettingCollectionDefinition,
): JsonSchema {
  const metadata: JsonSchema = {};

  if (collection.description) {
    metadata.description = collection.description;
  }

  return metadata;
}

function buildProperties(schema: SettingsSchema): Record<string, JsonSchema> {
  const properties: Record<string, JsonSchema> = {};

  for (const [key, definition] of Object.entries(schema)) {
    properties[key] = buildSchemaFromDefinition(definition);
  }

  return properties;
}

function wrapRefWithMetadata(ref: string, metadata: JsonSchema): JsonSchema {
  const refSchema = { $ref: `#/$defs/${ref}` };

  if (Object.keys(metadata).length === 0) {
    return refSchema;
  }

  return { allOf: [refSchema, metadata] };
}

function buildSchemaFromCollection(
  collection: SettingCollectionDefinition,
): JsonSchema {
  const metadata = buildCollectionMetadata(collection);

  if (collection.ref) {
    return wrapRefWithMetadata(collection.ref, metadata);
  }

  switch (collection.type) {
    case 'string':
    case 'number':
    case 'boolean':
      return { type: collection.type, ...metadata };
    case 'enum':
      return { ...buildEnumSchema(collection.options ?? []), ...metadata };
    case 'array': {
      let items: JsonSchema = {};
      if (collection.properties) {
        items = {
          type: 'object',
          properties: buildProperties(collection.properties),
        };
      }
      return { type: 'array', items, ...metadata };
    }
    case 'object': {
      const schema: JsonSchema = { type: 'object', ...metadata };
      if (collection.properties) {
        schema.properties = buildProperties(collection.properties);
      }
      return schema;
    }
    default:
      return { ...metadata };
  }
}

function buildSchemaFromDefinition(definition: SettingDefinition): JsonSchema {
  const metadata = buildSettingMetadata(definition);

  if (definition.ref === 'TelemetrySettings') {
    const telemetrySchema: JsonSchema = {
      anyOf: [{ type: 'boolean' }, { $ref: '#/$defs/TelemetrySettings' }],
    };

    return { ...telemetrySchema, ...metadata };
  }

  if (definition.ref) {
    return wrapRefWithMetadata(definition.ref, metadata);
  }

  switch (definition.type) {
    case 'string':
    case 'number':
    case 'boolean':
      return { type: definition.type, ...metadata };
    case 'enum':
      return { ...buildEnumSchema(definition.options ?? []), ...metadata };
    case 'array': {
      const items = definition.items
        ? buildSchemaFromCollection(definition.items)
        : {};
      return { type: 'array', items, ...metadata };
    }
    case 'object': {
      const schema: JsonSchema = { type: 'object', ...metadata };
      if (definition.properties) {
        schema.properties = buildProperties(definition.properties);
      }
      if (definition.additionalProperties) {
        schema.additionalProperties = buildSchemaFromCollection(
          definition.additionalProperties,
        );
      }
      return schema;
    }
    default:
      return { ...metadata };
  }
}

async function generateSettingsSchema(): Promise<void> {
  const settingsSchema = getSettingsSchema();
  const properties = buildProperties(settingsSchema);

  const schema: JsonSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Papert Code Settings',
    description: 'Schema for Papert Code settings.json.',
    type: 'object',
    properties,
    $defs: SETTINGS_SCHEMA_DEFINITIONS,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`);

  console.log(`Wrote settings schema to ${outputPath}`);
}

generateSettingsSchema().catch((error) => {
  console.error('Failed to generate settings schema:', error);
  process.exit(1);
});
