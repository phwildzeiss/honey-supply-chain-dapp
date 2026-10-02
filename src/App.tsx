import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ConnectPage from './routes/ConnectPage'
import Layout from './routes/Layout'
import Dashboard from './routes/Dashboard'
import Apiaries from './routes/Apiaries'
import Harvest from './routes/Harvest'
import NewBatch from './routes/NewBatch'
import BatchDetail from './routes/BatchDetail'
import SubmitOrigin from './routes/SubmitOrigin'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ConnectPage />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/apiaries" element={<Apiaries />} />
          <Route path="/harvest" element={<Harvest />} />
          <Route path="/batches/new" element={<NewBatch />} />
          <Route path="/batches/:batchId" element={<BatchDetail />} />
          <Route path="/batches/:batchId/origin" element={<SubmitOrigin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
