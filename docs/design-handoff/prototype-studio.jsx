// The single Studio layout. Rendered once per theme — structure identical, color via `tk`.
// Responsive to its OWN container width (Chrome extension side-panel resizes constantly).

function StudioApp({ tk }) {
  const [ref, W] = useContainerWidth(1180);
  const narrow  = W < 680;   // tablet / wide panel → compact
  const vnarrow = W < 480;   // typical side panel width

  const [provider, setProvider] = React.useState("google");
  const [ratio, setRatio] = React.useState("16:9");
  const [count, setCount] = React.useState(4);
  const [mode, setMode] = React.useState("seq");
  const [kind, setKind] = React.useState("image");
  const [advanced, setAdvanced] = React.useState(false);
  const [multiPrompt, setMultiPrompt] = React.useState(false);
  const [autoDl, setAutoDl] = React.useState(true);
  const [retry, setRetry] = React.useState(true);

  const ibtn = iconBtnStyle(tk);
  const padX = vnarrow ? 12 : narrow ? 16 : 28;

  const tabs = [
    { icon: Icons.sparkle,  label: "Gen", active: true },
    { icon: Icons.flow,     label: "Workflow" },
    { icon: Icons.prompt,   label: "Prompts" },
    { icon: Icons.tasks,    label: "Tasks" },
    { icon: Icons.photo,    label: "Photos" },
    { icon: Icons.snippet,  label: "Snippets" },
    { icon: Icons.history,  label: "Lịch sử" },
    { icon: Icons.log,      label: "Logs" },
  ];

  const providers = [
    { id: "google",  label: "Google Flow", dot: "#4285f4" },
    { id: "chatgpt", label: "ChatGPT",     dot: "#10a37f", crown: true },
    { id: "grok",    label: "Grok",        dot: tk.dark ? "#e5e5e5" : "#222", crown: true },
    { id: "gemini",  label: "Gemini",      dot: "#a259ff" },
  ];

  const recentCols = vnarrow ? 2 : narrow ? 3 : 4;
  const heroSize = vnarrow ? 26 : narrow ? 34 : 44;

  const thumb = (i) => tk.dark
    ? `linear-gradient(135deg, oklch(${0.34 + i * 0.04} 0.15 ${tk.hue + i * 22}), oklch(0.20 0.05 ${tk.hue + 40}))`
    : `linear-gradient(135deg, oklch(${0.80 - i * 0.04} 0.12 ${tk.hue + i * 22}), oklch(${0.66 - i * 0.03} 0.10 ${tk.hue + 40}))`;

  return (
    <div ref={ref} style={{
      width: "100%", background: tk.bg, color: tk.text,
      fontFamily: FONT, fontSize: 13, WebkitFontSmoothing: "antialiased",
      containerType: "inline-size",
    }}>
      {/* ─── Top bar ─── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, padding: `${narrow ? 12 : 14}px ${padX}px`, borderBottom: `1px solid ${tk.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", flexShrink: 0,
            background: tk.accent, color: tk.onAccent, fontWeight: 800, fontSize: 13, letterSpacing: -0.3,
          }}>h2</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
            <span style={{ fontFamily: DISPLAY, fontStyle: "italic", fontSize: 22, lineHeight: 1, color: tk.heading, whiteSpace: "nowrap" }}>h2-flow</span>
            {!vnarrow && <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: 0.6,
              padding: "2px 6px", borderRadius: 4, background: tk.surface3, color: tk.textDim,
            }}>FREE</span>}
          </div>
        </div>

        {W >= 760 && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: 11, color: tk.textMute, whiteSpace: "nowrap" }}>
            <span><span style={{ color: tk.success }}>●</span>&nbsp; 50 credits</span>
            <span>·</span>
            <span>2 jobs</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {W >= 600 && <button style={ibtn}>{Icons.search}</button>}
          {W >= 600 && <button style={ibtn}>{Icons.globe}</button>}
          <button style={ibtn}>{tk.themeIcon === "moon" ? Icons.moon : Icons.sun}</button>
          {!vnarrow && <button style={ibtn}>{Icons.bell}</button>}
          <div style={{ width: 1, height: 18, background: tk.border, margin: "0 6px" }} />
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 7, height: 32, padding: vnarrow ? "0 9px" : "0 14px",
            background: tk.solid, color: tk.onSolid, border: "none", borderRadius: 8,
            fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap",
          }}>{Icons.user}{!vnarrow && " Đăng nhập"}</button>
        </div>
      </div>

      {/* ─── Tabs + project switcher ─── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, padding: `${narrow ? 10 : 12}px ${padX}px`, borderBottom: `1px solid ${tk.border}`,
        flexWrap: narrow ? "wrap" : "nowrap",
      }}>
        <div className="h2-scroll" style={{
          display: "flex", alignItems: "center", gap: 4,
          overflowX: "auto", flex: narrow ? "1 1 100%" : "0 1 auto",
          order: narrow ? 2 : 1, minWidth: 0,
        }}>
          {tabs.map((t) => <Tab key={t.label} tk={tk} {...t} />)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, order: narrow ? 1 : 2, flexShrink: 0, marginLeft: narrow ? "auto" : 0 }}>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 8, height: 32, padding: "0 10px 0 12px",
            background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 9,
            cursor: "pointer", fontFamily: FONT, color: tk.heading, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
          }}>
            <span style={{ color: tk.accent, display: "inline-flex" }}>{Icons.folder}</span>
            {vnarrow ? "Mặc định" : "Dự án: Mặc định"}
            <span style={{ color: tk.textMute, display: "inline-flex" }}>{Icons.chev}</span>
          </button>
          <button style={{
            display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: vnarrow ? "0 10px" : "0 14px",
            background: tk.accent, color: tk.onAccent, border: "none", borderRadius: 9,
            cursor: "pointer", fontFamily: FONT, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
            boxShadow: `0 4px 12px -4px ${tk.accentBorder}`,
          }}>{Icons.plus}{!vnarrow && " Dự án mới"}</button>
        </div>
      </div>

      {/* ─── Main column ─── */}
      <div style={{ padding: `${vnarrow ? 24 : narrow ? 32 : 48}px ${padX}px 32px`, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 860, display: "flex", flexDirection: "column", gap: narrow ? 16 : 22 }}>

          {/* Hero */}
          <div style={{ textAlign: "center" }}>
            <Eyebrow tk={tk}>Studio · Generate</Eyebrow>
            <h1 style={{
              margin: `${narrow ? 8 : 10}px 0 0`, fontFamily: DISPLAY, fontStyle: "italic", fontWeight: 400,
              fontSize: heroSize, lineHeight: 1.05, letterSpacing: -1, color: tk.heading, textWrap: "balance",
            }}>
              Hãy tạo một thứ gì đó <span style={{ fontFamily: FONT, fontStyle: "normal", fontSize: Math.round(heroSize * 0.68), color: tk.accent, fontWeight: 600 }}>đẹp</span>.
            </h1>
          </div>

          {/* Kind + provider */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <Seg tk={tk} value={kind} onChange={setKind} options={[{ id: "image", label: "Ảnh" }, { id: "video", label: "Video" }]} />
            {!narrow && <VDivider tk={tk} />}
            <Seg tk={tk} value={provider} onChange={setProvider} options={providers} wrap={narrow} />
          </div>

          {/* Prompt card */}
          <div style={{
            background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 18,
            boxShadow: tk.cardShadow, overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 16px", borderBottom: `1px solid ${tk.border}`,
            }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: tk.textDim, minWidth: 0 }}>
                <span style={{ display: "inline-flex", color: tk.textMute }}>{Icons.prompt}</span>
                <span style={{ fontWeight: 600, color: tk.text }}>Prompt</span>
                {!vnarrow && <span style={{ color: tk.textMute, fontFamily: MONO, fontSize: 11 }}>· 0 prompt</span>}
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: tk.textDim, cursor: "pointer", whiteSpace: "nowrap" }}>
                Multi-Prompt
                <Toggle tk={tk} on={multiPrompt} onChange={setMultiPrompt} />
              </label>
            </div>

            <textarea
              placeholder="Mô tả thứ bạn muốn tạo… ánh sáng, bố cục, phong cách, chất liệu."
              style={{
                width: "100%", boxSizing: "border-box", minHeight: vnarrow ? 130 : 170,
                padding: "18px 18px 8px", background: "transparent",
                border: "none", outline: "none", resize: "none",
                color: tk.text, fontSize: vnarrow ? 15 : 16, lineHeight: 1.55, fontFamily: FONT,
              }}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 14px", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Chip tk={tk} icon={Icons.wand} accent>{vnarrow ? "Nâng" : "Nâng prompt"}</Chip>
                {!vnarrow && <Chip tk={tk} icon={Icons.bookmark}>Thư viện</Chip>}
                <Chip tk={tk} icon={Icons.sparkle}>Chat AI</Chip>
                {!narrow && <Chip tk={tk} icon={Icons.doc}>Import .txt</Chip>}
                <Chip tk={tk} icon={Icons.attach} />
                {!narrow && <span style={{ marginLeft: 4, fontSize: 11, color: tk.textMute, fontFamily: MONO }}>0 / 4000</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexGrow: vnarrow ? 1 : 0 }}>
                <button onClick={() => setAdvanced(!advanced)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 12px",
                  background: "transparent", color: tk.textDim, border: `1px solid ${tk.border}`,
                  borderRadius: 10, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap",
                }}>
                  <span style={{ transform: advanced ? "rotate(180deg)" : "none", display: "inline-flex" }}>{Icons.chev}</span>
                  {!vnarrow && "Nâng cao"}
                </button>
                <button style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, height: 38, padding: "0 20px",
                  background: tk.accent, color: tk.onAccent, border: "none", borderRadius: 10, flexGrow: vnarrow ? 1 : 0,
                  fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, boxShadow: tk.btnShadow, whiteSpace: "nowrap",
                }}>
                  {Icons.play} Tạo {count} ảnh
                  {!narrow && <span style={{ opacity: 0.7, fontFamily: MONO, fontSize: 11, fontWeight: 500, marginLeft: 2 }}>⌘↵</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Settings strip */}
          <div style={{ display: "flex", alignItems: "center", gap: narrow ? 10 : 14, flexWrap: "wrap", padding: "2px 0" }}>
            <SettingItem tk={tk} label="Model">
              <div style={pickStyleStyle(tk)}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "#4285f4" }} />
                Imagen 3 {Icons.chev}
              </div>
            </SettingItem>
            {!narrow && <VDivider tk={tk} />}
            <SettingItem tk={tk} label="Tỉ lệ"><RatioPicker tk={tk} value={ratio} onChange={setRatio} /></SettingItem>
            {!narrow && <VDivider tk={tk} />}
            <SettingItem tk={tk} label="Số lượng">
              <div style={{ display: "inline-flex", alignItems: "center", background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 8 }}>
                <button onClick={() => setCount(Math.max(1, count - 1))} style={{ display: "inline-grid", placeItems: "center", width: 24, height: 28, background: "transparent", color: tk.textDim, border: "none", cursor: "pointer" }}>{Icons.minus}</button>
                <div style={{ minWidth: 22, textAlign: "center", fontSize: 13, fontWeight: 700, color: tk.heading }}>{count}</div>
                <button onClick={() => setCount(Math.min(8, count + 1))} style={{ display: "inline-grid", placeItems: "center", width: 24, height: 28, background: "transparent", color: tk.textDim, border: "none", cursor: "pointer" }}>{Icons.plus}</button>
              </div>
            </SettingItem>
            {!narrow && <VDivider tk={tk} />}
            <SettingItem tk={tk} label="Chế độ">
              <Seg tk={tk} size="sm" value={mode} onChange={setMode} options={[{ id: "seq", label: "Tuần tự" }, { id: "par", label: "Song song" }]} />
            </SettingItem>
            {!narrow && <VDivider tk={tk} />}
            <SettingItem tk={tk} label="Phong cách">
              <div style={pickStyleStyle(tk)}>
                <span style={{ display: "inline-flex", color: tk.accent }}>{Icons.style}</span>
                Cinematic {Icons.chev}
              </div>
            </SettingItem>
            {!narrow && (
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 11, color: tk.textMute }}>
                <span style={{ color: tk.success }}>●</span> còn 50 lượt
              </span>
            )}
          </div>

          {/* Reference images — always visible */}
          <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ ...advLabel(tk), marginBottom: 0, display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span style={{ display: "inline-flex", color: tk.accent }}>{Icons.image}</span>
                Ảnh tham chiếu <span style={{ color: tk.textMute, fontWeight: 500 }}>· 0/10</span>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <button style={{ ...ibtn, width: 26, height: 26 }}>{Icons.search}</button>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 5, height: 26, padding: "0 8px",
                  background: tk.surface2, border: `1px solid ${tk.border}`, borderRadius: 7,
                  fontSize: 11.5, fontWeight: 600, color: tk.textDim, cursor: "pointer",
                }}>{Icons.filter} Tất cả {Icons.chev}</div>
              </div>
            </div>
            <div style={{
              minHeight: 96, padding: "12px 14px",
              background: `repeating-linear-gradient(45deg, ${tk.surface2}, ${tk.surface2} 8px, ${tk.surface} 8px, ${tk.surface} 16px)`,
              border: `1.5px dashed ${tk.borderStrong}`, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap",
              color: tk.textDim, fontSize: 12.5, textAlign: "center",
            }}>
              <span style={{ display: "inline-flex" }}>{Icons.upload}</span>
              Kéo thả ảnh · hoặc <span style={{ color: tk.heading, fontWeight: 600 }}>chọn ảnh</span> · Ctrl+V để dán
            </div>
          </div>

          {/* Advanced drawer */}
          {advanced && (
            <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: vnarrow ? "1 1 100%" : "2 1 200px" }}>
                  <div style={advLabel(tk)}>Tên file</div>
                  <div style={{ display: "flex", alignItems: "center", background: tk.surface2, border: `1px solid ${tk.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ padding: "0 10px", color: tk.textMute, fontFamily: MONO, fontSize: 12 }}>/</div>
                    <input defaultValue="h2flow-01" style={{ flex: 1, minWidth: 0, height: 34, padding: "0 4px", background: "transparent", color: tk.text, border: "none", outline: "none", fontFamily: MONO, fontSize: 12.5 }} />
                    <div style={{ padding: "0 10px", color: tk.textMute, fontFamily: MONO, fontSize: 12 }}>.png</div>
                  </div>
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <div style={advLabel(tk)}>Tự động tải</div>
                  <Seg tk={tk} size="sm" value={autoDl ? "on" : "off"} onChange={(v) => setAutoDl(v === "on")} options={[{ id: "off", label: "Tắt" }, { id: "on", label: "Bật" }]} />
                </div>
                <div style={{ flex: "1 1 120px" }}>
                  <div style={advLabel(tk)}>Chất lượng</div>
                  <Seg tk={tk} size="sm" value="1k" options={[{ id: "1k", label: "1K" }, { id: "2k", label: "2K" }, { id: "4k", label: "4K" }]} />
                </div>
              </div>
            </div>
          )}

          {/* Recent strip */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 16, letterSpacing: 0.2, color: tk.heading }}>Gần đây</div>
              <button style={{ background: "none", border: "none", color: tk.textDim, fontSize: 11.5, fontFamily: FONT, cursor: "pointer" }}>Xem tất cả →</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${recentCols}, 1fr)`, gap: 12 }}>
              {Array.from({ length: recentCols * 2 > 8 ? 8 : recentCols === 2 ? 4 : recentCols }).map((_, i) => (
                <div key={i} style={{ aspectRatio: "16 / 9", background: thumb(i % 4), borderRadius: 12, border: `1px solid ${tk.border}`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", bottom: 8, left: 10, fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.85)" }}>h2flow-{String(i).padStart(2, "0")}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ─── Status bar ─── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, padding: `10px ${padX}px`, borderTop: `1px solid ${tk.border}`, background: tk.surface,
        fontFamily: MONO, fontSize: 11.5, flexWrap: "wrap", rowGap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <label onClick={() => setAutoDl(!autoDl)} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: tk.textDim, cursor: "pointer" }}>
            <span style={{ display: "grid", placeItems: "center", width: 15, height: 15, borderRadius: 4, background: autoDl ? tk.success : tk.surface3, color: tk.onSuccess, border: autoDl ? "none" : `1px solid ${tk.border}` }}>{autoDl && Icons.check}</span>
            Tự tải
          </label>
          <label onClick={() => setRetry(!retry)} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: tk.textDim, cursor: "pointer" }}>
            <span style={{ display: "grid", placeItems: "center", width: 15, height: 15, borderRadius: 4, background: retry ? tk.success : tk.surface3, color: tk.onSuccess, border: retry ? "none" : `1px solid ${tk.border}` }}>{retry && Icons.check}</span>
            Tự thử lại
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: vnarrow ? 12 : 18, color: tk.textMute, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "inline-flex", color: tk.textDim }}>{Icons.bolt}</span>Hàng đợi <span style={{ color: tk.heading, fontWeight: 700 }}>0/20</span></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "inline-flex", color: tk.textDim }}>{Icons.image}</span>Đã tạo <span style={{ color: tk.heading, fontWeight: 700 }}>0</span></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "inline-flex", color: tk.textDim }}>{Icons.download}</span>Đã tải <span style={{ color: tk.heading, fontWeight: 700 }}>0</span></span>
        </div>
      </div>
    </div>
  );
}

window.StudioApp = StudioApp;
