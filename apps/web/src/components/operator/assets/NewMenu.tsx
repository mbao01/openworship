import { useEffect, useRef } from "react";

export function NewMenu({
  onNewFolder,
  onClose,
}: {
  onNewFolder: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const btnCls =
    "block w-full text-left bg-transparent border-none font-sans text-[12px] text-ink px-[12px] py-[7px] cursor-pointer transition-colors hover:bg-bg-2 whitespace-nowrap";

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 z-[200] mt-[3px] min-w-[140px] rounded-lg border border-line-strong bg-bg-2 py-1 shadow-lg"
    >
      <button
        className={btnCls}
        onClick={() => {
          onNewFolder();
          onClose();
        }}
      >
        New Folder
      </button>
    </div>
  );
}
