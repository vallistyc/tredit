'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type BidRow = {
  id: string
  listing_id: string
  bidder_id: string
  offered_listing_id: string
  message: string | null
  status: string
  created_at: string
  // hasil join manual
  listing_title?: string
  offered_listing_title?: string
  bidder_username?: string
  pitcher_username?: string
}

export default function DealsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'masuk' | 'diajukan'>('masuk')
  const [incomingBids, setIncomingBids] = useState<BidRow[]>([])
  const [myBids, setMyBids] = useState<BidRow[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchBids()
  }, [])

  async function fetchBids() {
    setLoading(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setLoading(false)
      setErrorMsg('Kamu harus login dulu')
      return
    }
    const userId = userData.user.id

    // Tab "Masuk": bid yang masuk ke listing milik kita
    // Caranya: ambil dulu listing_id milik kita, baru query bids yang listing_id-nya termasuk itu
    const { data: myListings } = await supabase
      .from('listings')
      .select('id, title')
      .eq('owner_id', userId)

    const myListingIds = (myListings ?? []).map((l) => l.id)
    const myListingTitleMap = Object.fromEntries(
      (myListings ?? []).map((l) => [l.id, l.title])
    )

    let incoming: BidRow[] = []
    if (myListingIds.length > 0) {
      const { data: incomingData, error: incomingError } = await supabase
        .from('bids')
        .select('*')
        .in('listing_id', myListingIds)
        .order('created_at', { ascending: false })

      if (incomingError) {
        setErrorMsg('Gagal memuat bid masuk: ' + incomingError.message)
      }

      if (incomingData) {
        // ambil judul offered_listing + username bidder satu-satu (sederhana, belum dioptimasi join)
        incoming = await Promise.all(
          incomingData.map(async (bid) => {
            const { data: offeredListing } = await supabase
              .from('listings')
              .select('title')
              .eq('id', bid.offered_listing_id)
              .single()

            const { data: bidderProfile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', bid.bidder_id)
              .single()

            return {
              ...bid,
              listing_title: myListingTitleMap[bid.listing_id],
              offered_listing_title: offeredListing?.title,
              bidder_username: bidderProfile?.username,
            }
          })
        )
      }
    }
    setIncomingBids(incoming)

    // Tab "Diajukan": bid yang kita ajukan ke listing orang lain
    const { data: myBidsData, error: myBidsError } = await supabase
      .from('bids')
      .select('*')
      .eq('bidder_id', userId)
      .order('created_at', { ascending: false })

    if (myBidsError) {
      setErrorMsg('Gagal memuat bid diajukan: ' + myBidsError.message)
    }

    let mine: BidRow[] = []
    if (myBidsData) {
      mine = await Promise.all(
        myBidsData.map(async (bid) => {
          const { data: targetListing } = await supabase
            .from('listings')
            .select('title, owner_id')
            .eq('id', bid.listing_id)
            .single()

          let pitcherUsername: string | undefined
          if (targetListing?.owner_id) {
            const { data: pitcherProfile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', targetListing.owner_id)
              .single()
            pitcherUsername = pitcherProfile?.username
          }

          return {
            ...bid,
            listing_title: targetListing?.title,
            pitcher_username: pitcherUsername,
          }
        })
      )
    }
    setMyBids(mine)

    setLoading(false)
  }

  async function handleAccept(bidId: string) {
    setProcessingId(bidId)
    setErrorMsg('')

    const { data: dealId, error } = await supabase.rpc('accept_bid', {
      bid_id_param: bidId,
    })

    setProcessingId(null)

    if (error) {
      setErrorMsg('Gagal accept bid: ' + error.message)
      return
    }

    // Refresh list, lalu arahkan ke detail deal kalau halamannya sudah ada
    await fetchBids()
    if (dealId) {
      router.push(`/deals/${dealId}`)
    }
  }

  async function handleReject(bidId: string) {
    setProcessingId(bidId)
    setErrorMsg('')

    const { error } = await supabase.rpc('reject_bid', {
      bid_id_param: bidId,
    })

    setProcessingId(null)

    if (error) {
      setErrorMsg('Gagal reject bid: ' + error.message)
      return
    }

    await fetchBids()
  }

  function statusBadge(status: string) {
    const colors: Record<string, { bg: string; text: string }> = {
      pending: { bg: '#FFF3CD', text: '#856404' },
      accepted: { bg: '#D4EDDA', text: '#155724' },
      rejected: { bg: '#F8D7DA', text: '#721C24' },
    }
    const c = colors[status] ?? { bg: '#eee', text: '#333' }
    return (
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 8,
          background: c.bg,
          color: c.text,
        }}
      >
        {status}
      </span>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h1>Deals</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('masuk')}
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            border: '1px solid #5B3FE0',
            background: activeTab === 'masuk' ? '#5B3FE0' : 'transparent',
            color: activeTab === 'masuk' ? '#fff' : '#5B3FE0',
            cursor: 'pointer',
          }}
        >
          Masuk
        </button>
        <button
          onClick={() => setActiveTab('diajukan')}
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            border: '1px solid #5B3FE0',
            background: activeTab === 'diajukan' ? '#5B3FE0' : 'transparent',
            color: activeTab === 'diajukan' ? '#fff' : '#5B3FE0',
            cursor: 'pointer',
          }}
        >
          Diajukan
        </button>
      </div>

      {loading && <p>Memuat...</p>}
      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      {/* TAB: Masuk */}
      {!loading && activeTab === 'masuk' && (
        <div>
          {incomingBids.length === 0 && <p>Belum ada bid yang masuk.</p>}
          {incomingBids.map((bid) => (
            <div
              key={bid.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>{bid.listing_title}</strong>
                {statusBadge(bid.status)}
              </div>
              <p style={{ margin: '4px 0', fontSize: 14 }}>
                Ditawar oleh <strong>@{bid.bidder_username}</strong> dengan{' '}
                <strong>{bid.offered_listing_title}</strong>
              </p>
              {bid.message && (
                <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>"{bid.message}"</p>
              )}

              {bid.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={() => handleAccept(bid.id)}
                    disabled={processingId === bid.id}
                    style={{
                      flex: 1,
                      padding: 8,
                      background: '#5B3FE0',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    {processingId === bid.id ? 'Memproses...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleReject(bid.id)}
                    disabled={processingId === bid.id}
                    style={{
                      flex: 1,
                      padding: 8,
                      background: '#fff',
                      color: '#d32f2f',
                      border: '1px solid #d32f2f',
                      borderRadius: 8,
                      cursor: 'pointer',
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* TAB: Diajukan */}
      {!loading && activeTab === 'diajukan' && (
        <div>
          {myBids.length === 0 && <p>Kamu belum mengajukan barter ke manapun.</p>}
          {myBids.map((bid) => (
            <div
              key={bid.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>{bid.listing_title}</strong>
                {statusBadge(bid.status)}
              </div>
              <p style={{ margin: '4px 0', fontSize: 14 }}>
                Diajukan ke <strong>@{bid.pitcher_username}</strong>
              </p>
              {bid.message && (
                <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>"{bid.message}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}