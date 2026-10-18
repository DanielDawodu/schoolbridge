import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

const AccountantOrAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  if (!user || (user.role !== 'admin' && user.role !== 'accountant')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AccountantOrAdminRoute;
