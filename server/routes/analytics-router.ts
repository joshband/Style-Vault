import { Router } from "express";
import { storage } from "../storage";
import { getTagsSummary } from "../metadata-enrichment";
import { isAuthenticated } from "../replit_integrations/auth";

const router = Router();

function calculatePercentile(userCount: number, creatorCounts: Record<string, number>): number {
  const counts = Object.values(creatorCounts);
  
  if (counts.length === 0 || userCount === 0) return 0;
  
  const belowCount = counts.filter(c => c < userCount).length;
  
  return Math.min(99, Math.round((belowCount / counts.length) * 100));
}

function generateInsights(styles: any[], topMoods: any[], topColorFamilies: any[]): string[] {
  const insights: string[] = [];
  
  if (styles.length === 0) {
    insights.push("Create your first style to start seeing insights!");
    return insights;
  }
  
  if (styles.length === 1) {
    insights.push("You've created your first style! Create more to see patterns emerge.");
  } else if (styles.length >= 5) {
    insights.push(`You're building a solid collection with ${styles.length} styles.`);
  }
  
  if (topMoods.length > 0) {
    const dominantMood = topMoods[0].name.replace(/-/g, ' ');
    insights.push(`Your styles tend toward "${dominantMood}" moods.`);
  }
  
  if (topColorFamilies.length > 0) {
    const dominantColor = topColorFamilies[0].name.replace(/-/g, ' ');
    insights.push(`You gravitate toward "${dominantColor}" color palettes.`);
  }
  
  if (topMoods.length >= 3) {
    insights.push("Your style range is diverse - you explore multiple visual moods.");
  }
  
  return insights;
}

function computeStyleAnalytics(userStyles: any[], allPublicStyles: any[]) {
  const moodFrequency: Record<string, number> = {};
  const colorFamilyFrequency: Record<string, number> = {};
  const textureFrequency: Record<string, number> = {};
  const lightingFrequency: Record<string, number> = {};

  for (const style of userStyles) {
    const tags = style.metadataTags || {};
    
    for (const mood of (tags.mood || [])) {
      moodFrequency[mood] = (moodFrequency[mood] || 0) + 1;
    }
    
    for (const colorFamily of (tags.colorFamily || [])) {
      colorFamilyFrequency[colorFamily] = (colorFamilyFrequency[colorFamily] || 0) + 1;
    }
    
    for (const texture of (tags.texture || [])) {
      textureFrequency[texture] = (textureFrequency[texture] || 0) + 1;
    }
    
    for (const lighting of (tags.lighting || [])) {
      lightingFrequency[lighting] = (lightingFrequency[lighting] || 0) + 1;
    }
  }

  const styleCount = userStyles.length;
  
  const topMoods = Object.entries(moodFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topColorFamilies = Object.entries(colorFamilyFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const creatorCounts: Record<string, number> = {};
  for (const style of allPublicStyles) {
    if (style.creatorId) {
      creatorCounts[style.creatorId] = (creatorCounts[style.creatorId] || 0) + 1;
    }
  }
  
  const uniqueCreatorCount = Object.keys(creatorCounts).length;
  const platformAverage = uniqueCreatorCount > 0 
    ? Math.round(allPublicStyles.length / uniqueCreatorCount)
    : styleCount > 0 ? styleCount : 1;

  const percentileRank = calculatePercentile(styleCount, creatorCounts);

  const tokenDistribution = {
    colors: Object.keys(colorFamilyFrequency).length,
    textures: Object.keys(textureFrequency).length,
    moods: Object.keys(moodFrequency).length,
    total: styleCount,
  };

  return {
    userStats: {
      totalStyles: styleCount,
      platformAverageStyles: platformAverage,
      percentileRank,
    },
    tokenDistribution,
    topMoods,
    topColorFamilies,
    insights: generateInsights(userStyles, topMoods, topColorFamilies),
  };
}

function identifyTrends(allStyles: any[]): { trending: string[]; emerging: string[] } {
  const recentStyles = allStyles
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);
  
  const recentMoods: Record<string, number> = {};
  for (const style of recentStyles) {
    for (const mood of (style.metadataTags?.mood || [])) {
      recentMoods[mood] = (recentMoods[mood] || 0) + 1;
    }
  }
  
  const trending = Object.entries(recentMoods)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name.replace(/-/g, ' '));
  
  return {
    trending: trending.length > 0 ? trending : ["No clear trends yet"],
    emerging: [],
  };
}

function computePlatformAnalytics(allStyles: any[]) {
  const moodFrequency: Record<string, number> = {};
  const colorFamilyFrequency: Record<string, number> = {};
  const eraFrequency: Record<string, number> = {};
  
  for (const style of allStyles) {
    const tags = style.metadataTags || {};
    
    for (const mood of (tags.mood || [])) {
      moodFrequency[mood] = (moodFrequency[mood] || 0) + 1;
    }
    
    for (const colorFamily of (tags.colorFamily || [])) {
      colorFamilyFrequency[colorFamily] = (colorFamilyFrequency[colorFamily] || 0) + 1;
    }
    
    for (const era of (tags.era || [])) {
      eraFrequency[era] = (eraFrequency[era] || 0) + 1;
    }
  }

  const topMoods = Object.entries(moodFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count, percentage: Math.round((count / allStyles.length) * 100) }));

  const topColorFamilies = Object.entries(colorFamilyFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count, percentage: Math.round((count / allStyles.length) * 100) }));

  const topEras = Object.entries(eraFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const uniqueCreators = new Set(allStyles.map(s => s.creatorId).filter(Boolean)).size;

  return {
    platformStats: {
      totalStyles: allStyles.length,
      uniqueCreators,
      averageStylesPerCreator: uniqueCreators > 0 ? Math.round(allStyles.length / uniqueCreators * 10) / 10 : 0,
    },
    topMoods,
    topColorFamilies,
    topEras,
    trends: identifyTrends(allStyles),
  };
}

router.get("/api/analytics/user", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    
    const [userStyles, allPublicStyles] = await Promise.all([
      storage.getStylesByCreator(userId),
      storage.getPublicStyleSummaries(),
    ]);
    
    const analytics = computeStyleAnalytics(userStyles, allPublicStyles);
    
    res.json({
      userId,
      ...analytics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error computing user analytics:", error);
    res.status(500).json({ error: "Failed to compute analytics" });
  }
});

router.get("/api/analytics/platform", async (req, res) => {
  try {
    const allStyles = await storage.getStyleSummaries();
    const analytics = computePlatformAnalytics(allStyles);
    
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      ...analytics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error computing platform analytics:", error);
    res.status(500).json({ error: "Failed to compute platform analytics" });
  }
});

router.get("/api/tags/summary", async (req, res) => {
  try {
    const summary = await getTagsSummary();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json(summary);
  } catch (error) {
    console.error("Error fetching tags summary:", error);
    res.status(500).json({ error: "Failed to fetch tags summary" });
  }
});

router.get("/api/analytics", isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userStyles = await storage.getStylesByCreator(userId);
    const allPublicStyles = await storage.getPublicStyleSummaries();
    const analytics = computeStyleAnalytics(userStyles, allPublicStyles);

    res.json({
      userId,
      ...analytics,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error computing analytics:", error);
    res.status(500).json({ error: "Failed to compute analytics" });
  }
});

export default router;
