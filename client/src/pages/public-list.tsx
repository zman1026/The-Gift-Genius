import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Gift, 
  Cake, 
  GraduationCap, 
  Heart, 
  Baby, 
  Home as HomeIcon, 
  PartyPopper, 
  Calendar, 
  ExternalLink, 
  Check,
  Package,
  User
} from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const occasionTypes = [
  { value: "birthday", label: "Birthday", icon: Cake },
  { value: "graduation", label: "Graduation", icon: GraduationCap },
  { value: "wedding", label: "Wedding", icon: Heart },
  { value: "baby_shower", label: "Baby Shower", icon: Baby },
  { value: "anniversary", label: "Anniversary", icon: Heart },
  { value: "housewarming", label: "Housewarming", icon: HomeIcon },
  { value: "holiday", label: "Holiday", icon: PartyPopper },
  { value: "other", label: "Other", icon: Gift },
] as const;

const occasionThemes: Record<string, { primary: string; accent: string; background: string }> = {
  birthday: { primary: "#EC4899", accent: "#F97316", background: "#FDF2F8" },
  graduation: { primary: "#3B82F6", accent: "#10B981", background: "#EFF6FF" },
  wedding: { primary: "#F43F5E", accent: "#D4AF37", background: "#FFF1F2" },
  baby_shower: { primary: "#A855F7", accent: "#EC4899", background: "#FAF5FF" },
  anniversary: { primary: "#EF4444", accent: "#F59E0B", background: "#FEF2F2" },
  housewarming: { primary: "#84CC16", accent: "#F97316", background: "#F7FEE7" },
  holiday: { primary: "#DC2626", accent: "#15803D", background: "#FEF2F2" },
  other: { primary: "#6366F1", accent: "#8B5CF6", background: "#EEF2FF" },
};

export default function PublicList() {
  const [, params] = useRoute("/lists/:slug");
  const slug = params?.slug;

  const { data: listData, isLoading, error } = useQuery<any>({
    queryKey: ["/api/public/lists", slug],
    queryFn: async () => {
      const response = await fetch(`/api/public/lists/${slug}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to load list");
      }
      return response.json();
    },
    enabled: !!slug,
  });

  const getOccasionIcon = (type: string) => {
    const occasion = occasionTypes.find(o => o.value === type);
    return occasion?.icon || Gift;
  };

  const getOccasionLabel = (type: string) => {
    const occasion = occasionTypes.find(o => o.value === type);
    return occasion?.label || type;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" className="text-xs">High Priority</Badge>;
      case "low":
        return <Badge variant="secondary" className="text-xs">Low Priority</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Medium Priority</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4 md:p-6 max-w-4xl">
          <Skeleton className="h-40 w-full mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !listData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-lg font-semibold mb-2">List Not Found</h3>
            <p className="text-muted-foreground">
              This wishlist may have been removed or the link is incorrect.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = getOccasionIcon(listData.occasionType);
  const themeColors = listData.themeColors || occasionThemes[listData.occasionType] || occasionThemes.other;
  const items = listData.items || [];
  const owner = listData.owner;

  return (
    <div className="min-h-screen bg-background">
      <div 
        className="w-full py-8 md:py-12"
        style={{ 
          background: `linear-gradient(135deg, ${themeColors.background} 0%, ${themeColors.primary}15 100%)`,
          borderBottom: `3px solid ${themeColors.primary}`
        }}
      >
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div 
              className="p-4 rounded-2xl"
              style={{ backgroundColor: `${themeColors.primary}20` }}
            >
              <Icon 
                className="w-12 h-12" 
                style={{ color: themeColors.primary }}
                aria-hidden="true"
              />
            </div>
            <div className="text-center md:text-left flex-1">
              <h1 className="text-2xl md:text-3xl font-bold mb-2" data-testid="text-list-title">
                {listData.name}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-muted-foreground">
                <Badge 
                  style={{ 
                    backgroundColor: `${themeColors.primary}20`,
                    color: themeColors.primary,
                    borderColor: themeColors.primary
                  }}
                >
                  {getOccasionLabel(listData.occasionType)}
                </Badge>
                {listData.date && (
                  <span className="text-sm flex items-center gap-1">
                    <Calendar className="w-4 h-4" aria-hidden="true" />
                    {format(new Date(listData.date), "MMMM d, yyyy")}
                  </span>
                )}
              </div>
              {listData.description && (
                <p className="mt-3 text-muted-foreground max-w-xl">
                  {listData.description}
                </p>
              )}
            </div>
            {owner && (
              <div className="flex flex-col items-center gap-2 shrink-0">
                <Avatar className="h-16 w-16 border-2" style={{ borderColor: themeColors.primary }}>
                  <AvatarImage src={owner.profileImageUrl} alt={owner.firstName} />
                  <AvatarFallback style={{ backgroundColor: themeColors.background, color: themeColors.primary }}>
                    {owner.firstName?.[0]}{owner.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {owner.firstName} {owner.lastName}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" data-testid="text-items-count">
            Wishlist Items ({items.length})
          </h2>
        </div>

        {items.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-lg font-semibold mb-2">No items yet</h3>
              <p className="text-muted-foreground">
                This wishlist is empty. Check back later!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item: any) => (
              <Card 
                key={item.id} 
                className={`overflow-hidden transition-all ${item.isPurchased ? 'opacity-60' : ''}`}
                data-testid={`card-item-${item.id}`}
              >
                <div className="flex">
                  {item.imageUrl && (
                    <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 relative">
                      <img 
                        src={item.imageUrl} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      {item.isPurchased && (
                        <div 
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ backgroundColor: `${themeColors.primary}90` }}
                        >
                          <Check className="w-8 h-8 text-white" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                  )}
                  <CardContent className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${item.isPurchased ? 'line-through' : ''}`}>
                            {item.name}
                          </h3>
                          {item.isPurchased && (
                            <Badge 
                              style={{ 
                                backgroundColor: themeColors.primary,
                                color: 'white'
                              }}
                            >
                              Purchased
                            </Badge>
                          )}
                        </div>
                        {item.price && (
                          <p className="text-lg font-semibold" style={{ color: themeColors.primary }}>
                            ${parseFloat(item.price).toFixed(2)}
                            {item.quantity > 1 && (
                              <span className="text-sm font-normal text-muted-foreground">
                                {" "}x {item.quantity}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {!item.isPurchased && getPriorityBadge(item.priority)}
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {item.description}
                      </p>
                    )}
                    {item.link && !item.isPurchased && (
                      <a 
                        href={item.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Button 
                          variant="outline" 
                          size="sm"
                          style={{ 
                            borderColor: themeColors.primary,
                            color: themeColors.primary
                          }}
                          className="hover-elevate"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
                          View Item
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Powered by <span className="font-semibold">The Gift Genius</span>
          </p>
        </div>
      </div>
    </div>
  );
}
