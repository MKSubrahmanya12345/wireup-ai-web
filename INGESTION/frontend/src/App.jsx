import './App.css'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import AdminIngestionPage from './pages/AdminIngestionPage.jsx'

function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <header className="topbar">
          <div className="brand">WireUp Admin</div>
          <nav className="nav">
            <Link to="/admin/ingestion">Component Ingestion</Link>
          </nav>
        </header>
        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/admin/ingestion" replace />} />
            <Route path="/admin/ingestion" element={<AdminIngestionPage />} />
            <Route path="*" element={<Navigate to="/admin/ingestion" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
