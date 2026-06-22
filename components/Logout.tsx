// components/Logout.tsx
'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Logout({ onClose }: { onClose?: () => void }) {
  const router = useRouter()

  const handleLogout = async () => {
    onClose?.()
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="bg-red-500 text-white font-semibold px-4 py-2 rounded-lg cursor-pointer hover:bg-red-600"
    >
      Keluar
    </button>
  )
}