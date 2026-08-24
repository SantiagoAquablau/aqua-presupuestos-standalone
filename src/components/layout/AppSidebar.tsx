import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  FilePlus,
  Package,
  Truck,
  Settings,
  LogOut,
  ChevronLeft,
  Shield,
  HardHat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";
import iconoAquablau from "@/assets/iconoAquablau.png";

type NavItem = {
  label: string;
  icon: any;
  path: string;
  roles?: Array<"admin" | "comercial" | "administrativa">;
};

const navItems: NavItem[] = [
  { label: "Tauler", icon: LayoutDashboard, path: "/" },
  { label: "Pressupostos", icon: FileText, path: "/pressupostos", roles: ["admin", "comercial"] },
  { label: "Control d'Obres", icon: HardHat, path: "/control-obres", roles: ["admin", "comercial", "administrativa"] },
  { label: "Nou Pressupost", icon: FilePlus, path: "/nou-pressupost", roles: ["admin", "comercial"] },
  { label: "Catàleg d'Articles", icon: Package, path: "/cataleg", roles: ["admin", "comercial"] },
  { label: "Preus Proveïdors", icon: Truck, path: "/proveidors", roles: ["admin"] },
  { label: "Configuració", icon: Settings, path: "/configuracio", roles: ["admin"] },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);

  const sidebarWidth = collapsed ? 72 : 260;
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
  }
  const { signOut, isAdmin, role, roles, profile } = useAuth();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r)),
  );

  return (
    <>
      <aside
        className={cn(
          "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 fixed top-0 left-0 h-screen overflow-y-auto z-50",
          collapsed ? "w-[72px]" : "w-[260px]",
        )}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 p-1">
            <img src={iconoAquablau} alt="Aquablau" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-base font-bold text-sidebar-foreground tracking-tight">Pressupostos</h1>
              <p className="text-[11px] text-sidebar-muted">Piscines Aquablau</p>
            </div>
          )}
        </div>

        {/* Role badge */}
        {!collapsed && role && (
          <div className="px-5 py-2">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                isAdmin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              <Shield className="w-3 h-3" />
              {ROLE_LABELS[role]}
            </div>
          </div>
        )}

        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  if (typeof window !== "undefined" && window.innerWidth < 1024) setCollapsed(true);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-left",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-sidebar-primary")} />
                {!collapsed && <span className="animate-fade-in flex-1 text-left">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          {!collapsed && profile && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {profile.full_name || profile.email}
              </p>
              <p className="text-[10px] text-sidebar-muted truncate">{profile.email}</p>
            </div>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Tancar sessió</span>}
          </button>
        </div>
      </aside>

      {/* Toggle button fixed outside sidebar, on the edge */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden md:flex fixed w-6 h-6 rounded-full bg-card border border-border items-center justify-center shadow-sm hover:bg-muted transition-all duration-300"
        style={{
          left: `${sidebarWidth - 12}px`,
          top: "120px",
          transform: "translateY(0)",
          zIndex: 100,
        }}
      >
        <ChevronLeft
          className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", collapsed && "rotate-180")}
        />
      </button>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 flex justify-around py-2 px-1">
        {visibleItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="truncate max-w-[60px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
