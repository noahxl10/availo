// Full Example Screens: Login, Onboarding, Dashboard, Listings, Create Listing,
// Availability Calendar, Booking Detail, Embed Setup, Public Widget

const Screen = ({ children, bg = '#f1f0ee', style = {} }) => (
  <div style={{
    width: '100%', height: '100%', background: bg,
    fontFamily: "'DM Sans', sans-serif",
    overflow: 'hidden', position: 'relative',
    ...style
  }}>
    {children}
  </div>
);

// ── LOGIN SCREEN ────────────────────────────────────────────────
const LoginScreen = () => {
  const [phone, setPhone] = React.useState('');
  const [step, setStep] = React.useState('phone'); // phone | otp
  const [otp, setOtp] = React.useState(['', '', '', '', '', '']);

  return (
    <Screen bg="#f8f8f7">
      <div style={{ display: 'flex', height: '100%' }}>
        {/* Left panel */}
        <div style={{ width: 420, background: '#1a1916', display: 'flex', flexDirection: 'column', padding: '48px 44px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'auto' }}>
            <div style={{ width: 32, height: 32, background: '#1e8f88', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>A</span>
            </div>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: '#ffffff', letterSpacing: '-0.3px' }}>Availo</span>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 32, fontFamily: "'DM Serif Display', serif", color: '#ffffff', lineHeight: 1.25, marginBottom: 16 }}>
              Your bookings,<br />beautifully managed.
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, maxWidth: 280 }}>
              The operator platform for tours, rentals, classes, and experiences.
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { n: '340+', l: 'Operators' },
              { n: '18k', l: 'Bookings/mo' },
              { n: '99.9%', l: 'Uptime' },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#2ea69f', minWidth: 52 }}>{s.n}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
            {step === 'phone' ? (
              <>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1916', marginBottom: 6, letterSpacing: '-0.4px' }}>Sign in</div>
                <div style={{ fontSize: 14, color: '#7d7970', marginBottom: 32 }}>We'll send a one-time code to your phone.</div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#5c5852', display: 'block', marginBottom: 8 }}>Phone Number</label>
                  <div style={{ display: 'flex', gap: 0, border: '1.5px solid #e4e2de', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                    <div style={{ padding: '12px 14px', background: '#f8f8f7', borderRight: '1.5px solid #e4e2de', fontSize: 14, color: '#5c5852', whiteSpace: 'nowrap' }}>🇺🇸 +1</div>
                    <input
                      value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="(555) 000-0000"
                      style={{ flex: 1, padding: '12px 14px', border: 'none', outline: 'none', fontSize: 14, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", background: 'transparent' }}
                    />
                  </div>
                </div>
                <button onClick={() => setStep('otp')} style={{
                  width: '100%', background: '#1e8f88', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif', marginBottom: 16",
                }}>
                  Continue →
                </button>
                <div style={{ fontSize: 12, color: '#a8a49c', textAlign: 'center', marginTop: 16 }}>
                  By continuing you agree to our <span style={{ color: '#1e8f88', cursor: 'pointer' }}>Terms</span> and <span style={{ color: '#1e8f88', cursor: 'pointer' }}>Privacy Policy</span>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setStep('phone')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7d7970', fontSize: 13, padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1916', marginBottom: 6, letterSpacing: '-0.4px' }}>Enter your code</div>
                <div style={{ fontSize: 14, color: '#7d7970', marginBottom: 32 }}>Sent to +1 {phone || '(555) 283-1947'}</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                  {otp.map((v, i) => (
                    <input key={i} maxLength={1} value={v}
                      onChange={e => { const n = [...otp]; n[i] = e.target.value; setOtp(n); }}
                      style={{
                        width: 44, height: 52, textAlign: 'center', fontSize: 20, fontWeight: 700,
                        border: '1.5px solid #e4e2de', borderRadius: 10, outline: 'none',
                        color: '#1a1916', fontFamily: "'DM Sans', sans-serif",
                      }}
                      onFocus={e => e.target.style.borderColor = '#1e8f88'}
                      onBlur={e => e.target.style.borderColor = '#e4e2de'}
                    />
                  ))}
                </div>
                <button style={{ width: '100%', background: '#1e8f88', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Verify & Sign In
                </button>
                <div style={{ fontSize: 12, color: '#a8a49c', textAlign: 'center', marginTop: 14 }}>
                  Didn't get it? <span style={{ color: '#1e8f88', cursor: 'pointer' }}>Resend code</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Screen>
  );
};

// ── ONBOARDING SCREEN ───────────────────────────────────────────
const OnboardingScreen = () => {
  const [step, setStep] = React.useState(0);
  const steps = ['Business', 'Experience', 'Widget'];
  const stepContent = [
    {
      title: 'Tell us about your business',
      fields: [
        { label: 'Business Name', placeholder: 'Ocean Tours Co.', value: 'Ocean Tours Co.' },
        { label: 'Business Type', type: 'select', options: ['Tour Operator', 'Rental Shop', 'Fitness Studio', 'Event Venue', 'Other'] },
        { label: 'Location', placeholder: 'Santa Cruz, CA', value: 'Santa Cruz, CA' },
        { label: 'Website (optional)', placeholder: 'https://yoursite.com' },
      ]
    },
    {
      title: 'Add your first experience',
      fields: [
        { label: 'Experience Name', placeholder: 'Morning Kayak Tour', value: 'Morning Kayak Tour' },
        { label: 'Duration', type: 'select', options: ['30 min', '1 hour', '2 hours', '4 hours', 'Full Day', 'Custom'] },
        { label: 'Price per guest', placeholder: '$0.00', value: '$65.00' },
        { label: 'Max guests', placeholder: '12', value: '8' },
      ]
    },
    {
      title: 'Set up your booking widget',
      fields: [],
      isEmbed: true,
    }
  ];

  return (
    <Screen bg="#f8f8f7">
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 520, background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '28px 32px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <div style={{ width: 28, height: 28, background: '#1e8f88', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>A</span>
              </div>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: '#1a1916' }}>Availo</span>
            </div>
            {/* Progress */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
              {steps.map((s, i) => (
                <React.Fragment key={s}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: i < step ? '#1e8f88' : i === step ? '#1e8f88' : '#f1f0ee',
                      color: i <= step ? '#fff' : '#a8a49c',
                      fontSize: 12, fontWeight: 700,
                      border: `2px solid ${i <= step ? '#1e8f88' : '#e4e2de'}`,
                    }}>
                      {i < step ? '✓' : i + 1}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: i === step ? '#1e8f88' : i < step ? '#2ea69f' : '#a8a49c' }}>{s}</div>
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ flex: 2, height: 2, background: i < step ? '#1e8f88' : '#e4e2de', alignSelf: 'flex-start', marginTop: 13, transition: 'background 0.3s' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1916', marginBottom: 6 }}>{stepContent[step].title}</div>
          </div>
          {/* Content */}
          <div style={{ padding: '16px 32px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {stepContent[step].isEmbed ? (
              <div>
                <div style={{ fontSize: 13, color: '#7d7970', marginBottom: 16 }}>Copy this snippet and paste it where you want the booking widget to appear.</div>
                <div style={{ background: '#1a1916', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#5cbab4', lineHeight: 1.6 }}>
                    {'<script src="https://cdn.availo.io/widget.js"'}<br />
                    {'  data-key="ak_live_oce_2a9f3b"'}<br />
                    {'  data-listing="kayak-morning-tour"'}<br />
                    {'></script>'}
                  </div>
                </div>
                <button style={{ width: '100%', padding: '10px', border: '1.5px dashed #2ea69f', borderRadius: 10, background: '#eef7f6', color: '#177870', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  Copy Snippet
                </button>
              </div>
            ) : (
              stepContent[step].fields.map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#5c5852', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: '#fff' }}>
                      {f.options.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input defaultValue={f.value} placeholder={f.placeholder} type={f.type || 'text'} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
                      onFocus={e => e.target.style.borderColor = '#2ea69f'}
                      onBlur={e => e.target.style.borderColor = '#e4e2de'}
                    />
                  )}
                </div>
              ))
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: '11px', border: '1.5px solid #e4e2de', borderRadius: 10, background: 'none', cursor: 'pointer', fontSize: 13, color: '#5c5852', fontFamily: "'DM Sans', sans-serif" }}>Back</button>
              )}
              <button onClick={() => step < 2 ? setStep(s => s + 1) : null} style={{ flex: 3, padding: '11px', border: 'none', borderRadius: 10, background: '#1e8f88', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
                {step < 2 ? 'Continue →' : 'Go to Dashboard →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
};

// ── DASHBOARD SCREEN ─────────────────────────────────────────────
const DashboardScreen = () => {
  const bookings = [
    { name: 'Lena Marsh', listing: 'Morning Kayak Tour', date: 'May 8 · 9:00 AM', guests: 3, total: '$195', status: 'confirmed' },
    { name: 'Ray Johansson', listing: 'Sunset Paddleboard', date: 'May 8 · 5:30 PM', guests: 2, total: '$130', status: 'confirmed' },
    { name: 'Dana Cruz', listing: 'Full-Day Sea Cave Tour', date: 'May 9 · 8:00 AM', guests: 6, total: '$540', status: 'pending' },
    { name: 'Mikael Osei', listing: 'Snorkel Adventure', date: 'May 10 · 10:00 AM', guests: 4, total: '$280', status: 'confirmed' },
  ];

  return (
    <Screen bg="#f8f8f7">
      <div style={{ display: 'flex', height: '100%' }}>
        <SidebarNav />
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1916', letterSpacing: '-0.4px' }}>Good morning, Jamie</div>
              <div style={{ fontSize: 13, color: '#7d7970', marginTop: 3 }}>Thursday, April 30, 2026 · Ocean Tours Co.</div>
            </div>
            <button style={{ background: '#1e8f88', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
              + New Listing
            </button>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
            <StatCard label="Bookings this month" value="84" delta="12%" sub="vs last month" />
            <StatCard label="Revenue this month" value="$6,240" delta="8.4%" sub="vs last month" />
            <StatCard label="Upcoming (7 days)" value="23" sub="next booking in 4h" />
            <StatCard label="Avg. party size" value="3.2" delta="0.4" deltaDir="up" sub="vs last month" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
            {/* Recent bookings */}
            <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f0ee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1916' }}>Recent Bookings</div>
                <span style={{ fontSize: 12, color: '#1e8f88', cursor: 'pointer' }}>View all →</span>
              </div>
              <div>
                {bookings.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: i < bookings.length - 1 ? '1px solid #f8f8f7' : 'none', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafaf9'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#cceae7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#177870', flexShrink: 0 }}>
                      {b.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916' }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: '#7d7970', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.listing} · {b.date} · {b.guests} guests</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1916', marginRight: 10 }}>{b.total}</div>
                    <div style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 99, textTransform: 'capitalize',
                      background: b.status === 'confirmed' ? '#edf7f2' : '#fef6ec',
                      color: b.status === 'confirmed' ? '#1a9e6e' : '#e08c2a',
                    }}>{b.status}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini calendar */}
            <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1916', marginBottom: 14 }}>Availability — May</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center' }}>
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 600, color: '#a8a49c', paddingBottom: 6 }}>{d}</div>
                ))}
                {Array(2).fill(null).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: 30 }, (_, i) => i + 1).map(d => {
                  const booked = [1,2,6,7,8,9,14,15,16,22,23,29].includes(d);
                  const full = [8,15].includes(d);
                  return (
                    <div key={d} style={{
                      aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 5, fontSize: 11,
                      background: full ? '#1e8f88' : booked ? '#cceae7' : 'transparent',
                      color: full ? '#fff' : booked ? '#177870' : '#3e3b37',
                      fontWeight: booked ? 600 : 400,
                    }}>{d}</div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 14 }}>
                {[{ bg: '#1e8f88', c: '#fff', l: 'Full' }, { bg: '#cceae7', c: '#177870', l: 'Booked' }, { bg: 'transparent', c: '#a8a49c', l: 'Open' }].map(s => (
                  <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: s.bg, border: s.bg === 'transparent' ? '1px solid #e4e2de' : 'none' }} />
                    <span style={{ fontSize: 11, color: '#7d7970' }}>{s.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
};

// ── LISTINGS MANAGER ─────────────────────────────────────────────
const ListingsScreen = () => {
  const listings = [
    { title: 'Morning Kayak Tour', type: 'Tour · 2 hours', price: '$65/guest', capacity: 8, status: 'active' },
    { title: 'Sunset Paddleboard', type: 'Rental · 1.5 hours', price: '$45/guest', capacity: 6, status: 'active' },
    { title: 'Full-Day Sea Cave Tour', type: 'Tour · 8 hours', price: '$120/guest', capacity: 10, status: 'active' },
    { title: 'Snorkel Adventure', type: 'Tour · 3 hours', price: '$70/guest', capacity: 12, status: 'active' },
    { title: 'Junior Ocean Class', type: 'Class · 1 hour', price: '$35/guest', capacity: 8, status: 'draft' },
    { title: 'Corporate Team Paddle', type: 'Event · 4 hours', price: '$200/group', capacity: 20, status: 'paused' },
  ];

  return (
    <Screen bg="#f8f8f7">
      <div style={{ display: 'flex', height: '100%' }}>
        <SidebarNav />
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1916', letterSpacing: '-0.4px' }}>Listings</div>
              <div style={{ fontSize: 13, color: '#7d7970', marginTop: 3 }}>6 listings · 4 active</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <input placeholder="Search listings…" style={{ padding: '9px 14px 9px 34px', border: '1.5px solid #e4e2de', borderRadius: 9, fontSize: 13, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: '#fff', width: 200 }} />
                <span style={{ position: 'absolute', left: 11, top: 10, color: '#a8a49c', fontSize: 14 }}>⊕</span>
              </div>
              <button style={{ background: '#1e8f88', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                + New Listing
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {listings.map((l, i) => <ListingCard key={i} {...l} />)}
          </div>
        </div>
      </div>
    </Screen>
  );
};

// ── BOOKING DETAIL ───────────────────────────────────────────────
const BookingDetailScreen = () => (
  <Screen bg="#f8f8f7">
    <div style={{ display: 'flex', height: '100%' }}>
      <SidebarNav />
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button style={{ background: 'none', border: '1.5px solid #e4e2de', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#5c5852', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>← Bookings</button>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1916' }}>#BK-20485</div>
          <span style={{ background: '#edf7f2', color: '#1a9e6e', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>Confirmed</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Guest info */}
            <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916', marginBottom: 16 }}>Guest</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#cceae7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#177870' }}>LM</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1916' }}>Lena Marsh</div>
                  <div style={{ fontSize: 12, color: '#7d7970' }}>lena.marsh@gmail.com · +1 (555) 847-2291</div>
                </div>
              </div>
            </div>
            {/* Experience */}
            <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916', marginBottom: 16 }}>Experience</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Listing', 'Morning Kayak Tour'],
                  ['Date & Time', 'May 8, 2026 · 9:00 AM'],
                  ['Duration', '2 hours'],
                  ['Guests', '3 (2 adults, 1 child)'],
                  ['Add-ons', 'Wetsuit ×3, Photos ×1'],
                  ['Meeting Point', 'Main Beach Pier, Slip 4'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#a8a49c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 13, color: '#1a1916' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Notes */}
            <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916', marginBottom: 10 }}>Guest Notes</div>
              <div style={{ fontSize: 13, color: '#5c5852', background: '#f8f8f7', borderRadius: 8, padding: '10px 14px', fontStyle: 'italic' }}>
                "One child is 7 years old. Hoping for calm water conditions. First time kayaking for the group."
              </div>
            </div>
          </div>
          {/* Sidebar summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #f1f0ee' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916', marginBottom: 12 }}>Payment</div>
                {[['2× Adult ($65)', '$130.00'], ['1× Child ($45)', '$45.00'], ['Wetsuit ×3', '$45.00'], ['Photos ×1', '$35.00'], ['Fee', '$5.50']].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 12, color: '#7d7970' }}>{k}</span>
                    <span style={{ fontSize: 12, color: '#1a1916', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #f1f0ee', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1916' }}>Total</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1916' }}>$260.50</span>
                </div>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button style={{ width: '100%', padding: '9px', border: 'none', borderRadius: 8, background: '#1e8f88', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Send Reminder</button>
                <button style={{ width: '100%', padding: '9px', border: '1.5px solid #f9c4c4', borderRadius: 8, background: 'none', color: '#d94f4f', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel Booking</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Screen>
);

// ── EMBED SETUP ──────────────────────────────────────────────────
const EmbedScreen = () => {
  const [copied, setCopied] = React.useState(false);
  const [theme, setTheme] = React.useState('light');
  const [listing, setListing] = React.useState('kayak-morning-tour');

  return (
    <Screen bg="#f8f8f7">
      <div style={{ display: 'flex', height: '100%' }}>
        <SidebarNav />
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1916', marginBottom: 4 }}>Embed Widget</div>
          <div style={{ fontSize: 13, color: '#7d7970', marginBottom: 28 }}>Add a booking widget to any website in under 5 minutes.</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Config */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '20px 22px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916', marginBottom: 16 }}>Configuration</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#5c5852', display: 'block', marginBottom: 6 }}>Listing</label>
                    <select value={listing} onChange={e => setListing(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: '#fff' }}>
                      <option value="kayak-morning-tour">Morning Kayak Tour</option>
                      <option>Sunset Paddleboard</option>
                      <option>Full-Day Sea Cave Tour</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#5c5852', display: 'block', marginBottom: 8 }}>Theme</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['light', 'dark', 'auto'].map(t => (
                        <button key={t} onClick={() => setTheme(t)} style={{ flex: 1, padding: '8px', border: `1.5px solid ${theme === t ? '#1e8f88' : '#e4e2de'}`, borderRadius: 7, background: theme === t ? '#eef7f6' : '#fff', color: theme === t ? '#177870' : '#5c5852', fontSize: 12, fontWeight: theme === t ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textTransform: 'capitalize' }}>{t}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '20px 22px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916', marginBottom: 14 }}>Embed Code</div>
                <div style={{ background: '#1a1916', borderRadius: 10, padding: '16px', marginBottom: 14, position: 'relative' }}>
                  <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#5cbab4', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
{`<script
  src="https://cdn.availo.io/widget.js"
  data-key="ak_live_oce_2a9f3b"
  data-listing="${listing}"
  data-theme="${theme}"
></script>`}
                  </pre>
                </div>
                <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }} style={{ width: '100%', padding: '10px', border: 'none', borderRadius: 9, background: copied ? '#1a9e6e' : '#1e8f88', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.2s' }}>
                  {copied ? '✓ Copied!' : 'Copy Code'}
                </button>
              </div>
            </div>

            {/* Preview */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#a8a49c', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Widget Preview</div>
              <div style={{ background: '#e8e4de', borderRadius: 16, padding: 24, minHeight: 420 }}>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#a8a49c', marginBottom: 12 }}>yourwebsite.com — embedded widget</div>
                <BookingWidget compact={true} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
};

// ── PUBLIC BOOKING WIDGET ────────────────────────────────────────
const BookingWidget = ({ compact = false }) => {
  const [widgetStep, setWidgetStep] = React.useState(0);
  const [selDate, setSelDate] = React.useState(8);
  const [selSlot, setSelSlot] = React.useState('9:00 AM');
  const [guests, setGuests] = React.useState({ adults: 2, children: 1 });
  const slots = ['8:00 AM', '9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'];
  const dates = [7, 8, 9, 12, 14, 15, 16, 19, 22, 23];

  const totalBase = guests.adults * 65 + guests.children * 45;

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: compact ? 14 : 20,
      boxShadow: compact ? '0 4px 20px rgba(0,0,0,0.1)' : '0 8px 40px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      fontFamily: "'DM Sans', sans-serif",
      maxWidth: compact ? '100%' : 400,
    }}>
      {/* Header */}
      <div style={{ background: '#1a1916', padding: compact ? '16px 18px' : '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: compact ? 13 : 16, fontWeight: 700, color: '#ffffff' }}>Morning Kayak Tour</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>Ocean Tours Co. · 2 hours · from $65</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: widgetStep === i ? '#2ea69f' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>
      </div>

      <div style={{ padding: compact ? '16px 18px' : '20px 24px' }}>
        {widgetStep === 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7d7970', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Select Date</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {dates.map(d => (
                <button key={d} onClick={() => setSelDate(d)} style={{
                  padding: '6px 12px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  border: `1.5px solid ${selDate === d ? '#1e8f88' : '#e4e2de'}`,
                  background: selDate === d ? '#1e8f88' : '#fff',
                  color: selDate === d ? '#fff' : '#3e3b37',
                  fontWeight: selDate === d ? 600 : 400,
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.1s',
                }}>
                  May {d}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7d7970', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Time</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {slots.map(s => (
                <button key={s} onClick={() => setSelSlot(s)} style={{
                  padding: '7px 14px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
                  border: `1.5px solid ${selSlot === s ? '#1e8f88' : '#e4e2de'}`,
                  background: selSlot === s ? '#eef7f6' : '#fff',
                  color: selSlot === s ? '#177870' : '#3e3b37',
                  fontWeight: selSlot === s ? 600 : 400,
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.1s',
                }}>
                  {s}
                </button>
              ))}
            </div>
            <button onClick={() => setWidgetStep(1)} style={{ width: '100%', background: '#1e8f88', color: '#fff', border: 'none', borderRadius: 9, padding: compact ? '10px' : '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Next: Guests →
            </button>
          </div>
        )}

        {widgetStep === 1 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7d7970', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Guests</div>
            {[{ key: 'adults', label: 'Adults', sub: 'Ages 13+', min: 1, max: 10, price: 65 }, { key: 'children', label: 'Children', sub: 'Ages 3–12', min: 0, max: 8, price: 45 }].map((t, i) => (
              <div key={t.key} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: i === 0 ? '1px solid #f1f0ee' : 'none' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1916' }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: '#a8a49c' }}>{t.sub} · ${t.price}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => setGuests(g => ({ ...g, [t.key]: Math.max(t.min, g[t.key] - 1) }))} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #cac7c1', background: 'none', cursor: 'pointer', fontSize: 16, color: '#5c5852', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1916', minWidth: 14, textAlign: 'center' }}>{guests[t.key]}</span>
                  <button onClick={() => setGuests(g => ({ ...g, [t.key]: Math.min(t.max, g[t.key] + 1) }))} style={{ width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #1e8f88', background: 'none', cursor: 'pointer', fontSize: 16, color: '#1e8f88', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setWidgetStep(0)} style={{ flex: 1, padding: '10px', border: '1.5px solid #e4e2de', borderRadius: 9, background: 'none', cursor: 'pointer', fontSize: 13, color: '#5c5852', fontFamily: "'DM Sans', sans-serif" }}>Back</button>
              <button onClick={() => setWidgetStep(2)} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 9, background: '#1e8f88', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Next: Confirm →</button>
            </div>
          </div>
        )}

        {widgetStep === 2 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7d7970', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Confirm Booking</div>
            <div style={{ background: '#f8f8f7', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              {[
                ['Date', `May ${selDate}, 2026`],
                ['Time', selSlot],
                ['Guests', `${guests.adults} adults, ${guests.children} child${guests.children !== 1 ? 'ren' : ''}`],
                ['Total', `$${totalBase}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: '#7d7970' }}>{k}</span>
                  <span style={{ color: '#1a1916', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <input placeholder="Full name" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 12, marginBottom: 8, fontFamily: "'DM Sans', sans-serif", outline: 'none' }} onFocus={e => e.target.style.borderColor = '#2ea69f'} onBlur={e => e.target.style.borderColor = '#e4e2de'} />
            <input placeholder="Email address" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 12, marginBottom: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none' }} onFocus={e => e.target.style.borderColor = '#2ea69f'} onBlur={e => e.target.style.borderColor = '#e4e2de'} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setWidgetStep(1)} style={{ flex: 1, padding: '10px', border: '1.5px solid #e4e2de', borderRadius: 9, background: 'none', cursor: 'pointer', fontSize: 13, color: '#5c5852', fontFamily: "'DM Sans', sans-serif" }}>Back</button>
              <button style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 9, background: '#1e8f88', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Book Now · ${totalBase}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── CREATE LISTING SCREEN ────────────────────────────────────────
const CreateListingScreen = () => {
  const [activeTab, setActiveTab] = React.useState('details');
  const tabs = ['details', 'pricing', 'availability', 'add-ons'];

  return (
    <Screen bg="#f8f8f7">
      <div style={{ display: 'flex', height: '100%' }}>
        <SidebarNav />
        <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button style={{ background: 'none', border: '1.5px solid #e4e2de', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#5c5852', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>← Listings</button>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1916' }}>New Listing</div>
            <div style={{ flex: 1 }} />
            <button style={{ padding: '8px 16px', border: '1.5px solid #e4e2de', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 12, color: '#5c5852', fontFamily: "'DM Sans', sans-serif" }}>Save Draft</button>
            <button style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#1e8f88', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>Publish Listing</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, background: '#f1f0ee', padding: 4, borderRadius: 10, width: 'fit-content', marginBottom: 24 }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: activeTab === t ? '#fff' : 'transparent', color: activeTab === t ? '#1a1916' : '#7d7970', fontSize: 13, fontWeight: activeTab === t ? 600 : 400, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: activeTab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {activeTab === 'details' && (
                <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'Listing Name', placeholder: 'e.g. Morning Kayak Tour', value: 'Morning Kayak Tour' },
                    { label: 'Type', type: 'select', options: ['Tour', 'Rental', 'Class', 'Event', 'Experience', 'Appointment'] },
                    { label: 'Duration', type: 'select', options: ['30 min', '1 hour', '2 hours', '3 hours', '4 hours', 'Full Day'] },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#5c5852', display: 'block', marginBottom: 6 }}>{f.label}</label>
                      {f.type === 'select' ? (
                        <select style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: '#fff' }}>
                          {f.options.map(o => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input defaultValue={f.value} placeholder={f.placeholder} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} onFocus={e => e.target.style.borderColor = '#2ea69f'} onBlur={e => e.target.style.borderColor = '#e4e2de'} />
                      )}
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#5c5852', display: 'block', marginBottom: 6 }}>Description</label>
                    <textarea rows={4} defaultValue="A guided 2-hour morning kayak tour along the Pacific Coast. Suitable for beginners. All equipment provided." style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", resize: 'vertical', outline: 'none' }} onFocus={e => e.target.style.borderColor = '#2ea69f'} onBlur={e => e.target.style.borderColor = '#e4e2de'} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#5c5852', display: 'block', marginBottom: 6 }}>Meeting Point</label>
                    <input defaultValue="Main Beach Pier, Slip 4, Santa Cruz" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} onFocus={e => e.target.style.borderColor = '#2ea69f'} onBlur={e => e.target.style.borderColor = '#e4e2de'} />
                  </div>
                </div>
              )}
              {activeTab === 'availability' && (
                <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '22px 24px' }}>
                  <CalendarPicker />
                </div>
              )}
              {activeTab === 'add-ons' && (
                <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '22px 24px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916', marginBottom: 14 }}>Available Add-ons</div>
                  <AddonSelector />
                </div>
              )}
              {activeTab === 'pricing' && (
                <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'Price per Adult', placeholder: '$0.00', value: '$65.00' },
                    { label: 'Price per Child (optional)', placeholder: '$0.00', value: '$45.00' },
                    { label: 'Min. guests', placeholder: '1', value: '1' },
                    { label: 'Max. guests', placeholder: '12', value: '8' },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#5c5852', display: 'block', marginBottom: 6 }}>{f.label}</label>
                      <input defaultValue={f.value} placeholder={f.placeholder} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} onFocus={e => e.target.style.borderColor = '#2ea69f'} onBlur={e => e.target.style.borderColor = '#e4e2de'} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar preview panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#fff', border: '1px solid #e4e2de', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ height: 100, background: '#f1f0ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, cursor: 'pointer' }}>
                  <div style={{ width: 28, height: 28, background: '#e4e2de', borderRadius: 6 }} />
                  <div style={{ fontSize: 10, color: '#a8a49c', fontFamily: 'monospace' }}>cover photo</div>
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1916', marginBottom: 4 }}>Morning Kayak Tour</div>
                  <div style={{ fontSize: 12, color: '#7d7970', marginBottom: 10 }}>Tour · 2 hours</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1e8f88' }}>$65 / guest</div>
                    <div style={{ fontSize: 11, color: '#7d7970' }}>Max 8</div>
                  </div>
                </div>
              </div>
              <EmptyState icon="◫" title="No bookings yet" body="Your listing isn't published. Publish to start receiving bookings." />
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
};

Object.assign(window, {
  LoginScreen, OnboardingScreen, DashboardScreen,
  ListingsScreen, BookingDetailScreen, EmbedScreen,
  BookingWidget, CreateListingScreen,
});
