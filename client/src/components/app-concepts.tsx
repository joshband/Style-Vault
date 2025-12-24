import { StyleTheme } from "@/hooks/useStyleTheme";
import { cn } from "@/lib/utils";
import { 
  BarChart3, Users, DollarSign, TrendingUp, 
  ArrowRight, Play, Star, Check, Menu, 
  User, Lock, Mail, Eye, EyeOff
} from "lucide-react";
import { useState } from "react";

interface AppConceptsProps {
  theme: StyleTheme;
  className?: string;
}

function DashboardConcept({ theme }: { theme: StyleTheme }) {
  const stats = [
    { label: "Total Users", value: "12,847", icon: Users, change: "+12%" },
    { label: "Revenue", value: "$48,290", icon: DollarSign, change: "+8%" },
    { label: "Growth", value: "23.5%", icon: TrendingUp, change: "+5%" },
    { label: "Active", value: "1,429", icon: BarChart3, change: "+18%" },
  ];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: theme.colors.background,
        boxShadow: theme.shadows.md,
      }}
      data-testid="concept-dashboard"
    >
      <div
        className="px-4 py-3 flex items-center justify-between border-b"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.neutral,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 flex items-center justify-center font-bold text-white text-sm"
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
              fontFamily: theme.typography.fontSerif,
            }}
          >
            D
          </div>
          <span
            className="font-medium"
            style={{
              fontFamily: theme.typography.fontSans,
              fontSize: theme.typography.fontSizes.sm,
              color: theme.colors.primary,
            }}
          >
            Dashboard
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 flex items-center justify-center"
            style={{
              backgroundColor: theme.colors.secondary,
              borderRadius: theme.borderRadius.full,
            }}
          >
            <User size={12} className="text-white" />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-3"
              style={{
                backgroundColor: theme.colors.surface,
                borderRadius: theme.borderRadius.lg,
                boxShadow: theme.shadows.xs,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <stat.icon size={16} style={{ color: theme.colors.secondary }} />
                <span
                  className="text-xs font-medium"
                  style={{ color: theme.colors.accent }}
                >
                  {stat.change}
                </span>
              </div>
              <div
                className="font-bold"
                style={{
                  fontFamily: theme.typography.fontSans,
                  fontSize: theme.typography.fontSizes.lg,
                  color: theme.colors.primary,
                }}
              >
                {stat.value}
              </div>
              <div
                className="mt-0.5"
                style={{
                  fontFamily: theme.typography.fontSans,
                  fontSize: theme.typography.fontSizes.xs,
                  color: theme.colors.secondary,
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div
          className="h-24 flex items-end justify-between px-2"
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
          }}
        >
          {[40, 65, 45, 80, 55, 90, 70].map((height, i) => (
            <div
              key={i}
              className="w-6 transition-all"
              style={{
                height: `${height}%`,
                backgroundColor: i === 5 ? theme.colors.accent : theme.colors.primary,
                opacity: i === 5 ? 1 : 0.6,
                borderRadius: `${theme.borderRadius.sm} ${theme.borderRadius.sm} 0 0`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketingHeroConcept({ theme }: { theme: StyleTheme }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
        boxShadow: theme.shadows.md,
      }}
      data-testid="concept-marketing"
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div
            className="font-bold text-white"
            style={{
              fontFamily: theme.typography.fontSerif,
              fontSize: theme.typography.fontSizes.lg,
            }}
          >
            Brand
          </div>
          <nav className="hidden md:flex items-center gap-4">
            {["Features", "Pricing", "About"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-white/80 hover:text-white transition-colors"
                style={{
                  fontFamily: theme.typography.fontSans,
                  fontSize: theme.typography.fontSizes.sm,
                }}
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
        <button
          data-testid="button-get-started"
          className="px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: theme.colors.accent,
            color: "#fff",
            borderRadius: theme.borderRadius.md,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Get Started
        </button>
      </div>

      <div className="px-6 py-8 text-center space-y-4">
        <h1
          className="text-white leading-tight"
          style={{
            fontFamily: theme.typography.fontSerif,
            fontSize: theme.typography.fontSizes["3xl"],
            fontWeight: theme.typography.fontWeights.bold,
          }}
        >
          Build Something Amazing
        </h1>
        <p
          className="text-white/80 max-w-md mx-auto"
          style={{
            fontFamily: theme.typography.fontSans,
            fontSize: theme.typography.fontSizes.base,
            lineHeight: theme.typography.lineHeights.relaxed,
          }}
        >
          Create beautiful, functional products with our design system built on your unique visual style.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            data-testid="button-start-trial"
            className="px-5 py-2.5 font-medium flex items-center gap-2"
            style={{
              backgroundColor: "#fff",
              color: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
              fontFamily: theme.typography.fontSans,
            }}
          >
            Start Free Trial
            <ArrowRight size={16} />
          </button>
          <button
            data-testid="button-watch-demo"
            className="px-5 py-2.5 font-medium flex items-center gap-2 text-white border border-white/30"
            style={{
              backgroundColor: "transparent",
              borderRadius: theme.borderRadius.md,
              fontFamily: theme.typography.fontSans,
            }}
          >
            <Play size={16} />
            Watch Demo
          </button>
        </div>

        <div className="flex items-center justify-center gap-6 pt-4 text-white/70 text-sm">
          <div className="flex items-center gap-1">
            <Check size={14} />
            <span>Free 14-day trial</span>
          </div>
          <div className="flex items-center gap-1">
            <Check size={14} />
            <span>No credit card</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthFormConcept({ theme }: { theme: StyleTheme }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: theme.colors.surface,
        boxShadow: theme.shadows.md,
      }}
      data-testid="concept-auth"
    >
      <div className="p-6 space-y-6">
        <div className="text-center space-y-2">
          <div
            className="w-12 h-12 mx-auto flex items-center justify-center font-bold text-white text-xl"
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius.lg,
              fontFamily: theme.typography.fontSerif,
            }}
          >
            A
          </div>
          <h2
            style={{
              fontFamily: theme.typography.fontSerif,
              fontSize: theme.typography.fontSizes["2xl"],
              fontWeight: theme.typography.fontWeights.bold,
              color: theme.colors.primary,
            }}
          >
            Welcome Back
          </h2>
          <p
            style={{
              fontFamily: theme.typography.fontSans,
              fontSize: theme.typography.fontSizes.sm,
              color: theme.colors.secondary,
            }}
          >
            Sign in to continue to your account
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              style={{
                fontFamily: theme.typography.fontSans,
                fontSize: theme.typography.fontSizes.sm,
                fontWeight: theme.typography.fontWeights.medium,
                color: theme.colors.primary,
              }}
            >
              Email
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: theme.colors.secondary }}
              />
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full pl-9 pr-3 py-2.5 outline-none focus:ring-2"
                style={{
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.neutral}`,
                  borderRadius: theme.borderRadius.md,
                  fontFamily: theme.typography.fontSans,
                  fontSize: theme.typography.fontSizes.sm,
                  color: theme.colors.primary,
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              style={{
                fontFamily: theme.typography.fontSans,
                fontSize: theme.typography.fontSizes.sm,
                fontWeight: theme.typography.fontWeights.medium,
                color: theme.colors.primary,
              }}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: theme.colors.secondary }}
              />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="w-full pl-9 pr-9 py-2.5 outline-none focus:ring-2"
                style={{
                  backgroundColor: theme.colors.background,
                  border: `1px solid ${theme.colors.neutral}`,
                  borderRadius: theme.borderRadius.md,
                  fontFamily: theme.typography.fontSans,
                  fontSize: theme.typography.fontSizes.sm,
                  color: theme.colors.primary,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff size={16} style={{ color: theme.colors.secondary }} />
                ) : (
                  <Eye size={16} style={{ color: theme.colors.secondary }} />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2">
              <div
                className="w-4 h-4 flex items-center justify-center"
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.borderRadius.sm,
                }}
              >
                <Check size={10} className="text-white" />
              </div>
              <span
                style={{
                  fontFamily: theme.typography.fontSans,
                  fontSize: theme.typography.fontSizes.sm,
                  color: theme.colors.secondary,
                }}
              >
                Remember me
              </span>
            </label>
            <a
              href="#"
              style={{
                fontFamily: theme.typography.fontSans,
                fontSize: theme.typography.fontSizes.sm,
                color: theme.colors.accent,
              }}
            >
              Forgot password?
            </a>
          </div>

          <button
            data-testid="button-sign-in"
            className="w-full py-2.5 font-medium text-white transition-all hover:opacity-90"
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
              fontFamily: theme.typography.fontSans,
            }}
          >
            Sign In
          </button>
        </div>

        <div className="text-center">
          <span
            style={{
              fontFamily: theme.typography.fontSans,
              fontSize: theme.typography.fontSizes.sm,
              color: theme.colors.secondary,
            }}
          >
            Don't have an account?{" "}
            <a href="#" data-testid="link-sign-up" style={{ color: theme.colors.accent, fontWeight: theme.typography.fontWeights.medium }}>
              Sign up
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}

export function AppConcepts({ theme, className }: AppConceptsProps) {
  return (
    <div className={cn("space-y-6", className)} data-testid="app-concepts">
      <div className="text-sm font-medium text-muted-foreground">Application Concepts</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardConcept theme={theme} />
        <AuthFormConcept theme={theme} />
      </div>
      <MarketingHeroConcept theme={theme} />
    </div>
  );
}

export default AppConcepts;
