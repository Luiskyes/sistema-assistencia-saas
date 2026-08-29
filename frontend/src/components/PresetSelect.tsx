import { useId, useState } from "react";

type Props = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  customLabel?: string;
  customPlaceholder?: string;
  required?: boolean;
  customMultiline?: boolean;
};

export function PresetSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecione uma opção",
  customLabel = "Outro",
  customPlaceholder = "Digite uma opção...",
  required = false,
  customMultiline = false,
}: Props) {
  const panelId = useId();
  const valueIsPreset = options.includes(value);
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(Boolean(value) && !valueIsPreset);

  function select(option: string) {
    setCustomMode(false);
    onChange(option);
    setOpen(false);
  }

  function selectCustom() {
    setCustomMode(true);
    onChange("");
    setOpen(true);
  }

  const displayValue = value || (customMode ? customLabel : placeholder);

  return (
    <div className="preset-field">
      <span className="preset-field-label">{label}{required ? " *" : ""}</span>
      <button
        type="button"
        className={`preset-trigger ${value || customMode ? "has-value" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{displayValue}</span>
        <b aria-hidden="true">⌄</b>
      </button>

      {open ? (
        <div className="preset-panel" id={panelId}>
          <div className="preset-options" role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={!customMode && value === option}
                className={!customMode && value === option ? "selected" : ""}
                onClick={() => select(option)}
              >
                {!customMode && value === option ? "✓ " : ""}{option}
              </button>
            ))}
            <button
              type="button"
              role="option"
              aria-selected={customMode}
              className={`preset-custom-option ${customMode ? "selected" : ""}`}
              onClick={selectCustom}
            >
              {customMode ? "✓ " : "+ "}{customLabel}
            </button>
          </div>

          {customMode ? (
            customMultiline ? (
              <textarea
                autoFocus
                required={required}
                rows={4}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={customPlaceholder}
                aria-label={`${label}: ${customLabel}`}
              />
            ) : (
              <input
                autoFocus
                required={required}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={customPlaceholder}
                aria-label={`${label}: ${customLabel}`}
              />
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
