import { useEffect, useRef } from 'react'
import L from 'leaflet'

export default function RouteMap({ stages, hotelCat }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const polylineRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (mapInstance.current) {
      mapInstance.current.remove()
    }

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    // Markers
    const markers = stages.map((stage, idx) => {
      const isFirst = idx === 0
      const isLast = idx === stages.length - 1
      const isHighlight = stage.highlight

      const size = isFirst || isLast ? 36 : isHighlight ? 30 : 24
      const bg = isFirst ? '#152930' : isLast ? '#ffff47' : isHighlight ? '#5764ff' : '#2a4d5a'
      const textColor = isLast ? '#152930' : '#fff'
      const border = isFirst || isLast ? '4px' : '3px'

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${bg};color:${textColor};border:${border} solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
          font-size:${size > 30 ? 13 : 11}px;font-weight:700;font-family:'GT Haptik','Helvetica Neue',Helvetica,Arial,sans-serif;
        ">${isFirst ? '🚀' : isLast ? '🏁' : idx + 1}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      })

      const marker = L.marker([stage.lat, stage.lng], { icon }).addTo(map)
      const catBadge = stage.cats.includes(hotelCat)
        ? `<span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#e8f4f8;color:#152930;font-size:10px;font-weight:700;margin-left:4px">${hotelCat}</span>`
        : ''

      marker.bindPopup(`
        <div style="min-width:160px">
          <strong style="font-size:14px">${stage.name}</strong> ${catBadge}
          <br/><span style="color:#888;font-size:11px">Stage ${idx + 1}${stage.highlight ? ' · ⭐ Highlight' : ''}</span>
          ${stage.km > 0 ? `<br/><span style="color:#152930;font-weight:600;font-size:12px">${stage.km} km from previous</span>` : ''}
          <br/><span style="font-size:12px;color:#555">${stage.desc}</span>
        </div>
      `)
      return marker
    })
    markersRef.current = markers

    // Route polyline
    const coords = stages.map(s => [s.lat, s.lng])
    const polyline = L.polyline(coords, {
      color: '#152930',
      weight: 4,
      opacity: 0.7,
      dashArray: '8, 6',
      smoothFactor: 1.5,
    }).addTo(map)
    polylineRef.current = polyline

    // Fit bounds
    if (coords.length > 0) {
      map.fitBounds(coords, { padding: [40, 40] })
    }

    mapInstance.current = map

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [stages, hotelCat])

  return <div ref={mapRef} style={{ width: '100%', height: '420px', borderRadius: '12px' }} />
}
