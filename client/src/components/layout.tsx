import { Link, useLocation } from "wouter";
import { Compass, PenTool, Search, Settings, Menu, X, Eye, Wand2, LogIn, LogOut, User, Bookmark, Sparkles } from "lucide-react";
import logoUrl from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ActiveJobsIndicator } from "./active-jobs-indicator";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AppMode = "explore" | "inspect" | "author" | "generate" | "remix";

function getCurrentMode(path: string): AppMode {
  if (path.startsWith("/style/")) return "inspect";
  if (path.startsWith("/generate/")) return "generate";
  if (path === "/create") return "author";
  if (path === "/remix") return "remix";
  return "explore";
}

const modeLabels: Record<AppMode, string> = {
  explore: "Explore",
  inspect: "Inspect",
  author: "Create",
  generate: "Generate",
  remix: "Remix",
};

const modeDescriptions: Record<AppMode, string> = {
  explore: "Browse and discover styles",
  inspect: "Analyze style details",
  author: "Create a new style",
  generate: "Generate with a style",
  remix: "Blend styles together",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  
  const currentMode = getCurrentMode(location);

  const navItems = [
    { href: "/", label: "Explore", icon: Compass, mode: "explore" as AppMode },
    { href: "/create", label: "Create", icon: PenTool, mode: "author" as AppMode },
    { href: "/remix", label: "Remix", icon: Sparkles, mode: "remix" as AppMode },
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
            <Link href="/" className="flex items-center gap-2">
              <img src={logoUrl} alt="Visual DNA Studio" className="h-10 w-auto" />
            </Link>
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
            
            <div className="flex items-center gap-3 ml-auto">
              <ActiveJobsIndicator />
              
              {authLoading ? (
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
              ) : isAuthenticated && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="user-menu-trigger">
                      <Avatar className="h-8 w-8">
                        {user.profileImageUrl ? (
                          <AvatarImage src={user.profileImageUrl} alt={user.firstName || user.email || "User"} />
                        ) : null}
                        <AvatarFallback>
                          {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || <User size={14} />}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/saved" className="flex items-center gap-2 cursor-pointer" data-testid="library-link">
                        <Bookmark size={14} />
                        My Library
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/api/logout" className="flex items-center gap-2 cursor-pointer" data-testid="logout-button">
                        <LogOut size={14} />
                        Sign out
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" size="sm" asChild data-testid="login-button">
                  <a href="/api/login" className="flex items-center gap-2">
                    <LogIn size={14} />
                    <span className="hidden sm:inline">Sign in</span>
                  </a>
                </Button>
              )}
            </div>
         </header>

         <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full overflow-auto">
            {children}
         </div>
      </main>
    </div>
  );
}
