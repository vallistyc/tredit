'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Listing = {
  id: string
  title: string
  brand: string | null
  location: string | null
  expected_goods: string[]
  condition_notes: string | null
  estimated_value: number
  photo_urls: string[]
  category: string
  created_at: string
  owner_id: string
}

const CATEGORIES = [
  { value: 'semua', label: 'Semua' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'gadget', label: 'Gadget' },
  { value: 'aksesoris', label: 'Aksesoris' },
  { value: 'lainnya', label: 'Lainnya' },
]

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('semua')
  const supabase = createClient()

  useEffect(() => {
    fetchListings()
  }, [activeCategory])

  async function fetchListings() {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const currentUserId = userData.user?.id

    // Ambil listing_id yang sudah di-bid oleh user ini (status pending)
    let bidedListingIds: string[] = []
    if (currentUserId) {
      const { data: myBids } = await supabase
        .from('bids')
        .select('listing_id')
        .eq('bidder_id', currentUserId)
        .eq('status', 'pending')

      bidedListingIds = (myBids ?? []).map((b) => b.listing_id)
    }

    // Query dasar: hanya listing yang masih aktif
    let query = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    // Sembunyikan listing milik sendiri
    if (currentUserId) {
      query = query.neq('owner_id', currentUserId)
    }

    // Sembunyikan listing yang sudah di-bid oleh user ini
    if (bidedListingIds.length > 0) {
      query = query.not('id', 'in', `(${bidedListingIds.join(',')})`)
    }

    // Filter kategori
    if (activeCategory !== 'semua') {
      query = query.eq('category', activeCategory)
    }

    const { data, error } = await query

    if (!error && data) {
      setListings(data as Listing[])
    }

    setLoading(false)
  }

  function formatRupiah(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  function formatRelativeDate(isoDate: string) {
    const diffMs = Date.now() - new Date(isoDate).getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hari ini'
    if (diffDays === 1) return '1 hari lalu'
    return `${diffDays} hari lalu`
  }

  return (
    <div className="max-w-[960px] mx-auto p-6">
      <h1 className="text-2xl text-center font-medium mb-5 text-[#4b00dc]">Catch your Goods!</h1>

      {/* Tombol filter kategori */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-4 py-2 rounded-full border border-primary cursor-pointer ${
              activeCategory === cat.value ? 'bg-primary border-3 font-semibold text-[#4b00dc]' : 'bg-transparent text-primary'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading && <p>Memuat listing...</p>}

      {!loading && listings.length === 0 && (
        <p>Belum ada listing tersedia di kategori ini.</p>
      )}

      {/* Grid card listing */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
        {listings.map((listing) => (
          
            key={listing.id}
            href={`/listing/${listings.id}`}
            className="block no-underline text-inherit border border-line rounded-xl overflow-hidden"
          >
            {/* Foto */}
            <div
              className="w-full h-[180px] bg-black bg-cover bg-center"
              style={
                listing.photo_urls[0]
                  ? { backgroundImage: `url(${listing.photo_urls[0]})` }
                  : undefined
              }
            />

            {/* Judul + harga */}
            <div className="bg-primary-card px-[14px] py-3">
              <div className="flex justify-between">
                <h3 className="m-0 text-lg font-semibold">{listing.title}</h3>
                <span className="text-[13px] font-semibold text-right">
                  E.P
                  <br />
                  {formatRupiah(listing.estimated_value)}
                </span>
              </div>
            </div>

            {/* Info badges */}
            <div className="py-[10px] px-[14px]">
              <div className="flex gap-1.5 flex-wrap mb-2">
                {listings.location && (
                  <span className="text-xs bg-primary-soft px-2 py-1 rounded-lg">
                    📍 {listings.location}
                  </span>
                )}
                <span className="text-xs bg-primary-soft px-2 py-1 rounded-lg">
                  👋 0 Bids
                </span>
                <span className="text-xs bg-primary-soft px-2 py-1 rounded-lg">
                  🗓 {formatRelativeDate(listings.created_at)}
                </span>
              </div>

              {listings.expected_goods.length > 0 && (
                <div className="text-[13px] mb-1.5">
                  <strong>Expected Goods</strong>
                  <ul className="list-disc pl-[18px] mt-1">
                    {listings.expected_goods.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {listings.condition_notes && (
                <div className="text-[13px]">
                  <strong>Condition</strong>
                  <p className="mt-1">{listings.condition_notes}</p>
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}