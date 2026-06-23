'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Profile = {
  username: string
  full_name: string | null
  whatsapp_number: string | null
  email: string | null
  trust_score: number | null
}

type Listing = {
  id: string
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

const STATUS_FILTERS = [
  'all',
  'active',
  'pending_offer',
  'locked_in_deal',
  'completed',
  'inactive',
]

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

function statusLabel(status: string) {
  if (status === 'active') return 'Active'
  if (status === 'pending_offer') return 'Pending Offer'
  if (status === 'locked_in_deal') return 'Locked in Deal'
  if (status === 'completed') return 'Completed'
  if (status === 'inactive') return 'Inactive'
  if (status === 'locked') return 'Locked'
  if (status === 'cancelled') return 'Cancelled'
  return status
}

function statusStyle(status: string) {
  if (status === 'active') return { background: '#EAFBF1', color: '#166534' }
  if (status === 'pending_offer') return { background: '#FFF8E7', color: '#92640A' }
  if (status === 'locked_in_deal' || status === 'locked') {
    return { background: '#EDE9FB', color: 'var(--primary)' }
  }
  if (status === 'inactive' || status === 'cancelled') {
    return { background: '#F3F4F6', color: 'var(--text-muted)' }
  }
  return { background: '#EFF6FF', color: '#1D4ED8' }
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busyListingId, setBusyListingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError('')
    setNotice('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const [{ data: profileData, error: profileError }, { data: listingData, error: listingError }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('username, full_name, whatsapp_number, email, trust_score')
          .eq('id', user.id)
          .single(),
        supabase
          .from('listings')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
      ])

    if (profileError || listingError) {
      setError(profileError?.message || listingError?.message || 'Gagal memuat profile')
      setLoading(false)
      return
    }

    const withCounts = await Promise.all(
      (listingData || []).map(async item => {
        const [{ count: incomingBidCount }, { count: outgoingOfferCount }] =
          await Promise.all([
            supabase
              .from('bids')
              .select('*', { count: 'exact', head: true })
              .eq('listing_id', item.id)
              .eq('status', 'pending'),
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

    setProfile(profileData)
    setListings(withCounts)
    setLoading(false)
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfile()
  }, [loadProfile])

  const filteredListings = useMemo(() => {
    if (filter === 'all') return listings
    return listings.filter(item => item.status === filter)
  }, [filter, listings])

  const stats = useMemo(() => {
    return {
      total: listings.length,
      active: listings.filter(item => item.status === 'active').length,
      pending: listings.filter(item => item.status === 'pending_offer').length,
      locked: listings.filter(item => ['locked_in_deal', 'locked'].includes(item.status)).length,
      inactive: listings.filter(item => item.status === 'inactive').length,
    }
  }, [listings])

  async function updateListingStatus(listing: Listing, nextStatus: 'active' | 'inactive') {
    setBusyListingId(listing.id)
    setError('')
    setNotice('')

    const { error: updateError } = await supabase
      .from('listings')
      .update({ status: nextStatus })
      .eq('id', listing.id)

    if (updateError) {
      setError('Gagal update listing: ' + updateError.message)
      setBusyListingId(null)
      return
    }

    setListings(prev =>
      prev.map(item => (item.id === listing.id ? { ...item, status: nextStatus } : item))
    )
    setNotice(
      nextStatus === 'inactive'
        ? 'Listing dinonaktifkan dan tidak muncul di marketplace.'
        : 'Listing diaktifkan kembali.'
    )
    setBusyListingId(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <main className="main-content" style={{ padding: '20px 16px 120px' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <header style={{ marginBottom: '18px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Profile</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Kelola barangmu dan pantau status setiap pitch.
            </p>
          </header>

          {loading ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Memuat profile...
            </div>
          ) : error ? (
            <div className="card" style={{ padding: '16px' }}>
              <p className="error-text">{error}</p>
            </div>
          ) : (
            <>
              <section
                className="card"
                style={{
                  padding: '18px',
                  marginBottom: '14px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '20px',
                      flexShrink: 0,
                    }}
                  >
                    {(profile?.username || 'T').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 800 }}>
                      {profile?.full_name || profile?.username || 'TREDIT User'}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                      @{profile?.username}
                    </p>
                    <p style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 700, marginTop: '4px' }}>
                      Trust Score {profile?.trust_score ?? 100}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <StatCard label="Total Listing" value={stats.total} />
                  <StatCard label="Active" value={stats.active} />
                  <StatCard label="Pending Offer" value={stats.pending} />
                  <StatCard label="Locked" value={stats.locked} />
                </div>
              </section>

              {notice && (
                <div className="card" style={{ padding: '12px 14px', marginBottom: '12px', border: '1px solid #FFB800' }}>
                  <p style={{ color: '#92640A', fontSize: '13px', lineHeight: 1.5 }}>{notice}</p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '2px' }}>
                  {STATUS_FILTERS.map(item => (
                    <button
                      key={item}
                      onClick={() => setFilter(item)}
                      style={{
                        border: '1px solid',
                        borderColor: filter === item ? 'var(--primary)' : 'var(--border)',
                        background: filter === item ? 'var(--primary)' : 'var(--surface)',
                        color: filter === item ? 'white' : 'var(--text)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item === 'all' ? 'Semua' : statusLabel(item)}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => router.push('/listing/new')}
                  style={{
                    border: 'none',
                    background: 'var(--primary)',
                    color: 'white',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Add Pitch
                </button>
              </div>

              {filteredListings.length === 0 ? (
                <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>
                    Belum ada listing
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                    Listing dengan filter ini belum tersedia.
                  </p>
                  <button className="btn-primary" onClick={() => router.push('/listing/new')}>
                    Buat Listing
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredListings.map(listing => (
                    <ListingRow
                      key={listing.id}
                      listing={listing}
                      busy={busyListingId === listing.id}
                      onOpen={() => router.push(`/listing/${listing.id}`)}
                      onActivate={() => updateListingStatus(listing, 'active')}
                      onDeactivate={() => updateListingStatus(listing, 'inactive')}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
        {label}
      </p>
      <p style={{ fontSize: '20px', fontWeight: 800 }}>{value}</p>
    </div>
  )
}

function ListingRow({
  listing,
  busy,
  onOpen,
  onActivate,
  onDeactivate,
}: {
  listing: Listing
  busy: boolean
  onOpen: () => void
  onActivate: () => void
  onDeactivate: () => void
}) {
  const style = statusStyle(listing.status)
  const canToggle = listing.status === 'active' || listing.status === 'inactive'

  return (
    <article className="card" style={{ padding: '12px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <button
          onClick={onOpen}
          style={{
            width: '86px',
            height: '86px',
            border: 'none',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#F3F0FF',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
          }}
        >
          {listing.photo_urls && listing.photo_urls.length > 0 ? (
            <img
              src={listing.photo_urls[0]}
              alt={listing.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: 'var(--primary)', fontSize: '12px' }}>No Photo</span>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
            <div style={{ minWidth: 0 }}>
              <button
                onClick={onOpen}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  padding: 0,
                  textAlign: 'left',
                  fontSize: '16px',
                  fontWeight: 800,
                  lineHeight: 1.3,
                }}
              >
                {listing.title}
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px', textTransform: 'capitalize' }}>
                {listing.category}{listing.brand ? ` | ${listing.brand}` : ''}
              </p>
            </div>

            <span
              style={{
                height: 'fit-content',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '11px',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                ...style,
              }}
            >
              {statusLabel(listing.status)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span className="badge-muted">E.P {formatRupiah(listing.estimated_value)}</span>
            <span className="badge-muted">{listing.incomingBidCount} incoming</span>
            <span className="badge-muted">{listing.outgoingOfferCount} outgoing</span>
            <span className="badge-muted">{timeAgo(listing.created_at)}</span>
          </div>

          {listing.status === 'pending_offer' && (
            <p style={{ color: '#92640A', fontSize: '13px', lineHeight: 1.5, marginBottom: '8px' }}>
              Barang ini sedang menjadi penawaran aktif, tapi masih terlihat di marketplace sebagai Soft Lock.
            </p>
          )}

          {listing.status === 'locked_in_deal' && (
            <p style={{ color: 'var(--primary)', fontSize: '13px', lineHeight: 1.5, marginBottom: '8px' }}>
              Barang ini sudah terkunci dalam deal dan tidak muncul di marketplace.
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={onOpen}
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                borderRadius: '8px',
                padding: '8px 10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Detail
            </button>

            {canToggle && (
              <button
                onClick={listing.status === 'active' ? onDeactivate : onActivate}
                disabled={busy}
                style={{
                  border: '1.5px solid var(--primary)',
                  background: listing.status === 'active' ? 'transparent' : 'var(--primary)',
                  color: listing.status === 'active' ? 'var(--primary)' : 'white',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'Memproses...' : listing.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
