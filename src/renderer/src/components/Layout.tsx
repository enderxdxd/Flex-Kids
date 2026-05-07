import React, { ReactNode } from 'react';
import Navbar from './Navbar';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main
        className="p-6 min-h-screen transition-[margin] duration-200"
        style={{ marginLeft: 'var(--sidebar-w-current)' }}
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;
