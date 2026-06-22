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

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-warning-bg text-warning',
  accepted: 'bg-success-bg text-success',
  rejected: 'bg-danger-bg text-danger',
}
const STATUS_FALLBACK = 'bg-gray-100 text-gray-700'

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
    const classes = STATUS_CLASSES[status] ?? STATUS_FALLBACK
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${classes}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="max-w-[600px] mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Deals</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('masuk')}
          className={`px-4 py-2 rounded-full border border-primary cursor-pointer ${
            activeTab === 'masuk' ? 'bg-primary text-white' : 'bg-transparent text-primary'
          }`}
        >
          Masuk
        </button>
        <button
          onClick={() => setActiveTab('diajukan')}
          className={`px-4 py-2 rounded-full border border-primary cursor-pointer ${
            activeTab === 'diajukan' ? 'bg-primary text-white' : 'bg-transparent text-primary'
          }`}
        >
          Diajukan
        </button>
      </div>

      {loading && <p>Memuat...</p>}
      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      {/* TAB: Masuk */}
      {!loading && activeTab === 'masuk' && (
        <div>
          {incomingBids.length === 0 && <p>Belum ada bid yang masuk.</p>}
          {incomingBids.map((bid) => (
            <div key={bid.id} className="border border-line rounded-xl p-4 mb-3">
              <div className="flex justify-between mb-2">
                <strong>{bid.listing_title}</strong>
                {statusBadge(bid.status)}
              </div>
              <p className="my-1 text-sm">
                Ditawar oleh <strong>@{bid.bidder_username}</strong> dengan{' '}
                <strong>{bid.offered_listing_title}</strong>
              </p>
              {bid.message && (
                <p className="my-1 text-[13px] text-muted">&quot;{bid.message}&quot;</p>
              )}

              {bid.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAccept(bid.id)}
                    disabled={processingId === bid.id}
                    className="flex-1 py-2 bg-primary text-white border-none rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  >
                    {processingId === bid.id ? 'Memproses...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleReject(bid.id)}
                    disabled={processingId === bid.id}
                    className="flex-1 py-2 bg-white text-danger-button border border-danger-button rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-default"
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
            <div key={bid.id} className="border border-line rounded-xl p-4 mb-3">
              <div className="flex justify-between mb-2">
                <strong>{bid.listing_title}</strong>
                {statusBadge(bid.status)}
              </div>
              <p className="my-1 text-sm">
                Diajukan ke <strong>@{bid.pitcher_username}</strong>
              </p>
              {bid.message && (
                <p className="my-1 text-[13px] text-muted">&quot;{bid.message}&quot;</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}