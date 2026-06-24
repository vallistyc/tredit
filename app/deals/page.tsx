'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Listing = {
  id: string
  owner_id: string
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

type Deal = {
  id: string
  bid_id: string
  verifier_id: string | null
}

type VerifierProfile = {
  id: string
}

type DealRow = {
  bid: Bid
  targetListing?: Listing
  offeredListing?: Listing
  bidder?: Profile
  deal?: Deal
}

function formatRupiah(value?: number) {
  if (!value) return 'Rp0'
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
  if (status === 'pending') return 'Menunggu'
  if (status === 'accepted') return 'Diterima'
  if (status === 'rejected') return 'Ditolak'
  if (status === 'cancelled') return 'Dibatalkan'
  if (status === 'expired') return 'Expired'
  if (status === 'verification_passed') return 'Lolos Verifikasi'
  if (status === 'completed') return 'Completed'
  if (status === 'refund_pitcher_invalid') return 'Refund: Pitcher Invalid'
  if (status === 'refund_catcher_invalid') return 'Refund: Catcher Invalid'
  if (status === 'refund_both_invalid') return 'Penalty: Keduanya Invalid'
  return status
}

function statusColor(status: string) {
  if (status === 'accepted' || status === 'verification_passed' || status === 'completed') {
    return { bg: '#EAFBF1', text: '#166534' }
  }
  if (
    status === 'rejected' ||
    status === 'cancelled' ||
    status === 'expired' ||
    status.startsWith('refund_')
  ) {
    return { bg: '#FEF2F2', text: '#991B1B' }
  }
  return { bg: '#FFF8E7', text: '#92640A' }
}

async function getRandomVerifierId() {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_verifier', true)

  const verifiers = (data || []) as VerifierProfile[]
  if (verifiers.length === 0) return null

  return verifiers[Math.floor(Math.random() * verifiers.length)].id
}

export default function DealsPage() {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [incoming, setIncoming] = useState<DealRow[]>([])
  const [outgoing, setOutgoing] = useState<DealRow[]>([])
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming')
  const [loading, setLoading] = useState(true)
  const [busyBidId, setBusyBidId] = useState<string | null>(null)
  const [acceptingRow, setAcceptingRow] = useState<DealRow | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadDeals = useCallback(async () => {
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

    setCurrentUserId(user.id)

    const { data: myListings, error: myListingsError } = await supabase
      .from('listings')
      .select('id, owner_id, title, photo_urls, estimated_value, status')
      .eq('owner_id', user.id)

    if (myListingsError) {
      setError('Gagal memuat listing milikmu: ' + myListingsError.message)
      setLoading(false)
      return
    }

    const myListingIds = (myListings || []).map(item => item.id)

    const incomingRequest = myListingIds.length
      ? supabase
          .from('bids')
          .select('*')
          .in('listing_id', myListingIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null })

    const [incomingResult, outgoingResult] = await Promise.all([
      incomingRequest,
      supabase
        .from('bids')
        .select('*')
        .eq('bidder_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (incomingResult.error || outgoingResult.error) {
      setError(
        incomingResult.error?.message ||
          outgoingResult.error?.message ||
          'Gagal memuat tawaran'
      )
      setLoading(false)
      return
    }

    const incomingBids = (incomingResult.data || []) as Bid[]
    const outgoingBids = (outgoingResult.data || []) as Bid[]
    const allBids = [...incomingBids, ...outgoingBids]

    const listingIds = Array.from(
      new Set(allBids.flatMap(bid => [bid.listing_id, bid.offered_listing_id]))
    )
    const bidderIds = Array.from(new Set(allBids.map(bid => bid.bidder_id)))
    const bidIds = Array.from(new Set(allBids.map(bid => bid.id)))

    const [{ data: relatedListings }, { data: profiles }, { data: dealData }] = await Promise.all([
      listingIds.length
        ? supabase
            .from('listings')
            .select('id, owner_id, title, photo_urls, estimated_value, status')
            .in('id', listingIds)
        : Promise.resolve({ data: [] }),
      bidderIds.length
        ? supabase
            .from('profiles')
            .select('id, username, full_name')
            .in('id', bidderIds)
        : Promise.resolve({ data: [] }),
      bidIds.length
        ? supabase
            .from('deals')
            .select('id, bid_id, verifier_id')
            .in('bid_id', bidIds)
        : Promise.resolve({ data: [] }),
    ])

    const listingMap = new Map<string, Listing>()
    ;[...(myListings || []), ...(relatedListings || [])].forEach(item => {
      listingMap.set(item.id, item as Listing)
    })

    const profileMap = new Map<string, Profile>()
    ;(profiles || []).forEach(item => {
      profileMap.set(item.id, item as Profile)
    })

    const dealMap = new Map<string, Deal>()
    ;((dealData || []) as Deal[]).forEach(item => {
      dealMap.set(item.bid_id, item)
    })

    const toRows = (bids: Bid[]) =>
      bids.map(bid => ({
        bid,
        targetListing: listingMap.get(bid.listing_id),
        offeredListing: listingMap.get(bid.offered_listing_id),
        bidder: profileMap.get(bid.bidder_id),
        deal: dealMap.get(bid.id),
      }))

    const incomingRows = toRows(incomingBids)
    const outgoingRows = toRows(outgoingBids)
    const acceptedRowsWithoutDeal = [...incomingRows, ...outgoingRows].filter(
      row => row.bid.status === 'accepted' && !row.deal
    )

    if (acceptedRowsWithoutDeal.length > 0) {
      const createdDeals = await Promise.all(
        acceptedRowsWithoutDeal.map(row => createDealForAcceptedBid(row))
      )

      createdDeals.forEach((result, index) => {
        if (result.deal) {
          acceptedRowsWithoutDeal[index].deal = result.deal
        }
      })
    }

    setIncoming(incomingRows)
    setOutgoing(outgoingRows)
    setLoading(false)
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDeals()
  }, [loadDeals])

  const activeRows = useMemo(
    () => (activeTab === 'incoming' ? incoming : outgoing),
    [activeTab, incoming, outgoing]
  )

  async function createDealForAcceptedBid(row: DealRow) {
    if (!row.targetListing) {
      return { deal: null, error: 'Listing Pitcher belum bisa dimuat.' }
    }

    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id, bid_id, verifier_id')
      .eq('bid_id', row.bid.id)
      .maybeSingle()

    if (existingDeal) {
      return { deal: existingDeal as Deal, error: null }
    }

    const verifierId = await getRandomVerifierId()

    const { data: createdDeal, error: createDealError } = await supabase
      .from('deals')
      .insert({
        bid_id: row.bid.id,
        side_a_listing_id: row.bid.listing_id,
        side_a_owner_id: row.targetListing.owner_id,
        side_a_recipient_id: row.bid.bidder_id,
        side_b_listing_id: row.bid.offered_listing_id,
        side_b_owner_id: row.bid.bidder_id,
        side_b_recipient_id: row.targetListing.owner_id,
        status: 'locked',
        verifier_id: verifierId,
      })
      .select('id, bid_id, verifier_id')
      .single()

    if (createDealError) {
      return { deal: null, error: createDealError.message }
    }

    return { deal: createdDeal as Deal, error: null }
  }

  async function openDealDetail(row: DealRow) {
    setError('')
    setNotice('')

    if (row.deal?.id) {
      router.push(`/deals/${row.deal.id}`)
      return
    }

    setBusyBidId(row.bid.id)
    const dealResult = await createDealForAcceptedBid(row)
    setBusyBidId(null)

    if (dealResult.deal?.id) {
      router.push(`/deals/${dealResult.deal.id}`)
      return
    }

    setError('Deal detail belum bisa dibuka: ' + (dealResult.error || 'record deal belum tersedia.'))
  }

  async function rejectBid(row: DealRow) {
    setBusyBidId(row.bid.id)
    setError('')
    setNotice('')

    const rpcResult = await supabase.rpc('reject_bid_v4', { p_bid_id: row.bid.id })

    if (!rpcResult.error) {
      setNotice('Tawaran ditolak. Escrow Catcher dikembalikan sesuai flow v4.')
      setBusyBidId(null)
      await loadDeals()
      return
    }

    const { error: rejectError } = await supabase
      .from('bids')
      .update({ status: 'rejected' })
      .eq('id', row.bid.id)

    if (rejectError) {
      setError('Gagal menolak tawaran: ' + rejectError.message)
      setBusyBidId(null)
      return
    }

    setNotice('Tawaran ditolak. Escrow Catcher ditandai untuk dikembalikan secara operasional.')
    setBusyBidId(null)
    setAcceptingRow(null)
    await loadDeals()
  }

  async function acceptBid(row: DealRow) {
    setBusyBidId(row.bid.id)
    setError('')
    setNotice('')

    const rpcResult = await supabase.rpc('accept_bid_v4', { p_bid_id: row.bid.id })

    if (!rpcResult.error) {
      const dealResult = await createDealForAcceptedBid(row)
      setNotice(
        dealResult.error
          ? `Tawaran diterima, tapi deal verifikator belum dibuat: ${dealResult.error}`
          : 'Tawaran diterima. Deal verifikator dibuat dan kedua barang masuk Locked in Deal.'
      )
      setBusyBidId(null)
      setAcceptingRow(null)
      await loadDeals()
      return
    }

    const { error: acceptError } = await supabase
      .from('bids')
      .update({ status: 'accepted' })
      .eq('id', row.bid.id)

    if (acceptError) {
      setError('Gagal menerima tawaran: ' + acceptError.message)
      setBusyBidId(null)
      return
    }

    await supabase
      .from('bids')
      .update({ status: 'cancelled' })
      .eq('listing_id', row.bid.listing_id)
      .eq('status', 'pending')
      .neq('id', row.bid.id)

    const targetUpdate = await supabase
      .from('listings')
      .update({ status: 'locked_in_deal' })
      .eq('id', row.bid.listing_id)

    const offeredUpdate = await supabase
      .from('listings')
      .update({ status: 'locked_in_deal' })
      .eq('id', row.bid.offered_listing_id)

    const dealResult = await createDealForAcceptedBid(row)

    if (targetUpdate.error || offeredUpdate.error) {
      setNotice(
        'Tawaran diterima, tapi status listing belum bisa dikunci penuh. Jalankan migration flow v4 agar Hard Lock lintas user aktif.'
      )
    } else if (dealResult.error) {
      setNotice(`Tawaran diterima, tapi deal verifikator belum dibuat: ${dealResult.error}`)
    } else {
      setNotice('Tawaran diterima. Deal verifikator dibuat dan kedua barang masuk tahap Locked in Deal.')
    }

    setBusyBidId(null)
    setAcceptingRow(null)
    await loadDeals()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <main className="main-content" style={{ padding: '20px 16px 120px' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <header style={{ marginBottom: '18px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Deals</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
              Kelola tawaran masuk sebagai Pitcher dan pantau Catch It yang kamu kirim.
            </p>
          </header>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '14px',
            }}
          >
            <button
              onClick={() => setActiveTab('incoming')}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px',
                background: activeTab === 'incoming' ? 'var(--primary)' : 'var(--surface)',
                color: activeTab === 'incoming' ? 'white' : 'var(--text)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Tawaran Masuk ({incoming.length})
            </button>
            <button
              onClick={() => setActiveTab('outgoing')}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px',
                background: activeTab === 'outgoing' ? 'var(--primary)' : 'var(--surface)',
                color: activeTab === 'outgoing' ? 'white' : 'var(--text)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Catch It Saya ({outgoing.length})
            </button>
          </div>

          {notice && (
            <div className="card" style={{ padding: '12px 14px', marginBottom: '12px', border: '1px solid #FFB800' }}>
              <p style={{ color: '#92640A', fontSize: '13px', lineHeight: 1.5 }}>{notice}</p>
            </div>
          )}

          {error && (
            <div className="card" style={{ padding: '12px 14px', marginBottom: '12px' }}>
              <p className="error-text">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Memuat deals...
            </div>
          ) : activeRows.length === 0 ? (
            <div className="card" style={{ padding: '28px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>
                Belum ada tawaran
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                {activeTab === 'incoming'
                  ? 'Tawaran ke listing milikmu akan muncul di sini.'
                  : 'Catch It yang kamu kirim akan muncul di sini.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeRows.map(row => {
                const colors = statusColor(row.bid.status)
                const canDecide =
                  activeTab === 'incoming' &&
                  row.bid.status === 'pending' &&
                  row.targetListing?.owner_id === currentUserId

                return (
                  <article key={row.bid.id} className="card" style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          {activeTab === 'incoming'
                            ? `Dari @${row.bidder?.username || 'catcher'}`
                            : 'Catch It terkirim'}
                        </p>
                        <h2 style={{ fontSize: '17px', fontWeight: 800 }}>
                          {row.offeredListing?.title || 'Barang penukar'} to {row.targetListing?.title || 'Listing target'}
                        </h2>
                      </div>
                      <span
                        style={{
                          height: 'fit-content',
                          background: colors.bg,
                          color: colors.text,
                          borderRadius: '6px',
                          padding: '5px 9px',
                          fontSize: '12px',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {statusLabel(row.bid.status)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '10px',
                        marginBottom: '12px',
                      }}
                    >
                      <ListingMiniCard label="Catcher menawarkan" listing={row.offeredListing} />
                      <ListingMiniCard label="Pitcher listing" listing={row.targetListing} />
                    </div>

                    {row.bid.message && (
                      <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                        <p className="section-label">Pesan</p>
                        <p style={{ fontSize: '14px', lineHeight: 1.5 }}>{row.bid.message}</p>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {timeAgo(row.bid.created_at)} | Escrow {row.bid.escrow_fee_paid ? 'paid' : 'unpaid'} | Platform {row.bid.platform_fee_paid ? 'paid' : 'unpaid'}
                      </p>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {row.bid.status !== 'pending' && (
                          <button
                            onClick={() => openDealDetail(row)}
                            disabled={busyBidId === row.bid.id}
                            style={{
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              borderRadius: '8px',
                              padding: '9px 12px',
                              fontWeight: 700,
                              cursor: busyBidId === row.bid.id ? 'not-allowed' : 'pointer',
                              opacity: busyBidId === row.bid.id ? 0.6 : 1,
                            }}
                          >
                            {busyBidId === row.bid.id ? 'Membuka...' : 'Detail'}
                          </button>
                        )}

                        {canDecide && (
                          <>
                          <button
                            onClick={() => rejectBid(row)}
                            disabled={busyBidId === row.bid.id}
                            style={{
                              border: '1.5px solid var(--danger)',
                              background: 'transparent',
                              color: 'var(--danger)',
                              borderRadius: '8px',
                              padding: '9px 12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Tolak
                          </button>
                          <button
                            onClick={() => setAcceptingRow(row)}
                            disabled={busyBidId === row.bid.id}
                            style={{
                              border: 'none',
                              background: 'var(--primary)',
                              color: 'white',
                              borderRadius: '8px',
                              padding: '9px 12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Terima
                          </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {acceptingRow && (
        <AcceptPaymentModal
          row={acceptingRow}
          busy={busyBidId === acceptingRow.bid.id}
          onClose={() => {
            if (!busyBidId) setAcceptingRow(null)
          }}
          onConfirm={() => acceptBid(acceptingRow)}
        />
      )}
    </div>
  )
}

function ListingMiniCard({ label, listing }: { label: string; listing?: Listing }) {
  return (
    <div style={{ display: 'flex', gap: '10px', background: 'var(--bg)', borderRadius: '10px', padding: '10px' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', background: '#F3F0FF', flexShrink: 0 }}>
        {listing?.photo_urls && listing.photo_urls.length > 0 ? (
          <img src={listing.photo_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '12px' }}>
            No Photo
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <p className="section-label">{label}</p>
        <p style={{ fontWeight: 800, fontSize: '14px', lineHeight: 1.3 }}>{listing?.title || 'Tidak bisa dimuat'}</p>
        <p style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '13px', marginTop: '4px' }}>
          {formatRupiah(listing?.estimated_value)}
        </p>
      </div>
    </div>
  )
}

function AcceptPaymentModal({
  row,
  busy,
  onClose,
  onConfirm,
}: {
  row: DealRow
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          margin: '0 auto',
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px' }}>
          Bayar Escrow Pitcher
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5, marginBottom: '14px' }}>
          Setelah pembayaran mock ini dikonfirmasi, tawaran lain otomatis dibatalkan dan kedua barang masuk Locked in Deal.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <ListingMiniCard label="Pitcher melepas" listing={row.targetListing} />
          <ListingMiniCard label="Catcher melepas" listing={row.offeredListing} />
        </div>

        <div style={{ background: '#FFF8E7', border: '1px solid #FFB800', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#92640A', fontSize: '14px' }}>Escrow Fee Pitcher</span>
            <strong style={{ color: '#92640A', fontSize: '14px' }}>Rp25.000</strong>
          </div>
          <p style={{ color: '#92640A', fontSize: '12px', lineHeight: 1.5 }}>
            Platform Fee sudah dibayar saat listing dibuat. Escrow ini akan dikembalikan jika kedua barang valid.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-outline" onClick={onClose} disabled={busy} style={{ flex: 1 }}>
            Batal
          </button>
          <button className="btn-primary" onClick={onConfirm} disabled={busy} style={{ flex: 2 }}>
            {busy ? 'Memproses...' : 'Konfirmasi & Bayar Rp25.000'}
          </button>
        </div>
      </div>
    </div>
  )
}
