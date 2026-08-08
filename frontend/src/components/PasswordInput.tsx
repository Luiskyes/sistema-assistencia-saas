import { useId, useState } from "react";

type PasswordInputProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  hint?: string;
};

export function PasswordInput({
  label,
  name,
  value,
  onChange,
  autoComplete,
  minLength,
  hint,
}: PasswordInputProps) {
  const inputId = useId();
  const hintId = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <div className="password-wrap">
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          aria-describedby={hint ? hintId : undefined}
          required
        />
        <button
          className="password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {hint ? <small id={hintId} className="field-hint">{hint}</small> : null}
    </div>
  );
}
