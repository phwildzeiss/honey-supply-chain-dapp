import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ConnectPage from './routes/ConnectPage'
import Dashboard from './routes/Dashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ConnectPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
