interface ProviderEditorProps {
  provider: { apiKey?: string; baseUrl?: string; model?: string; models?: string[] };
  onChange: (next: { apiKey?: string; baseUrl?: string; model?: string; models?: string[] }) => void;
}

export function ProviderEditor({ provider, onChange }: ProviderEditorProps) {
  const modelsValue = (provider.models || []).join(', ');
  return (
    <div className="policy">
      <label className="field">
        <span>API key</span>
        <input
          value={provider.apiKey ?? ''}
          onChange={(e) => onChange({ ...provider, apiKey: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Base URL</span>
        <input
          value={provider.baseUrl ?? ''}
          onChange={(e) => onChange({ ...provider, baseUrl: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Default model</span>
        <input
          value={provider.model ?? ''}
          onChange={(e) => onChange({ ...provider, model: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Available models (comma-separated)</span>
        <input
          value={modelsValue}
          onChange={(e) =>
            onChange({
              ...provider,
              models: e.target.value
                .split(',')
                .map((value) => value.trim()),
            })
          }
        />
      </label>
    </div>
  );
}
