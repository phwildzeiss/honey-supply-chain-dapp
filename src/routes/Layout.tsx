import { Navigate, Outlet } from 'react-router-dom'
import { useConnection } from 'wagmi'
import Header from '../components/Header'

function Layout() {
  const { isConnected } = useConnection()

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
