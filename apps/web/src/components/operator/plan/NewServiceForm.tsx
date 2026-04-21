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
        className="w-full px-3 py-2 bg-bg-2 border border-line rounded text-ink text-sm"
        placeholder="Untitled service"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 px-3 py-2 bg-accent text-accent-foreground text-xs font-semibold rounded cursor-pointer"
        >
          Create
        </button>
        <button
          type="button"
          className="px-3 py-2 text-ink-3 text-xs rounded border border-line hover:text-ink cursor-pointer"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
