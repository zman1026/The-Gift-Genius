import { useFamily } from "@/contexts/FamilyContext";
import { useEvent } from "@/contexts/EventContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Edit2, Check, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Budget() {
  const { selectedFamilyId, families } = useFamily();
  const { selectedEventId } = useEvent();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['/api/events', selectedEventId, 'budget'],
    queryFn: async () => {
      const response = await fetch(`/api/events/${selectedEventId}/budget`);
      if (!response.ok) throw new Error('Failed to fetch budget data');
      return response.json();
    },
    enabled: !!selectedEventId,
  });

  const updateAllocationsMutation = useMutation({
    mutationFn: async (newAllocations: any[]) => {
      const response = await fetch(`/api/events/${selectedEventId}/budget/allocations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: newAllocations }),
      });
      if (!response.ok) throw new Error('Failed to update budget allocations');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', selectedEventId, 'budget'] });
      setIsEditing(false);
      toast({
        title: "Budget updated",
        description: "Budget allocations have been successfully updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update budget allocations",
        variant: "destructive",
      });
    },
  });

  if (!selectedEventId) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center space-y-2">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium text-foreground">No Event Selected</h3>
          <p className="text-sm text-muted-foreground">Please select an event from the sidebar to view its budget</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading budget...</p>
        </div>
      </div>
    );
  }

  const handleStartEdit = () => {
    setIsEditing(true);
    const initialAllocations: Record<string, string> = {};
    budgetData?.memberBudgets?.forEach((member: any) => {
      const key = member.userId || member.managedProfileId;
      initialAllocations[key] = member.allocated.toString();
    });
    setAllocations(initialAllocations);
  };

  const handleSaveAllocations = () => {
    // Read actual values from DOM inputs for validation (in case of programmatic changes)
    const actualAllocations: Record<string, string> = {};
    Object.keys(allocations).forEach(key => {
      const inputElement = document.getElementById(`budget-${key}`) as HTMLInputElement;
      if (inputElement) {
        actualAllocations[key] = inputElement.value;
      } else {
        actualAllocations[key] = allocations[key];
      }
    });

    // Client-side validation
    const allocationArray = Object.entries(actualAllocations).map(([key, value]) => {
      const amount = parseFloat(value);
      
      // Strict validation: must be a valid non-negative number
      if (isNaN(amount) || amount < 0 || !isFinite(amount)) {
        toast({
          title: "Invalid Budget",
          description: "All budget amounts must be non-negative numbers",
          variant: "destructive",
        });
        return null;
      }
      
      const member = budgetData.memberBudgets.find(
        (m: any) => (m.userId || m.managedProfileId) === key
      );
      return {
        userId: member.userId || null,
        managedProfileId: member.managedProfileId || null,
        allocatedAmount: amount,
      };
    });

    // Check if any allocations failed validation
    if (allocationArray.some(a => a === null)) {
      return;
    }

    updateAllocationsMutation.mutate(allocationArray.filter(a => a !== null));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'over':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'good':
        return 'On Track';
      case 'warning':
        return 'Approaching Limit';
      case 'over':
        return 'Over Budget';
      default:
        return 'Unknown';
    }
  };

  // Check if user is the family organizer
  const currentFamily = families.find((f: any) => f.id === selectedFamilyId);
  const isOrganizer = currentFamily?.createdById === (user as any)?.id;

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate" data-testid="title-budget">
            Budget
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            {budgetData?.event?.name || 'Event Budget'}
          </p>
        </div>
        {!isEditing && isOrganizer && (
          <Button
            onClick={handleStartEdit}
            variant="outline"
            data-testid="button-edit-budget"
          >
            <Edit2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
        )}
        {isEditing && (
          <div className="flex gap-2">
            <Button
              onClick={handleSaveAllocations}
              disabled={updateAllocationsMutation.isPending}
              data-testid="button-save-budget"
            >
              <Check className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              variant="outline"
              data-testid="button-cancel-edit"
              aria-label="Cancel editing"
            >
              <X className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
          </div>
        )}
      </div>

      {/* Compact Budget Overview */}
      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Budget</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-total-budget">
                ${budgetData?.totalAllocated?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Spent</p>
              <p className="text-xl sm:text-2xl font-semibold text-foreground" data-testid="text-total-spent">
                ${budgetData?.totalSpent?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
          <Progress
            value={budgetData?.totalAllocated > 0 
              ? Math.min((budgetData.totalSpent / budgetData.totalAllocated) * 100, 100)
              : 0
            }
            className="h-2 mb-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {budgetData?.totalAllocated > 0
                ? `${((budgetData.totalSpent / budgetData.totalAllocated) * 100).toFixed(0)}% used`
                : '0% used'}
            </span>
            <span data-testid="text-total-remaining">
              ${budgetData?.totalRemaining?.toFixed(2) || '0.00'} left
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Simplified Member List */}
      <div className="space-y-2">
        {budgetData?.memberBudgets?.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No budget set yet.
              {isOrganizer && <span className="block mt-1">Tap "Edit" to get started.</span>}
            </CardContent>
          </Card>
        )}
        {budgetData?.memberBudgets?.map((member: any) => {
          const key = member.userId || member.managedProfileId;
          return (
            <Card key={key} data-testid={`budget-member-${key}`}>
              <CardContent className="p-3 sm:p-4">
                {!isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.profileImageUrl} alt={member.displayName} />
                        <AvatarFallback className="text-xs">
                          {member.displayName?.split(' ').map((n: string) => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {member.displayName}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          ${member.spent?.toFixed(2)} of ${member.allocated?.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          member.status === 'good' ? 'text-green-600 dark:text-green-400' :
                          member.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {member.percentUsed?.toFixed(0)}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ${member.remaining?.toFixed(2)} left
                        </p>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(member.percentUsed, 100)}
                      className="h-1.5"
                      data-testid={`progress-${key}`}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profileImageUrl} alt={member.displayName} />
                      <AvatarFallback className="text-xs">
                        {member.displayName?.split(' ').map((n: string) => n[0]).join('') || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {member.displayName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        id={`budget-${key}`}
                        type="number"
                        min="0"
                        step="1"
                        value={allocations[key] || '0'}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                            setAllocations({ ...allocations, [key]: value });
                          }
                        }}
                        className="w-20 h-9 text-sm"
                        data-testid={`input-budget-${key}`}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
