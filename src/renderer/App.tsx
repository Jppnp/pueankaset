import React from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { SalePage } from './pages/SalePage'
import { StockPage } from './pages/StockPage'
import { HistoryPage } from './pages/HistoryPage'

export function App() {
  return (
    <HashRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<SalePage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
