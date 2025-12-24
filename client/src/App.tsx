import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";

import Explore from "@/pages/Explore";
import Inspect from "@/pages/Inspect";
import Author from "@/pages/Author";
import Generate from "@/pages/Generate";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Explore} />
      <Route path="/style/:id" component={Inspect} />
      <Route path="/create" component={Author} />
      <Route path="/generate/:styleId" component={Generate} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary showHomeLink>
          <Toaster />
          <Router />
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
