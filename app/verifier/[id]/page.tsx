'use client'

import { useEffect, useState } from 'react'
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

type ListingMini = { id: string; title: string }

export default function VerifierWorkPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [listingA, setListingA] = useState<ListingMini | null>(null)
  const [listingB, setListingB] = useState<ListingMini | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Form verifikasi per barang
  const [reportA, setReportA] = useState({ is_authentic: true, is_condition_match: true, notes: '' })
  const [reportB, setReportB] = useState({ is_authentic: true, is_condition_match: true, notes: '' })
  const [reportsExist, setReportsExist] = useState(false)

  useEffect(() => {
    fetchDeal()
  }, [dealId])

  async function fetchDeal() {
    setLoading(true)
    setErrorMsg('')

    const { data: dealData, error } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single()

    if (error || !dealData) {
      setErrorMsg('Deal tidak ditemukan atau kamu tidak punya akses')
      setLoading(false)
      return
    }

    setDeal(dealData as Deal)

    const [{ data: lA }, { data: lB }] = await Promise.all([
      supabase.from('listings').select('id, title').eq('id', dealData.side_a_listing_id).single(),
      supabase.from('listings').select('id, title').eq('id', dealData.side_b_listing_id).single(),
    ])
    setListingA(lA as ListingMini)
    setListingB(lB as ListingMini)

    const { data: existingReports } = await supabase
      .from('verification_reports')
      .select('*')
      .eq('deal_id', dealId)

    if (existingReports && existingReports.length > 0) {
      setReportsExist(true)
      const rA = existingReports.find((r) => r.listing_id === dealData.side_a_listing_id)
      const rB = existingReports.find((r) => r.listing_id === dealData.side_b_listing_id)
      if (rA) setReportA({ is_authentic: rA.is_authentic, is_condition_match: rA.is_condition_match, notes: rA.notes ?? '' })
      if (rB) setReportB({ is_authentic: rB.is_authentic, is_condition_match: rB.is_condition_match, notes: rB.notes ?? '' })
    }

    setLoading(false)
  }

  async function updateDealField(fields: Partial<Deal>) {
    setBusy(true)
    setErrorMsg('')
    const { error } = await supabase.from('deals').update(fields).eq('id', dealId)
    setBusy(false)
    if (error) {
      setErrorMsg('Gagal update: ' + error.message)
      return
    }
    fetchDeal()
  }

  async function handleSubmitReports() {
    if (!deal) return
    setBusy(true)
    setErrorMsg('')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      setBusy(false)
      return
    }

    // Hapus laporan lama (kalau ada) baru insert ulang, supaya bisa diedit sebelum dikirim
    await supabase.from('verification_reports').delete().eq('deal_id', dealId)

    const { error } = await supabase.from('verification_reports').insert([
      {
        deal_id: dealId,
        verifier_id: userData.user.id,
        listing_id: deal.side_a_listing_id,
        is_authentic: reportA.is_authentic,
        is_condition_match: reportA.is_condition_match,
        notes: reportA.notes,
      },
      {
        deal_id: dealId,
        verifier_id: userData.user.id,
        listing_id: deal.side_b_listing_id,
        is_authentic: reportB.is_authentic,
        is_condition_match: reportB.is_condition_match,
        notes: reportB.notes,
      },
    ])

    setBusy(false)

    if (error) {
      setErrorMsg('Gagal simpan laporan: ' + error.message)
      return
    }

    setReportsExist(true)
    fetchDeal()
  }

  async function handleSendReportToParties() {
    await updateDealField({
      verification_reported_at: new Date().toISOString(),
      status: 'verified',
    })
  }

  async function handleComplete() {
    await updateDealField({ status: 'completed' })
  }

  if (loading) return <p className="p-6">Memuat...</p>
  if (errorMsg && !deal) return <p className="p-6 text-red-600">{errorMsg}</p>
  if (!deal) return null

  const bothInitialReceived = deal.side_a_received && deal.side_b_received
  const bothCrossReceived = deal.side_a_cross_received && deal.side_b_cross_received
  const reportSent = !!deal.verification_reported_at

  return (
    <div className="max-w-[600px] mx-auto p-6">
      <button onClick={() => router.push('/verifier')} className="mb-4 cursor-pointer">
        ← Kembali ke daftar tugas
      </button>

      <h1 className="text-2xl font-bold">Verifikasi Deal</h1>
      <p className="text-[13px] text-muted">
        Status saat ini: <strong>{deal.status}</strong>
      </p>

      {errorMsg && <p className="text-red-600">{errorMsg}</p>}

      {/* TAHAP 1: Etape Owner -> Verifikator */}
      <Section title="Tahap 1 — Penerimaan Barang dari Owner">
        <ShippingRow
          label={`Barang A (${listingA?.title ?? '...'})`}
          shipped={deal.side_a_shipped}
          shippedAt={deal.side_a_shipped_at}
          received={deal.side_a_received}
          receivedAt={deal.side_a_received_at}
          onMarkShipped={() => updateDealField({ side_a_shipped: true, side_a_shipped_at: new Date().toISOString() })}
          onMarkReceived={() => updateDealField({ side_a_received: true, side_a_received_at: new Date().toISOString() })}
          busy={busy}
        />
        <ShippingRow
          label={`Barang B (${listingB?.title ?? '...'})`}
          shipped={deal.side_b_shipped}
          shippedAt={deal.side_b_shipped_at}
          received={deal.side_b_received}
          receivedAt={deal.side_b_received_at}
          onMarkShipped={() => updateDealField({ side_b_shipped: true, side_b_shipped_at: new Date().toISOString() })}
          onMarkReceived={() => updateDealField({ side_b_received: true, side_b_received_at: new Date().toISOString() })}
          busy={busy}
        />
      </Section>

      {/* TAHAP 2: Form verifikasi keaslian, hanya aktif kalau kedua barang sudah diterima */}
      <Section title="Tahap 2 — Verifikasi Keaslian">
        {!bothInitialReceived && (
          <p className="text-[13px] text-muted">
            Menunggu kedua barang diterima dulu sebelum verifikasi bisa diisi.
          </p>
        )}

        {bothInitialReceived && (
          <>
            <ReportForm title={listingA?.title ?? 'Barang A'} value={reportA} onChange={setReportA} disabled={reportSent} />
            <ReportForm title={listingB?.title ?? 'Barang B'} value={reportB} onChange={setReportB} disabled={reportSent} />

            {!reportSent && (
              <button
                onClick={handleSubmitReports}
                disabled={busy}
                className="mt-2 px-4 py-2 bg-primary text-white border-none rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-default"
              >
                {reportsExist ? 'Update Laporan' : 'Simpan Laporan'}
              </button>
            )}
          </>
        )}
      </Section>

      {/* TAHAP 3: Kirim laporan ke kedua pihak */}
      <Section title="Tahap 3 — Pelaporan Hasil">
        {reportSent ? (
          <p className="text-[13px] text-success">
            ✓ Laporan sudah dikirim ke kedua pihak pada {new Date(deal.verification_reported_at!).toLocaleString('id-ID')}
          </p>
        ) : (
          <button
            onClick={handleSendReportToParties}
            disabled={busy || !reportsExist}
            className="px-4 py-2 bg-primary text-white border-none rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            Kirim Laporan ke Kedua Pihak
          </button>
        )}
      </Section>

      {/* TAHAP 4: Cross-shipping ke penerima asli */}
      <Section title="Tahap 4 — Cross-Shipping ke Penerima Asli">
        {!reportSent && <p className="text-[13px] text-muted">Menunggu laporan verifikasi dikirim dulu.</p>}
        {reportSent && (
          <>
            <ShippingRow
              label={`Barang A → ke @${deal.side_a_recipient_id.slice(0, 8)}...`}
              shipped={deal.side_a_cross_shipped}
              shippedAt={deal.side_a_cross_shipped_at}
              received={deal.side_a_cross_received}
              receivedAt={deal.side_a_cross_received_at}
              onMarkShipped={() => updateDealField({ side_a_cross_shipped: true, side_a_cross_shipped_at: new Date().toISOString() })}
              onMarkReceived={() => updateDealField({ side_a_cross_received: true, side_a_cross_received_at: new Date().toISOString() })}
              busy={busy}
            />
            <ShippingRow
              label={`Barang B → ke @${deal.side_b_recipient_id.slice(0, 8)}...`}
              shipped={deal.side_b_cross_shipped}
              shippedAt={deal.side_b_cross_shipped_at}
              received={deal.side_b_cross_received}
              receivedAt={deal.side_b_cross_received_at}
              onMarkShipped={() => updateDealField({ side_b_cross_shipped: true, side_b_cross_shipped_at: new Date().toISOString() })}
              onMarkReceived={() => updateDealField({ side_b_cross_received: true, side_b_cross_received_at: new Date().toISOString() })}
              busy={busy}
            />
          </>
        )}
      </Section>

      {/* SELESAI */}
      {bothCrossReceived && deal.status !== 'completed' && (
        <button
          onClick={handleComplete}
          disabled={busy}
          className="w-full py-3 bg-success text-white border-none rounded-lg cursor-pointer font-bold disabled:opacity-50 disabled:cursor-default"
        >
          Tandai Deal Selesai
        </button>
      )}

      {deal.status === 'completed' && (
        <p className="text-center font-bold text-success">✓ Deal Selesai</p>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-line rounded-xl p-4 mb-4">
      <h3 className="mt-0 mb-3 text-[15px] font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function ShippingRow({
  label,
  shipped,
  shippedAt,
  received,
  receivedAt,
  onMarkShipped,
  onMarkReceived,
  busy,
}: {
  label: string
  shipped: boolean
  shippedAt: string | null
  received: boolean
  receivedAt: string | null
  onMarkShipped: () => void
  onMarkReceived: () => void
  busy: boolean
}) {
  return (
    <div className="mb-3">
      <p className="mb-1 text-sm font-semibold">{label}</p>
      <div className="flex gap-2">
        <button
          onClick={onMarkShipped}
          disabled={busy || shipped}
          className={`flex-1 py-1.5 text-[13px] border border-line-strong rounded-md ${
            shipped ? 'bg-success-bg text-success cursor-default' : 'bg-white text-gray-800 cursor-pointer'
          }`}
        >
          {shipped ? `✓ Dikirim ${shippedAt ? new Date(shippedAt).toLocaleDateString('id-ID') : ''}` : 'Tandai Dikirim'}
        </button>
        <button
          onClick={onMarkReceived}
          disabled={busy || !shipped || received}
          className={`flex-1 py-1.5 text-[13px] border border-line-strong rounded-md ${
            received ? 'bg-success-bg text-success cursor-default' : 'bg-white text-gray-800'
          } ${!shipped || received ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {received ? `✓ Diterima ${receivedAt ? new Date(receivedAt).toLocaleDateString('id-ID') : ''}` : 'Tandai Diterima'}
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
  value: { is_authentic: boolean; is_condition_match: boolean; notes: string }
  onChange: (v: { is_authentic: boolean; is_condition_match: boolean; notes: string }) => void
  disabled: boolean
}) {
  return (
    <div className="mb-4 pb-4 border-b border-line-light">
      <p className="font-semibold text-sm">{title}</p>
      <label className="block text-[13px] mb-1">
        <input
          type="checkbox"
          checked={value.is_authentic}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, is_authentic: e.target.checked })}
        />{' '}
        Barang asli (authentic)
      </label>
      <label className="block text-[13px] mb-1">
        <input
          type="checkbox"
          checked={value.is_condition_match}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, is_condition_match: e.target.checked })}
        />{' '}
        Kondisi sesuai deskripsi
      </label>
      <textarea
        placeholder="Catatan verifikasi (opsional)"
        value={value.notes}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, notes: e.target.value })}
        rows={2}
        className="w-full mt-1 text-[13px] border border-line rounded-md p-1.5"
      />
    </div>
  )
}