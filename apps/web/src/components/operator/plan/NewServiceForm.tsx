import { useEffect, useRef, useState } from "react";

export function NewServiceForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate(name.trim());
      }}
    >
      <input
        ref={inputRef}
        className="w-full rounded border border-line bg-bg-2 px-3 py-2 text-sm text-ink"
        placeholder="Untitled service"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 cursor-pointer rounded bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground"
        >
          Create
        </button>
        <button
          type="button"
          className="cursor-pointer rounded border border-line px-3 py-2 text-xs text-ink-3 hover:text-ink"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
