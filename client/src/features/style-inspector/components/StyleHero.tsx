import { Link, useLocation } from "wouter";
import { ArrowLeft, RefreshCw, Share2, Bookmark, BookmarkCheck, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { isFeatureEnabled } from "@shared/featureFlags";
import type { StyleHero } from "../types";

interface StyleHeroProps {
  hero: StyleHero;
  onRegenerate?: () => Promise<void> | void;
  isRegenerating?: boolean;
}

export function StyleHeroComponent({ hero, onRegenerate, isRegenerating = false }: StyleHeroProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  const handleShare = useCallback(async () => {
    setShareLoading(true);
    try {
      let code = hero.shareCode;
      if (!code) {
        const res = await fetch(`/api/styles/${hero.id}/share`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          code = data.shareCode;
        }
      }
      if (code) {
        const shareUrl = `${window.location.origin}/s/${code}`;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Share link copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      toast.error('Failed to create share link');
    } finally {
      setShareLoading(false);
    }
  }, [hero.id, hero.shareCode]);

  const handleBookmark = useCallback(async () => {
    if (!isAuthenticated) {
      toast.info('Please sign in to bookmark styles');
      return;
    }
    setBookmarkLoading(true);
    try {
      const method = isBookmarked ? 'DELETE' : 'POST';
      const res = await fetch(`/api/styles/${hero.id}/bookmark`, {
        method,
        credentials: 'include',
      });
      if (res.ok) {
        setIsBookmarked(!isBookmarked);
        toast.success(isBookmarked ? 'Bookmark removed' : 'Style bookmarked!');
      }
    } catch (error) {
      toast.error('Failed to update bookmark');
    } finally {
      setBookmarkLoading(false);
    }
  }, [hero.id, isAuthenticated, isBookmarked]);

  const handleRegenerate = useCallback(async () => {
    if (!isAuthenticated && !authLoading) {
      toast.info('Please sign in to regenerate style previews');
      return;
    }
    if (onRegenerate) {
      await onRegenerate();
    }
  }, [isAuthenticated, authLoading, onRegenerate]);

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={12} /> Back
          </Link>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-serif font-medium text-foreground leading-tight" data-testid="style-name">
            {hero.name}
          </h1>
          <p className="text-muted-foreground text-base font-light leading-relaxed" data-testid="style-description">
            {hero.description}
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {hero.creatorName && hero.creatorId && (
            <Link 
              href={`/creator/${hero.creatorId}`}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <User size={12} />
              <span className="text-xs">{hero.creatorName}</span>
            </Link>
          )}
        </div>
      </header>

      <section className="flex flex-wrap gap-2">
        <Button
          onClick={handleShare}
          disabled={shareLoading}
          variant="outline"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3"
          data-testid="button-share-style"
        >
          {shareLoading ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
          {copied ? "Copied!" : "Share"}
        </Button>

        <Button
          onClick={handleBookmark}
          disabled={bookmarkLoading}
          variant="outline"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3"
          data-testid="button-bookmark-style"
        >
          {bookmarkLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isBookmarked ? (
            <BookmarkCheck size={16} className="text-primary" />
          ) : (
            <Bookmark size={16} />
          )}
          {isBookmarked ? "Saved" : "Save"}
        </Button>

        {isFeatureEnabled('regenerate.enabled') && (
          <Button
            onClick={handleRegenerate}
            disabled={isRegenerating || authLoading}
            variant="outline"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3"
            data-testid="button-regenerate-style"
          >
            {isRegenerating || authLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Regenerate
          </Button>
        )}
      </section>
    </div>
  );
}
