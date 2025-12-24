import { StyleTheme } from "@/hooks/useStyleTheme";
import { cn } from "@/lib/utils";
import { 
  Bell, Search, Menu, ChevronRight, Check, X, 
  User, Settings, LogOut, Heart, ShoppingCart, 
  Mail, Star, ArrowRight, Plus, Minus
} from "lucide-react";

interface StylePlaygroundProps {
  theme: StyleTheme;
  className?: string;
}

function ButtonShowcase({ theme }: { theme: StyleTheme }) {
  return (
    <div className="space-y-4" data-testid="playground-buttons">
      <h3 className="text-sm font-medium text-muted-foreground">Buttons</h3>
      <div className="flex flex-wrap gap-3">
        <button
          data-testid="button-primary"
          className="px-4 py-2 text-white font-medium transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
            fontFamily: theme.typography.fontSans,
            boxShadow: theme.shadows.sm,
          }}
        >
          Primary
        </button>
        <button
          data-testid="button-secondary"
          className="px-4 py-2 font-medium transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.colors.secondary,
            color: "#fff",
            borderRadius: theme.borderRadius.md,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Secondary
        </button>
        <button
          data-testid="button-outline"
          className="px-4 py-2 font-medium transition-all hover:opacity-90 border-2"
          style={{
            backgroundColor: "transparent",
            borderColor: theme.colors.primary,
            color: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Outline
        </button>
        <button
          data-testid="button-accent-pill"
          className="px-4 py-2 font-medium transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.colors.accent,
            color: "#fff",
            borderRadius: theme.borderRadius.full,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Accent Pill
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          data-testid="button-icon-plus"
          className="p-2 transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
          }}
        >
          <Plus size={18} className="text-white" />
        </button>
        <button
          data-testid="button-icon-heart"
          className="p-2 transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.neutral}`,
            borderRadius: theme.borderRadius.full,
          }}
        >
          <Heart size={18} style={{ color: theme.colors.accent }} />
        </button>
        <button
          data-testid="button-view-more"
          className="px-3 py-1.5 text-sm font-medium flex items-center gap-1"
          style={{
            backgroundColor: theme.colors.surface,
            border: `1px solid ${theme.colors.neutral}`,
            borderRadius: theme.borderRadius.sm,
            fontFamily: theme.typography.fontSans,
            color: theme.colors.primary,
          }}
        >
          View More <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function CardShowcase({ theme }: { theme: StyleTheme }) {
  return (
    <div className="space-y-4" data-testid="playground-cards">
      <h3 className="text-sm font-medium text-muted-foreground">Cards</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="p-4 space-y-3"
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            boxShadow: theme.shadows.md,
          }}
        >
          <div className="flex items-center justify-between">
            <h4
              className="font-semibold"
              style={{
                fontFamily: theme.typography.fontSerif,
                fontSize: theme.typography.fontSizes.lg,
                color: theme.colors.primary,
              }}
            >
              Product Card
            </h4>
            <span
              className="px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: theme.colors.accent,
                color: "#fff",
                borderRadius: theme.borderRadius.full,
              }}
            >
              New
            </span>
          </div>
          <p
            style={{
              fontFamily: theme.typography.fontSans,
              fontSize: theme.typography.fontSizes.sm,
              color: theme.colors.secondary,
              lineHeight: theme.typography.lineHeights.normal,
            }}
          >
            A beautiful card component styled with your extracted design tokens.
          </p>
          <div className="flex items-center justify-between pt-2">
            <span
              className="font-bold"
              style={{
                fontFamily: theme.typography.fontSans,
                fontSize: theme.typography.fontSizes.xl,
                color: theme.colors.primary,
              }}
            >
              $99.00
            </span>
            <button
              data-testid="button-add-to-cart"
              className="px-3 py-1.5 text-sm font-medium text-white"
              style={{
                backgroundColor: theme.colors.primary,
                borderRadius: theme.borderRadius.md,
              }}
            >
              Add to Cart
            </button>
          </div>
        </div>

        <div
          className="p-4 space-y-3"
          style={{
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.neutral}`,
            borderRadius: theme.borderRadius.lg,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{
                backgroundColor: theme.colors.primary,
                borderRadius: theme.borderRadius.full,
              }}
            >
              <User size={20} className="text-white" />
            </div>
            <div>
              <h4
                className="font-medium"
                style={{
                  fontFamily: theme.typography.fontSans,
                  fontSize: theme.typography.fontSizes.base,
                  color: theme.colors.primary,
                }}
              >
                John Smith
              </h4>
              <p
                style={{
                  fontFamily: theme.typography.fontSans,
                  fontSize: theme.typography.fontSizes.xs,
                  color: theme.colors.secondary,
                }}
              >
                Product Designer
              </p>
            </div>
          </div>
          <p
            style={{
              fontFamily: theme.typography.fontSans,
              fontSize: theme.typography.fontSizes.sm,
              color: theme.colors.secondary,
            }}
          >
            "The style tokens perfectly capture the aesthetic I was looking for."
          </p>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={14}
                fill={theme.colors.accent}
                style={{ color: theme.colors.accent }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FormShowcase({ theme }: { theme: StyleTheme }) {
  return (
    <div className="space-y-4" data-testid="playground-forms">
      <h3 className="text-sm font-medium text-muted-foreground">Form Elements</h3>
      <div
        className="p-4 space-y-4 max-w-md"
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
        }}
      >
        <div className="space-y-1.5">
          <label
            style={{
              fontFamily: theme.typography.fontSans,
              fontSize: theme.typography.fontSizes.sm,
              fontWeight: theme.typography.fontWeights.medium,
              color: theme.colors.primary,
            }}
          >
            Email Address
          </label>
          <div className="relative">
            <Mail
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: theme.colors.secondary }}
            />
            <input
              type="email"
              data-testid="input-email"
              placeholder="you@example.com"
              className="w-full pl-9 pr-3 py-2 outline-none focus:ring-2"
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
            Message
          </label>
          <textarea
            rows={3}
            data-testid="input-message"
            placeholder="Your message..."
            className="w-full px-3 py-2 outline-none focus:ring-2 resize-none"
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

        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 flex items-center justify-center"
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius.sm,
            }}
          >
            <Check size={12} className="text-white" />
          </div>
          <span
            style={{
              fontFamily: theme.typography.fontSans,
              fontSize: theme.typography.fontSizes.sm,
              color: theme.colors.secondary,
            }}
          >
            I agree to the terms and conditions
          </span>
        </div>

        <button
          data-testid="button-submit"
          className="w-full py-2.5 font-medium text-white transition-all hover:opacity-90"
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function NavigationShowcase({ theme }: { theme: StyleTheme }) {
  return (
    <div className="space-y-4" data-testid="playground-navigation">
      <h3 className="text-sm font-medium text-muted-foreground">Navigation</h3>
      <div
        className="p-3 flex items-center justify-between"
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-8 h-8 flex items-center justify-center font-bold text-white"
            style={{
              backgroundColor: theme.colors.primary,
              borderRadius: theme.borderRadius.md,
              fontFamily: theme.typography.fontSerif,
            }}
          >
            S
          </div>
          <nav className="hidden md:flex items-center gap-4">
            {["Home", "Products", "About", "Contact"].map((item, i) => (
              <a
                key={item}
                href="#"
                data-testid={`link-nav-${item.toLowerCase()}`}
                className="transition-colors hover:opacity-80"
                style={{
                  fontFamily: theme.typography.fontSans,
                  fontSize: theme.typography.fontSizes.sm,
                  fontWeight: i === 0 ? theme.typography.fontWeights.semibold : theme.typography.fontWeights.regular,
                  color: i === 0 ? theme.colors.primary : theme.colors.secondary,
                }}
              >
                {item}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="button-search"
            className="p-2 transition-all hover:opacity-80"
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: theme.borderRadius.full,
            }}
          >
            <Search size={18} style={{ color: theme.colors.secondary }} />
          </button>
          <button
            data-testid="button-notifications"
            className="p-2 relative transition-all hover:opacity-80"
            style={{
              backgroundColor: theme.colors.background,
              borderRadius: theme.borderRadius.full,
            }}
          >
            <Bell size={18} style={{ color: theme.colors.secondary }} />
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ backgroundColor: theme.colors.accent }}
            />
          </button>
          <div
            className="w-8 h-8 flex items-center justify-center"
            style={{
              backgroundColor: theme.colors.secondary,
              borderRadius: theme.borderRadius.full,
            }}
          >
            <User size={16} className="text-white" />
          </div>
        </div>
      </div>

      <div
        className="p-2 flex flex-col gap-1 max-w-[200px]"
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.md,
          border: `1px solid ${theme.colors.neutral}`,
        }}
      >
        {[
          { icon: User, label: "Profile" },
          { icon: Settings, label: "Settings" },
          { icon: LogOut, label: "Sign Out" },
        ].map((item) => (
          <button
            key={item.label}
            className="flex items-center gap-2 px-3 py-2 rounded transition-all hover:opacity-80"
            style={{
              fontFamily: theme.typography.fontSans,
              fontSize: theme.typography.fontSizes.sm,
              color: theme.colors.primary,
            }}
          >
            <item.icon size={16} style={{ color: theme.colors.secondary }} />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BadgeShowcase({ theme }: { theme: StyleTheme }) {
  return (
    <div className="space-y-4" data-testid="playground-badges">
      <h3 className="text-sm font-medium text-muted-foreground">Badges & Tags</h3>
      <div className="flex flex-wrap gap-2">
        <span
          className="px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: theme.colors.primary,
            color: "#fff",
            borderRadius: theme.borderRadius.full,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Primary
        </span>
        <span
          className="px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: theme.colors.secondary,
            color: "#fff",
            borderRadius: theme.borderRadius.full,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Secondary
        </span>
        <span
          className="px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: theme.colors.accent,
            color: "#fff",
            borderRadius: theme.borderRadius.full,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Accent
        </span>
        <span
          className="px-2.5 py-1 text-xs font-medium border"
          style={{
            backgroundColor: "transparent",
            borderColor: theme.colors.neutral,
            color: theme.colors.secondary,
            borderRadius: theme.borderRadius.full,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Outline
        </span>
        <span
          className="px-2.5 py-1 text-xs font-medium flex items-center gap-1"
          style={{
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.neutral}`,
            color: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
            fontFamily: theme.typography.fontSans,
          }}
        >
          <Check size={12} style={{ color: theme.colors.accent }} />
          Success
        </span>
        <span
          className="px-2.5 py-1 text-xs font-medium flex items-center gap-1"
          style={{
            backgroundColor: theme.colors.background,
            border: `1px solid ${theme.colors.neutral}`,
            color: theme.colors.primary,
            borderRadius: theme.borderRadius.md,
            fontFamily: theme.typography.fontSans,
          }}
        >
          Tag
          <X size={12} style={{ color: theme.colors.secondary }} />
        </span>
      </div>
    </div>
  );
}

export function StylePlayground({ theme, className }: StylePlaygroundProps) {
  return (
    <div
      className={cn("p-6 space-y-8", className)}
      style={{ backgroundColor: theme.colors.background }}
      data-testid="style-playground"
    >
      <div className="max-w-3xl mx-auto space-y-8">
        <ButtonShowcase theme={theme} />
        <CardShowcase theme={theme} />
        <FormShowcase theme={theme} />
        <NavigationShowcase theme={theme} />
        <BadgeShowcase theme={theme} />
      </div>
    </div>
  );
}

export default StylePlayground;
