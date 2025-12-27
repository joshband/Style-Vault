import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Activity, Settings, Wand2, Shield, AlertCircle, CheckCircle, Clock, Zap } from "lucide-react";
import { Link } from "wouter";
import type { Style } from "@shared/schema";

interface MetricsSummary {
  totalGenerations: number;
  successRate: number;
  averageDurationMs: number;
  byType: Record<string, { count: number; avgDuration: number; successRate: number }>;
}

interface FeatureToggle {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  value: Record<string, unknown> | null;
  updatedAt: string;
}

interface AdminStats {
  totalStyles: number;
  publicStyles: number;
  privateStyles: number;
  pendingEnrichment: number;
  completedMoodBoards: number;
  completedUiConcepts: number;
}

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [regenerateOptions, setRegenerateOptions] = useState({
    previews: true,
    mood_board: true,
    ui_concepts: true,
  });
  const [fullRegenOptions, setFullRegenOptions] = useState({
    includeTokens: true,
    includeMetadata: true,
    includePreviews: true,
    includeMoodBoard: true,
    includeUiConcepts: true,
  });

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<MetricsSummary>({
    queryKey: ["admin", "metrics-summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/metrics/summary");
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: features, isLoading: featuresLoading, refetch: refetchFeatures } = useQuery<FeatureToggle[]>({
    queryKey: ["admin", "features"],
    queryFn: async () => {
      const res = await fetch("/api/admin/features");
      if (!res.ok) throw new Error("Failed to fetch features");
      return res.json();
    },
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const { data: styles } = useQuery<Style[]>({
    queryKey: ["admin", "styles"],
    queryFn: async () => {
      const res = await fetch("/api/styles?limit=100");
      if (!res.ok) throw new Error("Failed to fetch styles");
      const data = await res.json();
      return data.styles || [];
    },
  });

  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await fetch(`/api/admin/features/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to update feature");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "features"] });
      toast({ title: "Feature updated", description: "The feature toggle has been updated." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const regenerateImagesMutation = useMutation({
    mutationFn: async () => {
      const imageTypes = Object.entries(regenerateOptions)
        .filter(([_, v]) => v)
        .map(([k]) => k);
      const res = await fetch("/api/admin/styles/regenerate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleIds: selectedStyles, imageTypes }),
      });
      if (!res.ok) throw new Error("Failed to start regeneration");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Regeneration started", 
        description: `Started ${data.jobCount} jobs. Check job queue for progress.` 
      });
      setSelectedStyles([]);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const regenerateFullMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/styles/regenerate-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleIds: selectedStyles, ...fullRegenOptions }),
      });
      if (!res.ok) throw new Error("Failed to start full regeneration");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Full regeneration started", 
        description: `Started ${data.jobCount} jobs from source images.` 
      });
      setSelectedStyles([]);
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const regenerateAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/styles/regenerate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fullRegenOptions),
      });
      if (!res.ok) throw new Error("Failed to start bulk regeneration");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Bulk regeneration started", 
        description: `Started ${data.jobCount} jobs for all styles.` 
      });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filteredStyles = styles?.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleSelectAll = () => {
    if (selectedStyles.length === filteredStyles.length) {
      setSelectedStyles([]);
    } else {
      setSelectedStyles(filteredStyles.map(s => s.id));
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="admin-page">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-semibold text-lg">← Visual DNA</Link>
            <h1 className="text-lg font-medium flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Admin Dashboard
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            refetchMetrics();
            refetchFeatures();
            refetchStats();
          }} data-testid="button-refresh-all">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4" data-testid="admin-tabs">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
            <TabsTrigger value="regenerate" data-testid="tab-regenerate">Regenerate</TabsTrigger>
            <TabsTrigger value="metrics" data-testid="tab-metrics">Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Styles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="stat-total-styles">
                    {statsLoading ? "..." : stats?.totalStyles || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.publicStyles || 0} public, {stats?.privateStyles || 0} private
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Enrichment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="stat-pending-enrichment">
                    {statsLoading ? "..." : stats?.pendingEnrichment || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Styles awaiting metadata enrichment
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Asset Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold" data-testid="stat-mood-boards">
                      {statsLoading ? "..." : stats?.completedMoodBoards || 0}
                    </span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-xl" data-testid="stat-ui-concepts">
                      {statsLoading ? "..." : stats?.completedUiConcepts || 0}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mood Boards / UI Concepts
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Generation Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <p>Loading metrics...</p>
                ) : metrics ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Generations</p>
                      <p className="text-2xl font-bold">{metrics.totalGenerations}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold">{(metrics.successRate * 100).toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Duration</p>
                      <p className="text-2xl font-bold">{Math.round(metrics.averageDurationMs / 1000)}s</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No metrics available yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Feature Toggles
                </CardTitle>
                <CardDescription>
                  Enable or disable AI models and system features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {featuresLoading ? (
                  <p>Loading features...</p>
                ) : features && features.length > 0 ? (
                  features.map((feature) => (
                    <div 
                      key={feature.id} 
                      className="flex items-center justify-between p-4 rounded-lg border"
                      data-testid={`feature-row-${feature.key}`}
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{feature.key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
                        {feature.description && (
                          <p className="text-sm text-muted-foreground">{feature.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={feature.enabled ? "default" : "secondary"}>
                          {feature.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <Switch
                          checked={feature.enabled}
                          onCheckedChange={(checked) => 
                            toggleFeatureMutation.mutate({ key: feature.key, enabled: checked })
                          }
                          data-testid={`toggle-${feature.key}`}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No feature toggles configured.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regenerate" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5" />
                    Selective Image Regeneration
                  </CardTitle>
                  <CardDescription>
                    Regenerate specific image types for selected styles
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Image Types to Regenerate</Label>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(regenerateOptions).map(([key, value]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={value}
                            onCheckedChange={(checked) =>
                              setRegenerateOptions(prev => ({ ...prev, [key]: !!checked }))
                            }
                            data-testid={`checkbox-${key}`}
                          />
                          <span className="text-sm capitalize">{key.replace(/_/g, " ")}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={() => regenerateImagesMutation.mutate()}
                    disabled={selectedStyles.length === 0 || regenerateImagesMutation.isPending}
                    className="w-full"
                    data-testid="button-regenerate-images"
                  >
                    {regenerateImagesMutation.isPending ? "Starting..." : `Regenerate Images (${selectedStyles.length} styles)`}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Full Style Regeneration
                  </CardTitle>
                  <CardDescription>
                    Rebuild styles completely from source images
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Regeneration Options</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(fullRegenOptions).map(([key, value]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={value}
                            onCheckedChange={(checked) =>
                              setFullRegenOptions(prev => ({ ...prev, [key]: !!checked }))
                            }
                            data-testid={`checkbox-full-${key}`}
                          />
                          <span className="text-sm capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => regenerateFullMutation.mutate()}
                      disabled={selectedStyles.length === 0 || regenerateFullMutation.isPending}
                      className="flex-1"
                      data-testid="button-regenerate-full"
                    >
                      {regenerateFullMutation.isPending ? "Starting..." : `Full Regen (${selectedStyles.length})`}
                    </Button>
                    <Button
                      onClick={() => regenerateAllMutation.mutate()}
                      disabled={regenerateAllMutation.isPending}
                      variant="destructive"
                      data-testid="button-regenerate-all"
                    >
                      {regenerateAllMutation.isPending ? "Starting..." : "Regenerate ALL"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Select Styles</CardTitle>
                <CardDescription>
                  Choose styles to regenerate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Input
                    placeholder="Search styles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                    data-testid="input-search-styles"
                  />
                  <Button variant="outline" size="sm" onClick={handleSelectAll} data-testid="button-select-all">
                    {selectedStyles.length === filteredStyles.length ? "Deselect All" : "Select All"}
                  </Button>
                  <Badge variant="secondary">
                    {selectedStyles.length} selected
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                  {filteredStyles.map((style) => (
                    <label 
                      key={style.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedStyles.includes(style.id) ? "bg-primary/10 border-primary" : ""
                      }`}
                      data-testid={`style-row-${style.id}`}
                    >
                      <Checkbox
                        checked={selectedStyles.includes(style.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedStyles(prev => [...prev, style.id]);
                          } else {
                            setSelectedStyles(prev => prev.filter(id => id !== style.id));
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{style.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {style.isPublic ? "Public" : "Private"}
                        </p>
                      </div>
                      {style.metadataEnrichmentStatus === "complete" ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : style.metadataEnrichmentStatus === "pending" ? (
                        <Clock className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      )}
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Metrics by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <p>Loading metrics...</p>
                ) : metrics?.byType && Object.keys(metrics.byType).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(metrics.byType).map(([type, data]) => (
                      <div key={type} className="p-4 rounded-lg border" data-testid={`metric-row-${type}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium capitalize">{type.replace(/_/g, " ")}</h3>
                          <Badge variant="outline">{data.count} operations</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Avg Duration</p>
                            <p className="font-medium">{Math.round(data.avgDuration / 1000)}s</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Success Rate</p>
                            <p className={`font-medium ${data.successRate >= 0.9 ? "text-green-500" : data.successRate >= 0.7 ? "text-yellow-500" : "text-red-500"}`}>
                              {(data.successRate * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No metrics data available. Metrics are recorded during generation operations.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
