import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export default async function RootPage() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  
  // Cek apakah ada Supabase session cookie
  const hasSession = allCookies.some(c => 
    c.name.includes('sb-') && c.name.includes('-auth-token')
  )
  
  if (hasSession) {
    redirect('/home')
  } else {
    redirect('/signup')
  }
}