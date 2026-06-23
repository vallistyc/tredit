'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '../components/Navbar'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
import { getCurrentAppRole } from '@/lib/authRole'

type Listing = {
  id: string
  owner_id: string
  title: string
  category: string
  brand: string | null
  condition_notes: string | null
  location: string | null
  expected_goods: string[] | null
  estimated_value: number
  photo_urls: string[] | null
  status: string
  created_at: string
  incomingBidCount: number
  outgoingOfferCount: number
}

const CATEGORIES = ['all', 'fashion', 'gadget', 'aksesoris', 'lainnya']

function formatRupiah(value: number) {
  return 'Rp' + Number(value).toLocaleString('id-ID')
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  if (hours < 24) return `${hours} jam lalu`
  return `${days} hari lalu`
}

export default function HomePage() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [category, setCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchMarketplace() {
      setLoading(true)
      setError('')

      const { user, role } = await getCurrentAppRole()

      if (!user) {
        router.push('/login')
        return
      }

      if (role === 'verifier') {
        router.push('/verifier')
        return
      }

      const { data, error: listingsError } = await supabase
        .from('listings')
        .select('*')
        .in('status', ['active', 'pending_offer'])
        .neq('owner_id', user.id)
        .order('created_at', { ascending: false })

      if (listingsError) {
        setError('Gagal memuat marketplace: ' + listingsError.message)
        setListings([])
        setLoading(false)
        return
      }

      const withCounts = await Promise.all(
        (data || []).map(async item => {
          const [{ count: incomingBidCount }, { count: outgoingOfferCount }] =
            await Promise.all([
              supabase
                .from('bids')
                .select('*', { count: 'exact', head: true })
                .eq('listing_id', item.id),
              supabase
                .from('bids')
                .select('*', { count: 'exact', head: true })
                .eq('offered_listing_id', item.id)
                .eq('status', 'pending'),
            ])

          return {
            ...item,
            incomingBidCount: incomingBidCount || 0,
            outgoingOfferCount: outgoingOfferCount || 0,
          } as Listing
        })
      )

      setListings(withCounts)
      setLoading(false)
    }

    fetchMarketplace()
  }, [router])

  const filteredListings = useMemo(() => {
    if (category === 'all') return listings
    return listings.filter(item => item.category === category)
  }, [category, listings])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <main className="main-content" style={{ padding: '20px 16px 110px' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <header style={{ marginBottom: '18px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Marketplace</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Cari barang yang cocok, lalu Catch It dengan listing milikmu.
            </p>
          </header>

          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '8px' }}>
            {CATEGORIES.map(item => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                style={{
                  border: '1px solid',
                  borderColor: category === item ? 'var(--primary)' : 'var(--border)',
                  background: category === item ? 'var(--primary)' : 'var(--surface)',
                  color: category === item ? 'white' : 'var(--text)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  textTransform: item === 'all' ? 'none' : 'capitalize',
                  whiteSpace: 'nowrap',
                }}
              >
                {item === 'all' ? 'Semua' : item}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Memuat listing...
            </div>
          ) : error ? (
            <div className="card" style={{ padding: '18px' }}>
              <p className="error-text">{error}</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Belum ada listing tersedia</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Listing milik akun lain yang aktif akan muncul di sini.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {filteredListings.map(item => {
                const hasActiveOffer = item.status === 'pending_offer' || item.outgoingOfferCount > 0

                return (
                  <article
                    key={item.id}
                    className="card"
                    onClick={() => router.push(`/listing/${item.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ height: '190px', background: '#F3F0FF', position: 'relative' }}>
                      {item.photo_urls && item.photo_urls.length > 0 ? (
                        <img
                          src={item.photo_urls[0]}
                          alt={item.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                          No Photo
                        </div>
                      )}

                      {hasActiveOffer && (
                        <span
                          style={{
                            position: 'absolute',
                            left: '10px',
                            top: '10px',
                            background: '#FFF8E7',
                            color: '#92640A',
                            border: '1px solid #FFB800',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          Ada tawaran tukar aktif
                        </span>
                      )}
                    </div>

                    <div style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ minWidth: 0 }}>
                          <h2 style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1.3 }}>{item.title}</h2>
                          {item.brand && (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                              {item.brand}
                            </p>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>E.P</p>
                          <p style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: 800 }}>
                            {formatRupiah(item.estimated_value)}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {item.location && (
                          <span className="badge-muted">{item.location}</span>
                        )}
                        <span className="badge-muted">{item.incomingBidCount} bids</span>
                        <span className="badge-muted">{timeAgo(item.created_at)}</span>
                      </div>

                      {item.expected_goods && item.expected_goods.length > 0 && (
                        <div style={{ marginBottom: '12px' }}>
                          <p className="section-label">Expected Goods</p>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {item.expected_goods.slice(0, 3).map(good => (
                              <span key={good} className="badge-amber">
                                {good}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.condition_notes && (
                        <div>
                          <p className="section-label">Condition</p>
                          <p
                            style={{
                              color: 'var(--text)',
                              fontSize: '13px',
                              lineHeight: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {item.condition_notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
