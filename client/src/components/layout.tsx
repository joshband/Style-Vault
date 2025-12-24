import { Link, useLocation } from "wouter";
import { Compass, PenTool, Layers, Search, Settings, Menu, X, Eye, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type AppMode = "explore" | "inspect" | "author" | "generate";

function getCurrentMode(path: string): AppMode {
  if (path.startsWith("/style/")) return "inspect";
  if (path.startsWith("/generate/")) return "generate";
  if (path === "/create") return "author";
  return "explore";
}

const modeLabels: Record<AppMode, string> = {
  explore: "Explore",
  inspect: "Inspect",
  author: "Create",
  generate: "Generate",
};

const modeDescriptions: Record<AppMode, string> = {
  explore: "Browse and discover styles",
  inspect: "Analyze style details",
  author: "Create a new style",
  generate: "Generate with a style",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const currentMode = getCurrentMode(location);

  const navItems = [
    { href: "/", label: "Explore", icon: Compass, mode: "explore" as AppMode },
    { href: "/create", label: "Create", icon: PenTool, mode: "author" as AppMode },
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
              const isActive = currentMode === item.mode;
              
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  data-testid={`nav-${item.mode}`}
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
            
            {/* Contextual mode indicators for Inspect and Generate */}
            {(currentMode === "inspect" || currentMode === "generate") && (
              <div className="mt-4 pt-4 border-t border-sidebar-border">
                <div className="px-3 py-2 text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
                  Current Mode
                </div>
                <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md bg-sidebar-primary/50 text-sidebar-primary-foreground">
                  {currentMode === "inspect" ? <Eye size={18} /> : <Wand2 size={18} />}
                  <span className="hidden sm:inline">{modeLabels[currentMode]}</span>
                </div>
              </div>
            )}
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
