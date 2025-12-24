import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Explorer from "@/pages/Explorer";
import StyleDetail from "@/pages/StyleDetail";
import Authoring from "@/pages/Authoring";
import Generation from "@/pages/Generation";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Explorer} />
      <Route path="/style/:id" component={StyleDetail} />
      <Route path="/create" component={Authoring} />
      <Route path="/generate" component={Generation} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
