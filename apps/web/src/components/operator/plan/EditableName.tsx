import { useEffect, useRef, useState } from "react";

export function EditableName({
  name,
  isReadOnly,
  onSave,
}: {
  name: string;
  isReadOnly: boolean;
  onSave: (newName: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    } else {
      setValue(name);
    }
  };

  if (editing && !isReadOnly) {
    return (
      <input
        ref={inputRef}
        className="font-serif text-xl font-normal tracking-[-0.015em] text-ink w-full bg-transparent border-b-2 border-accent outline-none py-0.5"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        placeholder="Untitled service"
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <h1
      className={`font-serif text-xl font-normal tracking-[-0.015em] mb-0 ${
        name ? "text-ink" : "text-muted"
      } ${!isReadOnly ? "cursor-pointer hover:text-accent transition-colors" : ""}
      }`}
      onClick={() => {
        if (!isReadOnly) setEditing(true);
      }}
    >
      {name || "Untitled service"}
    </h1>
  );
}
