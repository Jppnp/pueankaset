import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RoleProvider, useRole } from './contexts/RoleContext'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { AuthScreen } from './components/auth/AuthScreen'
import { Sidebar } from './components/layout/Sidebar'
import { SalePage } from './pages/SalePage'
import { StockPage } from './pages/StockPage'
import { HistoryPage } from './pages/HistoryPage'
import { DashboardPage } from './pages/DashboardPage'
import { CustomerPage } from './pages/CustomerPage'
import { ExpensePage } from './pages/ExpensePage'
import { MonthlyReportPage } from './pages/MonthlyReportPage'

function AppRoutes() {
  const { role, isOwner } = useRole()

  if (!role) {
    return <AuthScreen />
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<SalePage />} />
          <Route
            path="/stock"
            element={isOwner ? <StockPage /> : <Navigate to="/" replace />}
          />
          <Route path="/history" element={<HistoryPage />} />
          <Route
            path="/customers"
            element={isOwner ? <CustomerPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/expenses"
            element={isOwner ? <ExpensePage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/report"
            element={isOwner ? <MonthlyReportPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/dashboard"
            element={isOwner ? <DashboardPage /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <RoleProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </RoleProvider>
    </ErrorBoundary>
  )
}
