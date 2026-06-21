'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Deal = {
  id: string
  verifier_id: string | null
  status: string
  created_at: string
  side_a_listing_id: string
  side_b_listing_id: string
}

type ListingMini = { id: string; title: string }

export default function VerifierDashboardPage() {
  const router = useRouter()
  const [isVerifier, setIsVerifier] = useState<boolean | null>(null)
  const [unclaimed, setUnclaimed] = useState<Deal[]>([])
  const [myTasks, setMyTasks] = useState<Deal[]>([])
  const [listingTitles, setListingTitles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    init()
  }, [])

  async function init() {
    setLoading(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setErrorMsg('Kamu harus login dulu')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_verifier')
      .eq('id', userData.user.id)
      .single()

    if (!profile?.is_verifier) {
      setIsVerifier(false)
      setLoading(false)
      return
    }
    setIsVerifier(true)

    // Deal yang locked tapi belum ada verifikator
    const { data: unclaimedData } = await supabase
      .from('deals')
      .select('*')
      .is('verifier_id', null)
      .neq('status', 'completed')
      .order('created_at', { ascending: true })

    // Deal yang sudah dipegang user ini, belum completed
    const { data: myTasksData } = await supabase
      .from('deals')
      .select('*')
      .eq('verifier_id', userData.user.id)
      .neq('status', 'completed')
      .order('created_at', { ascending: true })

    setUnclaimed((unclaimedData ?? []) as Deal[])
    setMyTasks((myTasksData ?? []) as Deal[])

    // Ambil judul listing buat ditampilkan di list (sekali query gabungan)
    const allListingIds = [
      ...(unclaimedData ?? []).flatMap((d) => [d.side_a_listing_id, d.side_b_listing_id]),
      ...(myTasksData ?? []).flatMap((d) => [d.side_a_listing_id, d.side_b_listing_id]),
    ]
    if (allListingIds.length > 0) {
      const { data: listings } = await supabase
        .from('listings')
        .select('id, title')
        .in('id', allListingIds)

      const map: Record<string, string> = {}
      ;(listings ?? []).forEach((l: ListingMini) => {
        map[l.id] = l.title
      })
      setListingTitles(map)
    }

    setLoading(false)
  }

  async function handleClaim(dealId: string) {
    setClaimingId(dealId)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { error } = await supabase
      .from('deals')
      .update({ verifier_id: userData.user.id })
      .eq('id', dealId)
      .is('verifier_id', null) // guard: jangan timpa kalau ternyata sudah diambil orang lain duluan

    setClaimingId(null)

    if (error) {
      setErrorMsg('Gagal mengambil tugas: ' + error.message)
      return
    }

    router.push(`/verifier/${dealId}`)
  }

  if (loading) return <p style={{ padding: 24 }}>Memuat...</p>

  if (isVerifier === false) {
    return <p style={{ padding: 24 }}>Halaman ini khusus untuk Verifikator.</p>
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h1>Dashboard Verifikator</h1>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Tugas Saya</h2>
      {myTasks.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Belum ada tugas berjalan.</p>}
      {myTasks.map((deal) => (
        <div
          key={deal.id}
          onClick={() => router.push(`/verifier/${deal.id}`)}
          style={{
            border: '1px solid #ddd',
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            cursor: 'pointer',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            {listingTitles[deal.side_a_listing_id] ?? '...'} ⇄ {listingTitles[deal.side_b_listing_id] ?? '...'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>Status: {deal.status}</p>
        </div>
      ))}

      <h2 style={{ fontSize: 16, marginTop: 32 }}>Tugas Tersedia</h2>
      {unclaimed.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Tidak ada tugas baru.</p>}
      {unclaimed.map((deal) => (
        <div
          key={deal.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            {listingTitles[deal.side_a_listing_id] ?? '...'} ⇄ {listingTitles[deal.side_b_listing_id] ?? '...'}
          </p>
          <button
            onClick={() => handleClaim(deal.id)}
            disabled={claimingId === deal.id}
            style={{
              padding: '8px 16px',
              background: '#5B3FE0',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {claimingId === deal.id ? 'Mengambil...' : 'Ambil Tugas'}
          </button>
        </div>
      ))}
    </div>
  )
}