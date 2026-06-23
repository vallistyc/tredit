'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Listing = {
  id: string
  owner_id: string
  title: string
  category: string
  brand: string | null
  condition_notes: string | null
  location: string | null
  photo_urls: string[] | null
  estimated_value: number
  status: string
}

type Bid = {
  id: string
  listing_id: string
  bidder_id: string
  offered_listing_id: string
  message: string | null
  status: string
  escrow_fee_paid: boolean
  platform_fee_paid: boolean
  created_at: string
}

type Profile = {
  id: string
  username: string
  full_name: string | null
}

function formatRupiah(value?: number) {
  if (!value) return 'Rp0'
  return 'Rp' + Number(value).toLocaleString('id-ID')
}

function statusLabel(status: string) {
  if (status === 'accepted') return 'Locked in Deal'
  if (status === 'verification_passed') return 'Lolos Verifikasi'
  if (status === 'completed') return 'Completed'
  if (status === 'refund_pitcher_invalid') return 'Refund: Barang Pitcher Invalid'
  if (status === 'refund_catcher_invalid') return 'Refund: Barang Catcher Invalid'
  if (status === 'refund_both_invalid') return 'Penalty: Keduanya Invalid'
  return status
}

function refundCopy(status: string) {
  if (status === 'refund_pitcher_invalid') {
    return 'Escrow Pitcher dialihkan ke Catcher. Escrow Catcher dikembalikan.'
  }
  if (status === 'refund_catcher_invalid') {
    return 'Escrow Catcher dialihkan ke Pitcher. Escrow Pitcher dikembalikan.'
  }
  if (status === 'refund_both_invalid') {
    return 'Kedua escrow disita TREDIT sebagai denda. Platform Fee tetap non-refundable.'
  }
  if (status === 'completed') {
    return 'Barang sudah ditukar ke pemilik baru. Escrow kedua pihak dikembalikan.'
  }
  if (status === 'verification_passed') {
    return 'Kedua barang valid. Verifier dapat menyelesaikan distribusi final.'
  }
  return 'Kedua barang sedang Hard Lock dan menunggu proses kirim ke verifier.'
}

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string
  const [bid, setBid] = useState<Bid | null>(null)
  const [pitcherListing, setPitcherListing] = useState<Listing | null>(null)
  const [catcherListing, setCatcherListing] = useState<Listing | null>(null)
  const [pitcher, setPitcher] = useState<Profile | null>(null)
  const [catcher, setCatcher] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDeal = useCallback(async () => {
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
      .select('*')
      .eq('id', dealId)
      .single()

    if (bidError || !bidData) {
      setError('Deal tidak bisa dimuat: ' + (bidError?.message || 'data kosong'))
      setLoading(false)
      return
    }

    const typedBid = bidData as Bid
    const { data: listingsData, error: listingsError } = await supabase
      .from('listings')
      .select('id, owner_id, title, category, brand, condition_notes, location, photo_urls, estimated_value, status')
      .in('id', [typedBid.listing_id, typedBid.offered_listing_id])

    if (listingsError) {
      setError('Listing deal tidak bisa dimuat: ' + listingsError.message)
      setLoading(false)
      return
    }

    const listings = (listingsData || []) as Listing[]
    const target = listings.find(item => item.id === typedBid.listing_id) || null
    const offered = listings.find(item => item.id === typedBid.offered_listing_id) || null
    const profileIds = Array.from(new Set([target?.owner_id, typedBid.bidder_id].filter(Boolean))) as string[]

    const { data: profilesData } = profileIds.length
      ? await supabase
          .from('profiles')
          .select('id, username, full_name')
          .in('id', profileIds)
      : { data: [] }

    const profiles = (profilesData || []) as Profile[]
    setBid(typedBid)
    setPitcherListing(target)
    setCatcherListing(offered)
    setPitcher(profiles.find(item => item.id === target?.owner_id) || null)
    setCatcher(profiles.find(item => item.id === typedBid.bidder_id) || null)
    setLoading(false)
  }, [dealId, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDeal()
  }, [loadDeal])

  const steps = useMemo(() => {
    const status = bid?.status || ''
    return [
      { label: 'Accepted Deal', done: true },
      { label: 'Kirim ke Verifier', done: ['accepted', 'verification_passed', 'completed'].includes(status) || status.startsWith('refund_') },
      { label: 'Verifikasi', done: ['verification_passed', 'completed'].includes(status) || status.startsWith('refund_') },
      { label: 'Tukar & Selesai', done: status === 'completed' },
    ]
  }, [bid])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <main className="main-content" style={{ padding: '20px 16px 120px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <button
            onClick={() => router.push('/deals')}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '16px', padding: 0 }}
          >
            Kembali ke Deals
          </button>

          {loading ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Memuat detail deal...
            </div>
          ) : error || !bid ? (
            <div className="card" style={{ padding: '18px' }}>
              <p className="error-text">{error || 'Deal tidak ditemukan'}</p>
            </div>
          ) : (
            <>
              <section className="card" style={{ padding: '18px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <div>
                    <p className="section-label">Detail Accepted Deal</p>
                    <h1 style={{ fontSize: '22px', fontWeight: 800 }}>
                      {catcherListing?.title || 'Barang Catcher'} to {pitcherListing?.title || 'Barang Pitcher'}
                    </h1>
                  </div>
                  <span style={{ height: 'fit-content', background: '#EDE9FB', color: 'var(--primary)', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', fontWeight: 800 }}>
                    {statusLabel(bid.status)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {steps.map(step => (
                    <div key={step.label} style={{ background: step.done ? '#EAFBF1' : 'var(--bg)', borderRadius: '8px', padding: '10px' }}>
                      <p style={{ color: step.done ? '#166534' : 'var(--text-muted)', fontWeight: 800, fontSize: '13px' }}>
                        {step.done ? 'Done' : 'Pending'}
                      </p>
                      <p style={{ fontSize: '13px', marginTop: '2px' }}>{step.label}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <DealListingCard role="Pitcher" listing={pitcherListing} profile={pitcher} />
                <DealListingCard role="Catcher" listing={catcherListing} profile={catcher} />
              </section>

              <section className="card" style={{ padding: '16px' }}>
                <p className="section-label">Escrow & Refund Handling</p>
                <p style={{ fontSize: '14px', lineHeight: 1.6, marginBottom: '12px' }}>{refundCopy(bid.status)}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  <FeeBox label="Escrow Pitcher" value="Rp25.000" />
                  <FeeBox label="Escrow Catcher" value="Rp25.000" />
                  <FeeBox label="Platform Fee" value="Non-refundable" />
                </div>
                {bid.message && (
                  <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                    <p className="section-label">Pesan Catcher</p>
                    <p style={{ fontSize: '14px', lineHeight: 1.5 }}>{bid.message}</p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function DealListingCard({ role, listing, profile }: { role: string; listing: Listing | null; profile: Profile | null }) {
  return (
    <article className="card" style={{ overflow: 'hidden' }}>
      <div style={{ height: '190px', background: '#F3F0FF' }}>
        {listing?.photo_urls && listing.photo_urls.length > 0 ? (
          <img src={listing.photo_urls[0]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>No Photo</div>
        )}
      </div>
      <div style={{ padding: '14px' }}>
        <p className="section-label">{role}</p>
        <h2 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '4px' }}>{listing?.title || 'Listing tidak bisa dimuat'}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '8px' }}>
          @{profile?.username || 'user'} | {listing?.category || '-'}{listing?.brand ? ` | ${listing.brand}` : ''}
        </p>
        <p style={{ color: 'var(--primary)', fontWeight: 800, marginBottom: '8px' }}>{formatRupiah(listing?.estimated_value)}</p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{listing?.condition_notes || 'Tidak ada catatan kondisi.'}</p>
      </div>
    </article>
  )
}

function FeeBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px' }}>
      <p className="section-label">{label}</p>
      <p style={{ fontSize: '15px', fontWeight: 800 }}>{value}</p>
    </div>
  )
}