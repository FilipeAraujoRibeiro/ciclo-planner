import { useState, useRef, useMemo } from 'react'
import { STAGES, SERVICE_TYPES, HOTEL_CATS, RENTAL_BIKE, BIKE_SIZES, OPTIONAL_ACCESSORIES, INCLUDED_ITEMS, ADDONS, GUIDE_SUPPLEMENT_PER_DAY, TRANSLATIONS } from './data'
import RouteMap from './RouteMap'
import './App.css'

// ─── Config ───
const AIRTABLE_WEBHOOK_URL = '' // Set your Airtable webhook URL here. Empty = disabled.

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
  const [serviceType, setServiceType] = useState('self_guided')
  const [hotelCat, setHotelCat] = useState('ST')
  const [startDate, setStartDate] = useState('')
  const [firstStage, setFirstStage] = useState(0)
  const [lastStage, setLastStage] = useState(STAGES.length - 1)
  const [intermediateStages, setIntermediateStages] = useState(new Set())
  const [rooms, setRooms] = useState({ single: 0, twin: 0, double: 1 })
  const [stageNights, setStageNights] = useState({})
  const [selectedAddons, setSelectedAddons] = useState({})
  const [selectedAccessories, setSelectedAccessories] = useState({})
  const [bikeSize, setBikeSize] = useState('M')
  const [numBikes, setNumBikes] = useState(1)
  const [activeSection, setActiveSection] = useState('service')
  const [transferIn, setTransferIn] = useState({ enabled: false, from: '' })
  const [transferOut, setTransferOut] = useState({ enabled: false, to: '' })
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', notes: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null)

  const tx = TRANSLATIONS[lang]
  const currentService = SERVICE_TYPES.find(s => s.id === serviceType)
  const showSection = (key) => currentService.showSections.includes(key)

  // Derived calculations
  const activeStages = useMemo(() => {
    if (intermediateStages.size === 0) return STAGES.slice(firstStage, lastStage + 1)
    return STAGES.filter((stage, idx) => {
      if (idx === firstStage || idx === lastStage) return true
      if (idx < firstStage || idx > lastStage) return false
      return intermediateStages.has(stage.id)
    })
  }, [firstStage, lastStage, intermediateStages])

  const totalKm = activeStages.reduce((sum, s) => sum + s.km, 0)
  const totalNights = activeStages.reduce((sum, s, i) => {
    if (i === activeStages.length - 1) return sum + (stageNights[s.id] || 0)
    return sum + (stageNights[s.id] || 1)
  }, 0)
  const endDate = startDate ? addDays(new Date(startDate), totalNights) : null
  const totalRooms = rooms.single + rooms.twin + rooms.double
  const totalPassengers = rooms.single + rooms.twin * 2 + rooms.double * 2

  // For rent-only, use numBikes; for packages, derive from travellers
  const bikesNeeded = serviceType === 'rent' ? numBikes : Math.max(totalPassengers, 1)
  const rentalDays = serviceType === 'rent' ? Math.max(totalNights || 1, 1) : Math.max(totalNights, 1)

  // Pricing
  const hotelPrice = HOTEL_CATS.find(c => c.id === hotelCat)?.priceBase || 75
  const bikeTotal = RENTAL_BIKE.pricePerDay * rentalDays * bikesNeeded

  const accessoryTotal = Object.entries(selectedAccessories).reduce((sum, [id, on]) => {
    if (!on) return sum
    const a = OPTIONAL_ACCESSORIES.find(x => x.id === id)
    return a ? sum + a.price * rentalDays * bikesNeeded : sum
  }, 0)

  const addonTotal = Object.entries(selectedAddons).reduce((sum, [id, on]) => {
    if (!on) return sum
    const a = ADDONS.find(x => x.id === id)
    if (!a) return sum
    if (a.unit === 'night') return sum + a.price * totalNights
    return sum + a.price * Math.max(totalPassengers, 1)
  }, 0)

  const accommodationTotal = showSection('hotel') ? hotelPrice * totalNights * Math.max(totalRooms, 1) : 0
  const guideTotal = serviceType === 'guided' ? GUIDE_SUPPLEMENT_PER_DAY * rentalDays : 0

  const estimatedTotal = bikeTotal + accessoryTotal + accommodationTotal + addonTotal + guideTotal

  // Section refs & navigation
  const refs = {
    service: useRef(null), dates: useRef(null), route: useRef(null), bike: useRef(null),
    hotel: useRef(null), itinerary: useRef(null), accessories: useRef(null),
    addons: useRef(null), group: useRef(null), summary: useRef(null),
  }
  const scrollTo = (key) => {
    refs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(key)
  }

  // Route handlers
  const handleFirstStageChange = (newFirst) => {
    setFirstStage(newFirst)
    if (newFirst > lastStage) setLastStage(newFirst)
    setIntermediateStages(prev => {
      const newSet = new Set(prev)
      STAGES.forEach((stage, idx) => { if (idx <= newFirst || idx >= lastStage) newSet.delete(stage.id) })
      return newSet
    })
  }
  const handleLastStageChange = (newLast) => {
    setLastStage(newLast)
    setIntermediateStages(prev => {
      const newSet = new Set(prev)
      STAGES.forEach((stage, idx) => { if (idx <= firstStage || idx >= newLast) newSet.delete(stage.id) })
      return newSet
    })
  }
  const handleIntermediateToggle = (stageId) => {
    setIntermediateStages(prev => {
      const newSet = new Set(prev)
      newSet.has(stageId) ? newSet.delete(stageId) : newSet.add(stageId)
      return newSet
    })
  }

  // Quote body builder
  const buildQuoteBody = () => {
    const svc = SERVICE_TYPES.find(s => s.id === serviceType)
    const routeDescription = !showSection('route')
      ? 'N/A (Rent Only)'
      : intermediateStages.size > 0
        ? `Custom route: ${activeStages.map(s => s.name).join(' → ')}`
        : `Route: ${STAGES[firstStage].name} → ${STAGES[lastStage].name} (all cities)`
    const lines = [
      `Name: ${formData.name}`, `Email: ${formData.email}`, `Phone: ${formData.phone}`,
      ``, `--- Trip Details ---`,
      `Service: ${svc?.label}`,
      routeDescription,
      showSection('route') ? `Distance: ${totalKm} km | Nights: ${totalNights}` : `Rental Days: ${rentalDays}`,
      showSection('hotel') ? `Hotel: ${HOTEL_CATS.find(c => c.id === hotelCat)?.label}` : '',
      `Start Date: ${startDate || 'TBD'}`,
      showSection('group') ? `Rooms: Single(${rooms.single}) Twin(${rooms.twin}) Double(${rooms.double})` : '',
      `E-Bikes: ${bikesNeeded} × ${RENTAL_BIKE.name} (Size ${bikeSize})`,
      ``, `Accessories: ${Object.entries(selectedAccessories).filter(([,v]) => v).map(([id]) => OPTIONAL_ACCESSORIES.find(a => a.id === id)?.label).join(', ') || 'None'}`,
      showSection('addons') ? `Add-ons: ${Object.entries(selectedAddons).filter(([,v]) => v).map(([id]) => ADDONS.find(a => a.id === id)?.label).join(', ') || 'None'}` : '',
      transferIn.enabled ? `Transfer In: ${transferIn.from} → ${STAGES[firstStage].name}` : '',
      transferOut.enabled ? `Transfer Out: ${STAGES[lastStage].name} → ${transferOut.to}` : '',
      ``, `Estimated Total: €${estimatedTotal.toLocaleString()}`,
      formData.notes ? `\nNotes: ${formData.notes}` : '',
    ].filter(Boolean)
    return encodeURIComponent(lines.join('\n'))
  }

  // Airtable webhook submission
  const buildWebhookPayload = () => ({
    timestamp: new Date().toISOString(),
    serviceType,
    contact: { ...formData },
    trip: {
      startDate: startDate || null,
      endDate: endDate ? endDate.toISOString().split('T')[0] : null,
      totalNights,
      totalKm: showSection('route') ? totalKm : null,
      route: showSection('route') ? 'Coastal' : null,
      stages: showSection('route') ? activeStages.map(s => s.name) : null,
      hotelCategory: showSection('hotel') ? hotelCat : null,
      travellers: totalPassengers,
      rooms: showSection('hotel') ? { ...rooms } : null,
    },
    bike: { model: RENTAL_BIKE.name, size: bikeSize, quantity: bikesNeeded },
    accessories: Object.entries(selectedAccessories).filter(([, v]) => v).map(([id]) => id),
    addons: Object.entries(selectedAddons).filter(([, v]) => v).map(([id]) => id),
    transfers: {
      in: transferIn.enabled ? transferIn.from : null,
      out: transferOut.enabled ? transferOut.to : null,
    },
    estimatedTotal,
    language: lang,
    source: 'ciclo-planner',
  })

  const submitToAirtable = async () => {
    if (!AIRTABLE_WEBHOOK_URL) return
    try {
      const response = await fetch(AIRTABLE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildWebhookPayload()),
      })
      if (!response.ok) throw new Error('Webhook failed')
    } catch (err) {
      console.error('Airtable webhook error:', err)
    }
  }

  const handleSubmitQuote = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.email) {
      setSubmitStatus('validation')
      return
    }
    setIsSubmitting(true)
    setSubmitStatus(null)
    try {
      await submitToAirtable()
      setSubmitStatus('success')
    } catch {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Dynamic nav items based on service type
  const navItems = [
    { key: 'service', label: tx.serviceType, icon: '🎯' },
    { key: 'dates', label: tx.dates, icon: '📅' },
    showSection('route') && { key: 'route', label: tx.route, icon: '🗺️' },
    { key: 'bike', label: tx.bikeSize, icon: '🚲' },
    showSection('hotel') && { key: 'hotel', label: tx.hotel, icon: '🏨' },
    showSection('itinerary') && { key: 'itinerary', label: tx.itinerary, icon: '📋' },
    { key: 'accessories', label: tx.accessories, icon: '🎒' },
    showSection('addons') && { key: 'addons', label: tx.addons, icon: '✨' },
    { key: 'group', label: tx.group, icon: '👥' },
    { key: 'summary', label: tx.summary, icon: '📋' },
  ].filter(Boolean)

  const stepNum = (key) => {
    const idx = navItems.findIndex(n => n.key === key)
    return idx >= 0 ? idx + 1 : ''
  }

  // Filtered addons for current service type
  const filteredAddons = ADDONS.filter(a => a.forServices.includes(serviceType))

  return (
    <div className="app">
      {/* ────── Header ────── */}
      <header className="header">
        <div className="header-inner">
          <a href="https://ciclo-ebikes.com" className="logo" target="_blank" rel="noopener">
            <span className="logo-name">CICLO</span>
            <span className="logo-sub">URBAN ELECTRIC BIKES</span>
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
          <p className="hero-eyebrow">CICLO URBAN ELECTRIC BIKES</p>
          <h1 className="hero-title">{tx.subtitle}</h1>
          <p className="hero-tagline">{tx.tagline}</p>
          <div className="hero-badges">
            {showSection('route') && <span className="hero-badge">🛤️ {totalKm} km</span>}
            {showSection('route') && <span className="hero-badge">📍 {activeStages.length} stages</span>}
            <span className="hero-badge">🌊 Coastal Camino</span>
            <span className="hero-badge">⚡ Riese & Müller</span>
          </div>
        </div>
      </div>

      {/* ────── Nav Pills ────── */}
      <nav className="nav-pills">
        <div className="nav-pills-inner">
          {navItems.map(({ key, label, icon }) => (
            <button key={key} className={`nav-pill ${activeSection === key ? 'active' : ''}`} onClick={() => scrollTo(key)}>
              <span className="nav-pill-icon">{icon}</span>
              <span className="nav-pill-label">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ────── Main ────── */}
      <main className="main">

        {/* ── 1. Service Type ── */}
        <section ref={refs.service} className="section" id="service">
          <SectionHead num={stepNum('service')} icon="🎯" title={tx.serviceType} />
          <div className="service-grid">
            {SERVICE_TYPES.map(s => (
              <button
                key={s.id}
                className={`service-card ${serviceType === s.id ? 'active' : ''}`}
                onClick={() => { setServiceType(s.id); setSelectedAddons({}); }}
              >
                <span className="service-icon">{s.icon}</span>
                <span className="service-label">{lang === 'pt' ? s.labelPt : s.label}</span>
                <span className="service-desc">{lang === 'pt' ? s.descPt : s.desc}</span>
                <div className="service-includes">
                  {INCLUDED_ITEMS[s.id][lang === 'pt' ? 'pt' : 'en'].slice(0, 4).map((item, i) => (
                    <span key={i} className="service-include-item">✓ {item}</span>
                  ))}
                  {INCLUDED_ITEMS[s.id][lang === 'pt' ? 'pt' : 'en'].length > 4 && (
                    <span className="service-include-more">+{INCLUDED_ITEMS[s.id][lang === 'pt' ? 'pt' : 'en'].length - 4} more</span>
                  )}
                </div>
                {serviceType === s.id && <span className="check-badge">✓</span>}
              </button>
            ))}
          </div>
        </section>

        {/* ── 2. Trip Dates ── */}
        <section ref={refs.dates} className="section" id="dates">
          <SectionHead num={stepNum('dates')} icon="📅" title={tx.dates} />
          <div className="dates-grid">
            <div className="date-field">
              <label>{tx.startDate}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="date-field">
              <label>{tx.endDate}</label>
              <div className="date-display">{endDate ? formatDate(endDate) : tx.selectDates}</div>
            </div>
          </div>
          {serviceType === 'rent' && (
            <div className="rent-days-note">
              <p className="section-subtitle" style={{ margin: '8px 0 0', padding: 0 }}>
                {lang === 'pt' ? 'Dias de aluguer' : 'Rental days'}: <strong>{rentalDays}</strong>
              </p>
            </div>
          )}
        </section>

        {/* ── 3. Route Selection (self-guided / guided only) ── */}
        {showSection('route') && (
          <section ref={refs.route} className="section" id="route">
            <SectionHead num={stepNum('route')} icon="🗺️" title={tx.route} />
            <div className="dates-grid">
              <div className="date-field">
                <label>{tx.firstNight}</label>
                <select value={firstStage} onChange={e => handleFirstStageChange(+e.target.value)}>
                  {STAGES.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}
                </select>
              </div>
              <div className="date-field">
                <label>{tx.lastNight}</label>
                <select value={lastStage} onChange={e => handleLastStageChange(+e.target.value)}>
                  {STAGES.filter((_, i) => i >= firstStage).map((s, i) => (
                    <option key={s.id} value={firstStage + i}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {lastStage - firstStage > 1 && (
              <div className="route-customizer">
                <h4>{lang === 'pt' ? 'Personalize a Sua Rota (Opcional)' : 'Customize Your Route (Optional)'}</h4>
                <p className="route-hint">{lang === 'pt' ? 'Por defeito, todas as cidades estão incluídas. Desmarque para saltar:' : 'By default, all cities are included. Uncheck to skip:'}</p>
                <div className="stages-checklist">
                  {STAGES.map((stage, idx) => {
                    if (idx <= firstStage || idx >= lastStage) return null
                    const isSelected = intermediateStages.size === 0 || intermediateStages.has(stage.id)
                    return (
                      <label key={stage.id} className={`stage-toggle-card ${isSelected ? 'active' : ''}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => handleIntermediateToggle(stage.id)} />
                        <div className="stage-toggle-content">
                          <span className="stage-toggle-num">{tx.stage} {idx + 1}</span>
                          <span className="stage-toggle-name">{stage.name}</span>
                          {stage.highlight && <span className="highlight-tag">⭐</span>}
                          <span className="stage-toggle-dist">{stage.km} km</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="route-preview-card">
              <h4>{lang === 'pt' ? 'A Sua Rota' : 'Your Route'}</h4>
              <div className="route-path">
                {activeStages.map((s, i) => (
                  <span key={s.id}>{s.name}{i < activeStages.length - 1 && <span className="arrow-sep">→</span>}</span>
                ))}
              </div>
              <div className="route-stats">
                <span>🛤️ {totalKm} km</span>
                <span>📍 {activeStages.length} {lang === 'pt' ? 'cidades' : 'cities'}</span>
                <span>🌙 {totalNights} {tx.nights}{totalNights !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </section>
        )}

        {/* ── 4. Bike & Size ── */}
        <section ref={refs.bike} className="section" id="bike">
          <SectionHead num={stepNum('bike')} icon="🚲" title={tx.bikeSize} />
          <div className="bike-showcase">
            <div className="bike-showcase-info">
              <h3 className="bike-showcase-name">{RENTAL_BIKE.name}</h3>
              <p className="bike-showcase-desc">{lang === 'pt' ? RENTAL_BIKE.descPt : RENTAL_BIKE.desc}</p>
              <div className="bike-showcase-price">€{RENTAL_BIKE.pricePerDay}<small>{tx.perDay}</small></div>
            </div>
          </div>
          <div className="size-section">
            <label className="size-label">{tx.selectSize}</label>
            <div className="size-picker">
              {BIKE_SIZES.map(s => (
                <button key={s.id} className={`size-btn ${bikeSize === s.id ? 'active' : ''}`} onClick={() => setBikeSize(s.id)}>
                  <span className="size-letter">{s.label}</span>
                  <span className="size-height">{lang === 'pt' ? s.heightPt : s.height}</span>
                </button>
              ))}
            </div>
          </div>
          {serviceType === 'rent' && (
            <div className="bikes-count">
              <span className="room-label">🚲 {tx.numberOfBikes}</span>
              <Counter value={numBikes} onDec={() => setNumBikes(n => Math.max(1, n - 1))} onInc={() => setNumBikes(n => n + 1)} />
            </div>
          )}
          <div className="included-box">
            <h4>✓ {tx.included}</h4>
            <div className="included-grid">
              {INCLUDED_ITEMS[serviceType][lang === 'pt' ? 'pt' : 'en'].map((item, i) => (
                <div key={i} className="included-item"><span className="inc-check">✓</span> {item}</div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. Accommodation (self-guided / guided only) ── */}
        {showSection('hotel') && (
          <section ref={refs.hotel} className="section" id="hotel">
            <SectionHead num={stepNum('hotel')} icon="🏨" title={tx.hotel} />
            <div className="hotel-grid">
              {HOTEL_CATS.map(c => (
                <button key={c.id} className={`hotel-card ${hotelCat === c.id ? 'active' : ''}`} onClick={() => setHotelCat(c.id)}>
                  <span className="hotel-icon">{c.icon}</span>
                  <span className="hotel-label">{lang === 'pt' ? c.labelPt : c.label}</span>
                  <span className="hotel-desc">{lang === 'pt' ? c.descPt : c.desc}</span>
                  <span className="hotel-price">from €{c.priceBase}<small>/{tx.nights}</small></span>
                  {hotelCat === c.id && <span className="check-badge">✓</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Map (self-guided / guided only) ── */}
        {showSection('itinerary') && (
          <section className="section section-map">
            <SectionHead icon="🗺️" title={tx.map} />
            <div className="map-container">
              <RouteMap stages={activeStages} hotelCat={hotelCat} />
            </div>
          </section>
        )}

        {/* ── 6. Itinerary (self-guided / guided only) ── */}
        {showSection('itinerary') && (
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
                          <span className="dist-time">~{Math.round(next.km / 15 * 60)} min</span>
                        </span>
                        <span className="dist-line" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 7. Optional Accessories ── */}
        <section ref={refs.accessories} className="section" id="accessories">
          <SectionHead num={stepNum('accessories')} icon="🎒" title={tx.optionalAccessories} />
          <p className="section-subtitle" style={{ margin: '-16px 0 20px 0', padding: 0 }}>{tx.accessoriesNote}</p>
          <div className="addons-list">
            {OPTIONAL_ACCESSORIES.map(a => (
              <div key={a.id} className={`addon-card ${selectedAccessories[a.id] ? 'active' : ''}`}>
                <div className="addon-top">
                  <label className="addon-toggle">
                    <input type="checkbox" checked={!!selectedAccessories[a.id]} onChange={e => setSelectedAccessories(p => ({ ...p, [a.id]: e.target.checked }))} />
                    <span className="addon-icon">{a.icon}</span>
                    <span className="addon-label">{lang === 'pt' ? a.labelPt : a.label}</span>
                  </label>
                  <span className="addon-price">€{a.price} <small>{tx.perDay}</small></span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 8. Add-ons (self-guided / guided only) ── */}
        {showSection('addons') && filteredAddons.length > 0 && (
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
            {/* Experience add-ons */}
            <div className="addons-list">
              {filteredAddons.map(a => (
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
        )}

        {/* ── 9. Travellers & Rooms ── */}
        <section ref={refs.group} className="section" id="group">
          <SectionHead num={stepNum('group')} icon="👥" title={tx.group} />
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

        {/* ── 10. Summary ── */}
        <section ref={refs.summary} className="section" id="summary">
          <SectionHead num={stepNum('summary')} icon="📋" title={tx.summary} />
          <div className="summary-card">
            <div className="summary-grid">
              <SumItem icon="🎯" label={tx.service} value={lang === 'pt' ? currentService.labelPt : currentService.label} />
              {showSection('route') && <SumItem icon="📍" label={tx.route} value={`${STAGES[firstStage].name} → ${STAGES[lastStage].name}`} />}
              {showSection('route') && <SumItem icon="🛤️" label={tx.distance} value={`${totalKm} km`} />}
              <SumItem icon="🌙" label={tx.duration} value={showSection('route') ? `${totalNights} ${tx.nights}${totalNights !== 1 ? 's' : ''}` : `${rentalDays} ${lang === 'pt' ? 'dias' : 'days'}`} />
              <SumItem icon="🚲" label={tx.bikeSize} value={`${RENTAL_BIKE.name} (${bikeSize}) × ${bikesNeeded}`} />
              {showSection('hotel') && <SumItem icon="🏨" label={tx.hotel} value={HOTEL_CATS.find(c => c.id === hotelCat)?.[lang === 'pt' ? 'labelPt' : 'label']} />}
              <SumItem icon="👥" label={tx.passengers} value={totalPassengers} />
              <SumItem icon="📅" label={tx.startDate} value={startDate ? formatDate(new Date(startDate)) : '—'} />
            </div>

            {/* Selected accessories */}
            {Object.entries(selectedAccessories).some(([, v]) => v) && (
              <div className="summary-addons">
                <h4>{tx.accessories}:</h4>
                <div className="addon-badges">
                  {Object.entries(selectedAccessories).filter(([, v]) => v).map(([id]) => {
                    const a = OPTIONAL_ACCESSORIES.find(x => x.id === id)
                    return a ? <span key={id} className="addon-badge-sm">{a.icon} {lang === 'pt' ? a.labelPt : a.label}</span> : null
                  })}
                </div>
              </div>
            )}

            {/* Selected add-ons */}
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
            <form className="quote-form" onSubmit={handleSubmitQuote}>
              <div className="form-row">
                <input placeholder={lang === 'pt' ? 'Nome completo *' : 'Full name *'} value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} required />
                <input placeholder="Email *" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} required />
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
              <div className="cta-row">
                <button type="submit" className="cta-btn" disabled={isSubmitting}>
                  {isSubmitting ? tx.submitting : `✉️ ${tx.requestQuote}`}
                </button>
                <a
                  className="cta-btn cta-whatsapp"
                  href={`https://wa.me/351933405845?text=${buildQuoteBody()}`}
                  target="_blank"
                  rel="noopener"
                >
                  💬 WhatsApp
                </a>
              </div>
            </form>

            {submitStatus === 'success' && <div className="submit-toast success">{tx.submitSuccess}</div>}
            {submitStatus === 'error' && <div className="submit-toast error">{tx.submitError}</div>}
            {submitStatus === 'validation' && <div className="submit-toast error">{tx.nameRequired}</div>}

            <p className="cta-note">{tx.quoteNote}</p>
          </div>
        </section>
      </main>

      {/* ────── Bottom Bar ────── */}
      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <span className="bb-stat">{lang === 'pt' ? currentService.labelPt : currentService.label}</span>
          <span className="bb-sep" />
          {showSection('route') && <><span className="bb-route">{STAGES[firstStage].name} → {STAGES[lastStage].name}</span><span className="bb-sep" /></>}
          {showSection('route') && <><span className="bb-stat">{totalKm} km</span><span className="bb-sep" /></>}
          <span className="bb-stat">{bikesNeeded} 🚲</span>
          <div className="bb-spacer" />
          <span className="bb-price">€{estimatedTotal.toLocaleString()}</span>
          <button className="bb-cta" onClick={() => scrollTo('summary')}>{tx.requestQuote}</button>
        </div>
      </div>

      {/* ────── Footer ────── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="logo footer-logo">
            <span className="logo-name" style={{ color: '#fff' }}>CICLO</span>
            <span className="logo-sub" style={{ color: 'rgba(255,255,255,0.5)' }}>URBAN ELECTRIC BIKES</span>
          </div>
          <div className="footer-links">
            <a href="https://ciclo-ebikes.com" target="_blank" rel="noopener">ciclo-ebikes.com</a>
            <span>·</span>
            <a href="tel:+351933405845">+351 933 405 845</a>
            <span>·</span>
            <a href="mailto:hello@ciclo-ebikes.com">hello@ciclo-ebikes.com</a>
          </div>
          <p className="footer-copy">© {new Date().getFullYear()} CICLO Urban Electric Bikes · Rua General Torres 24, V.N. Gaia, Porto, Portugal</p>
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
      <button type="button" onClick={onDec} className="counter-btn">−</button>
      <span className="counter-val">{value}</span>
      <button type="button" onClick={onInc} className="counter-btn">+</button>
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
