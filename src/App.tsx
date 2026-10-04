import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ConnectPage from './routes/ConnectPage'
import Layout from './routes/Layout'
import Dashboard from './routes/Dashboard'
import Apiaries from './routes/Apiaries'
import Harvest from './routes/Harvest'
import NewBatch from './routes/NewBatch'
import BatchDetail from './routes/BatchDetail'
import SubmitOrigin from './routes/SubmitOrigin'
import SubmitSi from './routes/SubmitSi'
import TransferCustody from './routes/TransferCustody'
import ProcessAndBottle from './routes/ProcessAndBottle'
import MyBatches from './routes/MyBatches'
import ConsumerView from './routes/ConsumerView'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ConnectPage />} />
        <Route path="/consumer" element={<ConsumerView />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/apiaries" element={<Apiaries />} />
          <Route path="/harvest" element={<Harvest />} />
          <Route path="/batches/new" element={<NewBatch />} />
          <Route path="/batches/:batchId" element={<BatchDetail />} />
          <Route path="/batches/:batchId/origin" element={<SubmitOrigin />} />
          <Route path="/batches/:batchId/si" element={<SubmitSi />} />
          <Route path="/batches/:batchId/transfer" element={<TransferCustody />} />
          <Route path="/batches/:batchId/bottle" element={<ProcessAndBottle />} />
          <Route path="/my-batches" element={<MyBatches />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
