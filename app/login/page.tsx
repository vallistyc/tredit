'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    // Step 1: cari email berdasarkan username yang diketik (sekalian ambil is_verifier buat redirect nanti)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, is_verifier')
      .eq('username', username)
      .single()

    if (profileError || !profile) {
      setLoading(false)
      setErrorMsg('Username tidak ditemukan')
      return
    }

    // Step 2: baru login pakai email hasil pencarian + password
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    })

    setLoading(false)

    if (loginError) {
      setErrorMsg('Password salah')
      return
    }

    // Berhasil login -> Verifikator ke dashboard verifikasi, user biasa ke Home
    if (profile.is_verifier) {
      router.refresh()
      router.push('/verifier')
    } else {
      router.refresh()
      router.push('/home')
    }
  }

  return (
    <div className="max-w-[400px] mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Masuk TREDIT</h1>

      <form onSubmit={handleLogin}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#4b00dc] text-amber-500 font-medium py-3 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {loading ? 'Masuk...' : 'Masuk'}
        </button>
      </form>

      <p className="mt-4 text-sm text-center">
        Belum punya akun?{' '}
        <a href="/signup" className="text-primary underline">
          Daftar di sini
        </a>
      </p>
    </div>
  )
}