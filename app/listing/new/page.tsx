'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewListingPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('fashion')
  const [brand, setBrand] = useState('')
  const [conditionNotes, setConditionNotes] = useState('') // deskripsi bebas, contoh: "no box, sedikit baret di sol"
  const [location, setLocation] = useState('')
  const [expectedGoodsInput, setExpectedGoodsInput] = useState('') // diketik dipisah koma
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Simulasi "AI estimasi harga": random murni di rentang 1 juta - 20 juta.
  // Tidak berdasarkan input apapun dari Pitcher.
  // Nanti kalau RAG/AI asli sudah siap, fungsi ini yang diganti.
  function simulateAIEstimate(): number {
    const min = 1_000_000
    const max = 20_000_000
    const randomValue = Math.random() * (max - min) + min
    return Math.round(randomValue / 50_000) * 50_000 // dibulatkan ke kelipatan 50rb biar rapi
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      setLoading(false)
      setErrorMsg('Kamu harus login dulu')
      return
    }

    const userId = userData.user.id

    let photoUrls: string[] = []

    if (photoFile) {
      const fileExt = photoFile.name.split('.').pop()
      const fileName = `${userId}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, photoFile)

      if (uploadError) {
        setLoading(false)
        setErrorMsg('Gagal upload foto: ' + uploadError.message)
        return
      }

      const { data: urlData } = supabase.storage
        .from('listing-photos')
        .getPublicUrl(fileName)

      photoUrls = [urlData.publicUrl]
    }

    const expectedGoodsArray = expectedGoodsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0)

    // Tahap "Estimating the price..." -- delay buatan 1.5 detik
    setLoading(false)
    setEstimating(true)

    await new Promise((resolve) => setTimeout(resolve, 1500))

    const aiEstimatedValue = simulateAIEstimate()

    setEstimating(false)
    setLoading(true)

    const { data: listing, error: insertError } = await supabase
      .from('listings')
      .insert({
        owner_id: userId,
        title,
        category,
        brand,
        condition_notes: conditionNotes,
        location,
        expected_goods: expectedGoodsArray,
        estimated_value: aiEstimatedValue,
        photo_urls: photoUrls,
      })
      .select()
      .single()

    setLoading(false)

    if (insertError || !listing) {
      setErrorMsg('Gagal membuat listing: ' + insertError?.message)
      return
    }

    router.push('/home')
  }

  return (
    <div className="max-w-[480px] mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Tambah Listing</h1>

      {estimating && (
        <div className="p-4 bg-primary-soft rounded-lg mb-4">
          <p>Estimating the price...</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Judul Barang</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="contoh: Air Jordan Low"
            required
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Kategori</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="fashion">Fashion</option>
            <option value="gadget">Gadget</option>
            <option value="aksesoris">Aksesoris</option>
            <option value="lainnya">Lainnya</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Brand</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Kondisi Barang</label>
          <textarea
            value={conditionNotes}
            onChange={(e) => setConditionNotes(e.target.value)}
            placeholder="contoh: no box, sedikit baret di bagian sol"
            rows={3}
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Lokasi</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="contoh: Gubeng"
            required
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            Barang yang Diharapkan (pisahkan dengan koma)
          </label>
          <input
            type="text"
            value={expectedGoodsInput}
            onChange={(e) => setExpectedGoodsInput(e.target.value)}
            placeholder="contoh: Adidas, Puma, NB"
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Foto Barang</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
        </div>

        {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading || estimating}
          className="w-full bg-primary text-white font-semibold py-3 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {estimating
            ? 'Estimating the price...'
            : loading
            ? 'Menyimpan...'
            : 'Publikasikan Listing'}
        </button>
      </form>
    </div>
  )
}