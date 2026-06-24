'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Deal = {
  id: string
  verifier_id: string | null
  status: string
  side_a_listing_id: string
  side_b_listing_id: string
}

type ListingMini = {
  id: string
  title: string
}

type Profile = {
  username: string
  is_verifier: boolean | null
}

type DealCardData = {
  deal: Deal
  listingA?: ListingMini
  listingB?: ListingMini
}

type Bid = {
  id: string
  listing_id: string
  bidder_id: string
  offered_listing_id: string
}

type ListingOwner = {
  id: string
  owner_id: string
}

type DealInsert = {
  bid_id: string
  side_a_listing_id: string
  side_a_owner_id: string
  side_a_recipient_id: string
  side_b_listing_id: string
  side_b_owner_id: string
  side_b_recipient_id: string
  status: string
  verifier_id: null
}

function statusLabel(status: string) {
  if (status === 'verified') return 'Verified'
  if (status === 'completed') return 'Completed'
  if (status === 'locked') return 'Locked'
  return status || 'In Progress'
}

export default function VerifierDashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [myTasks, setMyTasks] = useState<DealCardData[]>([])
  const [availableTasks, setAvailableTasks] = useState<DealCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [busyDealId, setBusyDealId] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isVerifier = profile?.is_verifier === true

  const loadDashboard = useCallback(async () => {
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

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('username, is_verifier')
      .eq('id', user.id)
      .single()

    if (profileError || !profileData) {
      setError('Gagal memuat profil verifikator: ' + (profileError?.message || 'profil kosong'))
      setLoading(false)
      return
    }

    setProfile(profileData as Profile)

    if (profileData.is_verifier !== true) {
      setLoading(false)
      return
    }

    const { data: acceptedBids, error: acceptedBidsError } = await supabase
      .from('bids')
      .select('id, listing_id, bidder_id, offered_listing_id')
      .eq('status', 'accepted')

    if (acceptedBidsError) {
      setError('Gagal memuat accepted bids: ' + acceptedBidsError.message)
      setLoading(false)
      return
    }

    const bids = (acceptedBids || []) as Bid[]
    const bidIds = bids.map(bid => bid.id)

    const { data: existingDeals } = bidIds.length
      ? await supabase.from('deals').select('bid_id').in('bid_id', bidIds)
      : { data: [] }

    const existingBidIds = new Set((existingDeals || []).map(deal => deal.bid_id as string))
    const bidsWithoutDeal = bids.filter(bid => !existingBidIds.has(bid.id))

    if (bidsWithoutDeal.length > 0) {
      const listingIds = Array.from(
        new Set(bidsWithoutDeal.flatMap(bid => [bid.listing_id, bid.offered_listing_id]))
      )

      const { data: listingOwners, error: listingOwnersError } = await supabase
        .from('listings')
        .select('id, owner_id')
        .in('id', listingIds)

      if (listingOwnersError) {
        setError('Gagal memuat listing untuk membuat tugas: ' + listingOwnersError.message)
        setLoading(false)
        return
      }

      const ownerMap = new Map<string, string>()
      ;((listingOwners || []) as ListingOwner[]).forEach(listing => {
        ownerMap.set(listing.id, listing.owner_id)
      })

      const dealsToCreate: DealInsert[] = bidsWithoutDeal
        .map(bid => {
          const pitcherId = ownerMap.get(bid.listing_id)
          const catcherId = ownerMap.get(bid.offered_listing_id) || bid.bidder_id

          if (!pitcherId || !catcherId) return null

          return {
            bid_id: bid.id,
            side_a_listing_id: bid.listing_id,
            side_a_owner_id: pitcherId,
            side_a_recipient_id: catcherId,
            side_b_listing_id: bid.offered_listing_id,
            side_b_owner_id: catcherId,
            side_b_recipient_id: pitcherId,
            status: 'locked',
            verifier_id: null,
          }
        })
        .filter((deal): deal is DealInsert => deal !== null)

      if (dealsToCreate.length > 0) {
        const { error: createDealsError } = await supabase.from('deals').insert(dealsToCreate)

        if (createDealsError) {
          setError('Gagal membuat tugas verifikator: ' + createDealsError.message)
          setLoading(false)
          return
        }

        setNotice(`${dealsToCreate.length} accepted deal masuk ke Tugas Tersedia.`)
      }
    }

    const [assignedResult, availableResult] = await Promise.all([
      supabase
        .from('deals')
        .select('id, verifier_id, status, side_a_listing_id, side_b_listing_id')
        .eq('verifier_id', user.id)
        .neq('status', 'completed')
        .order('id', { ascending: false }),
      supabase
        .from('deals')
        .select('id, verifier_id, status, side_a_listing_id, side_b_listing_id')
        .is('verifier_id', null)
        .neq('status', 'completed')
        .order('id', { ascending: false }),
    ])

    if (assignedResult.error || availableResult.error) {
      setError(
        assignedResult.error?.message ||
          availableResult.error?.message ||
          'Gagal memuat tugas verifikator'
      )
      setLoading(false)
      return
    }

    const assignedDeals = (assignedResult.data || []) as Deal[]
    const availableDeals = (availableResult.data || []) as Deal[]
    const allDeals = [...assignedDeals, ...availableDeals]
    const listingIds = Array.from(
      new Set(allDeals.flatMap(deal => [deal.side_a_listing_id, deal.side_b_listing_id]))
    )

    const { data: listingData } = listingIds.length
      ? await supabase.from('listings').select('id, title').in('id', listingIds)
      : { data: [] }

    const listingMap = new Map<string, ListingMini>()
    ;((listingData || []) as ListingMini[]).forEach(listing => listingMap.set(listing.id, listing))

    const hydrateDeals = (deals: Deal[]) =>
      deals.map(deal => ({
        deal,
        listingA: listingMap.get(deal.side_a_listing_id),
        listingB: listingMap.get(deal.side_b_listing_id),
      }))

    setMyTasks(hydrateDeals(assignedDeals))
    setAvailableTasks(hydrateDeals(availableDeals))
    setLoading(false)
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard()
  }, [loadDashboard])

  const stats = useMemo(() => {
    return {
      mine: myTasks.length,
      available: availableTasks.length,
    }
  }, [myTasks.length, availableTasks.length])

  async function takeTask(dealId: string) {
    setBusyDealId(dealId)
    setError('')
    setNotice('')

    const { data, error: assignError } = await supabase
      .from('deals')
      .update({ verifier_id: (await supabase.auth.getUser()).data.user?.id })
      .eq('id', dealId)
      .is('verifier_id', null)
      .select('id')
      .maybeSingle()

    if (assignError || !data) {
      setError('Tugas gagal diambil. Kemungkinan sudah diambil verifikator lain.')
      setBusyDealId(null)
      await loadDashboard()
      return
    }

    setNotice('Tugas berhasil diambil.')
    setBusyDealId(null)
    await loadDashboard()
  }

  async function handleLogout() {
    setLoggingOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #F7F6FB 0%, #FDFDFF 100%)' }}>
      <Navbar />

      <main className="main-content-verif" style={{ padding: '28px 16px 120px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <header
            style={{
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '16px',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <p className="section-label" style={{ color: 'var(--primary)' }}>Verifier Console</p>
              <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: 0 }}>Dashboard Verifikator</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px', lineHeight: 1.6 }}>
                Accepted deal masuk ke Tugas Tersedia. Ambil tugas terlebih dahulu untuk mulai verifikasi.
              </p>
            </div>
            {profile?.username && (
              <div
                style={{
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '10px 12px',
                  boxShadow: '0 8px 24px rgba(26,26,46,0.06)',
                }}
              >
                <p style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                  Signed in
                </p>
                <p style={{ color: 'var(--text)', fontSize: '14px', fontWeight: 800 }}>@{profile.username}</p>
              </div>
            )}
          </header>

        {loading ? (
          <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Memuat tugas verifikator...
          </div>
        ) : !isVerifier ? (
          <div className="card" style={{ padding: '18px', border: '1px solid #FECACA', background: '#FEF2F2' }}>
            <p className="error-text" style={{ fontWeight: 700 }}>
            Halaman ini khusus untuk Verifikator
            </p>
          </div>
        ) : (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
              <StatCard label="Tugas Saya" value={stats.mine} />
              <StatCard label="Tersedia" value={stats.available} />
            </section>

            {notice && (
              <div className="card" style={{ padding: '13px 15px', marginBottom: '12px', border: '1px solid #FFB800', background: '#FFF8E7' }}>
                <p style={{ color: '#92640A', fontSize: '13px' }}>{notice}</p>
              </div>
            )}

            {error && (
              <div className="card" style={{ padding: '13px 15px', marginBottom: '12px', border: '1px solid #FECACA', background: '#FEF2F2' }}>
                <p className="error-text">{error}</p>
              </div>
            )}

            <TaskSection title="Tugas Saya" emptyText="Belum ada tugas yang kamu ambil.">
              {myTasks.map(item => (
                <DealCard
                  key={item.deal.id}
                  item={item}
                  actionLabel="Buka Tugas"
                  onAction={() => router.push(`/verifier/${item.deal.id}`)}
                />
              ))}
            </TaskSection>

            <TaskSection title="Tugas Tersedia" emptyText="Tidak ada tugas tersedia saat ini.">
              {availableTasks.map(item => (
                <DealCard
                  key={item.deal.id}
                  item={item}
                  actionLabel={busyDealId === item.deal.id ? 'Mengambil...' : 'Ambil Tugas'}
                  disabled={busyDealId === item.deal.id}
                  onAction={() => takeTask(item.deal.id)}
                />
              ))}
            </TaskSection>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                width: '100%',
                border: '1px solid var(--danger)',
                background: 'white',
                color: 'var(--danger)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '14px',
                fontWeight: 900,
                cursor: loggingOut ? 'not-allowed' : 'pointer',
                opacity: loggingOut ? 0.6 : 1,
                boxShadow: '0 8px 20px rgba(239,68,68,0.08)',
              }}
            >
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </>
        )}
        </div>
      </main>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="card"
      style={{
        padding: '16px',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 28px rgba(26,26,46,0.06)',
      }}
    >
      <p className="section-label">{label}</p>
      <p style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1 }}>{value}</p>
    </div>
  )
}

function TaskSection({
  title,
  emptyText,
  children,
}: {
  title: string
  emptyText: string
  children: React.ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)

  return (
    <section style={{ marginBottom: '22px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '10px' }}>{title}</h2>
      {hasChildren ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</div>
      ) : (
        <div className="card" style={{ padding: '18px', color: 'var(--text-muted)', fontSize: '14px', border: '1px dashed var(--border)', boxShadow: 'none' }}>{emptyText}</div>
      )}
    </section>
  )
}

function DealCard({
  item,
  actionLabel,
  disabled,
  onAction,
}: {
  item: DealCardData
  actionLabel: string
  disabled?: boolean
  onAction: () => void
}) {
  return (
    <article
      className="card"
      style={{
        padding: '16px',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px rgba(26,26,46,0.07)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <p className="section-label">Deal</p>
          <h3 style={{ fontSize: '16px', fontWeight: 900, lineHeight: 1.4 }}>
            {item.listingA?.title || 'Listing A'} <span style={{ color: 'var(--text-muted)' }}>to</span>{' '}
            {item.listingB?.title || 'Listing B'}
          </h3>
        </div>
        <span style={{ height: 'fit-content', background: '#FFF8E7', color: '#92640A', borderRadius: '999px', padding: '6px 10px', fontSize: '12px', fontWeight: 900 }}>
          {statusLabel(item.deal.status)}
        </span>
      </div>
      <button
        onClick={onAction}
        disabled={disabled}
        style={{
          width: '100%',
          border: 'none',
          background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
          color: 'white',
          borderRadius: '10px',
          padding: '11px 12px',
          fontSize: '14px',
          fontWeight: 900,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          boxShadow: disabled ? 'none' : '0 10px 18px rgba(91,63,224,0.22)',
        }}
      >
        {actionLabel}
      </button>
    </article>
  )
}
