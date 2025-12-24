import { Link, useLocation } from "wouter";
import { Grid, Plus, Layers, Search, Settings, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Explorer", icon: Grid },
    { href: "/create", label: "Authoring", icon: Plus },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden flex-col md:flex-row">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:relative w-64 h-screen border-r border-sidebar-border bg-sidebar flex flex-col justify-between p-4 flex-shrink-0 z-40 transform transition-transform md:transform-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div>
          <div className="mb-8 px-2 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center rounded-sm flex-shrink-0">
                <Layers size={18} />
              </div>
              <span className="font-serif font-bold text-lg tracking-tight hidden sm:inline">Style Explorer</span>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1 pt-4 border-t border-sidebar-border hidden sm:block">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors text-left">
            <Settings size={18} />
            Settings
          </button>
          <div className="px-3 py-2 text-xs text-muted-foreground/60 font-mono mt-4">
            v1.0.0-alpha
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0 w-full">
         {/* Top Bar (Contextual) */}
         <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 flex-shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-muted-foreground hover:text-foreground mr-2"
            >
              <Menu size={20} />
            </button>
            
            <div className="flex items-center gap-2 md:gap-4 w-full max-w-md">
              <Search className="text-muted-foreground flex-shrink-0" size={16} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent border-none outline-none text-xs sm:text-sm w-full placeholder:text-muted-foreground/60"
              />
            </div>
         </header>

         <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full overflow-auto">
            {children}
         </div>
      </main>
    </div>
  );
}
