'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
import Navbar from '@/app/components/Navbar'

// Penjelasan Next.js: folder [id] adalah dynamic route.
// useParams() dipakai di client component untuk baca nilai id-nya.

type Listing = {
  id: string
  title: string
  category: string
  brand: string | null
  condition_notes: string
  location: string | null
  expected_goods: string[]
  estimated_value: number
  photo_urls: string[]
  created_at: string
  owner_id: string
  status: string
}

type Profile = {
  username: string
  full_name: string | null
  trust_score: number
}

type MyListing = {
  id: string
  title: string
  photo_urls: string[]
  estimated_value: number
  category: string
  status: string
  activeOfferCount: number
}

function formatRupiah(value: number) {
  return 'Rp' + value.toLocaleString('id-ID')
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes} menit lalu`
  if (hours < 24) return `${hours} jam lalu`
  return `${days} hari lalu`
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const [listing, setListing] = useState<Listing | null>(null)
  const [owner, setOwner] = useState<Profile | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [bidCount, setBidCount] = useState(0)
  const [activePhoto, setActivePhoto] = useState(0)
  const [loading, setLoading] = useState(true)

  // Modal Catch It
  const [showCatchModal, setShowCatchModal] = useState(false)
  const [myListings, setMyListings] = useState<MyListing[]>([])
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [catchStep, setCatchStep] = useState<'pick' | 'confirm'>('pick')
  const [catching, setCatching] = useState(false)
  const [catchError, setCatchError] = useState('')
  const [catchSuccess, setCatchSuccess] = useState(false)

  const fetchListing = useCallback(async () => {
    const { data: listingData } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single()

    if (!listingData) { router.push('/home'); return }
    setListing(listingData)

    const { data: ownerData } = await supabase
      .from('profiles')
      .select('username, full_name, trust_score')
      .eq('id', listingData.owner_id)
      .single()
    setOwner(ownerData)

    const { count } = await supabase
      .from('bids')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', id as string)
    setBidCount(count || 0)

    setLoading(false)
  }, [id, router])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUserId(user.id)
      await fetchListing()
    }
    init()
  }, [fetchListing, router])

  async function openCatchModal() {
    if (!currentUserId) return
    setCatchError('')
    setCatchStep('pick')
    setSelectedListingId(null)
    setMessage('')

    // Ambil listing milik user sendiri yang masih bisa dipakai untuk Catch It.
    const { data } = await supabase
      .from('listings')
      .select('id, title, photo_urls, estimated_value, category, status')
      .eq('owner_id', currentUserId)
      .in('status', ['active', 'pending_offer'])

    const withOfferCounts = await Promise.all(
      (data || []).map(async item => {
        const { count } = await supabase
          .from('bids')
          .select('*', { count: 'exact', head: true })
          .eq('offered_listing_id', item.id)
          .eq('status', 'pending')

        return {
          ...item,
          activeOfferCount: count || 0,
        }
      })
    )

    setMyListings(withOfferCounts.filter(item => item.activeOfferCount < 3))
    setShowCatchModal(true)
  }

  async function handleCatch() {
    if (!selectedListingId || !currentUserId || !listing) return
    setCatching(true)
    setCatchError('')

    const { count: activeOfferCount } = await supabase
      .from('bids')
      .select('*', { count: 'exact', head: true })
      .eq('offered_listing_id', selectedListingId)
      .eq('status', 'pending')

    if ((activeOfferCount || 0) >= 3) {
      setCatchError('Barang ini sudah memiliki 3 tawaran aktif. Pilih barang lain.')
      setCatching(false)
      return
    }

    const { error } = await supabase
      .from('bids')
      .insert({
        listing_id: listing.id,
        bidder_id: currentUserId,
        offered_listing_id: selectedListingId,
        message: message || null,
        status: 'pending',
        escrow_fee_paid: true,
        platform_fee_paid: true,
      })

    if (error) {
      setCatchError('Gagal mengajukan bid: ' + error.message)
      setCatching(false)
      return
    }

    await supabase
      .from('listings')
      .update({ status: 'pending_offer' })
      .eq('id', selectedListingId)

    setCatching(false)
    setCatchSuccess(true)
    setBidCount(prev => prev + 1)
  }

  function closeModal() {
    setShowCatchModal(false)
    setCatchSuccess(false)
    setCatchStep('pick')
    setSelectedListingId(null)
    setMessage('')
    setCatchError('')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Navbar />
        <p style={{ color: 'var(--text-muted)' }}>Memuat...</p>
      </div>
    )
  }

  if (!listing) return null

  const isOwner = currentUserId === listing.owner_id
  const selectedListing = myListings.find(l => l.id === selectedListingId)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <main className="main-content" style={{ padding: '20px 16px 100px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>

          {/* Back button */}
          <button
            onClick={() => router.push('/home')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px',
              padding: '0'
            }}
          >
            ← Kembali
          </button>

          {/* Foto */}
          <div className="card" style={{ marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '300px', background: '#F3F0FF', position: 'relative' }}>
              {listing.photo_urls && listing.photo_urls.length > 0 ? (
                <img
                  src={listing.photo_urls[activePhoto]}
                  alt={listing.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', opacity: 0.3 }}>
                  <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                </div>
              )}
              {/* Category badge */}
              <span style={{
                position: 'absolute', top: '12px', left: '12px',
                background: 'rgba(91,63,224,0.85)', color: 'white',
                fontSize: '12px', fontWeight: '600',
                padding: '4px 10px', borderRadius: '6px',
                textTransform: 'capitalize'
              }}>{listing.category}</span>
            </div>

            {/* Thumbnail strip */}
            {listing.photo_urls && listing.photo_urls.length > 1 && (
              <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', overflowX: 'auto' }}>
                {listing.photo_urls.map((url, i) => (
                  <div
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    style={{
                      width: '56px', height: '56px', flexShrink: 0,
                      borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
                      border: activePhoto === i ? '2px solid var(--primary)' : '2px solid transparent'
                    }}
                  >
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info utama */}
          <div className="card" style={{ padding: '18px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '20px', fontWeight: '800', lineHeight: '1.3' }}>{listing.title}</h1>
                {listing.brand && <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>{listing.brand}</p>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>E.P</p>
                <p style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)' }}>
                  {formatRupiah(listing.estimated_value)}
                </p>
              </div>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {listing.location && (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg)', padding: '4px 10px', borderRadius: '6px' }}>
                  📍 {listing.location}
                </span>
              )}
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg)', padding: '4px 10px', borderRadius: '6px' }}>
                🎯 {bidCount} bids
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg)', padding: '4px 10px', borderRadius: '6px' }}>
                {timeAgo(listing.created_at)}
              </span>
            </div>

            {/* Owner */}
            {owner && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg)', borderRadius: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--primary)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '14px', flexShrink: 0
                }}>
                  {owner.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>@{owner.username}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Trust Score: {owner.trust_score}</p>
                </div>
              </div>
            )}
          </div>

          {/* Expected Goods */}
          {listing.expected_goods && listing.expected_goods.length > 0 && (
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Expected Goods
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {listing.expected_goods.map((g, i) => (
                  <span key={i} style={{
                    fontSize: '13px', background: '#FFF8E7',
                    color: '#92640A', padding: '5px 12px',
                    borderRadius: '8px', fontWeight: '500'
                  }}>{g}</span>
                ))}
              </div>
            </div>
          )}

          {/* Condition */}
          {listing.condition_notes && (
            <div className="card" style={{ padding: '16px', marginBottom: '24px' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Condition
              </p>
              <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: '1.6' }}>
                {listing.condition_notes}
              </p>
            </div>
          )}

          {/* CTA */}
          {!isOwner && ['active', 'pending_offer'].includes(listing.status) && (
            <button
              className="btn-primary"
              onClick={openCatchModal}
              style={{ fontSize: '16px', padding: '14px' }}
            >
              🎯 Catch It!
            </button>
          )}

          {isOwner && (
            <div style={{ background: '#EDE9FB', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
              <p style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '14px' }}>
                Ini listing milikmu
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ===== MODAL CATCH IT ===== */}
      {showCatchModal && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 200, display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              borderRadius: '20px 20px 0 0',
              width: '100%', maxWidth: '600px',
              margin: '0 auto',
              maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Handle */}
            <div style={{ padding: '12px', display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '2px' }} />
            </div>

            {catchSuccess ? (
              /* Success state */
              <div style={{ padding: '24px 20px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '48px' }}>🎉</div>
                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Bid Terkirim!</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  Tunggu Pitcher menerima atau menolak bid-mu.
                </p>
                <button className="btn-primary" onClick={closeModal} style={{ marginTop: '8px' }}>
                  Oke, Tutup
                </button>
              </div>

            ) : catchStep === 'pick' ? (
              /* Step 1: Pilih listing */
              <>
                <div style={{ padding: '0 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '800' }}>🎯 Catch It!</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Pilih barang milikmu untuk ditawarkan
                  </p>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
                  {myListings.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                        Kamu belum punya listing aktif. Buat listing dulu sebelum bisa Catch It!
                      </p>
                      <button
                        className="btn-primary"
                        onClick={() => { closeModal(); router.push('/listing/new') }}
                      >
                        Buat Listing Sekarang
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {myListings.map(l => (
                        <div
                          key={l.id}
                          onClick={() => setSelectedListingId(l.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px', borderRadius: '12px', cursor: 'pointer',
                            border: selectedListingId === l.id
                              ? '2px solid var(--primary)'
                              : '2px solid var(--border)',
                            background: selectedListingId === l.id ? '#EDE9FB' : 'var(--surface)',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{
                            width: '56px', height: '56px', borderRadius: '8px',
                            overflow: 'hidden', flexShrink: 0, background: '#F3F0FF'
                          }}>
                            {l.photo_urls && l.photo_urls.length > 0 ? (
                              <img src={l.photo_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', opacity: 0.4, fontSize: '20px' }}>📦</div>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{l.category}</p>
                            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>{formatRupiah(l.estimated_value)}</p>
                            {l.activeOfferCount > 0 && (
                              <p style={{ fontSize: '12px', color: '#92640A', marginTop: '3px' }}>
                                Ada {l.activeOfferCount} tawaran aktif. Tawaran ini bisa batal otomatis jika tawaran lain diterima.
                              </p>
                            )}
                          </div>
                          {selectedListingId === l.id && (
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="12" height="12" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {myListings.length > 0 && (
                    <div style={{ marginTop: '14px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                        Pesan (opsional)
                      </label>
                      <textarea
                        className="input-field"
                        placeholder="Ceritakan kondisi barangmu, atau negosiasi..."
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={2}
                        style={{ resize: 'none' }}
                      />
                    </div>
                  )}
                </div>

                {myListings.length > 0 && (
                  <div style={{ padding: '12px 20px 28px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                    {catchError && <p className="error-text" style={{ marginBottom: '8px' }}>{catchError}</p>}
                    <button
                      className="btn-primary"
                      onClick={() => {
                        if (!selectedListingId) { setCatchError('Pilih listing dulu'); return }
                        setCatchError('')
                        setCatchStep('confirm')
                      }}
                      disabled={!selectedListingId}
                    >
                      Lanjut →
                    </button>
                  </div>
                )}
              </>

            ) : (
              /* Step 2: Konfirmasi pembayaran */
              <>
                <div style={{ padding: '0 20px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '800' }}>💳 Konfirmasi Pembayaran</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Review bid sebelum dikonfirmasi
                  </p>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Barter summary */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, padding: '12px', background: 'var(--bg)', borderRadius: '10px', textAlign: 'center' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>KAMU TAWARKAN</p>
                      <p style={{ fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedListing?.title}</p>
                      <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>{selectedListing ? formatRupiah(selectedListing.estimated_value) : ''}</p>
                    </div>
                    <div style={{ fontSize: '20px' }}>⇄</div>
                    <div style={{ flex: 1, padding: '12px', background: 'var(--bg)', borderRadius: '10px', textAlign: 'center' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>KAMU INGINKAN</p>
                      <p style={{ fontSize: '13px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</p>
                      <p style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>{formatRupiah(listing.estimated_value)}</p>
                    </div>
                  </div>

                  {/* Fee breakdown */}
                  {selectedListing && selectedListing.activeOfferCount > 0 && (
                    <div style={{ background: '#FFF8E7', border: '1px solid #FFB800', borderRadius: '10px', padding: '12px' }}>
                      <p style={{ fontSize: '13px', color: '#92640A', lineHeight: 1.5 }}>
                        Barang yang kamu tawarkan sudah punya tawaran aktif. Sesuai Soft Lock, bid ini tetap bisa dikirim,
                        tapi dapat dibatalkan otomatis jika tawaran lain diterima lebih dulu.
                      </p>
                    </div>
                  )}

                  {/* Fee breakdown */}
                  <div style={{ background: '#FFF8E7', border: '1px solid #FFB800', borderRadius: '10px', padding: '14px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#92640A', marginBottom: '8px' }}>Rincian Biaya</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#92640A' }}>Escrow Fee</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#92640A' }}>Rp25.000</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed #FFB800' }}>
                      <span style={{ fontSize: '13px', color: '#92640A' }}>Platform Fee</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#92640A' }}>Rp10.000</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#92640A' }}>Total</span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#92640A' }}>Rp35.000</span>
                    </div>
                  </div>

                  {catchError && <p className="error-text">{catchError}</p>}
                </div>

                <div style={{ padding: '12px 20px 28px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: '10px' }}>
                  <button
                    className="btn-outline"
                    onClick={() => setCatchStep('pick')}
                    disabled={catching}
                    style={{ flex: 1 }}
                  >
                    ← Kembali
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleCatch}
                    disabled={catching}
                    style={{ flex: 2 }}
                  >
                    {catching ? 'Memproses...' : 'Konfirmasi & Bayar Rp35.000'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}