type StatusMessageProps = {
  type: "error" | "success" | "info";
  children: string;
};

export function StatusMessage({ type, children }: StatusMessageProps) {
  const symbol = type === "success" ? "✓" : type === "error" ? "!" : "i";

  return (
    <div
      className={"status-message status-" + type}
      role={type === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <span aria-hidden="true">{symbol}</span>
      <p>{children}</p>
    </div>
  );
}
