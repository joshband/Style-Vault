import { Link, useLocation } from "wouter";
import { Grid, Plus, Wand2, Layers, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Explorer", icon: Grid },
    { href: "/create", label: "Authoring", icon: Plus },
    { href: "/generate", label: "Application", icon: Wand2 },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col justify-between p-4 flex-shrink-0">
        <div>
          <div className="mb-8 px-2 flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center rounded-sm">
              <Layers size={18} />
            </div>
            <span className="font-serif font-bold text-lg tracking-tight">Style Explorer</span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              
              return (
                <Link key={item.href} href={item.href}>
                  <a className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}>
                    <Icon size={18} />
                    {item.label}
                  </a>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-1 pt-4 border-t border-sidebar-border">
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
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
         {/* Top Bar (Contextual) */}
         <header className="h-14 border-b border-border flex items-center justify-between px-6 flex-shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-4 w-full max-w-md">
              <Search className="text-muted-foreground" size={16} />
              <input 
                type="text" 
                placeholder="Search styles, tokens, or tags..." 
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                JD
              </div>
            </div>
         </header>

         <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
            {children}
         </div>
      </main>
    </div>
  );
}
