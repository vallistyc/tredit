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

  if (loading) return <p className="p-6">Memuat...</p>

  if (isVerifier === false) {
    return <p className="p-6">Halaman ini khusus untuk Verifikator.</p>
  }

  return (
    <div className="max-w-[600px] mx-auto p-6">
      <h1 className="text-2xl font-bold">Dashboard Verifikator</h1>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      <h2 className="text-base font-semibold mt-6">Tugas Saya</h2>
      {myTasks.length === 0 && <p className="text-muted text-sm">Belum ada tugas berjalan.</p>}
      {myTasks.map((deal) => (
        <div
          key={deal.id}
          onClick={() => router.push(`/verifier/${deal.id}`)}
          className="border border-line rounded-xl p-4 mb-3 cursor-pointer"
        >
          <p className="m-0 font-semibold">
            {listingTitles[deal.side_a_listing_id] ?? '...'} ⇄ {listingTitles[deal.side_b_listing_id] ?? '...'}
          </p>
          <p className="mt-1 mb-0 text-[13px] text-muted">Status: {deal.status}</p>
        </div>
      ))}

      <h2 className="text-base font-semibold mt-8">Tugas Tersedia</h2>
      {unclaimed.length === 0 && <p className="text-muted text-sm">Tidak ada tugas baru.</p>}
      {unclaimed.map((deal) => (
        <div
          key={deal.id}
          className="border border-line rounded-xl p-4 mb-3 flex justify-between items-center"
        >
          <p className="m-0 font-semibold">
            {listingTitles[deal.side_a_listing_id] ?? '...'} ⇄ {listingTitles[deal.side_b_listing_id] ?? '...'}
          </p>
          <button
            onClick={() => handleClaim(deal.id)}
            disabled={claimingId === deal.id}
            className="px-4 py-2 bg-primary text-white border-none rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            {claimingId === deal.id ? 'Mengambil...' : 'Ambil Tugas'}
          </button>
        </div>
      ))}
    </div>
  )
}