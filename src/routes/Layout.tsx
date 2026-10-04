import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useConnection } from 'wagmi'
import Header from '../components/Header'

function Layout() {
  const { isConnected, address } = useConnection()
  const navigate = useNavigate()
  const previousAddress = useRef(address)

  useEffect(() => {
    if (previousAddress.current && address && previousAddress.current !== address) {
      navigate('/dashboard')
    }
    previousAddress.current = address
  }, [address])

  if (!isConnected) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <Header />
      <Outlet />
    </>
  )
}

export default Layout
