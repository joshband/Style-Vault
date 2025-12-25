import { Layout } from "@/components/layout";
import { StyleCard } from "@/components/style-card";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Bookmark, Loader2, Palette, FolderPlus, Folder, Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface StyleSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  metadataTags?: any;
  moodBoardStatus?: string;
  uiConceptsStatus?: string;
  thumbnailPreview?: string | null;
  creatorId?: string | null;
  creatorName?: string | null;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt?: string | null;
  styles?: StyleSummary[];
}

function StyleGrid({ styles, emptyMessage, emptyIcon: EmptyIcon, emptyAction }: { 
  styles: StyleSummary[]; 
  emptyMessage: string; 
  emptyIcon: any;
  emptyAction?: React.ReactNode;
}) {
  if (styles.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <EmptyIcon className="w-12 h-12 mx-auto text-muted-foreground/30" />
        <h2 className="text-xl font-medium text-muted-foreground">{emptyMessage}</h2>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {styles.map((style) => (
        <StyleCard
          key={style.id}
          style={{
            id: style.id,
            name: style.name,
            description: style.description || "",
            createdAt: style.createdAt,
            metadataTags: style.metadataTags,
            moodBoardStatus: style.moodBoardStatus,
            uiConceptsStatus: style.uiConceptsStatus,
            thumbnailPreview: style.thumbnailPreview,
            creatorId: style.creatorId,
            creatorName: style.creatorName,
          }}
        />
      ))}
    </div>
  );
}

function CollectionCard({ collection, onEdit, onDelete, onClick }: {
  collection: Collection;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  return (
    <div 
      className="group relative border border-border rounded-lg p-4 hover:border-foreground/20 transition-colors cursor-pointer"
      onClick={onClick}
      data-testid={`collection-card-${collection.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Folder className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-sm">{collection.name}</h3>
            {collection.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{collection.description}</p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        {collection.styles?.length || 0} styles
      </div>
    </div>
  );
}

function CreateCollectionDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (collection: Collection) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });
      if (res.ok) {
        const created = await res.json();
        onCreated(created);
        setName("");
        setDescription("");
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="My favorites"
              data-testid="input-collection-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea 
              id="description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A collection of my favorite design styles"
              data-testid="input-collection-description"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={!name.trim() || loading} data-testid="button-create-collection">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditCollectionDialog({ collection, open, onOpenChange, onUpdated }: {
  collection: Collection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (collection: Collection) => void;
}) {
  const [name, setName] = useState(collection?.name || "");
  const [description, setDescription] = useState(collection?.description || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setDescription(collection.description || "");
    }
  }, [collection]);

  const handleUpdate = async () => {
    if (!collection || !name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdated(updated);
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input 
              id="edit-name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              data-testid="input-edit-collection-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Textarea 
              id="edit-description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-edit-collection-description"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleUpdate} disabled={!name.trim() || loading} data-testid="button-update-collection">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SavedStyles() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [bookmarkedStyles, setBookmarkedStyles] = useState<StyleSummary[]>([]);
  const [createdStyles, setCreatedStyles] = useState<StyleSummary[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("bookmarks");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [bookmarksRes, createdRes, collectionsRes] = await Promise.all([
          fetch("/api/bookmarks"),
          fetch("/api/my-styles"),
          fetch("/api/collections"),
        ]);

        if (bookmarksRes.ok) {
          setBookmarkedStyles(await bookmarksRes.json());
        }
        if (createdRes.ok) {
          setCreatedStyles(await createdRes.json());
        }
        if (collectionsRes.ok) {
          setCollections(await collectionsRes.json());
        }
      } catch (error) {
        console.error("Failed to fetch library data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm("Are you sure you want to delete this collection? This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
      if (res.ok) {
        setCollections(collections.filter(c => c.id !== collectionId));
        if (selectedCollection?.id === collectionId) {
          setSelectedCollection(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete collection:", error);
    }
  };

  const handleCollectionClick = async (collection: Collection) => {
    try {
      const res = await fetch(`/api/collections/${collection.id}`);
      if (res.ok) {
        const fullCollection = await res.json();
        setSelectedCollection(fullCollection);
      }
    } catch (error) {
      console.error("Failed to fetch collection:", error);
    }
  };

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
          <h1 className="text-2xl font-serif font-medium">Sign in to access your library</h1>
          <p className="text-muted-foreground">
            Create an account or sign in to save styles, create collections, and track your creations.
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

  if (selectedCollection) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4">
            <button 
              onClick={() => setSelectedCollection(null)}
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider font-mono w-fit"
            >
              <ArrowLeft size={12} /> Back to Library
            </button>
            
            <div className="flex items-center gap-3">
              <Folder className="w-8 h-8 text-muted-foreground" />
              <div>
                <h1 className="text-3xl font-serif font-medium">{selectedCollection.name}</h1>
                {selectedCollection.description && (
                  <p className="text-muted-foreground">{selectedCollection.description}</p>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <StyleGrid 
              styles={selectedCollection.styles || []} 
              emptyMessage="This collection is empty"
              emptyIcon={Folder}
              emptyAction={
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                >
                  Browse Styles to Add
                </Link>
              }
            />
          )}
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
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif font-medium">My Library</h1>
              <p className="text-muted-foreground">
                Your saved styles, creations, and collections
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="bookmarks" className="gap-2" data-testid="tab-bookmarks">
              <Bookmark className="w-4 h-4" /> 
              Saved ({bookmarkedStyles.length})
            </TabsTrigger>
            <TabsTrigger value="created" className="gap-2" data-testid="tab-created">
              <Palette className="w-4 h-4" />
              Created ({createdStyles.length})
            </TabsTrigger>
            <TabsTrigger value="collections" className="gap-2" data-testid="tab-collections">
              <Folder className="w-4 h-4" />
              Collections ({collections.length})
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <TabsContent value="bookmarks">
                <StyleGrid 
                  styles={bookmarkedStyles} 
                  emptyMessage="No saved styles yet"
                  emptyIcon={Bookmark}
                  emptyAction={
                    <p className="text-sm text-muted-foreground/70">
                      When you find a style you love, click the Save button to add it here.
                    </p>
                  }
                />
              </TabsContent>

              <TabsContent value="created">
                <StyleGrid 
                  styles={createdStyles} 
                  emptyMessage="No styles created yet"
                  emptyIcon={Palette}
                  emptyAction={
                    <Link
                      href="/create"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Create Your First Style
                    </Link>
                  }
                />
              </TabsContent>

              <TabsContent value="collections">
                <div className="space-y-6">
                  <Button 
                    onClick={() => setCreateDialogOpen(true)}
                    className="gap-2"
                    data-testid="button-new-collection"
                  >
                    <FolderPlus className="w-4 h-4" /> New Collection
                  </Button>

                  {collections.length === 0 ? (
                    <div className="text-center py-16 space-y-4">
                      <Folder className="w-12 h-12 mx-auto text-muted-foreground/30" />
                      <h2 className="text-xl font-medium text-muted-foreground">No collections yet</h2>
                      <p className="text-sm text-muted-foreground/70">
                        Create collections to organize your favorite styles into groups.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {collections.map((collection) => (
                        <CollectionCard
                          key={collection.id}
                          collection={collection}
                          onEdit={() => setEditingCollection(collection)}
                          onDelete={() => handleDeleteCollection(collection.id)}
                          onClick={() => handleCollectionClick(collection)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>

        <CreateCollectionDialog 
          open={createDialogOpen} 
          onOpenChange={setCreateDialogOpen}
          onCreated={(collection) => setCollections([collection, ...collections])}
        />

        <EditCollectionDialog
          collection={editingCollection}
          open={!!editingCollection}
          onOpenChange={(open) => !open && setEditingCollection(null)}
          onUpdated={(updated) => {
            setCollections(collections.map(c => c.id === updated.id ? updated : c));
          }}
        />
      </div>
    </Layout>
  );
}
