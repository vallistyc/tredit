'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Listing = {
  id: string
  title: string
  photo_urls: string[] | null
  estimated_value: number
  status: string
}

type Bid = {
  id: string
  listing_id: string
  bidder_id: string
  offered_listing_id: string
  status: string
  created_at: string
}

type VerifierRow = {
  bid: Bid
  pitcherListing?: Listing
  catcherListing?: Listing
}

type Validity = 'valid' | 'invalid'

const DEAL_STATUSES = [
  'accepted',
  'verification_passed',
  'completed',
  'refund_pitcher_invalid',
  'refund_catcher_invalid',
  'refund_both_invalid',
]

function formatRupiah(value?: number) {
  if (!value) return 'Rp0'
  return 'Rp' + Number(value).toLocaleString('id-ID')
}

function statusLabel(status: string) {
  if (status === 'accepted') return 'Menunggu Verifikasi'
  if (status === 'verification_passed') return 'Valid, Siap Distribusi'
  if (status === 'completed') return 'Completed'
  if (status === 'refund_pitcher_invalid') return 'Refund Pitcher Invalid'
  if (status === 'refund_catcher_invalid') return 'Refund Catcher Invalid'
  if (status === 'refund_both_invalid') return 'Penalty Keduanya Invalid'
  return status
}


export default function VerifierPage() {
  const router = useRouter()
  const [rows, setRows] = useState<VerifierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyBidId, setBusyBidId] = useState<string | null>(null)
  const [pitcherValidity, setPitcherValidity] = useState<Record<string, Validity>>({})
  const [catcherValidity, setCatcherValidity] = useState<Record<string, Validity>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [username, setUsername] = useState('')

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      if (data) setUsername(data.username)
    }
    getProfile()
  }, [])
  
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const loadDeals = useCallback(async () => {
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: bidData, error: bidError } = await supabase
      .from('bids')
      .select('id, listing_id, bidder_id, offered_listing_id, status, created_at')
      .in('status', DEAL_STATUSES)
      .order('created_at', { ascending: false })

    if (bidError) {
      setError('Gagal memuat queue verifier: ' + bidError.message)
      setLoading(false)
      return
    }

    const bids = (bidData || []) as Bid[]
    const listingIds = Array.from(new Set(bids.flatMap(bid => [bid.listing_id, bid.offered_listing_id])))
    const { data: listingData } = listingIds.length
      ? await supabase
          .from('listings')
          .select('id, title, photo_urls, estimated_value, status')
          .in('id', listingIds)
      : { data: [] }

    const listingMap = new Map<string, Listing>()
    ;((listingData || []) as Listing[]).forEach(listing => listingMap.set(listing.id, listing))
    setRows(
      bids.map(bid => ({
        bid,
        pitcherListing: listingMap.get(bid.listing_id),
        catcherListing: listingMap.get(bid.offered_listing_id),
      }))
    )
    setLoading(false)
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDeals()
  }, [loadDeals])

  const stats = useMemo(() => {
    return {
      waiting: rows.filter(row => row.bid.status === 'accepted').length,
      passed: rows.filter(row => row.bid.status === 'verification_passed').length,
      completed: rows.filter(row => row.bid.status === 'completed').length,
      refunded: rows.filter(row => row.bid.status.startsWith('refund_')).length,
    }
  }, [rows])

  async function verify(row: VerifierRow) {
    const pitcher = pitcherValidity[row.bid.id] || 'valid'
    const catcher = catcherValidity[row.bid.id] || 'valid'
    setBusyBidId(row.bid.id)
    setError('')
    setNotice('')

    const { data, error: verifyError } = await supabase.rpc('verify_bid_v4', {
      p_bid_id: row.bid.id,
      p_pitcher_valid: pitcher === 'valid',
      p_catcher_valid: catcher === 'valid',
    })

    if (verifyError) {
      setError('Gagal menyimpan verifikasi: ' + verifyError.message)
      setBusyBidId(null)
      return
    }

    setNotice(`Hasil verifikasi disimpan: ${statusLabel(String(data))}.`)
    setBusyBidId(null)
    await loadDeals()
  }

  async function complete(row: VerifierRow) {
    setBusyBidId(row.bid.id)
    setError('')
    setNotice('')

    const { error: completeError } = await supabase.rpc('complete_bid_v4', { p_bid_id: row.bid.id })

    if (completeError) {
      setError('Gagal menyelesaikan deal: ' + completeError.message)
      setBusyBidId(null)
      return
    }

    setNotice('Deal selesai. Listing kedua barang menjadi Completed dan escrow dikembalikan.')
    setBusyBidId(null)
    await loadDeals()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <main className="main-content-verif" style={{ padding: '20px 16px 120px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto' }}>
          <header style={{ marginBottom: '16px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Verifier</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Input hasil verifikasi barang Pitcher dan Catcher.
            </p>
          </header>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            {username && (
              <p style={{
                fontSize: '13px', color: 'var(--text-muted)',
                padding: '0 8px', marginBottom: '8px'
              }}>@{username}</p>
            )}
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '11px 12px', borderRadius: '10px', border: 'none',
                background: 'transparent', color: 'var(--danger)',
                fontWeight: '500', fontSize: '15px', cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'left', width: '100%'
              }}
            >
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <StatCard label="Menunggu" value={stats.waiting} />
            <StatCard label="Valid" value={stats.passed} />
            <StatCard label="Completed" value={stats.completed} />
            <StatCard label="Refund" value={stats.refunded} />
          </section>

          {notice && (
            <div className="card" style={{ padding: '12px 14px', marginBottom: '12px', border: '1px solid #FFB800' }}>
              <p style={{ color: '#92640A', fontSize: '13px' }}>{notice}</p>
            </div>
          )}

          {error && (
            <div className="card" style={{ padding: '12px 14px', marginBottom: '12px' }}>
              <p className="error-text">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Memuat queue verifier...
            </div>
          ) : rows.length === 0 ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Belum ada deal aktif</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Accepted deal akan muncul setelah Pitcher menerima Catch It.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rows.map(row => (
                <article key={row.bid.id} className="card" style={{ padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <div>
                      <p className="section-label">Deal</p>
                      <h2 style={{ fontSize: '17px', fontWeight: 800 }}>
                        {row.catcherListing?.title || 'Barang Catcher'} to {row.pitcherListing?.title || 'Barang Pitcher'}
                      </h2>
                    </div>
                    <span style={{ height: 'fit-content', borderRadius: '6px', padding: '6px 9px', background: '#EDE9FB', color: 'var(--primary)', fontSize: '12px', fontWeight: 800 }}>
                      {statusLabel(row.bid.status)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                    <VerifyItem
                      role="Pitcher"
                      listing={row.pitcherListing}
                      value={pitcherValidity[row.bid.id] || 'valid'}
                      disabled={row.bid.status !== 'accepted'}
                      onChange={value => setPitcherValidity(prev => ({ ...prev, [row.bid.id]: value }))}
                    />
                    <VerifyItem
                      role="Catcher"
                      listing={row.catcherListing}
                      value={catcherValidity[row.bid.id] || 'valid'}
                      disabled={row.bid.status !== 'accepted'}
                      onChange={value => setCatcherValidity(prev => ({ ...prev, [row.bid.id]: value }))}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => router.push(`/verifier/${row.bid.id}`)}
                      style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: '8px', padding: '9px 12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Detail
                    </button>
                    {row.bid.status === 'accepted' && (
                      <button
                        onClick={() => verify(row)}
                        disabled={busyBidId === row.bid.id}
                        style={{ border: 'none', background: 'var(--primary)', color: 'white', borderRadius: '8px', padding: '9px 12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {busyBidId === row.bid.id ? 'Menyimpan...' : 'Simpan Verifikasi'}
                      </button>
                    )}
                    {row.bid.status === 'verification_passed' && (
                      <button
                        onClick={() => complete(row)}
                        disabled={busyBidId === row.bid.id}
                        style={{ border: 'none', background: '#166534', color: 'white', borderRadius: '8px', padding: '9px 12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {busyBidId === row.bid.id ? 'Memproses...' : 'Complete Deal'}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ padding: '14px' }}>
      <p className="section-label">{label}</p>
      <p style={{ fontSize: '22px', fontWeight: 800 }}>{value}</p>
    </div>
  )
}

function VerifyItem({
  role,
  listing,
  value,
  disabled,
  onChange,
}: {
  role: string
  listing?: Listing
  value: Validity
  disabled: boolean
  onChange: (value: Validity) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '10px', background: 'var(--bg)', borderRadius: '10px', padding: '10px' }}>
      <div style={{ width: '74px', height: '74px', borderRadius: '8px', background: '#F3F0FF', overflow: 'hidden', flexShrink: 0 }}>
        {listing?.photo_urls && listing.photo_urls.length > 0 ? (
          <img src={listing.photo_urls[0]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '12px' }}>No Photo</div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="section-label">{role}</p>
        <p style={{ fontSize: '14px', fontWeight: 800, marginBottom: '3px' }}>{listing?.title || 'Tidak bisa dimuat'}</p>
        <p style={{ color: 'var(--primary)', fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>{formatRupiah(listing?.estimated_value)}</p>
        <select
          className="input-field"
          value={value}
          disabled={disabled}
          onChange={event => onChange(event.target.value as Validity)}
          style={{ padding: '8px 10px', fontSize: '13px' }}
        >
          <option value="valid">Valid / Asli</option>
          <option value="invalid">Invalid / Palsu</option>
        </select>
      </div>
    </div>
  )
}
