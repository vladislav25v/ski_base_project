import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib'

export const AdminPage = () => {
  const navigate = useNavigate()
  const adminUid = import.meta.env.VITE_ADMIN_UID as string | undefined
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }
      const user = data.session?.user
      if (!user) {
        navigate('/login', { replace: true })
        return
      }
      if (!adminUid || user.id !== adminUid) {
        navigate('/', { replace: true })
        return
      }
      setIsChecking(false)
    })

    return () => {
      isMounted = false
    }
  }, [adminUid, navigate])

  if (isChecking) {
    return <div>Checking access...</div>
  }

  return <div>Admin</div>
}
