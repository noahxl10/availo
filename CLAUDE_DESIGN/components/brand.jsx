// Brand: Names, Logos, Color Palette, Typography
const BrandSection = () => {
  const names = [
    { name: "Availo", tagline: "Availability, simplified.", note: "Clean, coined word. Easy to say, spell, remember." },
    { name: "Slotto", tagline: "Every slot, filled.", note: "Playful but sharp. Memorable for time-slot booking." },
    { name: "Blockt", tagline: "Own your calendar.", note: "Confident, modern. Nods to calendar blocks." },
    { name: "Bookspan", tagline: "From inquiry to booked.", note: "Clear, functional. Broad appeal." },
    { name: "Folio", tagline: "Your business, beautifully booked.", note: "Premium feel. Works for experiences + classes." },
    { name: "Slipway", tagline: "Smooth from browse to booking.", note: "Nautical metaphor, effortless journey." },
    { name: "Tivio", tagline: "Bookings that work for you.", note: "Coined, modern SaaS feel." },
    { name: "Spano", tagline: "Time, space, experience.", note: "Short, European feel. Memorable." },
    { name: "Opero", tagline: "Built for operators.", note: "Operator-first positioning built into the name." },
    { name: "Kivo", tagline: "Keep guests coming back.", note: "Warm, retention-focused brand voice." },
  ];

  const logoDirections = [
    {
      name: "Direction A — Wordmark",
      description: "Clean DM Serif Display wordmark with a geometric availability dot motif replacing the 'i'.",
      bg: "#1e8f88",
      fg: "#ffffff",
      type: "wordmark"
    },
    {
      name: "Direction B — Mark + Type",
      description: "Minimal grid-square mark (calendar abstraction) paired with DM Sans medium wordmark.",
      bg: "#f8f8f7",
      fg: "#1a1916",
      type: "mark"
    },
    {
      name: "Direction C — Monogram",
      description: "Bold 'A' with negative-space time slot cut-through. Scales to favicon/app icon.",
      bg: "#2a2825",
      fg: "#2ea69f",
      type: "mono"
    }
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Name Exploration */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7d7970', marginBottom: 20 }}>
          01 — Brand Name Exploration
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {names.map((n, i) => (
            <div key={i} style={{
              background: i === 0 ? '#1e8f88' : '#f8f8f7',
              border: `1px solid ${i === 0 ? 'transparent' : '#e4e2de'}`,
              borderRadius: 10,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              <div style={{
                fontFamily: i === 0 ? "'DM Serif Display', serif" : "'DM Sans', sans-serif",
                fontSize: i === 0 ? 28 : 20,
                fontWeight: i === 0 ? 400 : 600,
                color: i === 0 ? '#ffffff' : '#1a1916',
                letterSpacing: i === 0 ? '-0.5px' : '-0.3px',
              }}>
                {n.name}
                {i === 0 && <span style={{ fontSize: 11, fontWeight: 500, background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 8px', marginLeft: 10, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>Selected</span>}
              </div>
              <div style={{ fontSize: 12, color: i === 0 ? 'rgba(255,255,255,0.85)' : '#5c5852', fontStyle: 'italic' }}>{n.tagline}</div>
              <div style={{ fontSize: 11, color: i === 0 ? 'rgba(255,255,255,0.65)' : '#a8a49c', marginTop: 2 }}>{n.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Logo Directions */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7d7970', marginBottom: 20 }}>
          02 — Logo Directions
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {logoDirections.map((dir, i) => (
            <div key={i} style={{ border: '1px solid #e4e2de', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{
                background: dir.bg,
                height: 140,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {dir.type === 'wordmark' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 38, color: dir.fg, letterSpacing: '-1px' }}>Avail</span>
                    <span style={{ display: 'inline-flex', width: 10, height: 10, background: '#ffffff', borderRadius: '50%', marginBottom: -2, marginLeft: 1, marginRight: 1, opacity: 0.95 }}></span>
                    <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 38, color: dir.fg, letterSpacing: '-1px' }}>o</span>
                  </div>
                )}
                {dir.type === 'mark' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, width: 36, height: 36 }}>
                      {[1,1,1, 1,0,1, 1,1,0].map((fill, ci) => (
                        <div key={ci} style={{ background: fill ? '#1a1916' : 'transparent', border: `1.5px solid #1a1916`, borderRadius: 3 }} />
                      ))}
                    </div>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 28, fontWeight: 500, color: dir.fg, letterSpacing: '-0.5px' }}>Availo</span>
                  </div>
                )}
                {dir.type === 'mono' && (
                  <div style={{ position: 'relative', width: 64, height: 64 }}>
                    <div style={{
                      width: 64, height: 64,
                      background: dir.fg,
                      borderRadius: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 36, fontWeight: 700, color: '#2a2825', lineHeight: 1 }}>A</span>
                    </div>
                    <div style={{
                      position: 'absolute', bottom: 10, right: -4,
                      width: 18, height: 8,
                      background: '#2a2825',
                      borderRadius: 3,
                    }} />
                  </div>
                )}
              </div>
              <div style={{ padding: '14px 16px', background: '#ffffff' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1916', marginBottom: 4 }}>{dir.name}</div>
                <div style={{ fontSize: 11, color: '#7d7970', lineHeight: 1.5 }}>{dir.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Color Palette */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7d7970', marginBottom: 20 }}>
          03 — Color System
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Accent scale */}
          <div>
            <div style={{ fontSize: 11, color: '#a8a49c', marginBottom: 8, fontWeight: 500 }}>Accent — Teal</div>
            <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden' }}>
              {[
                ['50', '#eef7f6'], ['100', '#cceae7'], ['200', '#99d5d0'],
                ['300', '#5cbab4'], ['400', '#2ea69f'], ['500', '#1e8f88'],
                ['600', '#177870'], ['700', '#115f59'], ['800', '#0b4541'], ['900', '#072e2b']
              ].map(([step, hex]) => (
                <div key={step} style={{ flex: 1, height: 56, background: hex, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}>
                  <div style={{ fontSize: 9, color: parseInt(step) < 400 ? '#177870' : 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{step}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Neutral scale */}
          <div>
            <div style={{ fontSize: 11, color: '#a8a49c', marginBottom: 8, fontWeight: 500 }}>Neutral — Warm Slate</div>
            <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden' }}>
              {[
                ['0', '#ffffff'], ['50', '#f8f8f7'], ['100', '#f1f0ee'], ['200', '#e4e2de'],
                ['300', '#cac7c1'], ['400', '#a8a49c'], ['500', '#7d7970'],
                ['600', '#5c5852'], ['700', '#3e3b37'], ['800', '#2a2825'], ['900', '#1a1916']
              ].map(([step, hex]) => (
                <div key={step} style={{ flex: 1, height: 56, background: hex, border: step === '0' ? '1px solid #e4e2de' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}>
                  <div style={{ fontSize: 9, color: parseInt(step) < 400 ? '#5c5852' : 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{step}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Semantic */}
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Success', bg: '#edf7f2', border: '#b8e8d4', dot: '#1a9e6e', text: '#0d5237' },
              { label: 'Warning', bg: '#fef6ec', border: '#fad9a8', dot: '#e08c2a', text: '#7a4a0e' },
              { label: 'Error', bg: '#fef0f0', border: '#f9c4c4', dot: '#d94f4f', text: '#7a1515' },
              { label: 'Info', bg: '#eff5fd', border: '#b8d1f5', dot: '#3b7fd4', text: '#1a3d72' },
            ].map((s) => (
              <div key={s.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: s.text }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: s.dot, fontFamily: "'JetBrains Mono', monospace" }}>{s.dot}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Dark theme preview */}
          <div style={{ background: '#111210', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#bbbfbb' }}>Dark Theme Available</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['#111210','#181917','#1f2120','#2b2d2b','#3a3d3a','#505450','#6e736e','#959a95','#bbbfbb','#f4f5f4'].map((c, i) => (
                <div key={i} style={{ width: 24, height: 24, borderRadius: 5, background: c, border: i === 0 ? '1px solid #2b2d2b' : 'none' }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Typography System */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7d7970', marginBottom: 20 }}>
          04 — Typography System
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #e4e2de', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: 'Display', font: "'DM Serif Display', serif", size: 48, weight: 400, lh: 1.15, sample: 'Book your next experience', note: 'display / 48px / Regular / DM Serif Display' },
            { label: 'H1', font: "'DM Sans', sans-serif", size: 36, weight: 600, lh: 1.2, sample: 'Manage your listings', note: 'h1 / 36px / Semibold / DM Sans' },
            { label: 'H2', font: "'DM Sans', sans-serif", size: 24, weight: 600, lh: 1.3, sample: 'Upcoming bookings', note: 'h2 / 24px / Semibold / DM Sans' },
            { label: 'H3', font: "'DM Sans', sans-serif", size: 18, weight: 600, lh: 1.4, sample: 'Kayak Tour — 2hr Morning Session', note: 'h3 / 18px / Semibold / DM Sans' },
            { label: 'Body', font: "'DM Sans', sans-serif", size: 15, weight: 400, lh: 1.6, sample: 'Configure availability windows, guest limits, and pricing for each listing.', note: 'body / 15px / Regular / DM Sans' },
            { label: 'Small', font: "'DM Sans', sans-serif", size: 13, weight: 400, lh: 1.5, sample: 'Last updated 3 hours ago · 4 bookings pending', note: 'small / 13px / Regular / DM Sans' },
            { label: 'Label', font: "'DM Sans', sans-serif", size: 11, weight: 600, lh: 1.4, sample: 'AVAILABILITY WINDOW', note: 'label / 11px / Semibold / DM Sans / tracked +0.08em', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7d7970' },
            { label: 'Mono', font: "'JetBrains Mono', monospace", size: 13, weight: 400, lh: 1.5, sample: '#1e8f88 · --color-accent-500', note: 'mono / 13px / Regular / JetBrains Mono', color: '#177870', bg: '#eef7f6' },
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 20, padding: '14px 20px', background: t.bg || (i % 2 === 0 ? '#ffffff' : '#fafaf9'), borderBottom: i < 7 ? '1px solid #f1f0ee' : 'none' }}>
              <div style={{ width: 52, flexShrink: 0, fontSize: 10, fontWeight: 600, color: '#a8a49c', textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 3 }}>{t.label}</div>
              <div style={{ flex: 1, fontFamily: t.font, fontSize: t.size, fontWeight: t.weight, lineHeight: t.lh, color: t.color || '#1a1916', letterSpacing: t.letterSpacing, textTransform: t.textTransform }}>{t.sample}</div>
              <div style={{ width: 280, flexShrink: 0, fontSize: 10, color: '#a8a49c', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{t.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { BrandSection });
