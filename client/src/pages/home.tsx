import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ActivityFeed } from "@/components/activity-feed";
import { MemberSpotlight } from "@/components/member-spotlight";
import { QuickActions } from "@/components/quick-actions";
import { GiftGivingProgress } from "@/components/gift-giving-progress";
import { AddItemListPicker } from "@/components/add-item-list-picker";
import { SharedPersonalLists } from "@/components/shared-personal-lists";

interface DashboardStats {
  myItemsCount: number;
  groupMembersCount: number;
  itemsPurchasedByOthers: number;
  totalPurchased: number;
}

interface FamilyData {
  id: string;
  name: string;
  giftBudget: number | null;
}

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedFamilyId, families } = useFamily();
  const [, setLocation] = useLocation();
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  
  const selectedFamily = families?.find((f) => f.id === selectedFamilyId);

  const { data: familiesData, isLoading: familiesLoading } = useQuery<FamilyData[]>({
    queryKey: ["/api/families"],
    retry: false,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats | null>({
    queryKey: ["/api/stats", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return null;
      
      const params = new URLSearchParams({ familyId: selectedFamilyId });
      
      const response = await fetch(`/api/stats?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      return response.json() as Promise<DashboardStats>;
    },
    enabled: !!selectedFamilyId,
    retry: false,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const handleAddItemClick = () => {
    setIsAddItemDialogOpen(true);
  };

  if (authLoading || familiesLoading || statsLoading) {
    return (
      <div className="p-3 md:p-8 space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  const hasFamilies = familiesData && familiesData.length > 0;

  // No family state
  if (!hasFamilies) {
    return (
      <div className="p-3 md:p-8">
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-serif text-xl font-semibold mb-2 text-foreground">Welcome to The Gift Genius!</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Start by creating a group or joining one to begin sharing wishlists and coordinating gifts.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setLocation('/families/create')}
                data-testid="button-create-group-empty"
              >
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                Create Group
              </Button>
              <Button
                onClick={() => setLocation('/families/join')}
                variant="outline"
                data-testid="button-join-group-empty"
              >
                <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
                Join Group
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-8 space-y-3 md:space-y-4">
      {/* Gift-Giving Progress Section - Above Quick Actions */}
      <GiftGivingProgress />

      {/* Quick Actions Section */}
      <QuickActions onAddItemClick={handleAddItemClick} />

      {/* Member Spotlight Section */}
      <MemberSpotlight familyId={selectedFamilyId!} />

      {/* Shared Personal Lists Section */}
      <SharedPersonalLists />

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation('/activities')} 
              data-testid="view-all-activity"
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ActivityFeed familyId={selectedFamilyId!} limit={5} compact />
        </CardContent>
      </Card>

      {/* Add Item List Picker Dialog */}
      <AddItemListPicker
        open={isAddItemDialogOpen}
        onOpenChange={setIsAddItemDialogOpen}
      />
    </div>
  );
}
