import { useState, useRef, useEffect, useMemo } from 'react'
import { STAGES, TRAVEL_MODES, HOTEL_CATS, EBIKE_MODELS, ADDONS, INCLUDED_EBIKE, TRANSLATIONS } from './data'
import RouteMap from './RouteMap'
import './App.css'

function formatDate(d) {
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function addDays(date, days) {
  const r = new Date(date)
  r.setDate(r.getDate() + days)
  return r
}

export default function App() {
  const [lang, setLang] = useState('en')
  const [travelMode, setTravelMode] = useState('ebike')
  const [hotelCat, setHotelCat] = useState('ST')
  const [startDate, setStartDate] = useState('')
  const [firstStage, setFirstStage] = useState(0)
  const [lastStage, setLastStage] = useState(STAGES.length - 1)
  const [rooms, setRooms] = useState({ single: 0, twin: 0, double: 1 })
  const [stageNights, setStageNights] = useState({})
  const [selectedAddons, setSelectedAddons] = useState({})
  const [selectedBike, setSelectedBike] = useState('riese_nevo')
  const [activeSection, setActiveSection] = useState('mode')
  const [transferIn, setTransferIn] = useState({ enabled: false, from: '' })
  const [transferOut, setTransferOut] = useState({ enabled: false, to: '' })
  const [quoteSubmitted, setQuoteSubmitted] = useState(false)
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' })

  const tx = TRANSLATIONS[lang]

  // Derived calculations
  const activeStages = STAGES.slice(firstStage, lastStage + 1)
  const totalKm = activeStages.reduce((sum, s) => sum + s.km, 0)
  const totalNights = activeStages.reduce((sum, s, i) => {
    if (i === activeStages.length - 1) return sum + (stageNights[s.id] || 0)
    return sum + (stageNights[s.id] || 1)
  }, 0)
  const endDate = startDate ? addDays(new Date(startDate), totalNights) : null
  const totalRooms = rooms.single + rooms.twin + rooms.double
  const totalPassengers = rooms.single + rooms.twin * 2 + rooms.double * 2

  const hotelPrice = HOTEL_CATS.find(c => c.id === hotelCat)?.priceBase || 75
  const bikeObj = EBIKE_MODELS.find(b => b.id === selectedBike)
  const bikeDays = travelMode === 'ebike' ? Math.max(totalNights, 1) : 0
  const addonTotal = Object.entries(selectedAddons).reduce((sum, [id, on]) => {
    if (!on) return sum
    const a = ADDONS.find(x => x.id === id)
    if (!a) return sum
    if (a.unit === 'stage') return sum + a.price * Math.max(activeStages.length - 1, 1)
    if (a.unit === 'night') return sum + a.price * totalNights
    return sum + a.price * totalPassengers
  }, 0)
  const estimatedTotal = (hotelPrice * totalNights * Math.max(totalRooms, 1))
    + (bikeObj ? bikeObj.price * bikeDays * totalPassengers : 0)
    + addonTotal

  const refs = {
    mode: useRef(null), hotel: useRef(null), dates: useRef(null),
    itinerary: useRef(null), ebike: useRef(null), addons: useRef(null), summary: useRef(null),
  }
  const scrollTo = (key) => {
    refs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(key)
  }

  // Build quote text for mailto
  const buildQuoteBody = () => {
    const lines = [
      `Name: ${formData.name}`, `Email: ${formData.email}`, `Phone: ${formData.phone}`,
      ``, `--- Trip Details ---`,
      `Route: ${STAGES[firstStage].name} → ${STAGES[lastStage].name}`,
      `Distance: ${totalKm} km | Nights: ${totalNights}`,
      `Travel Mode: ${TRAVEL_MODES.find(m => m.id === travelMode)?.label}`,
      `Hotel: ${HOTEL_CATS.find(c => c.id === hotelCat)?.label}`,
      `Start Date: ${startDate || 'TBD'}`,
      `Rooms: Single(${rooms.single}) Twin(${rooms.twin}) Double(${rooms.double})`,
      `Travellers: ${totalPassengers}`,
      travelMode === 'ebike' ? `E-Bike: ${bikeObj?.name}` : '',
      ``, `Add-ons: ${Object.entries(selectedAddons).filter(([,v]) => v).map(([id]) => ADDONS.find(a => a.id === id)?.label).join(', ') || 'None'}`,
      transferIn.enabled ? `Transfer In: ${transferIn.from} → ${STAGES[firstStage].name}` : '',
      transferOut.enabled ? `Transfer Out: ${STAGES[lastStage].name} → ${transferOut.to}` : '',
      ``, `Estimated Total: €${estimatedTotal.toLocaleString()}`,
      formData.notes ? `\nNotes: ${formData.notes}` : '',
    ].filter(Boolean)
    return encodeURIComponent(lines.join('\n'))
  }

  const navItems = [
    { key: 'mode', label: tx.travelMode, icon: '🚲' },
    { key: 'hotel', label: tx.hotel, icon: '🏨' },
    { key: 'dates', label: tx.dates, icon: '📅' },
    { key: 'itinerary', label: tx.itinerary, icon: '🗺️' },
    ...(travelMode === 'ebike' ? [{ key: 'ebike', label: tx.ebike, icon: '⚡' }] : []),
    { key: 'addons', label: tx.addons, icon: '✨' },
    { key: 'summary', label: tx.summary, icon: '📋' },
  ]
  const stepNum = (key) => {
    const idx = navItems.findIndex(n => n.key === key)
    return idx >= 0 ? idx + 1 : ''
  }

  return (
    <div className="app">
      {/* ────── Header ────── */}
      <header className="header">
        <div className="header-inner">
          <a href="https://ciclo-ebikes.com" className="logo" target="_blank" rel="noopener">
            <span className="logo-bolt">⚡</span>
            <span className="logo-name">CICLO</span>
            <span className="logo-sub">EBIKES</span>
          </a>
          <span className="header-title">{tx.title}</span>
          <button className="lang-btn" onClick={() => setLang(l => l === 'en' ? 'pt' : 'en')}>
            {lang === 'en' ? '🇵🇹 PT' : '🇬🇧 EN'}
          </button>
        </div>
      </header>

      {/* ────── Hero ────── */}
      <div className="hero">
        <div className="hero-bg" />
        <div className="hero-content">
          <p className="hero-eyebrow">CICLO EBIKES · Self-Guided Tours</p>
          <h1 className="hero-title">{tx.subtitle}</h1>
          <p className="hero-tagline">{tx.tagline}</p>
          <div className="hero-badges">
            <span className="hero-badge">🛤️ {totalKm} km</span>
            <span className="hero-badge">📍 {activeStages.length} stages</span>
            <span className="hero-badge">🌊 Coastal Route</span>
            <span className="hero-badge">⚡ E-Bike Friendly</span>
          </div>
        </div>
      </div>

      {/* ────── Nav Pills ────── */}
      <nav className="nav-pills">
        <div className="nav-pills-inner">
          {navItems.map(({ key, label, icon }) => (
            <button
              key={key}
              className={`nav-pill ${activeSection === key ? 'active' : ''}`}
              onClick={() => scrollTo(key)}
            >
              <span className="nav-pill-icon">{icon}</span>
              <span className="nav-pill-label">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ────── Main ────── */}
      <main className="main">

        {/* ── 1. Travel Mode ── */}
        <section ref={refs.mode} className="section" id="mode">
          <SectionHead num={stepNum('mode')} icon="🚲" title={tx.travelMode} />
          <div className="mode-grid">
            {TRAVEL_MODES.map(m => (
              <button
                key={m.id}
                className={`mode-card ${travelMode === m.id ? 'active' : ''}`}
                onClick={() => setTravelMode(m.id)}
              >
                <span className="mode-icon">{m.icon}</span>
                <span className="mode-label">{lang === 'pt' ? m.labelPt : m.label}</span>
                <span className="mode-desc">{lang === 'pt' ? m.descPt : m.desc}</span>
                {travelMode === m.id && <span className="check-badge">✓</span>}
              </button>
            ))}
          </div>
        </section>

        {/* ── 2. Hotel Category ── */}
        <section ref={refs.hotel} className="section" id="hotel">
          <SectionHead num={stepNum('hotel')} icon="🏨" title={tx.hotel} />
          <div className="hotel-grid">
            {HOTEL_CATS.map(c => (
              <button
                key={c.id}
                className={`hotel-card ${hotelCat === c.id ? 'active' : ''}`}
                onClick={() => setHotelCat(c.id)}
              >
                <span className="hotel-icon">{c.icon}</span>
                <span className="hotel-label">{lang === 'pt' ? c.labelPt : c.label}</span>
                <span className="hotel-desc">{lang === 'pt' ? c.descPt : c.desc}</span>
                <span className="hotel-price">from €{c.priceBase}<small>/night</small></span>
                {hotelCat === c.id && <span className="check-badge">✓</span>}
              </button>
            ))}
          </div>
          {/* Rooms */}
          <div className="rooms-box">
            <h4 className="rooms-title">{tx.rooms}</h4>
            {[
              { key: 'single', label: tx.single, ico: '🛏️' },
              { key: 'twin', label: tx.twin, ico: '🛏️🛏️' },
              { key: 'double', label: tx.double, ico: '🛌' },
            ].map(({ key, label, ico }) => (
              <div key={key} className="room-row">
                <span className="room-label">{ico} {label}</span>
                <Counter
                  value={rooms[key]}
                  onDec={() => setRooms(r => ({ ...r, [key]: Math.max(0, r[key] - 1) }))}
                  onInc={() => setRooms(r => ({ ...r, [key]: r[key] + 1 }))}
                />
              </div>
            ))}
            <div className="rooms-summary">
              {tx.passengers}: <strong>{totalPassengers}</strong> · {tx.rooms}: <strong>{totalRooms}</strong>
            </div>
          </div>
        </section>

        {/* ── 3. Dates ── */}
        <section ref={refs.dates} className="section" id="dates">
          <SectionHead num={stepNum('dates')} icon="📅" title={tx.dates} />
          <div className="dates-grid">
            <div className="date-field">
              <label>{tx.startDate}</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="date-field">
              <label>{tx.endDate}</label>
              <div className="date-display">{endDate ? formatDate(endDate) : tx.selectDates}</div>
            </div>
          </div>
          <div className="dates-grid">
            <div className="date-field">
              <label>{tx.firstNight}</label>
              <select value={firstStage} onChange={e => {
                const v = +e.target.value
                setFirstStage(v)
                if (v > lastStage) setLastStage(v)
              }}>
                {STAGES.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}
              </select>
            </div>
            <div className="date-field">
              <label>{tx.lastNight}</label>
              <select value={lastStage} onChange={e => setLastStage(+e.target.value)}>
                {STAGES.filter((_, i) => i >= firstStage).map((s, i) => (
                  <option key={s.id} value={firstStage + i}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ── Map ── */}
        <section className="section section-map">
          <SectionHead icon="🗺️" title={tx.map} />
          <div className="map-container">
            <RouteMap stages={activeStages} hotelCat={hotelCat} />
          </div>
        </section>

        {/* ── 4. Itinerary ── */}
        <section ref={refs.itinerary} className="section" id="itinerary">
          <SectionHead num={stepNum('itinerary')} icon="📋" title={tx.itinerary} />
          <div className="itinerary">
            {activeStages.map((stage, idx) => {
              const isLast = idx === activeStages.length - 1
              const nights = isLast ? (stageNights[stage.id] || 0) : (stageNights[stage.id] || 1)
              const next = activeStages[idx + 1]
              const cumNights = activeStages.slice(0, idx).reduce((s, st) => s + (stageNights[st.id] || 1), 0)
              const stageDate = startDate ? addDays(new Date(startDate), cumNights) : null

              return (
                <div key={stage.id} className="stage-wrap">
                  <div className={`stage-card ${stage.highlight ? 'highlight' : ''}`}>
                    <div className="stage-timeline">
                      <div className={`stage-dot ${stage.highlight ? 'highlight' : ''}`} />
                      {!isLast && <div className="stage-line" />}
                    </div>
                    <div className="stage-body">
                      <div className="stage-top">
                        <div>
                          <span className="stage-num">{tx.stage} {idx + 1}</span>
                          <h3 className="stage-name">{stage.name}</h3>
                          <p className="stage-desc">{stage.desc}</p>
                        </div>
                        <div className="stage-cats">
                          {stage.cats.map(c => (
                            <span key={c} className={`cat-badge ${c === hotelCat ? 'active' : ''}`}>{c}</span>
                          ))}
                        </div>
                      </div>
                      <div className="stage-bottom">
                        <div className="stage-nights">
                          <span className="nights-label">
                            {nights} {tx.nights}{nights !== 1 ? 's' : ''}
                            {stage.highlight && <span className="highlight-tag">⭐ {tx.highlight}</span>}
                          </span>
                          <Counter
                            small
                            value={nights}
                            onDec={() => setStageNights(p => ({ ...p, [stage.id]: Math.max(isLast ? 0 : 1, (p[stage.id] ?? (isLast ? 0 : 1)) - 1) }))}
                            onInc={() => setStageNights(p => ({ ...p, [stage.id]: (p[stage.id] ?? (isLast ? 0 : 1)) + 1 }))}
                          />
                        </div>
                        {stageDate && <span className="stage-date">{formatDate(stageDate)}</span>}
                      </div>
                    </div>
                  </div>
                  {!isLast && next && (
                    <div className="distance-badge">
                      <span className="dist-line" />
                      <span className="dist-info">
                        <strong>{next.km} km</strong>
                        <span className="dist-time">
                          {travelMode === 'ebike' || travelMode === 'cycling'
                            ? `~${Math.round(next.km / (travelMode === 'ebike' ? 15 : 12) * 60)} min`
                            : `~${(next.km / 4).toFixed(1)}h`}
                        </span>
                      </span>
                      <span className="dist-line" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── 5. E-Bike ── */}
        {travelMode === 'ebike' && (
          <section ref={refs.ebike} className="section" id="ebike">
            <SectionHead num={stepNum('ebike')} icon="⚡" title={tx.ebike} />
            <p className="section-subtitle">{tx.ebikeNote}</p>
            <div className="bike-grid">
              {EBIKE_MODELS.map(bike => (
                <button
                  key={bike.id}
                  className={`bike-card ${selectedBike === bike.id ? 'active' : ''}`}
                  onClick={() => setSelectedBike(bike.id)}
                >
                  <span className="bike-img">{bike.img}</span>
                  <h4 className="bike-name">{bike.name}</h4>
                  <p className="bike-desc">{lang === 'pt' ? bike.descPt : bike.desc}</p>
                  <div className="bike-price">€{bike.price}<small>{tx.day}</small></div>
                  {selectedBike === bike.id && <span className="check-badge">✓</span>}
                </button>
              ))}
            </div>
            <div className="included-box">
              <h4>🎁 {tx.included}</h4>
              <div className="included-grid">
                {INCLUDED_EBIKE[lang].map((item, i) => (
                  <div key={i} className="included-item">
                    <span className="inc-check">✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 6. Add-ons ── */}
        <section ref={refs.addons} className="section" id="addons">
          <SectionHead num={stepNum('addons')} icon="✨" title={tx.addons} />

          {/* Transfers */}
          <div className="transfers-grid">
            <div className="transfer-card">
              <label className="transfer-toggle">
                <input type="checkbox" checked={transferIn.enabled} onChange={e => setTransferIn(p => ({ ...p, enabled: e.target.checked }))} />
                <span>🚐 {tx.inTransfer}</span>
              </label>
              {transferIn.enabled && (
                <div className="transfer-fields">
                  <input placeholder={`${tx.from} (e.g. Porto Airport)`} value={transferIn.from} onChange={e => setTransferIn(p => ({ ...p, from: e.target.value }))} />
                  <span className="arrow">→</span>
                  <span className="fixed-loc">{STAGES[firstStage].name}</span>
                </div>
              )}
            </div>
            <div className="transfer-card">
              <label className="transfer-toggle">
                <input type="checkbox" checked={transferOut.enabled} onChange={e => setTransferOut(p => ({ ...p, enabled: e.target.checked }))} />
                <span>🚐 {tx.outTransfer}</span>
              </label>
              {transferOut.enabled && (
                <div className="transfer-fields">
                  <span className="fixed-loc">{STAGES[lastStage].name}</span>
                  <span className="arrow">→</span>
                  <input placeholder={`${tx.to} (e.g. Santiago Airport)`} value={transferOut.to} onChange={e => setTransferOut(p => ({ ...p, to: e.target.value }))} />
                </div>
              )}
            </div>
          </div>

          {/* Addon cards */}
          <div className="addons-list">
            {ADDONS.map(a => (
              <div key={a.id} className={`addon-card ${selectedAddons[a.id] ? 'active' : ''}`}>
                <div className="addon-top">
                  <label className="addon-toggle">
                    <input type="checkbox" checked={!!selectedAddons[a.id]} onChange={e => setSelectedAddons(p => ({ ...p, [a.id]: e.target.checked }))} />
                    <span className="addon-icon">{a.icon}</span>
                    <span className="addon-label">{lang === 'pt' ? a.labelPt : a.label}</span>
                  </label>
                  <span className="addon-price">€{a.price} <small>{tx[`per${a.unit.charAt(0).toUpperCase() + a.unit.slice(1)}`] || a.unit}</small></span>
                </div>
                <p className="addon-desc">{lang === 'pt' ? a.descPt : a.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. Summary ── */}
        <section ref={refs.summary} className="section" id="summary">
          <SectionHead num={stepNum('summary')} icon="📋" title={tx.summary} />
          <div className="summary-card">
            <div className="summary-grid">
              <SumItem icon="📍" label={tx.route} value={`${STAGES[firstStage].name} → ${STAGES[lastStage].name}`} />
              <SumItem icon="🛤️" label={tx.distance} value={`${totalKm} km`} />
              <SumItem icon="🌙" label={tx.duration} value={`${totalNights} ${tx.nights}${totalNights !== 1 ? 's' : ''}`} />
              <SumItem icon="🚲" label={tx.travelMode} value={TRAVEL_MODES.find(m => m.id === travelMode)?.[lang === 'pt' ? 'labelPt' : 'label']} />
              <SumItem icon="🏨" label={tx.hotel} value={HOTEL_CATS.find(c => c.id === hotelCat)?.[lang === 'pt' ? 'labelPt' : 'label']} />
              <SumItem icon="👥" label={tx.passengers} value={totalPassengers} />
              <SumItem icon="🚪" label={tx.rooms} value={totalRooms} />
              <SumItem icon="📅" label={tx.startDate} value={startDate ? formatDate(new Date(startDate)) : '—'} />
              {travelMode === 'ebike' && <SumItem icon="⚡" label={tx.ebike} value={bikeObj?.name} />}
            </div>

            {Object.entries(selectedAddons).some(([, v]) => v) && (
              <div className="summary-addons">
                <h4>{tx.selectedExtras}:</h4>
                <div className="addon-badges">
                  {Object.entries(selectedAddons).filter(([, v]) => v).map(([id]) => {
                    const a = ADDONS.find(x => x.id === id)
                    return a ? <span key={id} className="addon-badge-sm">{a.icon} {lang === 'pt' ? a.labelPt : a.label}</span> : null
                  })}
                </div>
              </div>
            )}

            <div className="price-block">
              <div className="price-label">{tx.estimatedFrom}</div>
              <div className="price-value">€{estimatedTotal.toLocaleString()}<span className="price-unit"> {tx.total}</span></div>
              {totalPassengers > 0 && (
                <div className="price-pp">~€{Math.round(estimatedTotal / totalPassengers).toLocaleString()} {tx.perPerson}</div>
              )}
            </div>

            {/* Contact form */}
            <div className="quote-form">
              <div className="form-row">
                <input placeholder={lang === 'pt' ? 'Nome completo' : 'Full name'} value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
                <input placeholder="Email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="form-row">
                <input placeholder={lang === 'pt' ? 'Telefone / WhatsApp' : 'Phone / WhatsApp'} value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <textarea
                placeholder={lang === 'pt' ? 'Notas adicionais (opcional)' : 'Additional notes (optional)'}
                rows={3}
                value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              />
            </div>

            <div className="cta-row">
              <a
                className="cta-btn"
                href={`mailto:hello@ciclo-ebikes.com?subject=${encodeURIComponent(`Camino Trip Quote — ${formData.name || 'New Request'}`)}&body=${buildQuoteBody()}`}
              >
                ✉️ {tx.requestQuote}
              </a>
              <a
                className="cta-btn cta-whatsapp"
                href={`https://wa.me/351933405845?text=${buildQuoteBody()}`}
                target="_blank"
                rel="noopener"
              >
                💬 WhatsApp
              </a>
            </div>
            <p className="cta-note">{tx.quoteNote}</p>
          </div>
        </section>
      </main>

      {/* ────── Bottom Bar ────── */}
      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <span className="bb-route">{STAGES[firstStage].name} → {STAGES[lastStage].name}</span>
          <span className="bb-sep" />
          <span className="bb-stat">{totalKm} km</span>
          <span className="bb-sep" />
          <span className="bb-stat">{totalNights}N</span>
          <span className="bb-sep" />
          <span className="bb-stat">👥 {totalPassengers}</span>
          <div className="bb-spacer" />
          <span className="bb-price">€{estimatedTotal.toLocaleString()}</span>
          <button className="bb-cta" onClick={() => scrollTo('summary')}>{tx.requestQuote}</button>
        </div>
      </div>

      {/* ────── Footer ────── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="logo footer-logo">
            <span className="logo-bolt">⚡</span>
            <span className="logo-name" style={{ color: '#fff' }}>CICLO</span>
            <span className="logo-sub" style={{ color: 'rgba(255,255,255,0.5)' }}>EBIKES</span>
          </div>
          <div className="footer-links">
            <a href="https://ciclo-ebikes.com" target="_blank" rel="noopener">ciclo-ebikes.com</a>
            <span>·</span>
            <a href="tel:+351933405845">+351 933 405 845</a>
            <span>·</span>
            <a href="mailto:hello@ciclo-ebikes.com">hello@ciclo-ebikes.com</a>
          </div>
          <p className="footer-copy">© 2025 CICLO EBIKES · Rua General Torres 24, V.N. Gaia, Porto, Portugal</p>
        </div>
      </footer>
    </div>
  )
}

/* ═══ Small Components ═══ */

function SectionHead({ num, icon, title }) {
  return (
    <div className="section-head">
      {num && <span className="section-num">{num}</span>}
      <span className="section-icon">{icon}</span>
      <h2 className="section-title">{title}</h2>
    </div>
  )
}

function Counter({ value, onDec, onInc, small }) {
  return (
    <div className={`counter ${small ? 'small' : ''}`}>
      <button onClick={onDec} className="counter-btn">−</button>
      <span className="counter-val">{value}</span>
      <button onClick={onInc} className="counter-btn">+</button>
    </div>
  )
}

function SumItem({ icon, label, value }) {
  return (
    <div className="sum-item">
      <span className="sum-icon">{icon}</span>
      <div>
        <div className="sum-label">{label}</div>
        <div className="sum-value">{value}</div>
      </div>
    </div>
  )
}
