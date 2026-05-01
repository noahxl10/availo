// Component Library: Sidebar, Cards, Calendar, Guest/Addon selectors, etc.

const SidebarNav = ({ collapsed = false }) => {
  const [active, setActive] = React.useState('dashboard');
  const [isCollapsed, setIsCollapsed] = React.useState(collapsed);

  const navItems = [
    { id: 'dashboard', icon: '⊡', label: 'Dashboard' },
    { id: 'listings', icon: '◫', label: 'Listings' },
    { id: 'bookings', icon: '◷', label: 'Bookings' },
    { id: 'calendar', icon: '▦', label: 'Availability' },
    { id: 'customers', icon: '◉', label: 'Customers' },
    { id: 'embed', icon: '◈', label: 'Embed' },
    { id: 'analytics', icon: '◰', label: 'Analytics' },
  ];

  const bottomItems = [
    { id: 'settings', icon: '◎', label: 'Settings' },
    { id: 'help', icon: '◌', label: 'Help' },
  ];

  const itemStyle = (id) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: isCollapsed ? '10px' : '9px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    background: active === id ? '#eef7f6' : 'transparent',
    color: active === id ? '#1e8f88' : '#5c5852',
    fontWeight: active === id ? 600 : 400,
    fontSize: 14,
    transition: 'all 0.15s',
    userSelect: 'none',
  });

  return (
    <div style={{
      width: isCollapsed ? 56 : 220,
      background: '#ffffff',
      borderRight: '1px solid #e4e2de',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 10px',
      transition: 'width 0.2s ease',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: isCollapsed ? '8px 0 20px' : '8px 4px 24px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        <div style={{ width: 30, height: 30, background: '#1e8f88', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: "'DM Sans', sans-serif" }}>A</span>
        </div>
        {!isCollapsed && <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: '#1a1916', letterSpacing: '-0.3px' }}>Availo</span>}
      </div>

      {/* Main nav */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => (
          <div key={item.id} style={itemStyle(item.id)} onClick={() => setActive(item.id)}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
            {!isCollapsed && <span>{item.label}</span>}
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid #f1f0ee', paddingTop: 12 }}>
        {bottomItems.map(item => (
          <div key={item.id} style={itemStyle(item.id)} onClick={() => setActive(item.id)}>
            <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
            {!isCollapsed && <span>{item.label}</span>}
          </div>
        ))}
        {/* User */}
        {!isCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginTop: 4, borderRadius: 8, background: '#f8f8f7' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#cceae7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#177870', flexShrink: 0 }}>JM</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1916', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Jamie Miller</div>
              <div style={{ fontSize: 11, color: '#a8a49c' }}>Ocean Tours Co.</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 0' }}>
          <button onClick={() => setIsCollapsed(!isCollapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a8a49c', fontSize: 12, padding: '4px 6px' }}>
            {isCollapsed ? '→' : '←'}
          </button>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, delta, deltaDir = 'up', sub }) => (
  <div style={{
    background: '#ffffff', border: '1px solid #e4e2de', borderRadius: 12,
    padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8,
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
  }}>
    <div style={{ fontSize: 12, fontWeight: 500, color: '#7d7970' }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: '#1a1916', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{value}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {delta && (
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: deltaDir === 'up' ? '#1a9e6e' : '#d94f4f',
          background: deltaDir === 'up' ? '#edf7f2' : '#fef0f0',
          padding: '2px 7px', borderRadius: 99,
        }}>
          {deltaDir === 'up' ? '↑' : '↓'} {delta}
        </span>
      )}
      {sub && <span style={{ fontSize: 11, color: '#a8a49c' }}>{sub}</span>}
    </div>
  </div>
);

const ListingCard = ({ title, type, price, capacity, status = 'active', img }) => {
  const statusColors = {
    active: { bg: '#edf7f2', color: '#1a9e6e' },
    draft: { bg: '#f1f0ee', color: '#7d7970' },
    paused: { bg: '#fef6ec', color: '#e08c2a' },
  };
  const sc = statusColors[status];
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e4e2de', borderRadius: 12,
      overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'none'; }}
    >
      <div style={{ height: 110, background: '#f1f0ee', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
          <div style={{ width: 36, height: 36, background: '#e4e2de', borderRadius: 8 }} />
          <div style={{ fontSize: 9, color: '#a8a49c', fontFamily: 'monospace', textAlign: 'center' }}>listing image</div>
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10, background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 99, textTransform: 'capitalize' }}>{status}</div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#a8a49c', marginBottom: 12 }}>{type}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e8f88' }}>{price}</div>
          <div style={{ fontSize: 11, color: '#7d7970' }}>up to {capacity} guests</div>
        </div>
      </div>
    </div>
  );
};

const CalendarPicker = () => {
  const [selected, setSelected] = React.useState(new Set([8, 9, 12, 15, 22]));
  const [selectedSlot, setSelectedSlot] = React.useState('9:00 AM');
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const slots = ['8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];
  const dates = Array.from({ length: 30 }, (_, i) => i + 1);
  const offset = 2; // May 2026 starts on Friday

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ background: '#ffffff', border: '1px solid #e4e2de', borderRadius: 12, padding: 20, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5c5852', fontSize: 16 }}>‹</button>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1916' }}>May 2026</div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5c5852', fontSize: 16 }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
          {days.map(d => (
            <div key={d} style={{ fontSize: 11, fontWeight: 600, color: '#a8a49c', padding: '0 0 8px', letterSpacing: '0.04em' }}>{d}</div>
          ))}
          {Array(offset).fill(null).map((_, i) => <div key={`e${i}`} />)}
          {dates.map(d => {
            const avail = selected.has(d);
            const isToday = d === 1;
            return (
              <div key={d} onClick={() => {
                const s = new Set(selected);
                s.has(d) ? s.delete(d) : s.add(d);
                setSelected(s);
              }} style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 7, fontSize: 12, cursor: 'pointer',
                background: avail ? '#1e8f88' : isToday ? '#f1f0ee' : 'transparent',
                color: avail ? '#ffffff' : isToday ? '#1a1916' : '#3e3b37',
                fontWeight: avail ? 600 : 400,
                transition: 'all 0.1s',
              }}>
                {d}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 130 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#7d7970', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Time Slots</div>
        {slots.map(slot => (
          <div key={slot} onClick={() => setSelectedSlot(slot)} style={{
            padding: '9px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            background: selectedSlot === slot ? '#1e8f88' : '#f8f8f7',
            color: selectedSlot === slot ? '#ffffff' : '#3e3b37',
            fontWeight: selectedSlot === slot ? 600 : 400,
            border: `1px solid ${selectedSlot === slot ? 'transparent' : '#e4e2de'}`,
            transition: 'all 0.1s',
            textAlign: 'center',
          }}>
            {slot}
          </div>
        ))}
      </div>
    </div>
  );
};

const GuestSelector = () => {
  const [guests, setGuests] = React.useState({ adults: 2, children: 1, infants: 0 });
  const types = [
    { key: 'adults', label: 'Adults', sub: 'Ages 13+', min: 1, max: 12 },
    { key: 'children', label: 'Children', sub: 'Ages 3–12', min: 0, max: 8 },
    { key: 'infants', label: 'Infants', sub: 'Under 3', min: 0, max: 4 },
  ];

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e4e2de', borderRadius: 12, overflow: 'hidden' }}>
      {types.map((t, i) => (
        <div key={t.key} style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: i < 2 ? '1px solid #f1f0ee' : 'none' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1916' }}>{t.label}</div>
            <div style={{ fontSize: 12, color: '#a8a49c' }}>{t.sub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setGuests(g => ({ ...g, [t.key]: Math.max(t.min, g[t.key] - 1) }))} style={{
              width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #cac7c1',
              background: 'none', cursor: 'pointer', fontSize: 18, color: '#5c5852',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>−</button>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1a1916', minWidth: 16, textAlign: 'center' }}>{guests[t.key]}</span>
            <button onClick={() => setGuests(g => ({ ...g, [t.key]: Math.min(t.max, g[t.key] + 1) }))} style={{
              width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #1e8f88',
              background: 'none', cursor: 'pointer', fontSize: 18, color: '#1e8f88',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>+</button>
          </div>
        </div>
      ))}
      <div style={{ padding: '10px 18px', background: '#f8f8f7', borderTop: '1px solid #f1f0ee' }}>
        <div style={{ fontSize: 12, color: '#7d7970' }}>
          {Object.values(guests).reduce((a, b) => a + b, 0)} guest{Object.values(guests).reduce((a, b) => a + b, 0) !== 1 ? 's' : ''} · Max capacity: 12
        </div>
      </div>
    </div>
  );
};

const AddonSelector = () => {
  const [selected, setSelected] = React.useState(new Set(['wetsuit']));
  const addons = [
    { id: 'wetsuit', name: 'Wetsuit Rental', desc: 'Full suit included', price: 15, icon: '◧' },
    { id: 'photos', name: 'Photo Package', desc: 'Underwater + surface shots', price: 35, icon: '◨' },
    { id: 'guide', name: 'Private Guide', desc: 'Dedicated guide for your group', price: 75, icon: '◩' },
    { id: 'lunch', name: 'Lunch Add-on', desc: 'Local meal post-tour', price: 25, icon: '◪' },
  ];

  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {addons.map(a => {
        const on = selected.has(a.id);
        return (
          <div key={a.id} onClick={() => toggle(a.id)} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '13px 16px',
            borderRadius: 10,
            border: `1.5px solid ${on ? '#2ea69f' : '#e4e2de'}`,
            background: on ? '#eef7f6' : '#ffffff',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: on ? '#cceae7' : '#f1f0ee',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: on ? '#177870' : '#a8a49c', flexShrink: 0,
            }}>{a.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916' }}>{a.name}</div>
              <div style={{ fontSize: 11, color: '#7d7970' }}>{a.desc}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: on ? '#1e8f88' : '#5c5852', marginRight: 6 }}>+${a.price}</div>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              border: `2px solid ${on ? '#1e8f88' : '#cac7c1'}`,
              background: on ? '#1e8f88' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {on && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CheckoutSummary = () => (
  <div style={{ background: '#ffffff', border: '1px solid #e4e2de', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
    <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f0ee' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916', marginBottom: 12 }}>Order Summary</div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ width: 52, height: 52, background: '#f1f0ee', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 20, height: 20, background: '#e4e2de', borderRadius: 4 }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1916' }}>Morning Kayak Tour</div>
          <div style={{ fontSize: 11, color: '#7d7970' }}>May 8, 2026 · 9:00 AM · 2h</div>
          <div style={{ fontSize: 11, color: '#7d7970' }}>3 guests (2 adults, 1 child)</div>
        </div>
      </div>
    </div>
    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f0ee' }}>
      {[
        { label: '2× Adult ($65)', val: '$130.00' },
        { label: '1× Child ($45)', val: '$45.00' },
        { label: 'Wetsuit Rental ×3', val: '$45.00' },
        { label: 'Photo Package ×1', val: '$35.00' },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#5c5852' }}>{r.label}</span>
          <span style={{ fontSize: 13, color: '#1a1916', fontWeight: 500 }}>{r.val}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#5c5852' }}>Booking fee</span>
        <span style={{ fontSize: 13, color: '#7d7970' }}>$5.50</span>
      </div>
    </div>
    <div style={{ padding: '14px 20px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1916' }}>Total</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#1a1916', letterSpacing: '-0.5px' }}>$260.50</span>
      </div>
      <button style={{
        width: '100%', background: '#1e8f88', color: '#ffffff',
        border: 'none', borderRadius: 10, padding: '13px', fontSize: 14,
        fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        letterSpacing: '0.01em',
      }}>
        Confirm Booking
      </button>
      <div style={{ fontSize: 11, color: '#a8a49c', textAlign: 'center', marginTop: 10 }}>
        Free cancellation up to 48 hours before
      </div>
    </div>
  </div>
);

const BookingConfirmation = () => (
  <div style={{ background: '#ffffff', border: '1px solid #e4e2de', borderRadius: 14, padding: '32px 28px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
    <div style={{ width: 56, height: 56, background: '#edf7f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '2px solid #b8e8d4' }}>
      <span style={{ fontSize: 24, color: '#1a9e6e' }}>✓</span>
    </div>
    <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1916', marginBottom: 6 }}>Booking Confirmed!</div>
    <div style={{ fontSize: 13, color: '#7d7970', marginBottom: 20 }}>Confirmation sent to guest@email.com</div>
    <div style={{ background: '#f8f8f7', borderRadius: 10, padding: '14px 18px', textAlign: 'left', marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#a8a49c', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Booking Details</div>
      {[
        ['Booking ID', '#BK-20485'],
        ['Experience', 'Morning Kayak Tour'],
        ['Date & Time', 'May 8, 2026 · 9:00 AM'],
        ['Guests', '3 (2 adults, 1 child)'],
        ['Total Paid', '$260.50'],
      ].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#7d7970' }}>{k}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1916' }}>{v}</span>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button style={{ flex: 1, padding: '10px', border: '1.5px solid #e4e2de', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, color: '#5c5852', fontFamily: "'DM Sans', sans-serif" }}>
        Download PDF
      </button>
      <button style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, background: '#1e8f88', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
        View Booking
      </button>
    </div>
  </div>
);

const EmptyState = ({ icon = '◫', title, body, cta }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', textAlign: 'center', background: '#f8f8f7', borderRadius: 14, border: '1.5px dashed #e4e2de' }}>
    <div style={{ fontSize: 32, color: '#cac7c1', marginBottom: 14 }}>{icon}</div>
    <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1916', marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: '#7d7970', marginBottom: 20, maxWidth: 260 }}>{body}</div>
    {cta && (
      <button style={{ background: '#1e8f88', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
        {cta}
      </button>
    )}
  </div>
);

const SettingsForm = () => {
  const [saved, setSaved] = React.useState(false);
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e4e2de', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f0ee' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1916' }}>Business Profile</div>
        <div style={{ fontSize: 12, color: '#a8a49c', marginTop: 2 }}>Shown on your booking pages and confirmation emails</div>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          { label: 'Business Name', placeholder: 'Ocean Tours Co.', value: 'Ocean Tours Co.' },
          { label: 'Contact Email', placeholder: 'hello@oceantours.co', value: 'hello@oceantours.co', type: 'email' },
          { label: 'Phone Number', placeholder: '+1 (555) 000-0000', value: '+1 (555) 283-1947', type: 'tel' },
        ].map(f => (
          <div key={f.label}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5c5852', marginBottom: 6 }}>{f.label}</label>
            <input defaultValue={f.value} placeholder={f.placeholder} type={f.type || 'text'} style={{
              width: '100%', boxSizing: 'border-box', padding: '9px 12px',
              border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916',
              fontFamily: "'DM Sans', sans-serif", outline: 'none',
              transition: 'border-color 0.15s',
            }}
              onFocus={e => e.target.style.borderColor = '#2ea69f'}
              onBlur={e => e.target.style.borderColor = '#e4e2de'}
            />
          </div>
        ))}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#5c5852', marginBottom: 6 }}>About</label>
          <textarea rows={3} defaultValue="We offer guided ocean kayak tours along the Pacific Coast year-round." style={{
            width: '100%', boxSizing: 'border-box', padding: '9px 12px',
            border: '1.5px solid #e4e2de', borderRadius: 8, fontSize: 13, color: '#1a1916',
            fontFamily: "'DM Sans', sans-serif", resize: 'vertical', outline: 'none',
          }}
            onFocus={e => e.target.style.borderColor = '#2ea69f'}
            onBlur={e => e.target.style.borderColor = '#e4e2de'}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={{ padding: '9px 18px', border: '1.5px solid #e4e2de', borderRadius: 8, background: 'none', cursor: 'pointer', fontSize: 13, color: '#5c5852', fontFamily: "'DM Sans', sans-serif" }}>
            Cancel
          </button>
          <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }} style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: saved ? '#1a9e6e' : '#1e8f88', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.2s' }}>
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  SidebarNav, StatCard, ListingCard,
  CalendarPicker, GuestSelector, AddonSelector,
  CheckoutSummary, BookingConfirmation, EmptyState, SettingsForm,
});
