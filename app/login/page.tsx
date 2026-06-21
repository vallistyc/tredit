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
      router.push('/verifier')
    } else {
      router.push('/home')
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
      <h1>Masuk TREDIT</h1>

      <form onSubmit={handleLogin}>
        <div>
          <label>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Masuk...' : 'Masuk'}
        </button>
      </form>

      <p>
        Belum punya akun? <a href="/signup">Daftar di sini</a>
      </p>
    </div>
  )
}