import { useFamily } from "@/contexts/FamilyContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Edit2, Check, X, ShoppingBag, TreePine, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";

export default function Budget() {
  const { selectedFamilyId, families } = useFamily();
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const { toast } = useToast();
  
  // Log Purchase dialog state
  const [logPurchaseDialog, setLogPurchaseDialog] = useState<{
    open: boolean;
    member: any | null;
  }>({ open: false, member: null });
  const [purchaseForm, setPurchaseForm] = useState({
    price: '',
    description: '',
    purchasedFrom: '',
    notes: '',
  });

  const { data: budgetData, isLoading } = useQuery({
    queryKey: ['/api/families', selectedFamilyId, 'budget'],
    queryFn: async () => {
      const response = await fetch(`/api/families/${selectedFamilyId}/budget`);
      if (!response.ok) throw new Error('Failed to fetch budget data');
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  const updateAllocationsMutation = useMutation({
    mutationFn: async (newAllocations: any[]) => {
      const response = await fetch(`/api/families/${selectedFamilyId}/budget/allocations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: newAllocations }),
      });
      if (!response.ok) throw new Error('Failed to update budget allocations');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families', selectedFamilyId, 'budget'] });
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

  const logPurchaseMutation = useMutation({
    mutationFn: async (data: {
      familyId: string;
      recipientUserId: string | null;
      recipientManagedProfileId: string | null;
      price: number;
      description: string;
      purchasedFrom?: string;
      notes?: string;
    }) => {
      const response = await fetch('/api/purchases/off-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to log purchase');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/families', selectedFamilyId, 'budget'] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchases'] });
      setLogPurchaseDialog({ open: false, member: null });
      setPurchaseForm({ price: '', description: '', purchasedFrom: '', notes: '' });
      toast({
        title: "Purchase logged",
        description: "Off-wishlist purchase has been successfully logged",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log purchase",
        variant: "destructive",
      });
    },
  });

  if (!selectedFamilyId) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center space-y-2">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium text-foreground">No Group Selected</h3>
          <p className="text-sm text-muted-foreground">Please select a group from the sidebar to view its budget</p>
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

  const handleOpenLogPurchase = (member: any) => {
    setLogPurchaseDialog({ open: true, member });
    setPurchaseForm({ price: '', description: '', purchasedFrom: '', notes: '' });
  };

  const handleCloseLogPurchase = () => {
    setLogPurchaseDialog({ open: false, member: null });
    setPurchaseForm({ price: '', description: '', purchasedFrom: '', notes: '' });
  };

  const handleSubmitLogPurchase = () => {
    const price = parseFloat(purchaseForm.price);
    
    if (!purchaseForm.price || isNaN(price) || price <= 0) {
      toast({
        title: "Invalid price",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }

    if (!purchaseForm.description.trim()) {
      toast({
        title: "Missing description",
        description: "Please describe what you purchased",
        variant: "destructive",
      });
      return;
    }

    logPurchaseMutation.mutate({
      familyId: selectedFamilyId!,
      recipientUserId: logPurchaseDialog.member.userId || null,
      recipientManagedProfileId: logPurchaseDialog.member.managedProfileId || null,
      price,
      description: purchaseForm.description.trim(),
      purchasedFrom: purchaseForm.purchasedFrom.trim() || undefined,
      notes: purchaseForm.notes.trim() || undefined,
    });
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

  const christmasTheme = { primary: "#DC2626", accent: "#15803D", background: "#FEF2F2" };

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 max-w-6xl">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
        <Link href="/my-wishlists" className="hover:text-foreground transition-colors" data-testid="link-my-wishlists">
          My Wishlists
        </Link>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
        <Link href="/wishlist" className="hover:text-foreground transition-colors flex items-center gap-1" data-testid="link-christmas-wishlist">
          <TreePine className="w-3.5 h-3.5" style={{ color: christmasTheme.accent }} aria-hidden="true" />
          Christmas Wishlist
        </Link>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
        <span className="text-foreground font-medium">Budget</span>
      </nav>
      
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg shrink-0"
              style={{ backgroundColor: christmasTheme.background }}
            >
              <DollarSign 
                className="w-5 h-5" 
                style={{ color: christmasTheme.accent }}
                aria-hidden="true"
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground truncate" data-testid="title-budget">
                Christmas Gift Budget
              </h1>
              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                <Badge variant="secondary" className="text-xs">
                  {currentFamily?.name || 'Group'}
                </Badge>
                <span>Track spending for your group gift exchange</span>
              </div>
            </div>
          </div>
        </div>
        {!isEditing && isOrganizer && (
          <Button
            onClick={handleStartEdit}
            variant="outline"
            data-testid="button-edit-budget"
          >
            <Edit2 className="w-4 h-4 sm:mr-2" aria-hidden="true" />
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
              <Check className="w-4 h-4 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              variant="outline"
              data-testid="button-cancel-edit"
              aria-label="Cancel editing"
            >
              <X className="w-4 h-4 sm:mr-2" aria-hidden="true" />
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
                    <div className="pt-1">
                      <Button
                        onClick={() => handleOpenLogPurchase(member)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                        data-testid={`button-log-purchase-${key}`}
                      >
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        Log Purchase
                      </Button>
                    </div>
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

      {/* Log Purchase Dialog */}
      <Dialog open={logPurchaseDialog.open} onOpenChange={(open) => !open && handleCloseLogPurchase()}>
        <DialogContent data-testid="dialog-log-purchase">
          <DialogHeader>
            <DialogTitle>Log Off-Wishlist Purchase</DialogTitle>
            <DialogDescription>
              Record a gift you bought for {logPurchaseDialog.member?.displayName} that wasn't on their wishlist.
              This will count toward their budget.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="purchase-price">Price *</Label>
              <Input
                id="purchase-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={purchaseForm.price}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, price: e.target.value })}
                data-testid="input-purchase-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-description">What did you buy? *</Label>
              <Input
                id="purchase-description"
                placeholder="e.g., Blue sweater, Board game, etc."
                value={purchaseForm.description}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, description: e.target.value })}
                data-testid="input-purchase-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-from">Where purchased from</Label>
              <Input
                id="purchase-from"
                placeholder="e.g., Amazon, Target, etc."
                value={purchaseForm.purchasedFrom}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, purchasedFrom: e.target.value })}
                data-testid="input-purchase-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-notes">Private notes</Label>
              <Textarea
                id="purchase-notes"
                placeholder="Optional notes (only you can see these)"
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                rows={3}
                data-testid="textarea-purchase-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseLogPurchase}
              data-testid="button-cancel-log-purchase"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitLogPurchase}
              disabled={logPurchaseMutation.isPending}
              data-testid="button-submit-log-purchase"
            >
              {logPurchaseMutation.isPending ? 'Logging...' : 'Log Purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
