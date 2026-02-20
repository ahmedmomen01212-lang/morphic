import { getCurrentUserId } from '@/lib/auth/get-current-user'

import { Chat } from '@/components/chat'

export default async function Page() {
  console.log('[v0] Home page rendering...')
  try {
    const userId = await getCurrentUserId()
    console.log('[v0] Home page userId:', userId ?? 'null (guest)')
    return <Chat isGuest={!userId} />
  } catch (error) {
    console.error('[v0] Home page error:', error)
    return <Chat isGuest={true} />
  }
}
