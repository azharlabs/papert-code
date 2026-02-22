import type { AdminControls } from '../types';
import { Toggle } from './Toggle';

interface PolicyEditorProps {
  controls: AdminControls;
  onChange: (next: AdminControls) => void;
}

export function PolicyEditor({ controls, onChange }: PolicyEditorProps) {
  const update = (patch: Partial<AdminControls>) =>
    onChange({ ...controls, ...patch });

  const updateMcp = (patch: NonNullable<AdminControls['mcpSetting']>) =>
    update({ mcpSetting: { ...controls.mcpSetting, ...patch } });

  const updateCli = (patch: NonNullable<AdminControls['cliFeatureSetting']>) =>
    update({ cliFeatureSetting: { ...controls.cliFeatureSetting, ...patch } });

  const updateExtensions = (enabled: boolean) =>
    updateCli({
      extensionsSetting: {
        ...controls.cliFeatureSetting?.extensionsSetting,
        extensionsEnabled: enabled,
      },
    });

  return (
    <div className="policy">
      <Toggle
        label="Secure mode"
        description="Enforce secure mode behaviors for CLI sessions."
        checked={controls.secureModeEnabled ?? false}
        onChange={(value) => update({ secureModeEnabled: value })}
      />
      <Toggle
        label="Strict mode disabled"
        description="Relax strict-mode safety validations."
        checked={controls.strictModeDisabled ?? false}
        onChange={(value) => update({ strictModeDisabled: value })}
      />
      <Toggle
        label="MCP enabled"
        description="Allow MCP servers and related commands."
        checked={controls.mcpSetting?.mcpEnabled ?? false}
        onChange={(value) => updateMcp({ mcpEnabled: value })}
      />
      <label className="field">
        <span>Override MCP config JSON</span>
        <textarea
          rows={4}
          value={controls.mcpSetting?.overrideMcpConfigJson ?? ''}
          placeholder={`{\n  "mcpServers": {\n    "server": { ... }\n  }\n}`}
          onChange={(event) =>
            updateMcp({ overrideMcpConfigJson: event.target.value })
          }
        />
      </label>
      <Toggle
        label="Extensions enabled"
        description="Control extensions and plugins availability."
        checked={
          controls.cliFeatureSetting?.extensionsSetting?.extensionsEnabled ?? false
        }
        onChange={updateExtensions}
      />
      <Toggle
        label="Skills enabled"
        description="Allow unmanaged skills to load in the CLI."
        checked={
          controls.cliFeatureSetting?.unmanagedCapabilitiesEnabled ?? false
        }
        onChange={(value) =>
          updateCli({ unmanagedCapabilitiesEnabled: value })
        }
      />
    </div>
  );
}
