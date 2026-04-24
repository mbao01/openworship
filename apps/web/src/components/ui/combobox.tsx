import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { ChevronDownIcon } from "lucide-react";

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? "";

  const filtered = filter
    ? options.filter((o) =>
        o.label.toLowerCase().includes(filter.toLowerCase()),
      )
    : options;

  useEffect(() => {
    if (open) {
      setFilter("");
      // Focus the input after popover opens
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className={`flex h-[26px] w-full cursor-pointer items-center justify-between rounded border border-line bg-bg-2 px-1.5 text-left text-xs outline-0 transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50 ${
            value ? "text-ink" : "text-ink-3"
          } ${className}`}
        >
          <span className="min-w-0 truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronDownIcon className="ml-1 h-3 w-3 shrink-0 text-ink-3" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-[9999] max-h-[200px] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded border border-line bg-bg-1 shadow-xl"
        >
          {/* Filter input */}
          <div className="border-b border-line px-2 py-1.5">
            <input
              ref={inputRef}
              className="w-full bg-transparent text-xs text-ink outline-0 placeholder:text-ink-3"
              placeholder="Type to filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                } else if (e.key === "Enter" && filtered.length === 1) {
                  onChange(filtered[0].value);
                  setOpen(false);
                }
              }}
            />
          </div>

          {/* Options list */}
          <div className="max-h-[160px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-ink-3">
                No matches
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`flex w-full cursor-pointer items-center px-2 py-1.5 text-left text-xs transition-colors hover:bg-bg-2 ${
                    o.value === value ? "font-medium text-accent" : "text-ink"
                  }`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
