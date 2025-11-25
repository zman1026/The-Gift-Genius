import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserSettingsDialog } from "@/components/user-settings-dialog";
import { useAuth } from "@/hooks/useAuth";
import { FamilyProvider, useFamily } from "@/contexts/FamilyContext";
import { CurrentMemberProvider, useCurrentMember } from "@/contexts/CurrentMemberContext";
import { GroupHeader } from "@/components/group-header";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import CreateFamily from "@/pages/create-family";
import JoinFamily from "@/pages/join-family";
import Wishlist from "@/pages/wishlist";
import Members from "@/pages/members";
import MemberWishlist from "@/pages/member-wishlist";
import Search from "@/pages/search";
import Purchased from "@/pages/purchased";
import Budget from "@/pages/budget";
import GiftCoordination from "@/pages/gift-coordination";
import Activities from "@/pages/activities";
import More from "@/pages/more";
import MyWishlists from "@/pages/my-wishlists";
import PersonalListDetail from "@/pages/personal-list-detail";
import PublicList from "@/pages/public-list";
import { AppErrorBoundary } from "@/components/error-boundary";
import { UnifiedAddItemDialog } from "@/components/unified-add-item-dialog";

function AuthenticatedContent() {
  const { user } = useAuth();
  const { selectedFamilyId } = useFamily();
  const { currentMemberId, currentMemberName } = useCurrentMember();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  
  const handleAddItemSuccess = () => {
    // Invalidate wishlist queries when an item is added
    queryClient.invalidateQueries({ queryKey: ["/api/wishlist"] });
    // If adding to a member's wishlist, also invalidate their wishlist
    if (currentMemberId) {
      queryClient.invalidateQueries({ queryKey: ["/api/members", currentMemberId, "wishlist"] });
    }
    // Invalidate activities to show the new activity log
    queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
    setIsAddItemDialogOpen(false);
  };

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const getInitials = () => {
    if (!user) return "U";
    const firstName = (user as any).firstName;
    const lastName = (user as any).lastName;
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-2 md:p-4 border-b border-border gap-2 md:gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="md:hidden">
              <GroupHeader />
            </div>
            <div className="flex-1 hidden md:block"></div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
              className="md:hidden"
              data-testid="button-mobile-settings"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={(user as any)?.profileImageUrl} alt="User" />
                <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
              </Avatar>
            </Button>
          </header>
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/my-list" component={Wishlist} />
              <Route path="/families/create" component={CreateFamily} />
              <Route path="/families/join" component={JoinFamily} />
              <Route path="/wishlist" component={Wishlist} />
              <Route path="/members" component={Members} />
              <Route path="/members/:userId" component={MemberWishlist} />
              <Route path="/search" component={Search} />
              <Route path="/purchased" component={Purchased} />
              <Route path="/budget" component={Budget} />
              <Route path="/gift-coordination" component={GiftCoordination} />
              <Route path="/activities" component={Activities} />
              <Route path="/more" component={More} />
              <Route path="/my-wishlists" component={MyWishlists} />
              <Route path="/personal-lists/:listId" component={PersonalListDetail} />
              <Route path="/lists/:slug" component={PublicList} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
        <BottomNav 
          onAddItemClick={() => setIsAddItemDialogOpen(true)}
          disabled={!selectedFamilyId}
        />
      </div>
      {selectedFamilyId && (
        <UnifiedAddItemDialog 
          open={isAddItemDialogOpen} 
          onOpenChange={setIsAddItemDialogOpen}
          familyId={selectedFamilyId}
          targetUserId={currentMemberId || undefined}
          targetUserName={currentMemberName || undefined}
          onSuccess={handleAddItemSuccess}
        />
      )}
      <UserSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <Toaster />
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || !isAuthenticated) {
    return (
      <>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/families/join" component={JoinFamily} />
          <Route path="/lists/:slug" component={PublicList} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </>
    );
  }

  return (
    <FamilyProvider>
      <CurrentMemberProvider>
        <AuthenticatedContent />
      </CurrentMemberProvider>
    </FamilyProvider>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
