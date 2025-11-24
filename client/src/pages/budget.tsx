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
    <div className="container mx-auto p-4 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="title-budget">
            Budget Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {budgetData?.event?.name || 'Event Budget'}
          </p>
        </div>
        {!isEditing && isOrganizer && (
          <Button
            onClick={handleStartEdit}
            variant="outline"
            data-testid="button-edit-budget"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Allocations
          </Button>
        )}
        {isEditing && (
          <div className="flex gap-2">
            <Button
              onClick={handleSaveAllocations}
              disabled={updateAllocationsMutation.isPending}
              data-testid="button-save-budget"
            >
              <Check className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              variant="outline"
              data-testid="button-cancel-edit"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Total Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-budget">
              ${budgetData?.totalAllocated?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Allocated for {budgetData?.event?.name}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-spent">
              ${budgetData?.totalSpent?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {budgetData?.totalAllocated > 0
                ? `${((budgetData.totalSpent / budgetData.totalAllocated) * 100).toFixed(0)}% of budget`
                : '0% of budget'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-remaining">
              ${budgetData?.totalRemaining?.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Available to spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Person Budget Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Budget by Family Member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {budgetData?.memberBudgets?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No budget allocations set yet. Click "Edit Allocations" to get started.
            </div>
          )}
          {budgetData?.memberBudgets?.map((member: any) => {
            const key = member.userId || member.managedProfileId;
            return (
              <div key={key} className="space-y-3" data-testid={`budget-member-${key}`}>
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.profileImageUrl} alt={member.displayName} />
                    <AvatarFallback>
                      {member.displayName?.split(' ').map((n: string) => n[0]).join('') || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground truncate">
                      {member.displayName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                        member.status === 'good' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        member.status === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {getStatusText(member.status)}
                      </span>
                    </div>
                  </div>
                  {!isEditing && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground">
                        ${member.spent?.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        of ${member.allocated?.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {isEditing && (
                    <div className="w-32">
                      <Label htmlFor={`budget-${key}`} className="text-sm">Budget</Label>
                      <div className="flex items-center">
                        <span className="text-muted-foreground mr-1">$</span>
                        <Input
                          id={`budget-${key}`}
                          type="number"
                          min="0"
                          step="1"
                          value={allocations[key] || '0'}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty string or valid numbers
                            if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                              setAllocations({ ...allocations, [key]: value });
                            }
                          }}
                          data-testid={`input-budget-${key}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {!isEditing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Remaining: ${member.remaining?.toFixed(2)}
                      </span>
                      <span className="font-medium text-foreground">
                        {member.percentUsed?.toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      value={Math.min(member.percentUsed, 100)}
                      className="h-2"
                      data-testid={`progress-${key}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
