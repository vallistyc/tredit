'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Deal = {
  id: string
  verifier_id: string | null
  status: string
  side_a_listing_id: string
  side_a_owner_id: string
  side_a_recipient_id: string
  side_a_shipped: boolean
  side_a_shipped_at: string | null
  side_a_received: boolean
  side_a_received_at: string | null
  side_a_cross_shipped: boolean
  side_a_cross_shipped_at: string | null
  side_a_cross_received: boolean
  side_a_cross_received_at: string | null
  side_b_listing_id: string
  side_b_owner_id: string
  side_b_recipient_id: string
  side_b_shipped: boolean
  side_b_shipped_at: string | null
  side_b_received: boolean
  side_b_received_at: string | null
  side_b_cross_shipped: boolean
  side_b_cross_shipped_at: string | null
  side_b_cross_received: boolean
  side_b_cross_received_at: string | null
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

type ReportFormValue = {
  is_authentic: boolean
  is_condition_match: boolean
  notes: string
}

type VerificationReport = ReportFormValue & {
  listing_id: string
}

const emptyReport: ReportFormValue = {
  is_authentic: true,
  is_condition_match: true,
  notes: '',
}

function formatDate(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function VerifierWorkPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [userId, setUserId] = useState<string | null>(null)
  const [isVerifier, setIsVerifier] = useState(false)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [listingA, setListingA] = useState<ListingMini | null>(null)
  const [listingB, setListingB] = useState<ListingMini | null>(null)
  const [recipientA, setRecipientA] = useState<ProfileMini | null>(null)
  const [recipientB, setRecipientB] = useState<ProfileMini | null>(null)
  const [reportA, setReportA] = useState<ReportFormValue>(emptyReport)
  const [reportB, setReportB] = useState<ReportFormValue>(emptyReport)
  const [reportsExist, setReportsExist] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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

    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_verifier')
      .eq('id', user.id)
      .single()

    if (profile?.is_verifier !== true) {
      setIsVerifier(false)
      setLoading(false)
      return
    }

    setIsVerifier(true)

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

    const [{ data: listingsData }, { data: profilesData }, { data: reportsData }] =
      await Promise.all([
        supabase
          .from('listings')
          .select('id, title, photo_urls')
          .in('id', [typedDeal.side_a_listing_id, typedDeal.side_b_listing_id]),
        supabase
          .from('profiles')
          .select('id, username')
          .in('id', [typedDeal.side_a_recipient_id, typedDeal.side_b_recipient_id]),
        supabase
          .from('verification_reports')
          .select('listing_id, is_authentic, is_condition_match, notes')
          .eq('deal_id', dealId),
      ])

    const listings = (listingsData || []) as ListingMini[]
    const profiles = (profilesData || []) as ProfileMini[]
    const reports = (reportsData || []) as VerificationReport[]
    const existingA = reports.find(report => report.listing_id === typedDeal.side_a_listing_id)
    const existingB = reports.find(report => report.listing_id === typedDeal.side_b_listing_id)

    setListingA(listings.find(listing => listing.id === typedDeal.side_a_listing_id) || null)
    setListingB(listings.find(listing => listing.id === typedDeal.side_b_listing_id) || null)
    setRecipientA(profiles.find(item => item.id === typedDeal.side_a_recipient_id) || null)
    setRecipientB(profiles.find(item => item.id === typedDeal.side_b_recipient_id) || null)
    setReportA(existingA ? toReportForm(existingA) : emptyReport)
    setReportB(existingB ? toReportForm(existingB) : emptyReport)
    setReportsExist(Boolean(existingA && existingB))
    setLoading(false)
  }, [dealId, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDeal()
  }, [loadDeal])

  const canWork = Boolean(isVerifier && userId && deal?.verifier_id === userId)
  const bothInitialReceived = Boolean(deal?.side_a_received && deal?.side_b_received)
  const reportSent = Boolean(deal?.verification_reported_at)
  const bothCrossReceived = Boolean(deal?.side_a_cross_received && deal?.side_b_cross_received)

  const stage = useMemo(() => {
    if (!deal) return 1
    if (!bothInitialReceived) return 1
    if (!reportsExist) return 2
    if (!reportSent) return 3
    return 4
  }, [bothInitialReceived, deal, reportSent, reportsExist])

  async function updateDealFields(fields: Partial<Deal>) {
    if (!deal || !userId) return

    setBusy(true)
    setError('')
    setNotice('')

    const { error: updateError } = await supabase
      .from('deals')
      .update(fields)
      .eq('id', deal.id)
      .eq('verifier_id', userId)

    if (updateError) {
      setError('Gagal update deal: ' + updateError.message)
      setBusy(false)
      return
    }

    setBusy(false)
    await loadDeal()
  }

  async function saveReports() {
    if (!deal || !userId) return

    setBusy(true)
    setError('')
    setNotice('')

    await supabase.from('verification_reports').delete().eq('deal_id', deal.id)

    const { error: insertError } = await supabase.from('verification_reports').insert([
      {
        deal_id: deal.id,
        verifier_id: userId,
        listing_id: deal.side_a_listing_id,
        ...reportA,
      },
      {
        deal_id: deal.id,
        verifier_id: userId,
        listing_id: deal.side_b_listing_id,
        ...reportB,
      },
    ])

    if (insertError) {
      setError('Gagal simpan laporan: ' + insertError.message)
      setBusy(false)
      return
    }

    setNotice('Laporan verifikasi tersimpan.')
    setReportsExist(true)
    setBusy(false)
    await loadDeal()
  }

  async function sendReport() {
    await updateDealFields({
      verification_reported_at: new Date().toISOString(),
      status: 'verified',
    })
  }

  async function completeDeal() {
    await updateDealFields({ status: 'completed' })
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #F7F6FB 0%, #FDFDFF 100%)', padding: '28px 16px' }}>
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '32px', textAlign: 'center', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
          Memuat tugas...
        </div>
      </main>
    )
  }

  if (!isVerifier) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '28px 16px' }}>
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '18px', border: '1px solid #FECACA', background: '#FEF2F2' }}>
          Halaman ini khusus untuk Verifikator
        </div>
      </main>
    )
  }

  if (!deal) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '28px 16px' }}>
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '18px', border: '1px solid #FECACA', background: '#FEF2F2', color: 'var(--danger)' }}>
          {error || 'Deal tidak ditemukan.'}
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #F7F6FB 0%, #FDFDFF 100%)', padding: '28px 16px 120px' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        <button
          onClick={() => router.push('/verifier')}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '16px', padding: 0, fontWeight: 800 }}
        >
          Kembali ke daftar tugas
        </button>

        <header className="card" style={{ padding: '18px', marginBottom: '14px', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(26,26,46,0.07)' }}>
          <p className="section-label" style={{ color: 'var(--primary)' }}>Deal #{deal.id.slice(0, 8)}</p>
          <h1 style={{ fontSize: '26px', fontWeight: 900 }}>Verifikasi Deal</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Status: {deal.status}</p>
        </header>

        {!canWork && (
          <div className="card" style={{ padding: '14px', marginBottom: '14px', border: '1px solid #FFB800', background: '#FFF8E7', color: '#92640A', fontSize: '14px' }}>
            Tugas ini belum menjadi milikmu. Ambil tugas dari dashboard verifikator terlebih dahulu.
          </div>
        )}

        {notice && (
          <div className="card" style={{ padding: '13px 15px', marginBottom: '12px', border: '1px solid #FFB800', background: '#FFF8E7', color: '#92640A', fontSize: '13px' }}>
            {notice}
          </div>
        )}

        {error && (
          <div className="card" style={{ padding: '13px 15px', marginBottom: '12px', border: '1px solid #FECACA', background: '#FEF2F2', color: 'var(--danger)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <StageHeader active={stage} />

        <Section title="Tahap 1 - Penerimaan Barang dari Owner">
          <ShippingRow
            label={`Side A - ${listingA?.title || 'Barang A'}`}
            shipped={deal.side_a_shipped}
            shippedAt={deal.side_a_shipped_at}
            received={deal.side_a_received}
            receivedAt={deal.side_a_received_at}
            disabled={!canWork || reportSent}
            onMarkShipped={() => updateDealFields({ side_a_shipped: true, side_a_shipped_at: new Date().toISOString() })}
            onMarkReceived={() => updateDealFields({ side_a_received: true, side_a_received_at: new Date().toISOString() })}
            busy={busy}
          />
          <ShippingRow
            label={`Side B - ${listingB?.title || 'Barang B'}`}
            shipped={deal.side_b_shipped}
            shippedAt={deal.side_b_shipped_at}
            received={deal.side_b_received}
            receivedAt={deal.side_b_received_at}
            disabled={!canWork || reportSent}
            onMarkShipped={() => updateDealFields({ side_b_shipped: true, side_b_shipped_at: new Date().toISOString() })}
            onMarkReceived={() => updateDealFields({ side_b_received: true, side_b_received_at: new Date().toISOString() })}
            busy={busy}
          />
        </Section>

        <Section title="Tahap 2 - Verifikasi Keaslian">
          {!bothInitialReceived && (
            <p className="text-sm text-muted">Form aktif setelah kedua barang diterima verifikator.</p>
          )}

          <ReportForm
            title={listingA?.title || 'Barang A'}
            value={reportA}
            onChange={setReportA}
            disabled={!canWork || !bothInitialReceived || reportSent}
          />
          <ReportForm
            title={listingB?.title || 'Barang B'}
            value={reportB}
            onChange={setReportB}
            disabled={!canWork || !bothInitialReceived || reportSent}
          />

          {!reportSent && (
            <button
              onClick={saveReports}
              disabled={busy || !canWork || !bothInitialReceived}
              style={primaryButtonStyle(busy || !canWork || !bothInitialReceived)}
            >
              {reportsExist ? 'Update Laporan' : 'Simpan Laporan'}
            </button>
          )}
        </Section>

        <Section title="Tahap 3 - Pelaporan Hasil">
          {reportSent ? (
            <p className="text-sm font-semibold text-success">
              Laporan sudah dikirim pada {formatDate(deal.verification_reported_at)}
            </p>
          ) : (
            <button
              onClick={sendReport}
              disabled={busy || !canWork || !reportsExist}
              style={primaryButtonStyle(busy || !canWork || !reportsExist)}
            >
              Kirim Laporan ke Kedua Pihak
            </button>
          )}
        </Section>

        {reportSent && (
          <Section title="Tahap 4 - Cross-Shipping ke Penerima Asli">
            <ShippingRow
              label={`Side A -> @${recipientA?.username || deal.side_a_recipient_id.slice(0, 8)}`}
              shipped={deal.side_a_cross_shipped}
              shippedAt={deal.side_a_cross_shipped_at}
              received={deal.side_a_cross_received}
              receivedAt={deal.side_a_cross_received_at}
              disabled={!canWork || deal.status === 'completed'}
              onMarkShipped={() => updateDealFields({ side_a_cross_shipped: true, side_a_cross_shipped_at: new Date().toISOString() })}
              onMarkReceived={() => updateDealFields({ side_a_cross_received: true, side_a_cross_received_at: new Date().toISOString() })}
              busy={busy}
            />
            <ShippingRow
              label={`Side B -> @${recipientB?.username || deal.side_b_recipient_id.slice(0, 8)}`}
              shipped={deal.side_b_cross_shipped}
              shippedAt={deal.side_b_cross_shipped_at}
              received={deal.side_b_cross_received}
              receivedAt={deal.side_b_cross_received_at}
              disabled={!canWork || deal.status === 'completed'}
              onMarkShipped={() => updateDealFields({ side_b_cross_shipped: true, side_b_cross_shipped_at: new Date().toISOString() })}
              onMarkReceived={() => updateDealFields({ side_b_cross_received: true, side_b_cross_received_at: new Date().toISOString() })}
              busy={busy}
            />
          </Section>
        )}

        {bothCrossReceived && deal.status !== 'completed' && (
          <button
            onClick={completeDeal}
            disabled={busy || !canWork}
            style={{
              ...primaryButtonStyle(busy || !canWork),
              width: '100%',
              background: '#166534',
              boxShadow: busy || !canWork ? 'none' : '0 10px 18px rgba(22,101,52,0.2)',
            }}
          >
            Tandai Deal Selesai
          </button>
        )}

        {deal.status === 'completed' && (
          <div className="card" style={{ padding: '16px', textAlign: 'center', color: '#166534', border: '1px solid #166534', background: '#EAFBF1', fontWeight: 900 }}>
            Deal Selesai
          </div>
        )}
      </div>
    </main>
  )
}

function toReportForm(report: VerificationReport): ReportFormValue {
  return {
    is_authentic: report.is_authentic,
    is_condition_match: report.is_condition_match,
    notes: report.notes || '',
  }
}

function StageHeader({ active }: { active: number }) {
  const stages = ['Terima', 'Verifikasi', 'Laporan', 'Cross-Ship']

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '14px' }}>
      {stages.map((stage, index) => {
        const step = index + 1
        const isActive = step === active
        const isDone = step < active
        return (
          <div
            key={stage}
            style={{
              border: '1px solid',
              borderColor: isActive || isDone ? 'var(--primary)' : 'var(--border)',
              background: isActive || isDone ? '#F3F0FF' : 'white',
              color: isActive || isDone ? 'var(--primary)' : 'var(--text-muted)',
              borderRadius: '12px',
              padding: '10px 6px',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: 900,
              boxShadow: isActive ? '0 8px 20px rgba(91,63,224,0.12)' : 'none',
            }}
          >
            {stage}
          </div>
        )
      })}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: '16px', marginBottom: '14px', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(26,26,46,0.06)' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 900, marginBottom: '12px' }}>{title}</h2>
      {children}
    </section>
  )
}

function ShippingRow({
  label,
  shipped,
  shippedAt,
  received,
  receivedAt,
  disabled,
  onMarkShipped,
  onMarkReceived,
  busy,
}: {
  label: string
  shipped: boolean
  shippedAt: string | null
  received: boolean
  receivedAt: string | null
  disabled: boolean
  onMarkShipped: () => void
  onMarkReceived: () => void
  busy: boolean
}) {
  return (
    <div style={{ marginBottom: '10px', borderRadius: '12px', background: 'var(--bg)', padding: '12px' }}>
      <p style={{ marginBottom: '10px', fontSize: '14px', fontWeight: 900 }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          onClick={onMarkShipped}
          disabled={busy || disabled || shipped}
          style={shippingButtonStyle(shipped, busy || disabled || shipped)}
        >
          {shipped ? `Dikirim ${formatDate(shippedAt)}` : 'Tandai Dikirim'}
        </button>
        <button
          onClick={onMarkReceived}
          disabled={busy || disabled || !shipped || received}
          style={shippingButtonStyle(received, busy || disabled || !shipped || received)}
        >
          {received ? `Diterima ${formatDate(receivedAt)}` : 'Tandai Diterima'}
        </button>
      </div>
    </div>
  )
}

function ReportForm({
  title,
  value,
  onChange,
  disabled,
}: {
  title: string
  value: ReportFormValue
  onChange: (value: ReportFormValue) => void
  disabled: boolean
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
      <p style={{ fontSize: '14px', fontWeight: 900, marginBottom: '10px' }}>{title}</p>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px' }}>
        <input
          type="checkbox"
          checked={value.is_authentic}
          disabled={disabled}
          onChange={event => onChange({ ...value, is_authentic: event.target.checked })}
        />
        Barang authentic
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px' }}>
        <input
          type="checkbox"
          checked={value.is_condition_match}
          disabled={disabled}
          onChange={event => onChange({ ...value, is_condition_match: event.target.checked })}
        />
        Kondisi sesuai
      </label>
      <textarea
        style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px', fontSize: '14px', outline: 'none', background: disabled ? 'var(--bg)' : 'white' }}
        rows={3}
        placeholder="Catatan verifikasi"
        value={value.notes}
        disabled={disabled}
        onChange={event => onChange({ ...value, notes: event.target.value })}
      />
    </div>
  )
}

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    border: 'none',
    background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
    color: 'white',
    borderRadius: '10px',
    padding: '11px 14px',
    fontSize: '14px',
    fontWeight: 900,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    boxShadow: disabled ? 'none' : '0 10px 18px rgba(91,63,224,0.22)',
  }
}

function shippingButtonStyle(active: boolean, disabled: boolean): React.CSSProperties {
  return {
    border: '1px solid',
    borderColor: active ? '#166534' : 'var(--border)',
    background: active ? '#EAFBF1' : 'white',
    color: active ? '#166534' : 'var(--text)',
    borderRadius: '10px',
    padding: '9px 10px',
    fontSize: '12px',
    fontWeight: 900,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled && !active ? 0.65 : 1,
  }
}
