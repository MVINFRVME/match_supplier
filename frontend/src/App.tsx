import { useCallback, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ComparePage } from './pages/ComparePage'
import { HomePage } from './pages/HomePage'
import { ShortlistPage } from './pages/ShortlistPage'
import { SupplierPage } from './pages/SupplierPage'
import { loadCompareIds, loadShortlist } from './storage'

export default function App() {
  const [compareCount, setCompareCount] = useState(() => loadCompareIds().length)
  const [shortlistCount, setShortlistCount] = useState(() => loadShortlist().length)

  const refreshCounters = useCallback(() => {
    setCompareCount(loadCompareIds().length)
    setShortlistCount(loadShortlist().length)
  }, [])

  return (
    <BrowserRouter>
      <Layout compareCount={compareCount} shortlistCount={shortlistCount}>
        <Routes>
          <Route path="/" element={<HomePage onChange={refreshCounters} />} />
          <Route path="/suppliers/:id" element={<SupplierPage onChange={refreshCounters} />} />
          <Route path="/compare" element={<ComparePage onChange={refreshCounters} />} />
          <Route path="/shortlist" element={<ShortlistPage onChange={refreshCounters} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
