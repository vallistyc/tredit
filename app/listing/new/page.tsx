'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
import Navbar from '@/app/components/Navbar'

const CATEGORIES = ['fashion', 'gadget', 'aksesoris', 'lainnya']

function generateEstimatedValue() {
  const min = 1000000
  const max = 20000000
  const step = 50000
  const steps = Math.floor((max - min) / step)
  return min + Math.floor(Math.random() * steps) * step
}

function formatRupiah(value: number) {
  return 'Rp' + value.toLocaleString('id-ID')
}

export default function NewListingPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [estimatedValue, setEstimatedValue] = useState<number | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([])
  const [expectedGoodsInput, setExpectedGoodsInput] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    category: '',
    brand: '',
    condition_notes: '',
    location: '',
  })

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
    }
    init()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length + photos.length > 5) {
      setError('Maksimal 5 foto')
      return
    }
    const newPhotos = [...photos, ...files]
    setPhotos(newPhotos)
    const urls = newPhotos.map(f => URL.createObjectURL(f))
    setPhotoPreviewUrls(urls)
  }

  function removePhoto(index: number) {
    const newPhotos = photos.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    setPhotoPreviewUrls(newPhotos.map(f => URL.createObjectURL(f)))
  }

  async function handleEstimate() {
    if (!form.title || !form.category) {
      setError('Isi judul dan kategori dulu sebelum estimasi harga')
      return
    }
    setEstimating(true)
    setEstimatedValue(null)
    await new Promise(r => setTimeout(r, 1500))
    setEstimatedValue(generateEstimatedValue())
    setEstimating(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    if (!estimatedValue) {
      setError('Klik "Estimasi Harga" dulu sebelum submit')
      return
    }
    if (photos.length === 0) {
      setError('Upload minimal 1 foto')
      return
    }

    setLoading(true)
    setError('')

    // Upload foto ke Supabase Storage
    const photoUrls: string[] = []
    for (const photo of photos) {
      const ext = photo.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, photo)

      if (uploadError) {
        setError('Gagal upload foto: ' + uploadError.message)
        setLoading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('listing-photos')
        .getPublicUrl(fileName)
      photoUrls.push(urlData.publicUrl)
    }

    // Parse expected goods
    const expectedGoods = expectedGoodsInput
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    // Insert listing
    const { data: listing, error: insertError } = await supabase
      .from('listings')
      .insert({
        owner_id: userId,
        title: form.title,
        category: form.category,
        brand: form.brand || null,
        condition_notes: form.condition_notes,
        location: form.location || null,
        expected_goods: expectedGoods,
        estimated_value: estimatedValue,
        photo_urls: photoUrls,
        status: 'active',
        escrow_fee_paid: true,
        platform_fee_paid: true,
      })
      .select()
      .single()

    if (insertError) {
      setError('Gagal buat listing: ' + insertError.message)
      setLoading(false)
      return
    }

    router.push('/home')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      <main className="main-content" style={{ padding: '20px 16px 100px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800' }}>Add Pitch</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Buat listing barang untuk di-barter
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Foto */}
            <div className="card" style={{ padding: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Foto Barang <span style={{ color: 'var(--danger)' }}>*</span>
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {photoPreviewUrls.map((url, i) => (
                  <div key={i} style={{ position: 'relative', width: '80px', height: '80px' }}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      style={{
                        position: 'absolute', top: '-6px', right: '-6px',
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: 'var(--danger)', color: 'white',
                        border: 'none', cursor: 'pointer', fontSize: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >×</button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <label style={{
                    width: '80px', height: '80px', borderRadius: '8px',
                    border: '2px dashed var(--border)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-muted)', fontSize: '24px'
                  }}>
                    +
                    <input type="file" accept="image/*" multiple onChange={handlePhotoChange} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Maksimal 5 foto</p>
            </div>

            {/* Info dasar */}
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Info Barang
              </p>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Judul <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input className="input-field" name="title" placeholder="cth: Nike Air Jordan 1 Retro High OG" value={form.title} onChange={handleChange} required />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Kategori <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select className="input-field" name="category" value={form.category} onChange={handleChange} required>
                  <option value="">Pilih kategori</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Brand
                </label>
                <input className="input-field" name="brand" placeholder="cth: Nike, Apple, Gucci" value={form.brand} onChange={handleChange} />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Lokasi
                </label>
                <input className="input-field" name="location" placeholder="cth: Jakarta Selatan" value={form.location} onChange={handleChange} />
              </div>
            </div>

            {/* Kondisi */}
            <div className="card" style={{ padding: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Kondisi Barang
              </label>
              <textarea
                className="input-field"
                name="condition_notes"
                placeholder="cth: no box, sedikit baret di sol, overall 8/10"
                value={form.condition_notes}
                onChange={handleChange}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Expected Goods */}
            <div className="card" style={{ padding: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Expected Goods
              </label>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Barang apa yang kamu inginkan sebagai barter? Pisahkan dengan koma.
              </p>
              <input
                className="input-field"
                placeholder="cth: Adidas Samba, Supreme Hoodie, AirPods Pro"
                value={expectedGoodsInput}
                onChange={e => setExpectedGoodsInput(e.target.value)}
              />
              {expectedGoodsInput && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {expectedGoodsInput.split(',').map(s => s.trim()).filter(s => s).map((g, i) => (
                    <span key={i} style={{
                      fontSize: '12px', background: '#FFF8E7',
                      color: '#92640A', padding: '3px 8px', borderRadius: '6px'
                    }}>{g}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Estimasi Harga */}
            <div className="card" style={{ padding: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Estimasi Harga (E.P)
              </p>
              {estimatedValue ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '22px', fontWeight: '800', color: 'var(--primary)' }}>
                      {formatRupiah(estimatedValue)}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hasil estimasi AI</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEstimate}
                    style={{
                      padding: '8px 14px', borderRadius: '8px',
                      border: '1.5px solid var(--primary)',
                      background: 'transparent', color: 'var(--primary)',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Re-estimasi
                  </button>
                </div>
              ) : estimating ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)' }}>
                  <div style={{
                    width: '18px', height: '18px', border: '2px solid var(--primary)',
                    borderTopColor: 'transparent', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite'
                  }} />
                  Estimating the price...
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleEstimate}
                  style={{
                    padding: '10px 20px', borderRadius: '10px',
                    border: '1.5px solid var(--primary)',
                    background: 'transparent', color: 'var(--primary)',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  ✨ Estimasi Harga
                </button>
              )}
            </div>

            {error && <p className="error-text">{error}</p>}

            {/* Mock payment notice */}
            <div style={{
              background: '#FFF8E7', border: '1px solid #FFB800',
              borderRadius: '10px', padding: '12px 14px'
            }}>
              <p style={{ fontSize: '13px', color: '#92640A', fontWeight: '600' }}>
                💳 Biaya Platform
              </p>
              <p style={{ fontSize: '12px', color: '#92640A', marginTop: '4px' }}>
                Escrow Fee Rp25.000 + Platform Fee Rp10.000 = <strong>Rp35.000</strong>
              </p>
            </div>

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Membuat listing...' : 'Buat Listing & Bayar Rp35.000'}
            </button>

          </form>
        </div>
      </main>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}