"use client";

import { useEffect, useRef } from "react";

const SCENES = [
  {
    preamble: "…and so Paul, writing to the church in Rome, says",
    match: "for I am sure that neither death nor life will be able to separate us",
    ref: "Romans 8 : 38–39",
    verse:
      "For I am sure that neither death nor life, nor angels nor rulers, nor things present nor things to come… will be able to separate us from the love of God.",
    matchLabel: "Scripture · <strong>Romans 8 : 38–39</strong>",
    confidence: 98,
    step: "Exact reference match",
    latency: "94ms",
  },
  {
    preamble: "let's sing it together — ",
    match: "it is well, it is well with my soul",
    ref: "Hymn · It Is Well With My Soul",
    verse:
      "When peace like a river attendeth my way, when sorrows like sea billows roll — whatever my lot, thou hast taught me to say: it is well, it is well with my soul.",
    matchLabel: "Lyrics · <strong>It Is Well With My Soul</strong> · v.1",
    confidence: 96,
    step: "Mid-lyric detection",
    latency: "102ms",
  },
  {
    preamble: "there's that beautiful psalm — ",
    match: "be still, and know that I am God",
    ref: "Psalm 46 : 10",
    verse:
      "Be still, and know that I am God. I will be exalted among the nations, I will be exalted in the earth.",
    matchLabel: "Scripture · <strong>Psalm 46 : 10</strong>",
    confidence: 99,
    step: "Paraphrase match",
    latency: "88ms",
  },
];

async function typeText(el: HTMLElement, text: string, speed = 28) {
  el.textContent = "";
  for (let n = 0; n < text.length; n++) {
    el.textContent += text[n];
    await new Promise((r) => setTimeout(r, speed));
  }
}

export function LiveDemo() {
  const stopRef = useRef(false);

  useEffect(() => {
    stopRef.current = false;

    const $ = (id: string) => document.getElementById(id);
    const T = $("demo-transcript");
    const ML = $("demo-matchLabel");
    const CF = $("demo-confFill") as HTMLElement | null;
    const CT = $("demo-confText");
    const DR = $("demo-displayRef");
    const DV = $("demo-displayVerse");
    const DS = $("demo-step");
    const LAT = $("demo-latency");

    if (!T || !ML || !CF || !CT || !DR || !DV || !DS || !LAT) return;

    const _T = T, _ML = ML, _CF = CF, _CT = CT, _DR = DR, _DV = DV, _DS = DS, _LAT = LAT;

    let i = 0;

    async function runScene(scene: (typeof SCENES)[number]) {
      if (stopRef.current) return;

      _T.innerHTML = '<span style="color: var(--muted);">Listening…</span>';
      _ML.innerHTML = "No match yet";
      _CF.style.width = "0%";
      _CT.textContent = "—";
      _DR.textContent = "";
      _DV.textContent = "";
      _DS.textContent = "Listening · —";
      _LAT.textContent = "~ 88ms";

      await new Promise((r) => setTimeout(r, 600));
      if (stopRef.current) return;

      _T.innerHTML =
        '<span id="demo-tl1"></span><span id="demo-tl2" style="background: color-mix(in srgb, var(--accent) 22%, transparent); padding: 0 4px; font-style: normal; color: var(--ink); font-weight: 500;"></span>';
      const tl1 = document.getElementById("demo-tl1");
      const tl2 = document.getElementById("demo-tl2");
      if (!tl1 || !tl2) return;

      for (let n = 0; n < scene.preamble.length; n++) {
        if (stopRef.current) return;
        tl1.textContent += scene.preamble[n];
        await new Promise((r) => setTimeout(r, 32));
      }
      for (let n = 0; n < scene.match.length; n++) {
        if (stopRef.current) return;
        tl2.textContent += scene.match[n];
        await new Promise((r) => setTimeout(r, 32));
      }

      if (stopRef.current) return;
      _LAT.textContent = "~ " + scene.latency;
      _ML.innerHTML = scene.matchLabel;
      _DS.textContent = scene.step;
      _CT.textContent = scene.confidence + "%";
      _CF.style.width = scene.confidence + "%";
      _DR.textContent = scene.ref;

      await new Promise((r) => setTimeout(r, 200));
      if (stopRef.current) return;

      await typeText(_DV, scene.verse, 10);

      await new Promise((r) => setTimeout(r, 3600));
    }

    async function loop() {
      while (!stopRef.current) {
        await runScene(SCENES[i % SCENES.length]);
        i++;
      }
    }

    loop();

    return () => {
      stopRef.current = true;
    };
  }, []);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--rule-soft)",
        borderRadius: "6px",
        overflow: "hidden",
        boxShadow: "var(--shadow)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--rule-soft)",
          background: "var(--bg-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontFamily: "var(--mono)",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#d64545",
              boxShadow: "0 0 0 0 rgba(214, 69, 69, 0.5)",
              animation: "pulse 1.6s infinite",
              flexShrink: 0,
            }}
          />
          Auto · listening
        </div>
        <div
          id="demo-latency"
          style={{
            fontFamily: "var(--mono)",
            fontSize: "11px",
            color: "var(--muted)",
          }}
        >
          ~ 94ms
        </div>
      </div>

      {/* Transcript */}
      <div
        id="demo-transcript"
        style={{
          padding: "18px 20px",
          minHeight: "90px",
          borderBottom: "1px solid var(--rule-soft)",
          fontFamily: "var(--serif)",
          fontSize: "18px",
          lineHeight: 1.4,
          color: "var(--ink-2)",
          fontStyle: "italic",
        }}
      >
        <span style={{ color: "var(--muted)" }}>Waiting for speech…</span>
      </div>

      {/* Match */}
      <div
        style={{
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--mono)",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--muted)",
          borderBottom: "1px solid var(--rule-soft)",
          minHeight: "44px",
        }}
      >
        <div id="demo-matchLabel">No match yet</div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span id="demo-confText">—</span>
          <div
            style={{
              width: "70px",
              height: "3px",
              background: "var(--rule-soft)",
              position: "relative",
            }}
          >
            <div
              id="demo-confFill"
              style={{
                position: "absolute",
                inset: 0,
                width: "0%",
                background: "var(--accent)",
                transition: "width 500ms",
              }}
            />
          </div>
        </div>
      </div>

      {/* Display */}
      <div
        style={{
          background: "#0A0907",
          color: "#F5EFDF",
          padding: "48px 36px",
          minHeight: "280px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "18px",
            right: "24px",
            fontFamily: "var(--mono)",
            fontSize: "10px",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(245,239,223,0.5)",
          }}
        >
          ESV
        </div>
        <div
          id="demo-displayRef"
          style={{
            fontFamily: "var(--mono)",
            fontSize: "11px",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#C9A76A",
            marginBottom: "20px",
            minHeight: "16px",
          }}
        />
        <div
          id="demo-displayVerse"
          style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: "clamp(18px, 2vw, 24px)",
            lineHeight: 1.4,
            letterSpacing: "-0.01em",
            maxWidth: "32ch",
            minHeight: "4.2em",
          }}
        />
      </div>

      {/* Hint */}
      <div
        style={{
          padding: "12px 20px",
          fontFamily: "var(--mono)",
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--muted)",
          background: "var(--bg-2)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Live demo · scripted</span>
        <span id="demo-step">— · —</span>
      </div>

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(214,69,69,0.5); }
          70% { box-shadow: 0 0 0 10px rgba(214,69,69,0); }
          100% { box-shadow: 0 0 0 0 rgba(214,69,69,0); }
        }
      `}</style>
    </div>
  );
}
