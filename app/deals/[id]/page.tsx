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

  if (loading) return <p style={{ padding: 24 }}>Memuat...</p>
  if (errorMsg) return <p style={{ padding: 24, color: 'red' }}>{errorMsg}</p>
  if (!deal) return null

  const currentStage = computeStage(deal)
  const currentStageIndex = STAGES.findIndex((s) => s.key === currentStage)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h1>Deal Detail</h1>
      <p style={{ color: '#888', fontSize: 13 }}>
        Dibuat {formatDate(deal.created_at)}
      </p>

      {/* STEPPER */}
      <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0' }}>
        {STAGES.map((stage, i) => {
          const isDone = i < currentStageIndex
          const isCurrent = i === currentStageIndex
          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: i < STAGES.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    background: isDone || isCurrent ? '#5B3FE0' : '#eee',
                    color: isDone || isCurrent ? '#fff' : '#999',
                  }}
                >
                  {isDone ? '✓' : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    marginTop: 4,
                    textAlign: 'center',
                    color: isCurrent ? '#5B3FE0' : '#999',
                    fontWeight: isCurrent ? 700 : 400,
                  }}
                >
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 2,
                    background: isDone ? '#5B3FE0' : '#eee',
                    marginBottom: 16,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      <p style={{ fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24 }}>
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
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        display: 'flex',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 8,
          flexShrink: 0,
          background: listing?.photo_urls?.[0]
            ? `url(${listing.photo_urls[0]}) center/cover`
            : '#000',
        }}
      />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#888' }}>{title}</p>
        <strong>{listing?.title ?? '...'}</strong>
        <p style={{ margin: '4px 0 0', fontSize: 13 }}>
          Tujuan: @{recipientUsername ?? '...'}
        </p>

        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <StatusLine label="Dikirim" done={shipped} doneAt={shippedAt} />
          <StatusLine label="Diterima" done={received} doneAt={receivedAt} />
        </div>
      </div>
    </div>
  )
}

function StatusLine({ label, done, doneAt }: { label: string; done: boolean; doneAt: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          background: done ? '#D4EDDA' : '#eee',
          color: done ? '#155724' : '#999',
        }}
      >
        {done ? '✓' : ''}
      </span>
      <span style={{ color: done ? '#000' : '#999' }}>
        {label} {done && doneAt ? `· ${doneAt}` : done ? '' : '(menunggu)'}
      </span>
    </div>
  )
}