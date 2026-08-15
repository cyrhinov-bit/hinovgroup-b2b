import React, { useEffect } from 'react';
import { Topbar } from './Topbar';
import { Sidebar } from './Sidebar';
import { Outlet, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export function Layout() {
  const location = useLocation();
  const { posWorkspace, setPosWorkspace } = useAppContext();

  useEffect(() => {
    const isPosRoute = location.pathname.startsWith('/pos');
    if (posWorkspace.active !== isPosRoute) {
      setPosWorkspace({ active: isPosRoute });
    }
  }, [location.pathname, posWorkspace.active, setPosWorkspace]);

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <div className="page-wrapper">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
