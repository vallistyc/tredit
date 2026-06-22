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

  if (loading) return <p className="p-6">Memuat...</p>
  if (!listing) return <p className="p-6">Listing tidak ditemukan</p>

  const isOwner = currentUserId === listing.owner_id
  const isLocked = listing.status !== 'active'

  return (
    <div className="max-w-[480px] mx-auto p-6">
      <div
        className="w-full h-[280px] bg-[#222] bg-cover bg-center rounded-xl mb-4"
        style={
          listing.photo_urls[0]
            ? { backgroundImage: `url(${listing.photo_urls[0]})` }
            : undefined
        }
      />

      <h1 className="text-2xl font-bold mb-1">{listing.title}</h1>
      {listing.brand && <p className="text-muted m-0 mb-2">{listing.brand}</p>}

      <p className="text-sm font-semibold">
        E.P {formatRupiah(listing.estimated_value)}
      </p>

      {listing.location && <p>📍 {listing.location}</p>}

      {listing.expected_goods.length > 0 && (
        <div className="mt-4">
          <strong>Expected Goods</strong>
          <ul className="list-disc pl-5 mt-1">
            {listing.expected_goods.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {listing.condition_notes && (
        <div className="mt-4">
          <strong>Kondisi</strong>
          <p>{listing.condition_notes}</p>
        </div>
      )}

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      {/* Tombol Catch It — hanya muncul kalau bukan pemilik dan listing masih active */}
      {!isOwner && !isLocked && (
        <button
          onClick={openCatchModal}
          className="mt-6 w-full py-4 bg-primary text-accent font-bold text-base border-none rounded-xl cursor-pointer"
        >
          Catch It
        </button>
      )}

      {isLocked && !isOwner && (
        <p className="mt-6 text-center text-muted">
          Listing ini sedang dalam proses deal.
        </p>
      )}

      {/* MODAL 1: Pilih barang yang mau ditawarkan */}
      {showCatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-[400px] w-[90%] max-h-[80vh] flex flex-col">
            <h2 className="flex-shrink-0 m-0 mb-4 text-xl font-bold">Tawarkan Barangmu</h2>

            {myListings.length === 0 && (
              <p className="flex-shrink-0">
                Kamu belum punya listing aktif untuk ditawarkan. Tambah listing dulu.
              </p>
            )}

            <form
              onSubmit={handleProceedToPayment}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="overflow-y-auto flex-1 min-h-0">
                {myListings.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-2 p-[10px] border rounded-lg mb-2 cursor-pointer ${
                      selectedOfferId === item.id ? 'border-primary' : 'border-line'
                    }`}
                  >
                    <input
                      type="radio"
                      name="offeredListing"
                      value={item.id}
                      checked={selectedOfferId === item.id}
                      onChange={(e) => setSelectedOfferId(e.target.value)}
                    />
                    <div>
                      <div className="font-semibold">{item.title}</div>
                      {item.brand && (
                        <div className="text-xs text-muted">{item.brand}</div>
                      )}
                    </div>
                  </label>
                ))}

                <textarea
                  placeholder="Tulis pesan untuk Pitcher (opsional)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full mt-2 p-2 rounded-lg border border-line"
                />

                {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}
              </div>

              <div className="flex gap-2 mt-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowCatchModal(false)
                    setErrorMsg('')
                  }}
                  className="flex-1 py-3 bg-white text-primary border border-primary rounded-lg cursor-pointer font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={myListings.length === 0}
                  className="flex-1 py-3 bg-primary text-white border-none rounded-lg cursor-pointer font-semibold disabled:opacity-50 disabled:cursor-default"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-[400px] w-[90%] max-h-[80vh] flex flex-col">
            <h2 className="flex-shrink-0 m-0 mb-4 text-xl font-bold">Konfirmasi Pembayaran</h2>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="flex justify-between mb-2">
                <span>Platform Fee</span>
                <span>{formatRupiah(PLATFORM_FEE)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Escrow Fee</span>
                <span>{formatRupiah(ESCROW_FEE)}</span>
              </div>
              <hr className="border-t border-line my-2" />
              <div className="flex justify-between font-bold mt-2">
                <span>Total</span>
                <span>{formatRupiah(ESCROW_FEE + PLATFORM_FEE)}</span>
              </div>

              <div className="mt-4 p-3 bg-primary-soft rounded-lg text-sm">
                <p className="m-0 mb-1">✅ Platform Fee tidak dapat dikembalikan.</p>
                <p className="m-0">
                  🔒 Escrow Fee dikembalikan jika tawaran ditolak atau barang terbukti valid saat selesai.
                </p>
              </div>

              <p className="text-sm text-muted mt-3">
                Barangmu akan dikunci sementara selama proses ini berlangsung.
              </p>

              {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}
            </div>

            <div className="flex gap-2 mt-4 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowPaymentConfirm(false)
                  setShowCatchModal(true)
                }}
                className="flex-1 py-3 bg-white text-primary border border-primary rounded-lg cursor-pointer font-semibold"
              >
                Kembali
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={submitting}
                className="flex-1 py-3 bg-primary text-white border-none rounded-lg cursor-pointer font-semibold disabled:opacity-50 disabled:cursor-default"
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