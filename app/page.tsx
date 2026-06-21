'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    checkAuthAndRedirect()
  }, [])

  async function checkAuthAndRedirect() {
    const { data } = await supabase.auth.getSession()

    if (data.session) {
      // Sudah pernah login -> langsung ke /home
      router.push('/home')
    } else {
      // Belum login -> ke /signup
      router.push('/signup')
    }
  }

  // Tampilan sementara selagi proses cek auth berjalan
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <p>Memuat...</p>
    </div>
  )
}