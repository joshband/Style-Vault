import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, BarChart3, Palette, TrendingUp, Lightbulb, Users, Sparkles, PieChart } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface UserAnalytics {
  userStats: {
    totalStyles: number;
    platformAverageStyles: number;
    percentileRank: number;
  };
  tokenDistribution: {
    colors: number;
    textures: number;
    moods: number;
    total: number;
  };
  topMoods: Array<{ name: string; count: number }>;
  topColorFamilies: Array<{ name: string; count: number }>;
  insights: string[];
}

interface PlatformAnalytics {
  platformStats: {
    totalStyles: number;
    uniqueCreators: number;
    averageStylesPerCreator: number;
  };
  topMoods: Array<{ name: string; count: number; percentage: number }>;
  topColorFamilies: Array<{ name: string; count: number; percentage: number }>;
  topEras: Array<{ name: string; count: number }>;
  trends: {
    trending: string[];
    emerging: string[];
  };
}

function StatCard({ title, value, subtitle, icon: Icon }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
}) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function BarChart({ items, maxCount }: { items: Array<{ name: string; count: number; percentage?: number }>; maxCount: number }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No data available yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.name} className="space-y-1" data-testid={`bar-item-${index}`}>
          <div className="flex justify-between text-sm">
            <span className="capitalize">{item.name.replace(/-/g, ' ')}</span>
            <span className="text-muted-foreground">
              {item.count} {item.percentage !== undefined && `(${item.percentage}%)`}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.max(5, (item.count / maxCount) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightsList({ insights }: { insights: string[] }) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <Card data-testid="insights-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Your Style Insights
        </CardTitle>
        <CardDescription>Patterns we've noticed in your collection</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {insights.map((insight, index) => (
            <li key={index} className="flex items-start gap-3" data-testid={`insight-${index}`}>
              <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm">{insight}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MyAnalytics() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: analytics, isLoading, error } = useQuery<UserAnalytics>({
    queryKey: ["/api/analytics"],
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-16 space-y-4">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30" />
        <h2 className="text-xl font-medium text-muted-foreground">Sign in to view your analytics</h2>
        <p className="text-sm text-muted-foreground">See insights about your style collection</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="text-center py-16 space-y-4">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30" />
        <h2 className="text-xl font-medium text-muted-foreground">Unable to load analytics</h2>
        <p className="text-sm text-muted-foreground">Please try again later</p>
      </div>
    );
  }

  const maxMoodCount = Math.max(...analytics.topMoods.map(m => m.count), 1);
  const maxColorCount = Math.max(...analytics.topColorFamilies.map(c => c.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Your Styles"
          value={analytics.userStats.totalStyles}
          subtitle={`Platform avg: ${analytics.userStats.platformAverageStyles}`}
          icon={Palette}
        />
        <StatCard
          title="Style Variety"
          value={analytics.topMoods.length}
          subtitle="Unique moods explored"
          icon={PieChart}
        />
        <StatCard
          title="Creator Rank"
          value={analytics.userStats.totalStyles === 0 
            ? "Getting started" 
            : analytics.userStats.percentileRank >= 50 
              ? `Top ${100 - analytics.userStats.percentileRank}%` 
              : "Rising creator"}
          subtitle={analytics.userStats.totalStyles === 0 
            ? "Create styles to rank" 
            : "Based on style count"}
          icon={TrendingUp}
        />
      </div>

      <InsightsList insights={analytics.insights} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="moods-chart">
          <CardHeader>
            <CardTitle className="text-lg">Your Top Moods</CardTitle>
            <CardDescription>Most common moods in your styles</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart items={analytics.topMoods} maxCount={maxMoodCount} />
          </CardContent>
        </Card>

        <Card data-testid="colors-chart">
          <CardHeader>
            <CardTitle className="text-lg">Your Color Families</CardTitle>
            <CardDescription>Dominant color palettes you use</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart items={analytics.topColorFamilies} maxCount={maxColorCount} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PlatformAnalyticsView() {
  const { data: analytics, isLoading, error } = useQuery<PlatformAnalytics>({
    queryKey: ["/api/analytics/public"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="text-center py-16 space-y-4">
        <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30" />
        <h2 className="text-xl font-medium text-muted-foreground">Unable to load platform analytics</h2>
      </div>
    );
  }

  const maxMoodCount = Math.max(...analytics.topMoods.map(m => m.count), 1);
  const maxColorCount = Math.max(...analytics.topColorFamilies.map(c => c.count), 1);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Styles"
          value={analytics.platformStats.totalStyles}
          subtitle="In the gallery"
          icon={Palette}
        />
        <StatCard
          title="Creators"
          value={analytics.platformStats.uniqueCreators}
          subtitle={`Avg ${analytics.platformStats.averageStylesPerCreator} styles each`}
          icon={Users}
        />
        <StatCard
          title="Trending"
          value={analytics.trends.trending[0] || "—"}
          subtitle="Most popular mood"
          icon={TrendingUp}
        />
      </div>

      <Card data-testid="trending-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Trending Now
          </CardTitle>
          <CardDescription>Popular moods in recent styles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {analytics.trends.trending.map((trend, index) => (
              <span 
                key={index}
                className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm capitalize"
                data-testid={`trend-tag-${index}`}
              >
                {trend}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="platform-moods-chart">
          <CardHeader>
            <CardTitle className="text-lg">Popular Moods</CardTitle>
            <CardDescription>Most common moods across all styles</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart items={analytics.topMoods.slice(0, 8)} maxCount={maxMoodCount} />
          </CardContent>
        </Card>

        <Card data-testid="platform-colors-chart">
          <CardHeader>
            <CardTitle className="text-lg">Popular Color Families</CardTitle>
            <CardDescription>Most used color palettes</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart items={analytics.topColorFamilies.slice(0, 8)} maxCount={maxColorCount} />
          </CardContent>
        </Card>
      </div>

      {analytics.topEras.length > 0 && (
        <Card data-testid="eras-card">
          <CardHeader>
            <CardTitle className="text-lg">Style Eras</CardTitle>
            <CardDescription>Historical influences in the collection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analytics.topEras.map((era, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-sm capitalize"
                  data-testid={`era-tag-${index}`}
                >
                  {era.name.replace(/-/g, ' ')} ({era.count})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Analytics() {
  return (
    <Layout>
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="back-button">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="analytics-title">
              <BarChart3 className="h-6 w-6" />
              Style Analytics
            </h1>
            <p className="text-muted-foreground text-sm">
              Discover patterns and trends in your design collection
            </p>
          </div>
        </div>

        <Tabs defaultValue="my" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="my" data-testid="tab-my-analytics">My Analytics</TabsTrigger>
            <TabsTrigger value="platform" data-testid="tab-platform-analytics">Platform Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="my">
            <MyAnalytics />
          </TabsContent>

          <TabsContent value="platform">
            <PlatformAnalyticsView />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
