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
import { FamilyProvider } from "@/contexts/FamilyContext";
import { FamilySwitcher } from "@/components/family-switcher";
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

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  if (isLoading || !isAuthenticated) {
    return (
      <>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/families/join" component={JoinFamily} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </>
    );
  }

  return (
    <FamilyProvider>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between p-2 md:p-4 border-b border-border gap-2 md:gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex-1 md:flex-initial">
                <FamilySwitcher />
              </div>
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
            <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/families/create" component={CreateFamily} />
                <Route path="/families/join" component={JoinFamily} />
                <Route path="/wishlist" component={Wishlist} />
                <Route path="/members" component={Members} />
                <Route path="/members/:userId" component={MemberWishlist} />
                <Route path="/search" component={Search} />
                <Route path="/purchased" component={Purchased} />
                <Route path="/budget" component={Budget} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
          <BottomNav />
        </div>
        <UserSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
        <Toaster />
      </SidebarProvider>
    </FamilyProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
