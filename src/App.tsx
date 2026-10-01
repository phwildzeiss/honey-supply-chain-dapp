import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ConnectPage from './routes/ConnectPage'
import Dashboard from './routes/Dashboard'
import Apiaries from './routes/Apiaries'
import Harvest from './routes/Harvest'
import NewBatch from './routes/NewBatch'
import BatchDetail from './routes/BatchDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ConnectPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/apiaries" element={<Apiaries />} />
        <Route path="/harvest" element={<Harvest />} />
        <Route path="/batches/new" element={<NewBatch />} />
        <Route path="/batches/:batchId" element={<BatchDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
