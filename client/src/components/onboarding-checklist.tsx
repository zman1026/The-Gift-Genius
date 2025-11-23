import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Circle, X, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useFamily } from "@/contexts/FamilyContext";
import { cn } from "@/lib/utils";

interface ChecklistTask {
  id: string;
  title: string;
  description: string;
  action: string;
  path: string;
  completed: boolean;
}

export function OnboardingChecklist() {
  const [, setLocation] = useLocation();
  const { selectedFamilyId } = useFamily();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if checklist was dismissed
  useEffect(() => {
    const dismissed = localStorage.getItem("onboarding-dismissed");
    setIsDismissed(dismissed === "true");
  }, []);

  // Fetch user stats to determine task completion
  const { data: stats } = useQuery({
    queryKey: ["/api/stats", selectedFamilyId],
    queryFn: async () => {
      if (!selectedFamilyId) return null;
      const response = await fetch(`/api/stats?familyId=${selectedFamilyId}`, {
        credentials: "include",
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  const { data: familiesData } = useQuery({
    queryKey: ["/api/families"],
    retry: false,
  });

  const hasFamilies = familiesData && familiesData.length > 0;

  // Define checklist tasks
  const tasks: ChecklistTask[] = [
    {
      id: "create-family",
      title: "Create or join a family",
      description: "Start by creating a family group or joining an existing one",
      action: "Create Family",
      path: "/families/create",
      completed: hasFamilies,
    },
    {
      id: "add-item",
      title: "Add your first wishlist item",
      description: "Add something you'd like to receive this Christmas",
      action: "Add Item",
      path: "/wishlist",
      completed: (stats?.myItemsCount || 0) > 0,
    },
    {
      id: "invite-member",
      title: "Invite a family member",
      description: "Share your wishlist with family and friends",
      action: "Invite",
      path: "/dashboard",
      completed: (stats?.familyMembersCount || 0) > 1,
    },
    {
      id: "view-wishlist",
      title: "View someone's wishlist",
      description: "Check out what others are wishing for",
      action: "View Family",
      path: "/members",
      completed: false, // Can't easily track this, so leave as manual completion
    },
  ];

  const completedCount = tasks.filter((task) => task.completed).length;
  const progress = (completedCount / tasks.length) * 100;
  const allCompleted = completedCount === tasks.length;

  const handleDismiss = () => {
    localStorage.setItem("onboarding-dismissed", "true");
    setIsDismissed(true);
  };

  // Don't show if dismissed or all tasks completed
  if (isDismissed || allCompleted) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5" data-testid="onboarding-checklist">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-xl">🎁</span>
              Getting Started
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Complete these steps to make the most of your Christmas wishlist
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8 -mt-1 -mr-1"
            data-testid="button-dismiss-checklist"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {completedCount} of {tasks.length} complete
            </span>
            <span className="text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" data-testid="checklist-progress" />
        </div>

        {/* Task list */}
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                task.completed
                  ? "bg-primary/5 border-primary/20"
                  : "bg-background hover-elevate cursor-pointer"
              )}
              onClick={() => !task.completed && setLocation(task.path)}
              data-testid={`checklist-task-${task.id}`}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                  task.completed
                    ? "bg-primary text-primary-foreground"
                    : "border-2 border-muted-foreground"
                )}
              >
                {task.completed ? <Check className="w-3 h-3" /> : <Circle className="w-2 h-2 fill-current" />}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "font-medium text-sm",
                    task.completed ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {task.title}
                </p>
                {!task.completed && (
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                )}
              </div>

              {!task.completed && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocation(task.path);
                  }}
                  data-testid={`button-${task.id}`}
                >
                  {task.action}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
