import { useEffect, useState } from "react";

export function EditableDescription({
  value: initialValue,
  isReadOnly,
  onSave,
}: {
  value: string;
  isReadOnly: boolean;
  onSave: (desc: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed !== (initialValue ?? "")) {
      onSave(trimmed);
    }
  };

  if (isReadOnly) {
    return initialValue ? (
      <p className="text-xs text-ink-3 mt-1.5 m-0">{initialValue}</p>
    ) : null;
  }

  return (
    <input
      className="w-full mt-1.5 px-0 py-0.5 bg-transparent border-0 border-b border-transparent text-ink text-sm placeholder:text-muted focus:border-b-line-strong focus:outline-none"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      placeholder="Add a description..."
    />
  );
}
