import { useState } from "react";
import { Home, Gift, Users, Search, Settings, LogOut, ShoppingBag } from "lucide-react";
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
    title: "Family Members",
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
  {
    title: "Search Products",
    url: "/search",
    icon: Search,
    testId: "nav-search",
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
                      <item.icon />
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
            <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
            <AvatarFallback>{getInitials(user?.firstName, user?.lastName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate" data-testid="text-user-name">
              {user?.firstName || user?.lastName
                ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                : user?.email || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Settings className="w-4 h-4 text-muted-foreground" />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => window.location.href = '/api/logout'}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </SidebarFooter>

      <UserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  );
}
