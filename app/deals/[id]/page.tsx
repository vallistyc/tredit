'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/app/components/Navbar'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Deal = {
  id: string
  status: string
  verifier_id: string | null
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
  verification_reported_at: string | null
}

type ListingMini = {
  id: string
  title: string
  photo_urls: string[] | null
}

type ProfileMini = {
  id: string
  username: string
}

type DealReview = {
  id: string
  deal_id: string
  reviewer_id: string
  reviewed_user_id: string
  user_rating: number
  user_review: string | null
  platform_rating: number
  platform_review: string | null
}

type StepKey = 'locked' | 'shipping' | 'verifying' | 'verified' | 'completed'

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'locked', label: 'Locked' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'verifying', label: 'Verifying' },
  { key: 'verified', label: 'Verified' },
  { key: 'completed', label: 'Completed' },
]

function formatDate(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getActiveStep(deal: Deal): StepKey {
  if (deal.status === 'completed') return 'completed'
  if (deal.status === 'verified') return 'verified'

  const noSideShipped = !deal.side_a_shipped && !deal.side_b_shipped
  if (noSideShipped) return 'locked'

  const bothShippedAndReceived =
    deal.side_a_shipped &&
    deal.side_b_shipped &&
    deal.side_a_received &&
    deal.side_b_received

  if (!bothShippedAndReceived) return 'shipping'
  return 'verifying'
}

export default function UserDealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [listingA, setListingA] = useState<ListingMini | null>(null)
  const [listingB, setListingB] = useState<ListingMini | null>(null)
  const [recipientA, setRecipientA] = useState<ProfileMini | null>(null)
  const [recipientB, setRecipientB] = useState<ProfileMini | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [counterpart, setCounterpart] = useState<ProfileMini | null>(null)
  const [existingReview, setExistingReview] = useState<DealReview | null>(null)
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewNotice, setReviewNotice] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewForm, setReviewForm] = useState({
    user_rating: 5,
    user_review: '',
    platform_rating: 5,
    platform_review: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDeal = useCallback(async () => {
    setLoading(true)
    setError('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setCurrentUserId(user.id)

    const { data: dealData, error: dealError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single()

    if (dealError || !dealData) {
      setError('Deal tidak ditemukan atau kamu tidak punya akses.')
      setLoading(false)
      return
    }

    const typedDeal = dealData as Deal
    setDeal(typedDeal)

    const profileIds = Array.from(
      new Set([
        typedDeal.side_a_owner_id,
        typedDeal.side_a_recipient_id,
        typedDeal.side_b_owner_id,
        typedDeal.side_b_recipient_id,
      ])
    )

    const [{ data: listingsData }, { data: profilesData }, { data: reviewData }] = await Promise.all([
      supabase
        .from('listings')
        .select('id, title, photo_urls')
        .in('id', [typedDeal.side_a_listing_id, typedDeal.side_b_listing_id]),
      supabase
        .from('profiles')
        .select('id, username')
        .in('id', profileIds),
      supabase
        .from('deal_reviews')
        .select('*')
        .eq('deal_id', dealId)
        .eq('reviewer_id', user.id)
        .maybeSingle(),
    ])

    const listings = (listingsData || []) as ListingMini[]
    const profiles = (profilesData || []) as ProfileMini[]

    setListingA(listings.find(listing => listing.id === typedDeal.side_a_listing_id) || null)
    setListingB(listings.find(listing => listing.id === typedDeal.side_b_listing_id) || null)
    setRecipientA(profiles.find(profile => profile.id === typedDeal.side_a_recipient_id) || null)
    setRecipientB(profiles.find(profile => profile.id === typedDeal.side_b_recipient_id) || null)

    const counterpartId = getCounterpartId(typedDeal, user.id)
    setCounterpart(profiles.find(profile => profile.id === counterpartId) || null)

    if (reviewData) {
      const review = reviewData as DealReview
      setExistingReview(review)
      setReviewForm({
        user_rating: review.user_rating,
        user_review: review.user_review || '',
        platform_rating: review.platform_rating,
        platform_review: review.platform_review || '',
      })
    } else {
      setExistingReview(null)
      setReviewForm({
        user_rating: 5,
        user_review: '',
        platform_rating: 5,
        platform_review: '',
      })
    }

    setLoading(false)
  }, [dealId, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDeal()
  }, [loadDeal])

  const activeStep = useMemo(() => (deal ? getActiveStep(deal) : 'locked'), [deal])

  async function submitReview() {
    if (!deal || !currentUserId || !counterpart) return

    setReviewSaving(true)
    setReviewError('')
    setReviewNotice('')

    const payload = {
      deal_id: deal.id,
      reviewer_id: currentUserId,
      reviewed_user_id: counterpart.id,
      user_rating: reviewForm.user_rating,
      user_review: reviewForm.user_review,
      platform_rating: reviewForm.platform_rating,
      platform_review: reviewForm.platform_review,
      updated_at: new Date().toISOString(),
    }

    const { error: reviewUpsertError } = await supabase
      .from('deal_reviews')
      .upsert(payload, { onConflict: 'deal_id,reviewer_id' })
      .select()
      .single()

    if (reviewUpsertError) {
      setReviewError('Gagal menyimpan review: ' + reviewUpsertError.message)
      setReviewSaving(false)
      return
    }

    setReviewNotice('Review berhasil disimpan.')
    setReviewSaving(false)
    await loadDeal()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #F7F6FB 0%, #FDFDFF 100%)' }}>
      <Navbar />

      <main className="main-content" style={{ padding: '28px 16px 120px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <button
            onClick={() => router.push('/deals')}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '16px', padding: 0, fontWeight: 800 }}
          >
            Kembali ke Deals
          </button>

          {loading ? (
            <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Memuat detail deal...
            </div>
          ) : error || !deal ? (
            <div className="card" style={{ padding: '18px', border: '1px solid #FECACA', background: '#FEF2F2' }}>
              <p className="error-text">{error || 'Deal tidak ditemukan.'}</p>
            </div>
          ) : (
            <>
              <section
                className="card"
                style={{
                  padding: '20px',
                  marginBottom: '16px',
                  border: '1px solid var(--border)',
                  boxShadow: '0 12px 34px rgba(26,26,46,0.07)',
                }}
              >
                <p className="section-label" style={{ color: 'var(--primary)' }}>Deal Status</p>
                <h1 style={{ fontSize: '26px', fontWeight: 900, lineHeight: 1.25 }}>
                  {listingA?.title || 'Listing A'} <span style={{ color: 'var(--text-muted)' }}>to</span>{' '}
                  {listingB?.title || 'Listing B'}
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
                  Status sistem: {deal.status}
                </p>
                <DealStepper activeStep={activeStep} />
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <ShipmentCard
                  sideLabel="Side A"
                  listing={listingA}
                  recipient={recipientA}
                  shipped={deal.side_a_shipped}
                  shippedAt={deal.side_a_shipped_at}
                  received={deal.side_a_received}
                  receivedAt={deal.side_a_received_at}
                />
                <ShipmentCard
                  sideLabel="Side B"
                  listing={listingB}
                  recipient={recipientB}
                  shipped={deal.side_b_shipped}
                  shippedAt={deal.side_b_shipped_at}
                  received={deal.side_b_received}
                  receivedAt={deal.side_b_received_at}
                />
              </section>

              {deal.status === 'completed' && counterpart && (
                <ReviewSection
                  counterpart={counterpart}
                  form={reviewForm}
                  existingReview={existingReview}
                  saving={reviewSaving}
                  notice={reviewNotice}
                  error={reviewError}
                  onChange={setReviewForm}
                  onSubmit={submitReview}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function getCounterpartId(deal: Deal, userId: string) {
  if (userId === deal.side_a_owner_id) return deal.side_a_recipient_id
  if (userId === deal.side_b_owner_id) return deal.side_b_recipient_id
  if (userId === deal.side_a_recipient_id) return deal.side_a_owner_id
  if (userId === deal.side_b_recipient_id) return deal.side_b_owner_id
  return ''
}

function DealStepper({ activeStep }: { activeStep: StepKey }) {
  const activeIndex = STEPS.findIndex(step => step.key === activeStep)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginTop: '18px' }}>
      {STEPS.map((step, index) => {
        const isDone = index < activeIndex
        const isActive = index === activeIndex

        return (
          <div key={step.key} style={{ minWidth: 0 }}>
            <div
              style={{
                height: '8px',
                borderRadius: '999px',
                background: isDone || isActive ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))' : 'var(--border)',
                boxShadow: isActive ? '0 6px 14px rgba(91,63,224,0.22)' : 'none',
              }}
            />
            <p
              style={{
                marginTop: '8px',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 800,
                color: isActive ? 'var(--primary)' : isDone ? '#166534' : 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {step.label}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function ShipmentCard({
  sideLabel,
  listing,
  recipient,
  shipped,
  shippedAt,
  received,
  receivedAt,
}: {
  sideLabel: string
  listing: ListingMini | null
  recipient: ProfileMini | null
  shipped: boolean
  shippedAt: string | null
  received: boolean
  receivedAt: string | null
}) {
  return (
    <article
      className="card"
      style={{
        padding: '16px',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px rgba(26,26,46,0.06)',
      }}
    >
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ width: '72px', height: '72px', flexShrink: 0, overflow: 'hidden', borderRadius: '12px', background: '#F3F0FF' }}>
          {listing?.photo_urls && listing.photo_urls.length > 0 ? (
            <img src={listing.photo_urls[0]} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '12px', fontWeight: 800 }}>
              No Photo
            </div>
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="section-label" style={{ color: 'var(--primary)' }}>{sideLabel}</p>
          <h2 style={{ fontSize: '17px', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {listing?.title || 'Listing tidak bisa dimuat'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Tujuan pengiriman: @{recipient?.username || 'recipient'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
        <StatusPill label="Dikirim" active={shipped} timestamp={shippedAt} />
        <StatusPill label="Diterima" active={received} timestamp={receivedAt} />
      </div>
    </article>
  )
}

function StatusPill({
  label,
  active,
  timestamp,
}: {
  label: string
  active: boolean
  timestamp: string | null
}) {
  return (
    <div
      style={{
        border: '1px solid',
        borderColor: active ? '#166534' : 'var(--border)',
        background: active ? '#EAFBF1' : 'var(--bg)',
        color: active ? '#166534' : 'var(--text-muted)',
        borderRadius: '10px',
        padding: '10px',
      }}
    >
      <p style={{ fontSize: '12px', fontWeight: 800 }}>{label}</p>
      <p style={{ fontSize: '11px', marginTop: '4px' }}>{active ? formatDate(timestamp) : 'Belum'}</p>
    </div>
  )
}

function ReviewSection({
  counterpart,
  form,
  existingReview,
  saving,
  notice,
  error,
  onChange,
  onSubmit,
}: {
  counterpart: ProfileMini
  form: {
    user_rating: number
    user_review: string
    platform_rating: number
    platform_review: string
  }
  existingReview: DealReview | null
  saving: boolean
  notice: string
  error: string
  onChange: (form: {
    user_rating: number
    user_review: string
    platform_rating: number
    platform_review: string
  }) => void
  onSubmit: () => void
}) {
  return (
    <section
      className="card"
      style={{
        padding: '18px',
        marginTop: '16px',
        border: '1px solid var(--border)',
        boxShadow: '0 12px 34px rgba(26,26,46,0.07)',
      }}
    >
      <p className="section-label" style={{ color: 'var(--primary)' }}>
        Review Deal
      </p>
      <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '6px' }}>
        {existingReview ? 'Update Review' : 'Beri Review'}
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
        Nilai performa @{counterpart.username} sebagai partner barter dan pengalamanmu menggunakan TREDIT.
      </p>

      {notice && (
        <div style={{ background: '#EAFBF1', color: '#166534', border: '1px solid #166534', borderRadius: '10px', padding: '10px', fontSize: '13px', marginBottom: '12px' }}>
          {notice}
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', color: 'var(--danger)', border: '1px solid #FECACA', borderRadius: '10px', padding: '10px', fontSize: '13px', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      <ReviewField
        title={`Performa @${counterpart.username}`}
        rating={form.user_rating}
        notes={form.user_review}
        notesPlaceholder="Contoh: responsif, barang sesuai, komunikasi jelas..."
        onRatingChange={rating => onChange({ ...form, user_rating: rating })}
        onNotesChange={notes => onChange({ ...form, user_review: notes })}
      />

      <ReviewField
        title="Performa Platform TREDIT"
        rating={form.platform_rating}
        notes={form.platform_review}
        notesPlaceholder="Contoh: proses verifikasi jelas, status mudah dipantau..."
        onRatingChange={rating => onChange({ ...form, platform_rating: rating })}
        onNotesChange={notes => onChange({ ...form, platform_review: notes })}
      />

      <button
        onClick={onSubmit}
        disabled={saving}
        style={{
          width: '100%',
          border: 'none',
          background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
          color: 'white',
          borderRadius: '12px',
          padding: '12px 14px',
          fontSize: '14px',
          fontWeight: 900,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
          boxShadow: saving ? 'none' : '0 10px 18px rgba(91,63,224,0.22)',
        }}
      >
        {saving ? 'Menyimpan...' : existingReview ? 'Update Review' : 'Simpan Review'}
      </button>
    </section>
  )
}

function ReviewField({
  title,
  rating,
  notes,
  notesPlaceholder,
  onRatingChange,
  onNotesChange,
}: {
  title: string
  rating: number
  notes: string
  notesPlaceholder: string
  onRatingChange: (rating: number) => void
  onNotesChange: (notes: string) => void
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
      <p style={{ fontSize: '15px', fontWeight: 900, marginBottom: '10px' }}>{title}</p>
      <StarRating value={rating} onChange={onRatingChange} />
      <textarea
        value={notes}
        onChange={event => onNotesChange(event.target.value)}
        placeholder={notesPlaceholder}
        rows={3}
        style={{
          width: '100%',
          marginTop: '10px',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '10px',
          fontSize: '14px',
          lineHeight: 1.5,
          outline: 'none',
          resize: 'vertical',
        }}
      />
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} bintang`}
          style={{
            border: 'none',
            background: 'transparent',
            color: star <= value ? '#FFB800' : 'var(--border)',
            cursor: 'pointer',
            fontSize: '28px',
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}
