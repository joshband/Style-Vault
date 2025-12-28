import { createContext, useContext, type ReactNode } from 'react';
import { 
  defaultFeatureFlags, 
  isFeatureEnabled, 
  type FeatureFlags 
} from '@shared/featureFlags';

interface FeatureFlagContextValue {
  flags: FeatureFlags;
  isEnabled: (key: keyof FeatureFlags) => boolean;
  isAnyEnabled: (keys: (keyof FeatureFlags)[]) => boolean;
  isAllEnabled: (keys: (keyof FeatureFlags)[]) => boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const value: FeatureFlagContextValue = {
    flags: defaultFeatureFlags,
    isEnabled: (key) => isFeatureEnabled(key),
    isAnyEnabled: (keys) => keys.some(key => isFeatureEnabled(key)),
    isAllEnabled: (keys) => keys.every(key => isFeatureEnabled(key)),
  };

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
}

export function useFeatureFlag(key: keyof FeatureFlags): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(key);
}

interface FeatureGateProps {
  flag: keyof FeatureFlags;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(flag);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

interface MultiFeatureGateProps {
  flags: (keyof FeatureFlags)[];
  requireAll?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

export function MultiFeatureGate({ 
  flags, 
  requireAll = true, 
  children, 
  fallback = null 
}: MultiFeatureGateProps) {
  const { isAnyEnabled, isAllEnabled } = useFeatureFlags();
  const isEnabled = requireAll ? isAllEnabled(flags) : isAnyEnabled(flags);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}
