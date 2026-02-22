interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="toggle">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <button
        className={checked ? 'pill active' : 'pill'}
        onClick={() => onChange(!checked)}
        type="button"
      >
        {checked ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}
