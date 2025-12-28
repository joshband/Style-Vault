import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  X, 
  Palette, 
  Sparkles, 
  Layers, 
  Download,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

const ONBOARDING_KEY = "visual-dna-onboarded";

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const steps: OnboardingStep[] = [
  {
    icon: <Palette className="w-8 h-8" />,
    title: "Capture Visual Styles",
    description: "Upload any reference image and we'll extract its complete design DNA — colors, typography hints, spacing patterns, and mood characteristics."
  },
  {
    icon: <Layers className="w-8 h-8" />,
    title: "W3C Design Tokens",
    description: "Every style becomes a standards-compliant token set you can export to CSS, Tailwind, Figma, React, and 18+ other formats."
  },
  {
    icon: <Sparkles className="w-8 h-8" />,
    title: "AI-Powered Generation",
    description: "Generate new images in your captured style — mood boards, UI concepts, and more. Your visual language, infinitely applied."
  },
  {
    icon: <Download className="w-8 h-8" />,
    title: "Export Everywhere",
    description: "One-click exports for design tools, code frameworks, and game engines. Your style travels with your project."
  }
];

export function useOnboarding() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);
  
  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    setHasSeenOnboarding(seen === "true");
  }, []);

  const markOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setHasSeenOnboarding(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    setHasSeenOnboarding(false);
  };

  return { hasSeenOnboarding, markOnboardingComplete, resetOnboarding };
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleSkip}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
              aria-label="Close"
              data-testid="onboarding-close"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="p-8 pt-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="text-center space-y-6"
                >
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    {steps[currentStep].icon}
                  </div>
                  
                  <div className="space-y-3">
                    <h2 className="text-2xl font-serif font-medium">
                      {steps[currentStep].title}
                    </h2>
                    <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
                      {steps[currentStep].description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-center gap-2 mt-8">
                {steps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      index === currentStep 
                        ? "w-6 bg-primary" 
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    )}
                    aria-label={`Go to step ${index + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                <Button
                  variant="ghost"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                  className="gap-2"
                  data-testid="onboarding-prev"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </Button>

                <Button
                  onClick={handleNext}
                  className="gap-2"
                  data-testid="onboarding-next"
                >
                  {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                  {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function WelcomeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-6 mb-8"
    >
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
      
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="font-serif font-medium text-lg">Welcome to Visual DNA</h3>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
            Capture and manage visual styles as standards-based design tokens. Upload any image to extract its visual DNA, then export to 18+ formats.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

interface TooltipHintProps {
  id: string;
  content: string;
  position?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

const SEEN_HINTS_KEY = "visual-dna-seen-hints";

export function TooltipHint({ id, content, position = "top", children }: TooltipHintProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeen, setHasSeen] = useState(true);

  useEffect(() => {
    const seenHints = JSON.parse(localStorage.getItem(SEEN_HINTS_KEY) || "{}");
    setHasSeen(!!seenHints[id]);
  }, [id]);

  const handleDismiss = () => {
    const seenHints = JSON.parse(localStorage.getItem(SEEN_HINTS_KEY) || "{}");
    seenHints[id] = true;
    localStorage.setItem(SEEN_HINTS_KEY, JSON.stringify(seenHints));
    setHasSeen(true);
    setIsVisible(false);
  };

  useEffect(() => {
    if (!hasSeen) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [hasSeen]);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2"
  };

  return (
    <div className="relative inline-block">
      {children}
      <AnimatePresence>
        {isVisible && !hasSeen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={cn(
              "absolute z-50 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg",
              positionClasses[position]
            )}
          >
            <button
              onClick={handleDismiss}
              className="absolute -top-2 -right-2 p-1 rounded-full bg-muted hover:bg-muted-foreground/20 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <p className="text-sm text-muted-foreground">{content}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
