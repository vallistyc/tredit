'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Deal = {
  id: string
  bid_id: string
  side_a_listing_id: string
  side_a_owner_id: string
  side_a_recipient_id: string
  side_a_shipped: boolean
  side_a_shipped_at: string | null
  side_a_received: boolean
  side_a_received_at: string | null
  side_b_listing_id: string
  side_b_owner_id: string
  side_b_recipient_id: string
  side_b_shipped: boolean
  side_b_shipped_at: string | null
  side_b_received: boolean
  side_b_received_at: string | null
  status: string
  created_at: string
}

type ListingMini = {
  id: string
  title: string
  photo_urls: string[]
}

type ProfileMini = {
  id: string
  username: string
}

// Tahapan global deal, dihitung dari kombinasi shipped/received kedua sisi.
// Dipakai buat label stepper, BUKAN dari kolom deals.status langsung,
// supaya selalu akurat meskipun kolom status belum sempat di-update Verifikator.
function computeStage(deal: Deal): 'locked' | 'shipping' | 'verifying' | 'verified' | 'completed' {
  const bothShipped = deal.side_a_shipped && deal.side_b_shipped
  const bothReceived = deal.side_a_received && deal.side_b_received

  if (!deal.side_a_shipped && !deal.side_b_shipped) return 'locked'
  if (!bothShipped || !bothReceived) return 'shipping'
  if (deal.status === 'verified' || deal.status === 'completed') return deal.status as 'verified' | 'completed'
  return 'verifying'
}

const STAGES: { key: string; label: string }[] = [
  { key: 'locked', label: 'Locked' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'verifying', label: 'Verifying' },
  { key: 'verified', label: 'Verified' },
  { key: 'completed', label: 'Completed' },
]

export default function DealDetailPage() {
  const params = useParams()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [sideAListing, setSideAListing] = useState<ListingMini | null>(null)
  const [sideBListing, setSideBListing] = useState<ListingMini | null>(null)
  const [sideAOwner, setSideAOwner] = useState<ProfileMini | null>(null)
  const [sideBOwner, setSideBOwner] = useState<ProfileMini | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetchDeal()
  }, [dealId])

  async function fetchDeal() {
    setLoading(true)
    setErrorMsg('')

    const { data: dealData, error: dealError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single()

    if (dealError || !dealData) {
      setErrorMsg('Deal tidak ditemukan atau kamu tidak punya akses')
      setLoading(false)
      return
    }

    setDeal(dealData as Deal)

    const [
      { data: listingA },
      { data: listingB },
      { data: ownerA },
      { data: ownerB },
    ] = await Promise.all([
      supabase.from('listings').select('id, title, photo_urls').eq('id', dealData.side_a_listing_id).single(),
      supabase.from('listings').select('id, title, photo_urls').eq('id', dealData.side_b_listing_id).single(),
      supabase.from('profiles').select('id, username').eq('id', dealData.side_a_owner_id).single(),
      supabase.from('profiles').select('id, username').eq('id', dealData.side_b_owner_id).single(),
    ])

    setSideAListing(listingA as ListingMini)
    setSideBListing(listingB as ListingMini)
    setSideAOwner(ownerA as ProfileMini)
    setSideBOwner(ownerB as ProfileMini)

    setLoading(false)
  }

  function formatDate(iso: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return <p className="p-6">Memuat...</p>
  if (errorMsg) return <p className="p-6 text-red-600">{errorMsg}</p>
  if (!deal) return null

  const currentStage = computeStage(deal)
  const currentStageIndex = STAGES.findIndex((s) => s.key === currentStage)

  return (
    <div className="max-w-[600px] mx-auto p-6">
      <h1 className="text-2xl font-bold">Deal Detail</h1>
      <p className="text-muted text-[13px]">Dibuat {formatDate(deal.created_at)}</p>

      {/* STEPPER */}
      <div className="flex items-center my-6">
        {STAGES.map((stage, i) => {
          const isDone = i < currentStageIndex
          const isCurrent = i === currentStageIndex
          return (
            <div
              key={stage.key}
              className={`flex items-center ${i < STAGES.length - 1 ? 'flex-1' : 'flex-none'}`}
            >
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isDone || isCurrent ? 'bg-primary text-white' : 'bg-line-light text-gray-400'
                  }`}
                >
                  {isDone ? '✓' : i + 1}
                </div>
                <span
                  className={`text-[11px] mt-1 text-center ${
                    isCurrent ? 'text-primary font-bold' : 'text-gray-400 font-normal'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 ${isDone ? 'bg-primary' : 'bg-line-light'}`} />
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[13px] text-muted text-center mb-6">
        Progress pengiriman diperbarui oleh Verifikator. Halaman ini hanya menampilkan status terkini.
      </p>

      {/* SISI A */}
      <SideCard
        title={`Barang dari @${sideAOwner?.username ?? '...'}`}
        listing={sideAListing}
        shipped={deal.side_a_shipped}
        shippedAt={formatDate(deal.side_a_shipped_at)}
        received={deal.side_a_received}
        receivedAt={formatDate(deal.side_a_received_at)}
        recipientUsername={sideBOwner?.username}
      />

      {/* SISI B */}
      <SideCard
        title={`Barang dari @${sideBOwner?.username ?? '...'}`}
        listing={sideBListing}
        shipped={deal.side_b_shipped}
        shippedAt={formatDate(deal.side_b_shipped_at)}
        received={deal.side_b_received}
        receivedAt={formatDate(deal.side_b_received_at)}
        recipientUsername={sideAOwner?.username}
      />
    </div>
  )
}

function SideCard({
  title,
  listing,
  shipped,
  shippedAt,
  received,
  receivedAt,
  recipientUsername,
}: {
  title: string
  listing: ListingMini | null
  shipped: boolean
  shippedAt: string | null
  received: boolean
  receivedAt: string | null
  recipientUsername?: string
}) {
  return (
    <div className="border border-line rounded-xl p-4 mb-4 flex gap-3">
      <div
        className="w-16 h-16 rounded-lg flex-shrink-0 bg-black bg-cover bg-center"
        style={
          listing?.photo_urls?.[0]
            ? { backgroundImage: `url(${listing.photo_urls[0]})` }
            : undefined
        }
      />
      <div className="flex-1">
        <p className="m-0 text-[13px] text-muted">{title}</p>
        <strong>{listing?.title ?? '...'}</strong>
        <p className="mt-1 mb-0 text-[13px]">Tujuan: @{recipientUsername ?? '...'}</p>

        <div className="mt-2 flex flex-col gap-1">
          <StatusLine label="Dikirim" done={shipped} doneAt={shippedAt} />
          <StatusLine label="Diterima" done={received} doneAt={receivedAt} />
        </div>
      </div>
    </div>
  )
}

function StatusLine({ label, done, doneAt }: { label: string; done: boolean; doneAt: string | null }) {
  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <span
        className={`w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] ${
          done ? 'bg-success-bg text-success' : 'bg-line-light text-gray-400'
        }`}
      >
        {done ? '✓' : ''}
      </span>
      <span className={done ? 'text-black' : 'text-gray-400'}>
        {label} {done && doneAt ? `· ${doneAt}` : done ? '' : '(menunggu)'}
      </span>
    </div>
  )
}