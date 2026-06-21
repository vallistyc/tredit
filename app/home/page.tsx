'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Listing = {
  id: string
  title: string
  brand: string | null
  location: string | null
  expected_goods: string[]
  condition_notes: string | null
  estimated_value: number
  photo_urls: string[]
  category: string
  created_at: string
  owner_id: string
}

const CATEGORIES = [
  { value: 'semua', label: 'Semua' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'gadget', label: 'Gadget' },
  { value: 'aksesoris', label: 'Aksesoris' },
  { value: 'lainnya', label: 'Lainnya' },
]

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('semua')

  useEffect(() => {
    fetchListings()
  }, [activeCategory])

  async function fetchListings() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const currentUserId = userData.user?.id

    // Ambil listing_id yang sudah di-bid oleh user ini (status pending)
    let bidedListingIds: string[] = []
    if (currentUserId) {
      const { data: myBids } = await supabase
        .from('bids')
        .select('listing_id')
        .eq('bidder_id', currentUserId)
        .eq('status', 'pending')

      bidedListingIds = (myBids ?? []).map((b) => b.listing_id)
    }

    // Query dasar: hanya listing yang masih aktif
    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    // Sembunyikan listing milik sendiri
    if (currentUserId) {
      query = query.neq('owner_id', currentUserId)
    }

    // Sembunyikan listing yang sudah di-bid oleh user ini
    if (bidedListingIds.length > 0) {
      query = query.not('id', 'in', `(${bidedListingIds.join(',')})`)
    }

    // Filter kategori
    if (activeCategory !== 'semua') {
      query = query.eq('category', activeCategory)
    }

    const { data, error } = await query

    if (!error && data) {
      setListings(data as Listing[])
    }

    setLoading(false)
  }

  function formatRupiah(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  function formatRelativeDate(isoDate: string) {
    const diffMs = Date.now() - new Date(isoDate).getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hari ini'
    if (diffDays === 1) return '1 hari lalu'
    return `${diffDays} hari lalu`
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1>TREDIT</h1>

      {/* Tombol filter kategori */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: '1px solid #5B3FE0',
              background: activeCategory === cat.value ? '#5B3FE0' : 'transparent',
              color: activeCategory === cat.value ? '#fff' : '#5B3FE0',
              cursor: 'pointer',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading && <p>Memuat listing...</p>}

      {!loading && listings.length === 0 && (
        <p>Belum ada listing tersedia di kategori ini.</p>
      )}

      {/* Grid card listing */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {listings.map((listing) => (
          <a
            key={listing.id}
            href={`/listing/${listing.id}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid #ddd',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Foto */}
            <div
              style={{
                width: '100%',
                height: 180,
                background: listing.photo_urls[0]
                  ? `url(${listing.photo_urls[0]}) center/cover`
                  : '#000',
              }}
            />

            {/* Judul + harga */}
            <div style={{ background: '#C8BEF5', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>{listing.title}</h3>
                <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                  E.P
                  <br />
                  {formatRupiah(listing.estimated_value)}
                </span>
              </div>
            </div>

            {/* Info badges */}
            <div style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {listing.location && (
                  <span style={{ fontSize: 12, background: '#EEEDFE', padding: '4px 8px', borderRadius: 8 }}>
                    📍 {listing.location}
                  </span>
                )}
                <span style={{ fontSize: 12, background: '#EEEDFE', padding: '4px 8px', borderRadius: 8 }}>
                  👋 0 Bids
                </span>
                <span style={{ fontSize: 12, background: '#EEEDFE', padding: '4px 8px', borderRadius: 8 }}>
                  🗓 {formatRelativeDate(listing.created_at)}
                </span>
              </div>

              {listing.expected_goods.length > 0 && (
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  <strong>Expected Goods</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {listing.expected_goods.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {listing.condition_notes && (
                <div style={{ fontSize: 13 }}>
                  <strong>Condition</strong>
                  <p style={{ margin: '4px 0 0' }}>{listing.condition_notes}</p>
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}