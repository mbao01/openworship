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
      <p className="m-0 mt-1.5 text-xs text-ink-3">{initialValue}</p>
    ) : null;
  }

  return (
    <input
      className="mt-1.5 w-full border-0 border-b border-transparent bg-transparent px-0 py-0.5 text-sm text-ink placeholder:text-muted focus:border-b-line-strong focus:outline-none"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      placeholder="Add a description..."
    />
  );
}
