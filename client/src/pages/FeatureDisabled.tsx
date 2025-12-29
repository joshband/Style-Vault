import { Layout } from "@/components/layout";
import { Lock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

interface FeatureDisabledProps {
  featureName?: string;
}

export default function FeatureDisabled({ featureName = "This feature" }: FeatureDisabledProps) {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-serif font-medium mb-2">
          {featureName} is Currently Disabled
        </h1>
        <p className="text-muted-foreground max-w-md mb-6">
          We're refactoring the application to improve quality and reliability. 
          This feature will be re-enabled soon.
        </p>
        <Button asChild>
          <Link href="/">Return to Style Vault</Link>
        </Button>
      </div>
    </Layout>
  );
}
