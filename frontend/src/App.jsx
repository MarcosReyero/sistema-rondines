import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated, isSupervisor } from './lib/auth'

import Login from './views/vigilante/Login'
import MisRondas from './views/vigilante/MisRondas'
import EjecucionRonda from './views/vigilante/EjecucionRonda'
import ScanCheckpoint from './views/vigilante/ScanCheckpoint'

import SupervisorLayout from './views/supervisor/SupervisorLayout'
import Dashboard from './views/supervisor/Dashboard'
import MapaInstalacion from './views/supervisor/MapaInstalacion'
import GestionQR from './views/supervisor/GestionQR'
import GestionRondas from './views/supervisor/GestionRondas'
import RegistroRondines from './views/supervisor/RegistroRondines'
import Vigilantes from './views/supervisor/Vigilantes'

function RequireAuth({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return children
}

function RequireSupervisor({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (!isSupervisor()) return <Navigate to="/rondas" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Vigilante */}
        <Route path="/rondas" element={<RequireAuth><MisRondas /></RequireAuth>} />
        <Route path="/ejecucion/:id" element={<RequireAuth><EjecucionRonda /></RequireAuth>} />
        <Route path="/check/:uuid" element={<RequireAuth><ScanCheckpoint /></RequireAuth>} />

        {/* Supervisor */}
        <Route path="/supervisor" element={<RequireSupervisor><SupervisorLayout /></RequireSupervisor>}>
          <Route index element={<Dashboard />} />
          <Route path="instalaciones" element={<MapaInstalacion />} />
          <Route path="instalaciones/:id" element={<MapaInstalacion />} />
          <Route path="qr" element={<GestionQR />} />
          <Route path="rondas" element={<GestionRondas />} />
          <Route path="registro" element={<RegistroRondines />} />
          <Route path="vigilantes" element={<Vigilantes />} />
        </Route>

        <Route path="/" element={
          isAuthenticated()
            ? isSupervisor() ? <Navigate to="/supervisor" replace /> : <Navigate to="/rondas" replace />
            : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
