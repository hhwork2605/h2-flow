// Shared UI primitives for the Studio layout. Every one takes `tk` (a token set).

const FONT = `"Inter", "Segoe UI", system-ui, -apple-system, sans-serif`;
const DISPLAY = `"Playfair Display", Georgia, serif`;
const MONO = `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

function iconBtnStyle(tk) {
  return {
    display: "inline-grid", placeItems: "center",
    width: 32, height: 32,
    background: "transparent", color: tk.textDim,
    border: "none", borderRadius: 7, cursor: "pointer",
  };
}

// Measure the component's OWN container width (extension panel resizes constantly).
function useContainerWidth(initial = 1180) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(initial);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.round(e.contentRect.width));
    });
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// Inject once: hide scrollbars on horizontal scroll rows.
if (typeof document !== "undefined" && !document.getElementById("h2-resp-style")) {
  const s = document.createElement("style");
  s.id = "h2-resp-style";
  s.textContent = ".h2-scroll{scrollbar-width:none;-ms-overflow-style:none;} .h2-scroll::-webkit-scrollbar{display:none;height:0;width:0;}";
  document.head.appendChild(s);
}

function Seg({ tk, options, value, onChange, size = "md", wrap = false }) {
  const h = size === "sm" ? 26 : 28;
  return (
    <div style={{
      display: "inline-flex", padding: 3,
      background: tk.surface2,
      border: `1px solid ${tk.border}`,
      borderRadius: 9,
      flexWrap: wrap ? "wrap" : "nowrap",
      gap: wrap ? 3 : 0,
      maxWidth: "100%",
    }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange && onChange(o.id)} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            height: h, padding: "0 10px",
            background: active ? tk.raised : "transparent",
            color: active ? tk.heading : tk.textDim,
            border: active ? `1px solid ${tk.border}` : "1px solid transparent",
            borderRadius: 6, fontSize: size === "sm" ? 11.5 : 12, fontWeight: 600,
            cursor: "pointer", fontFamily: FONT,
            boxShadow: active && !tk.dark ? "0 1px 2px rgba(40,28,12,0.06)" : "none",
          }}>
            {o.dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: o.dot }} />}
            {o.label}
            {o.crown && <span style={{ display: "inline-flex", color: tk.warn, marginLeft: 1 }}>{Icons.crown}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ tk, icon, children, active, accent, onClick }) {
  const isAccent = accent || active;
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 30, padding: children ? "0 10px" : "0 8px",
      background: isAccent ? tk.accentSoft : tk.chipBg,
      color: isAccent ? (tk.dark ? "#fff" : tk.accent) : tk.text,
      border: `1px solid ${isAccent ? tk.accentBorder : tk.border}`,
      borderRadius: 8, fontSize: 12.5, fontWeight: 500,
      cursor: "pointer", fontFamily: FONT,
    }}>
      {icon}{children}
    </button>
  );
}

function Tab({ tk, icon, label, active }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      height: 32, padding: "0 12px",
      color: active ? tk.heading : tk.textDim,
      background: active ? tk.surface : "transparent",
      border: active ? `1px solid ${tk.border}` : "1px solid transparent",
      borderRadius: 9,
      fontSize: 12.5, fontWeight: active ? 600 : 500,
      cursor: "pointer",
      boxShadow: active && !tk.dark ? "0 1px 0 rgba(40,28,12,0.04)" : "none",
    }}>
      <span style={{ opacity: active ? 0.95 : 0.65, display: "inline-flex" }}>{icon}</span>
      {label}
    </div>
  );
}

function RatioPicker({ tk, value, onChange }) {
  const items = [
    { id: "16:9", w: 16, h: 9 },
    { id: "1:1",  w: 10, h: 10 },
    { id: "9:16", w: 9,  h: 14 },
    { id: "4:3",  w: 14, h: 10 },
    { id: "3:4",  w: 10, h: 14 },
  ];
  return (
    <div style={{ display: "inline-flex", gap: 4 }}>
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button key={it.id} onClick={() => onChange && onChange(it.id)} title={it.id} style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 4, width: 42, height: 42,
            background: active ? tk.accentSoft : tk.surface2,
            border: `1px solid ${active ? tk.accentBorder : tk.border}`,
            color: active ? (tk.dark ? "#fff" : tk.accent) : tk.textDim,
            borderRadius: 8, cursor: "pointer", fontFamily: FONT,
          }}>
            <div style={{
              width: it.w, height: it.h,
              border: `1.5px solid currentColor`,
              borderRadius: 2, opacity: 0.85,
            }} />
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.2 }}>{it.id}</div>
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ tk, on, onChange }) {
  return (
    <span onClick={() => onChange && onChange(!on)} style={{
      position: "relative", width: 30, height: 18, borderRadius: 999,
      background: on ? tk.accent : tk.surface3,
      border: `1px solid ${tk.border}`,
      cursor: "pointer", transition: "background 0.15s", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 1, left: on ? 13 : 1,
        width: 14, height: 14, borderRadius: 999, background: "#fff",
        transition: "left 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
      }} />
    </span>
  );
}

function Eyebrow({ tk, children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
      color: tk.textMute, textTransform: "uppercase",
    }}>{children}</div>
  );
}

function SettingItem({ tk, label, children }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11.5, color: tk.textMute, fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );
}

function VDivider({ tk }) {
  return <div style={{ width: 1, height: 22, background: tk.border }} />;
}

const advLabel = (tk) => ({
  fontSize: 11, fontWeight: 700, color: tk.textDim,
  marginBottom: 8, letterSpacing: 0.3, textTransform: "uppercase",
});

const pickStyleStyle = (tk) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  fontSize: 12.5, fontWeight: 600, color: tk.text,
  padding: "5px 9px", background: tk.surface2,
  border: `1px solid ${tk.border}`, borderRadius: 8,
  cursor: "pointer",
});

Object.assign(window, { Seg, Chip, Tab, RatioPicker, Toggle, Eyebrow, SettingItem, VDivider, iconBtnStyle, advLabel, pickStyleStyle, useContainerWidth, FONT, DISPLAY, MONO });
