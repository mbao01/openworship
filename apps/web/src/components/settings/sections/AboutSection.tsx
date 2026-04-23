/**
 * About section — version info and links.
 */
export function AboutSection() {
  return (
    <div className="flex-1 space-y-0 overflow-y-auto p-6">
      <h2 className="mb-6 border-b border-line pb-3 font-mono text-[10px] tracking-[0.12em] text-ink-3 uppercase">
        About
      </h2>

      <div className="space-y-3">
        <div>
          <p className="font-serif text-lg leading-snug text-ink">
            openworship
          </p>
          <p className="mt-1 text-xs text-ink-3">
            AI-powered worship presentation
          </p>
        </div>

        <div className="space-y-1.5 border-t border-line pt-3 font-mono text-[10.5px] text-ink-3">
          <div className="flex justify-between">
            <span>Version</span>
            <span className="text-ink-2">0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span>Build</span>
            <span className="text-ink-2">development</span>
          </div>
        </div>
      </div>
    </div>
  );
}
