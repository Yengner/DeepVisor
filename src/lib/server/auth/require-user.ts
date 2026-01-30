import 'server-only'

import { redirect } from 'next/navigation'
import { createServerClient } from '../supabase/server'

export async function requireUser(redirectTo: string = '/login') {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect(redirectTo)
  }

  return user
}
