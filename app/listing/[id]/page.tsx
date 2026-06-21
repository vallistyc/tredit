'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  owner_id: string
  status: string
}

const ESCROW_FEE = 25000
const PLATFORM_FEE = 10000

export default function ListingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const listingId = params.id as string

  const [listing, setListing] = useState<Listing | null>(null)
  const [myListings, setMyListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [showCatchModal, setShowCatchModal] = useState(false)
  const [selectedOfferId, setSelectedOfferId] = useState('')
  const [message, setMessage] = useState('')
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchAll()
  }, [listingId])

  async function fetchAll() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    setCurrentUserId(userData.user?.id ?? null)

    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', listingId)
      .single()

    if (!error && data) setListing(data as Listing)
    setLoading(false)
  }

  async function openCatchModal() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setErrorMsg('Kamu harus login dulu')
      return
    }

    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('owner_id', userData.user.id)
      .eq('status', 'active')
      .neq('id', listingId)

    if (!error && data) setMyListings(data as Listing[])
    setShowCatchModal(true)
  }

  function handleProceedToPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOfferId) {
      setErrorMsg('Pilih salah satu barangmu untuk ditawarkan')
      return
    }
    setErrorMsg('')
    setShowCatchModal(false)
    setShowPaymentConfirm(true)
  }

  async function handleConfirmPayment() {
    setSubmitting(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setSubmitting(false)
      setErrorMsg('Sesi login tidak ditemukan')
      return
    }

    // 1. Lock offered_listing milik penawar sekarang juga
    const { error: lockError } = await supabase
      .from('listings')
      .update({ status: 'locked' })
      .eq('id', selectedOfferId)
      .eq('owner_id', userData.user.id)

    if (lockError) {
      setSubmitting(false)
      setErrorMsg('Gagal mengunci barangmu: ' + lockError.message)
      return
    }

    // 2. Insert bid
    const { error: bidError } = await supabase.from('bids').insert({
      listing_id: listingId,
      bidder_id: userData.user.id,
      offered_listing_id: selectedOfferId,
      message,
      status: 'pending',
      escrow_fee_paid: true,
      platform_fee_paid: true,
      pitcher_escrow_fee_paid: false,
    })

    setSubmitting(false)

    if (bidError) {
      // Kalau insert bid gagal, kembalikan status offered_listing ke active
      await supabase
        .from('listings')
        .update({ status: 'active' })
        .eq('id', selectedOfferId)

      setErrorMsg('Gagal mengajukan barter: ' + bidError.message)
      return
    }

    router.push('/home')
  }

  function formatRupiah(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  if (loading) return <p style={{ padding: 24 }}>Memuat...</p>
  if (!listing) return <p style={{ padding: 24 }}>Listing tidak ditemukan</p>

  const isOwner = currentUserId === listing.owner_id
  const isLocked = listing.status !== 'active'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div
        style={{
          width: '100%',
          height: 280,
          background: listing.photo_urls[0]
            ? `url(${listing.photo_urls[0]}) center/cover`
            : '#222',
          borderRadius: 12,
          marginBottom: 16,
        }}
      />

      <h1 style={{ marginBottom: 4 }}>{listing.title}</h1>
      {listing.brand && <p style={{ color: '#888', margin: '0 0 8px' }}>{listing.brand}</p>}

      <p style={{ fontSize: 14, fontWeight: 600 }}>
        E.P {formatRupiah(listing.estimated_value)}
      </p>

      {listing.location && <p>📍 {listing.location}</p>}

      {listing.expected_goods.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong>Expected Goods</strong>
          <ul>
            {listing.expected_goods.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {listing.condition_notes && (
        <div style={{ marginTop: 16 }}>
          <strong>Kondisi</strong>
          <p>{listing.condition_notes}</p>
        </div>
      )}

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      {/* Tombol Catch It — hanya muncul kalau bukan pemilik dan listing masih active */}
      {!isOwner && !isLocked && (
        <button
          onClick={openCatchModal}
          style={{
            marginTop: 24,
            width: '100%',
            padding: 16,
            background: '#5B3FE0',
            color: '#FFB800',
            fontWeight: 700,
            fontSize: 16,
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
          }}
        >
          Catch It
        </button>
      )}

      {isLocked && !isOwner && (
        <p style={{ marginTop: 24, textAlign: 'center', color: '#888' }}>
          Listing ini sedang dalam proses deal.
        </p>
      )}

      {/* MODAL 1: Pilih barang yang mau ditawarkan */}
      {showCatchModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ flexShrink: 0, margin: '0 0 16px' }}>Tawarkan Barangmu</h2>

            {myListings.length === 0 && (
              <p style={{ flexShrink: 0 }}>
                Kamu belum punya listing aktif untuk ditawarkan. Tambah listing dulu.
              </p>
            )}

            <form
              onSubmit={handleProceedToPayment}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            >
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {myListings.map((item) => (
                  <label
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: 10,
                      border: `1px solid ${selectedOfferId === item.id ? '#5B3FE0' : '#ddd'}`,
                      borderRadius: 8,
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="offeredListing"
                      value={item.id}
                      checked={selectedOfferId === item.id}
                      onChange={(e) => setSelectedOfferId(e.target.value)}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.title}</div>
                      {item.brand && (
                        <div style={{ fontSize: 12, color: '#888' }}>{item.brand}</div>
                      )}
                    </div>
                  </label>
                ))}

                <textarea
                  placeholder="Tulis pesan untuk Pitcher (opsional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
                />

                {errorMsg && <p style={{ color: 'red', fontSize: 13 }}>{errorMsg}</p>}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => { setShowCatchModal(false); setErrorMsg('') }}
                  style={btnSecondary}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={myListings.length === 0}
                  style={btnPrimary}
                >
                  Lanjut
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Konfirmasi pembayaran */}
      {showPaymentConfirm && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ flexShrink: 0, margin: '0 0 16px' }}>Konfirmasi Pembayaran</h2>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Platform Fee</span>
                <span>{formatRupiah(PLATFORM_FEE)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>Escrow Fee</span>
                <span>{formatRupiah(ESCROW_FEE)}</span>
              </div>
              <hr />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 8 }}>
                <span>Total</span>
                <span>{formatRupiah(ESCROW_FEE + PLATFORM_FEE)}</span>
              </div>

              <div style={{ marginTop: 16, padding: 12, background: '#EEEDFE', borderRadius: 8, fontSize: 13 }}>
                <p style={{ margin: '0 0 4px' }}>✅ Platform Fee tidak dapat dikembalikan.</p>
                <p style={{ margin: 0 }}>🔒 Escrow Fee dikembalikan jika tawaran ditolak atau barang terbukti valid saat selesai.</p>
              </div>

              <p style={{ fontSize: 13, color: '#888', marginTop: 12 }}>
                Barangmu akan dikunci sementara selama proses ini berlangsung.
              </p>

              {errorMsg && <p style={{ color: 'red', fontSize: 13 }}>{errorMsg}</p>}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => { setShowPaymentConfirm(false); setShowCatchModal(true) }}
                style={btnSecondary}
              >
                Kembali
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={submitting}
                style={btnPrimary}
              >
                {submitting ? 'Memproses...' : 'Konfirmasi & Bayar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
}

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 24,
  maxWidth: 400,
  width: '90%',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
}

const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: 12,
  background: '#5B3FE0',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
}

const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: 12,
  background: '#fff',
  color: '#5B3FE0',
  border: '1px solid #5B3FE0',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
}