'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    whatsapp_number: '',
    email: '',
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

    // Validasi username: huruf kecil, angka, underscore saja
    if (!/^[a-z0-9_]+$/.test(form.username)) {
      setError('Username hanya boleh huruf kecil, angka, dan underscore (_)')
      setLoading(false)
      return
    }

    // Cek username sudah dipakai belum
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', form.username)
      .single()

    if (existing) {
      setError('Username sudah dipakai, coba yang lain')
      setLoading(false)
      return
    }

    // Daftar ke Supabase Auth
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username,
          full_name: form.full_name,
          whatsapp_number: form.whatsapp_number,
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    router.push('/home')
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
            Buat Akun
          </h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Nama Lengkap
              </label>
              <input
                className="input-field"
                name="full_name"
                type="text"
                placeholder="John Doe"
                value={form.full_name}
                onChange={handleChange}
                required
              />
            </div>

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
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Huruf kecil, angka, underscore saja
              </p>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Nomor WhatsApp
              </label>
              <input
                className="input-field"
                name="whatsapp_number"
                type="tel"
                placeholder="08123456789"
                value={form.whatsapp_number}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Email
              </label>
              <input
                className="input-field"
                name="email"
                type="email"
                placeholder="john@email.com"
                value={form.email}
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
                placeholder="Minimal 6 karakter"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button
              className="btn-primary"
              type="submit"
              disabled={loading}
              style={{ marginTop: '4px' }}
            >
              {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
            Sudah punya akun?{' '}
            <a href="/login" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}