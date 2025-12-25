import { Layout } from "@/components/layout";
import { StyleCard } from "@/components/style-card";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";

interface StyleSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  thumbnailUrl: string | null;
  moodBoard?: {
    thumbnailUrl?: string;
  } | null;
  previews?: {
    landscape?: string;
  } | null;
}

export default function SavedStyles() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [styles, setStyles] = useState<StyleSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchBookmarks = async () => {
      try {
        const res = await fetch("/api/bookmarks");
        if (res.ok) {
          const data = await res.json();
          setStyles(data);
        }
      } catch (error) {
        console.error("Failed to fetch bookmarks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookmarks();
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-16 space-y-6">
          <Bookmark className="w-16 h-16 mx-auto text-muted-foreground/50" />
          <h1 className="text-2xl font-serif font-medium">Sign in to see your saved styles</h1>
          <p className="text-muted-foreground">
            Create an account or sign in to bookmark and save your favorite styles.
          </p>
          <a
            href="/api/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors"
            data-testid="button-sign-in"
          >
            Sign In
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-mono w-fit">
            <ArrowLeft size={12} /> Back to Vault
          </Link>
          
          <div className="flex items-center gap-3">
            <Bookmark className="w-8 h-8 text-yellow-500 fill-yellow-500" />
            <h1 className="text-3xl font-serif font-medium">My Saved Styles</h1>
          </div>
          <p className="text-muted-foreground">
            Styles you've bookmarked for quick access
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : styles.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Bookmark className="w-12 h-12 mx-auto text-muted-foreground/30" />
            <h2 className="text-xl font-medium text-muted-foreground">No saved styles yet</h2>
            <p className="text-sm text-muted-foreground/70">
              When you find a style you love, click the Save button to add it here.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
            >
              Browse Styles
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {styles.map((style) => (
              <StyleCard
                key={style.id}
                style={{
                  id: style.id,
                  name: style.name,
                  description: style.description || "",
                  createdAt: style.createdAt,
                  thumbnailPreview: style.thumbnailUrl || style.moodBoard?.thumbnailUrl || style.previews?.landscape || null,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
