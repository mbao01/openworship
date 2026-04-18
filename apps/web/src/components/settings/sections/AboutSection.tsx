/**
 * About section — version info and links.
 */
export function AboutSection() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-0">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 mb-6 pb-3 border-b border-line">
        About
      </h2>

      <div className="space-y-3">
        <div>
          <p className="font-serif text-lg text-ink leading-snug">openworship</p>
          <p className="text-xs text-ink-3 mt-1">AI-powered worship presentation</p>
        </div>

        <div className="pt-3 border-t border-line space-y-1.5 font-mono text-[10.5px] text-ink-3">
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
