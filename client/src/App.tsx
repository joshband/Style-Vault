import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Spinner } from "@/components/ui/spinner";
import NotFound from "@/pages/not-found";

const Explore = lazy(() => import("@/pages/Explore"));
const Inspect = lazy(() => import("@/pages/Inspect"));
const Author = lazy(() => import("@/pages/Author"));
const Generate = lazy(() => import("@/pages/Generate"));
const BatchUpload = lazy(() => import("@/pages/BatchUpload"));
const SharedStyle = lazy(() => import("@/pages/SharedStyle"));
const SavedStyles = lazy(() => import("@/pages/SavedStyles"));
const Remix = lazy(() => import("@/pages/Remix"));
const Creator = lazy(() => import("@/pages/Creator"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen" data-testid="page-loader">
      <Spinner className="size-8 text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Explore} />
        <Route path="/style/:id" component={Inspect} />
        <Route path="/shared/:code" component={SharedStyle} />
        <Route path="/create" component={Author} />
        <Route path="/generate/:styleId" component={Generate} />
        <Route path="/batch" component={BatchUpload} />
        <Route path="/saved" component={SavedStyles} />
        <Route path="/remix" component={Remix} />
        <Route path="/creator/:creatorId" component={Creator} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
