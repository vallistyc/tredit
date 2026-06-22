'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username: username,
          whatsapp_number: whatsappNumber,
        },
      },
    })

    setLoading(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }

    router.push('/login')
  }

  return (
    <div className="max-w-[400px] mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Daftar TREDIT</h1>

      <form onSubmit={handleSignup}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Nama Lengkap</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

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
          <label className="block text-sm font-medium mb-1">Nomor WhatsApp</label>
          <input
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="08123456789"
            required
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            minLength={6}
            className="w-full border border-line rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {errorMsg && <p className="text-red-600 text-sm mb-4">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mb-2 mt-5 w-full bg-[#4b00dc] text-amber-500 font-semibold py-3 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-default"
        >
          {loading ? 'Mendaftar...' : 'Daftar'}
        </button>
        <button className='w-full border-2 border-[#4b00dc] text-[#4b00dc] font-semibold py-3 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-default'>
          <Link
          href="/login">
            Log In
          </Link>
        </button>
      </form>
    </div>
  )
}