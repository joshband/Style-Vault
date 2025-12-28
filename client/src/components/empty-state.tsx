import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { 
  Palette, 
  Bookmark, 
  Search, 
  Folder, 
  Image, 
  FileText, 
  Sparkles,
  PenTool,
  LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
  variant?: "default" | "compact" | "centered";
}

const iconVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 200, damping: 15 }
  }
};

const contentVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { delay: 0.1, duration: 0.3 }
  }
};

export function EmptyState({
  icon: Icon = Palette,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = "default"
}: EmptyStateProps) {
  const ActionButton = action?.href ? (
    <Link href={action.href}>
      <Button size={variant === "compact" ? "sm" : "default"} data-testid="empty-state-action">
        {action.label}
      </Button>
    </Link>
  ) : action?.onClick ? (
    <Button 
      size={variant === "compact" ? "sm" : "default"} 
      onClick={action.onClick}
      data-testid="empty-state-action"
    >
      {action.label}
    </Button>
  ) : null;

  const SecondaryButton = secondaryAction?.href ? (
    <Link href={secondaryAction.href}>
      <Button variant="outline" size={variant === "compact" ? "sm" : "default"}>
        {secondaryAction.label}
      </Button>
    </Link>
  ) : secondaryAction?.onClick ? (
    <Button variant="outline" size={variant === "compact" ? "sm" : "default"} onClick={secondaryAction.onClick}>
      {secondaryAction.label}
    </Button>
  ) : null;

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      className={cn(
        "flex flex-col items-center text-center",
        variant === "default" && "py-16 px-6 border border-dashed border-border rounded-xl",
        variant === "compact" && "py-8 px-4",
        variant === "centered" && "py-20 px-6",
        className
      )}
    >
      <motion.div 
        variants={iconVariants}
        className={cn(
          "flex items-center justify-center rounded-full bg-muted/50 mb-4",
          variant === "compact" ? "w-12 h-12" : "w-16 h-16"
        )}
      >
        <Icon className={cn(
          "text-muted-foreground/60",
          variant === "compact" ? "w-6 h-6" : "w-8 h-8"
        )} />
      </motion.div>
      
      <motion.div variants={contentVariants} className="max-w-md space-y-2">
        <h3 className={cn(
          "font-serif font-medium text-foreground",
          variant === "compact" ? "text-base" : "text-xl"
        )}>
          {title}
        </h3>
        <p className={cn(
          "text-muted-foreground leading-relaxed",
          variant === "compact" ? "text-xs" : "text-sm"
        )}>
          {description}
        </p>
      </motion.div>
      
      {(action || secondaryAction) && (
        <motion.div 
          variants={contentVariants}
          className="flex items-center gap-3 mt-6"
        >
          {ActionButton}
          {SecondaryButton}
        </motion.div>
      )}
    </motion.div>
  );
}

export function NoStylesEmpty() {
  return (
    <EmptyState
      icon={PenTool}
      title="What is a style?"
      description="A style is a reusable visual language — a captured essence of color, mood, texture, and form. It's not just an image or a prompt. It's a living artifact you can apply to generate new visuals that feel cohesive and intentional."
      action={{
        label: "Create your first style",
        href: "/create"
      }}
    />
  );
}

export function NoSearchResultsEmpty({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No styles match your filters"
      description="Try adjusting your search terms or removing some filters to see more results."
      action={{
        label: "Clear all filters",
        onClick: onClear
      }}
    />
  );
}

export function NoBookmarksEmpty() {
  return (
    <EmptyState
      icon={Bookmark}
      title="No saved styles yet"
      description="When you find a style you love, click the Save button to add it here for quick access."
      action={{
        label: "Explore styles",
        href: "/"
      }}
    />
  );
}

export function NoCreationsEmpty() {
  return (
    <EmptyState
      icon={Sparkles}
      title="No styles created yet"
      description="Create your first style by uploading a reference image or describing the visual aesthetic you want to capture."
      action={{
        label: "Create a style",
        href: "/create"
      }}
    />
  );
}

export function NoCollectionsEmpty({ onCreateCollection }: { onCreateCollection?: () => void }) {
  return (
    <EmptyState
      icon={Folder}
      title="No collections yet"
      description="Create collections to organize your favorite styles into themed groups for easy access."
      action={{
        label: "Create collection",
        onClick: onCreateCollection
      }}
    />
  );
}

export function EmptyCollectionState() {
  return (
    <EmptyState
      icon={Folder}
      title="This collection is empty"
      description="Add styles to this collection to organize your creative assets."
      action={{
        label: "Browse styles to add",
        href: "/"
      }}
      variant="compact"
    />
  );
}

export function NoImagesEmpty() {
  return (
    <EmptyState
      icon={Image}
      title="No images generated yet"
      description="Generate new images using this style to see them appear here."
      variant="compact"
    />
  );
}

export function ErrorState({ 
  title = "Something went wrong",
  description = "We couldn't load this content. Please try again.",
  onRetry
}: { 
  title?: string; 
  description?: string; 
  onRetry?: () => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-16 text-center border border-dashed border-destructive/30 rounded-xl bg-destructive/5"
    >
      <div className="max-w-md mx-auto space-y-4 px-6">
        <div className="w-12 h-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
          <svg 
            className="w-6 h-6 text-destructive" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-destructive">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="mt-4">
            Try again
          </Button>
        )}
      </div>
    </motion.div>
  );
}
