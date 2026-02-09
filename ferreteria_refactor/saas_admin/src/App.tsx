import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Tenants from './pages/Tenants';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Cargando sesión...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Dashboard Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={
              <div className="p-8 text-center max-w-2xl mx-auto mt-10">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Bienvenido al Panel SaaS</h1>
                <p className="text-gray-600 text-lg">
                  Aquí podrás gestionar todas las empresas (tenants), usuarios y configuraciones globales
                  de la plataforma Ferretería Enterprise.
                </p>
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                  <p className="font-semibold">👈 Comienza seleccionando "Empresas" en el menú lateral.</p>
                </div>
              </div>
            } />
            <Route path="tenants" element={<Tenants />} />
          </Route>

          {/* Redirect root to dashboard (which handles auth) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
