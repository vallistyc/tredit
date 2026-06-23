'use client'
 
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
 
export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    username: '',
    password: '',
  })
 
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }
 
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
 
    // Translate username → email (sekalian ambil is_verifier)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, is_verifier')
      .eq('username', form.username)
      .single()
 
    if (profileError || !profile?.email) {
      setError('Username tidak ditemukan')
      setLoading(false)
      return
    }
 
    // Login pakai email hasil lookup — HARUS sukses dulu sebelum redirect
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: form.password,
    })
 
    if (signInError) {
      setError('Password salah')
      setLoading(false)
      return
    }
 
    if (profile.is_verifier) {
      router.push('/verifier')
    } else {
      router.push('/home')
    }
  }
 
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'var(--bg)'
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px'
          }}>
            <div style={{
              width: '36px', height: '36px',
              background: 'var(--primary)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: '800', fontSize: '18px'
            }}>T</div>
            <span style={{ fontSize: '26px', fontWeight: '800', color: 'var(--primary)' }}>
              TREDIT
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Barter branded goods, tanpa ribet
          </p>
        </div>
 
        {/* Card */}
        <div className="card" style={{ padding: '28px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px' }}>
            Login
          </h1>
 
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Username
              </label>
              <input
                className="input-field"
                name="username"
                type="text"
                placeholder="johndoe123"
                value={form.username}
                onChange={handleChange}
                required
              />
            </div>
 
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Password
              </label>
              <input
                className="input-field"
                name="password"
                type="password"
                placeholder="Password kamu"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
 
            {error && <p className="error-text">{error}</p>}
 
            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{ marginTop: '4px' }}
            >
              {loading ? 'Masuk...' : 'Login'}
            </button>
          </form>
 
          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
            Belum punya akun?{' '}
            <a href="/signup" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
              Daftar
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}