import { useState } from "react";
import { Home, Gift, Users, Settings, LogOut, ShoppingBag, Plus, DollarSign } from "lucide-react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { UserSettingsDialog } from "@/components/user-settings-dialog";
import { FamilySwitcher } from "@/components/family-switcher";
import { EventSwitcher } from "@/components/event-switcher";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    testId: "nav-dashboard",
  },
  {
    title: "My Wishlist",
    url: "/my-list",
    icon: Gift,
    testId: "nav-wishlist",
  },
  {
    title: "Add Item",
    url: "/search",
    icon: Plus,
    testId: "nav-add-item",
  },
  {
    title: "Budget",
    url: "/budget",
    icon: DollarSign,
    testId: "nav-budget",
  },
  {
    title: "Group Members",
    url: "/members",
    icon: Users,
    testId: "nav-members",
  },
  {
    title: "Purchased Items",
    url: "/purchased",
    icon: ShoppingBag,
    testId: "nav-purchased",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  return (
    <Sidebar>
      <SidebarContent className="pb-20 md:pb-0">
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-serif text-primary px-4 py-4">
            The Gift Genius
          </SidebarGroupLabel>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupContent className="px-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-sidebar-foreground">Group</label>
              <FamilySwitcher />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-sidebar-foreground">Event</label>
              <EventSwitcher />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-xs text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                  >
                    <a href={item.url}>
                      <item.icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 pb-24 md:pb-4 border-t border-sidebar-border">
        <div
          className="flex items-center gap-3 mb-3 p-2 rounded-md cursor-pointer hover-elevate active-elevate-2"
          onClick={() => setSettingsOpen(true)}
          data-testid="button-open-settings"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={(user as any)?.profileImageUrl || undefined} alt={(user as any)?.firstName || "User"} />
            <AvatarFallback>{getInitials((user as any)?.firstName, (user as any)?.lastName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate" data-testid="text-user-name">
              {(user as any)?.firstName || (user as any)?.lastName
                ? `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim()
                : (user as any)?.email || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{(user as any)?.email}</p>
          </div>
          <Settings className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.location.href = '/api/logout'}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
          Log Out
        </Button>
      </SidebarFooter>

      <UserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  );
}
