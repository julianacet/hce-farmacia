import { createBrowserRouter, RouterProvider, Navigate } from 'react-router'
import RutaProtegida from './components/RutaProtegida'
import RootLayout from './layouts/RootLayout'
import Login from './pages/Login'
import Facturas from './pages/Facturas'
import NuevaFactura from './pages/NuevaFactura'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, element: <Navigate to="/facturas" replace /> },
          { path: 'facturas', element: <Facturas /> },
          { path: 'facturas/nueva', element: <NuevaFactura /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/facturas" replace /> },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
