'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [username, setUsername] = useState('')

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
      if (data) setUsername(data.username)
    }
    getProfile()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Verifier punya shell-nya sendiri, jadi Navbar utama gak perlu tampil di situ
  if (pathname?.startsWith('/verifier')) return null

  const navItems = [
    {
      label: 'Home',
      path: '/home',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
          <path d="M9 21V12h6v9"/>
        </svg>
      )
    },
    {
      label: 'Deals',
      path: '/deals',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
          <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
        </svg>
      )
    },
    {
      label: 'Profile',
      path: '/profile',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      )
    },
  ]

  const isActive = (path: string) => pathname === path

  return (
    <>
      {/* ======= DESKTOP SIDEBAR ======= */}
      <aside style={{
        display: 'none',
        position: 'fixed',
        top: 0, left: 0,
        width: '240px',
        height: '100vh',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        flexDirection: 'column',
        padding: '24px 16px',
        zIndex: 100,
      }} className="desktop-nav">
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '0 8px', marginBottom: '32px'
        }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'var(--primary)', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '800', fontSize: '16px', flexShrink: 0
          }}>T</div>
          <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>TREDIT-CARBONLESS</span>
        </div>

        {/* Nav items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '11px 12px', borderRadius: '10px', border: 'none',
                background: isActive(item.path) ? '#EDE9FB' : 'transparent',
                color: isActive(item.path) ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: isActive(item.path) ? '600' : '500',
                fontSize: '15px', cursor: 'pointer',
                transition: 'all 0.15s', textAlign: 'left', width: '100%'
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          {/* Add Pitch button */}
          <button
            onClick={() => router.push('/listing/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '11px 12px', borderRadius: '10px', border: 'none',
              background: isActive('/listing/new') ? 'var(--primary-dark)' : 'var(--primary)',
              color: 'white', fontWeight: '600', fontSize: '15px',
              cursor: 'pointer', transition: 'all 0.15s',
              textAlign: 'left', width: '100%', marginTop: '8px'
            }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v8M8 12h8"/>
            </svg>
            Add Pitch
          </button>
        </nav>

        {/* Bottom: username + logout */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          {username && (
            <p style={{
              fontSize: '13px', color: 'var(--text-muted)',
              padding: '0 8px', marginBottom: '8px'
            }}>@{username}</p>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '11px 12px', borderRadius: '10px', border: 'none',
              background: 'transparent', color: 'var(--danger)',
              fontWeight: '500', fontSize: '15px', cursor: 'pointer',
              transition: 'all 0.15s', textAlign: 'left', width: '100%'
            }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ======= MOBILE BOTTOM NAV ======= */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)',
      }} className="mobile-nav">
        {/* Nav items row */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '4px', padding: '10px 0',
                border: 'none', background: 'transparent',
                color: isActive(item.path) ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '11px', fontWeight: isActive(item.path) ? '600' : '400',
                cursor: 'pointer'
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          {/* Add Pitch */}
          <button
            onClick={() => router.push('/listing/new')}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '4px', padding: '10px 0',
              border: 'none', background: 'transparent',
              color: isActive('/listing/new') ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '11px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            <div style={{
              width: '36px', height: '36px',
              background: 'var(--primary)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', marginBottom: '2px'
            }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            Add Pitch
          </button>
        </div>

        {/* Logout row */}
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px',
              padding: '10px', border: 'none', background: 'transparent',
              color: 'var(--danger)', fontSize: '13px', fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </nav>
    </>
  )
}