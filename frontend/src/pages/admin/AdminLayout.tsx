import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ListOrdered,
  FileSpreadsheet,
  Printer,
  Coins,
  CreditCard,
  Users,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  ExternalLink,
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/queue', label: 'Live Queue', icon: ListOrdered },
    { path: '/admin/orders', label: 'All Orders', icon: FileSpreadsheet },
    { path: '/admin/printers', label: 'Printers', icon: Printer },
    { path: '/admin/pricing', label: 'Pricing', icon: Coins },
    { path: '/admin/payments', label: 'Payments', icon: CreditCard },
    { path: '/admin/customers', label: 'Customers', icon: Users },
    { path: '/admin/reports', label: 'Reports', icon: BarChart3 },
    { path: '/admin/staff', label: 'Staff Management', icon: UserCog },
    { path: '/admin/settings', label: 'Shop Settings', icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('printflow_admin_token');
    localStorage.removeItem('printflow_admin_user');
    navigate('/admin/login');
  };

  const adminUser = JSON.parse(localStorage.getItem('printflow_admin_user') || '{}');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 -ml-2 rounded-lg text-slate-300 hover:text-white"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="font-black text-sm tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>PrintFlow Admin</span>
          </div>
        </div>
        <Link to="/" target="_blank" className="p-2 text-slate-400 hover:text-white" title="Customer Storefront">
          <ExternalLink className="w-4 h-4" />
        </Link>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link to="/admin/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
              PF
            </div>
            <div>
              <div className="font-bold text-white text-sm leading-tight">PrintFlow</div>
              <div className="text-[11px] text-slate-400 font-medium">{adminUser?.shop?.name || 'Express Xerox'}</div>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items (1-10) */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer with Logout (11) */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{adminUser?.name || 'Shop Admin'}</div>
              <div className="text-[10px] text-slate-400 truncate">{adminUser?.email || 'admin@printflow.com'}</div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Link
              to="/"
              target="_blank"
              className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold text-center flex items-center justify-center gap-1.5 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Storefront</span>
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
