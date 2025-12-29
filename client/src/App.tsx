import { lazy, Suspense, useState, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { initializeExporters } from "@/lib/exporters";
import { OnboardingModal, useOnboarding } from "@/components/onboarding";
import { FeatureFlagProvider, useFeatureFlag } from "@/lib/feature-flags";
import NotFound from "@/pages/not-found";
import FeatureDisabled from "@/pages/FeatureDisabled";

initializeExporters();

const Explore = lazy(() => import("@/pages/Explore"));
const Inspect = lazy(() => import("@/pages/Inspect"));
const Author = lazy(() => import("@/pages/Author"));
const Generate = lazy(() => import("@/pages/Generate"));
const BatchUpload = lazy(() => import("@/pages/BatchUpload"));
const SharedStyle = lazy(() => import("@/pages/SharedStyle"));
const SavedStyles = lazy(() => import("@/pages/SavedStyles"));
const Remix = lazy(() => import("@/pages/Remix"));
const Creator = lazy(() => import("@/pages/Creator"));
const Compare = lazy(() => import("@/pages/Compare"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Tools = lazy(() => import("@/pages/Tools"));
const Admin = lazy(() => import("@/pages/Admin"));
const Features = lazy(() => import("@/pages/features"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen" data-testid="page-loader">
      <Spinner className="size-8 text-primary" />
    </div>
  );
}

function FeatureGatedRoute({ 
  flag, 
  component: Component,
  featureName 
}: { 
  flag: Parameters<typeof useFeatureFlag>[0];
  component: React.ComponentType;
  featureName: string;
}) {
  const isEnabled = useFeatureFlag(flag);
  return isEnabled ? <Component /> : <FeatureDisabled featureName={featureName} />;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Always enabled - Style Vault */}
        <Route path="/" component={Explore} />
        
        {/* Feature-gated routes */}
        <Route path="/style/:id">
          <FeatureGatedRoute flag="inspect.enabled" component={Inspect} featureName="Style Inspector" />
        </Route>
        <Route path="/shared/:code">
          <FeatureGatedRoute flag="sharing.enabled" component={SharedStyle} featureName="Style Sharing" />
        </Route>
        <Route path="/create">
          <FeatureGatedRoute flag="create.enabled" component={Author} featureName="Style Creation" />
        </Route>
        <Route path="/generate/:styleId">
          <FeatureGatedRoute flag="generate.enabled" component={Generate} featureName="Image Generation" />
        </Route>
        <Route path="/batch">
          <FeatureGatedRoute flag="batch.enabled" component={BatchUpload} featureName="Batch Upload" />
        </Route>
        <Route path="/saved">
          <FeatureGatedRoute flag="library.enabled" component={SavedStyles} featureName="My Library" />
        </Route>
        <Route path="/remix">
          <FeatureGatedRoute flag="remix.enabled" component={Remix} featureName="Style Remix" />
        </Route>
        <Route path="/creator/:creatorId">
          <FeatureGatedRoute flag="creator.enabled" component={Creator} featureName="Creator Profiles" />
        </Route>
        <Route path="/compare">
          <FeatureGatedRoute flag="compare.enabled" component={Compare} featureName="Style Comparison" />
        </Route>
        <Route path="/analytics">
          <FeatureGatedRoute flag="analytics.enabled" component={Analytics} featureName="Analytics" />
        </Route>
        <Route path="/tools">
          <FeatureGatedRoute flag="tools.enabled" component={Tools} featureName="Design Tools" />
        </Route>
        <Route path="/admin">
          <FeatureGatedRoute flag="admin.enabled" component={Admin} featureName="Admin Dashboard" />
        </Route>
        <Route path="/features">
          <FeatureGatedRoute flag="features.enabled" component={Features} featureName="Features" />
        </Route>
        
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { hasSeenOnboarding, markOnboardingComplete } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, [hasSeenOnboarding]);

  const handleClose = () => {
    markOnboardingComplete();
    setShowOnboarding(false);
  };

  return (
    <>
      {children}
      <OnboardingModal isOpen={showOnboarding} onClose={handleClose} />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FeatureFlagProvider>
        <TooltipProvider>
          <ErrorBoundary showHomeLink>
            <Toaster position="bottom-right" richColors closeButton />
            <OnboardingWrapper>
              <Router />
            </OnboardingWrapper>
          </ErrorBoundary>
        </TooltipProvider>
      </FeatureFlagProvider>
    </QueryClientProvider>
  );
}

export default App;
