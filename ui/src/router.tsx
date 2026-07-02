import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import RutaProtegida from './components/RutaProtegida'
import RootLayout from './layouts/RootLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Facturas from './pages/Facturas'
import NuevaFactura from './pages/NuevaFactura'
import Medicamentos from './pages/Medicamentos'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'facturas', element: <Facturas /> },
          { path: 'facturas/nueva', element: <NuevaFactura /> },
          { path: 'medicamentos', element: <Medicamentos /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
