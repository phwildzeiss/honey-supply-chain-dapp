import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ConnectPage from './routes/ConnectPage'
import Dashboard from './routes/Dashboard'
import Apiaries from './routes/Apiaries'
import Harvest from './routes/Harvest'
import NewBatch from './routes/NewBatch'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ConnectPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/apiaries" element={<Apiaries />} />
        <Route path="/harvest" element={<Harvest />} />
        <Route path="/batches/new" element={<NewBatch />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App
