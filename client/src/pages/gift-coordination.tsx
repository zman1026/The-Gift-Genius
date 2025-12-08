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
import { 
  DollarSign, 
  Edit2, 
  Check, 
  X, 
  ShoppingBag, 
  TreePine, 
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Gift,
  Users
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";

interface CoordinationInsight {
  type: "high-priority" | "no-gifts" | "personal-progress";
  message: string;
  count?: number;
  memberId?: string;
  memberName?: string;
}

export default function GiftCoordinationPage() {
  const { selectedFamilyId, families } = useFamily();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  
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

  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ['/api/families', selectedFamilyId, 'budget'],
    queryFn: async () => {
      const response = await fetch(`/api/families/${selectedFamilyId}/budget`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error('Failed to fetch budget data');
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  const { data: insights, isLoading: insightsLoading } = useQuery<CoordinationInsight[]>({
    queryKey: ["/api/coordination-insights", selectedFamilyId],
    queryFn: async () => {
      const params = new URLSearchParams({ familyId: selectedFamilyId! });
      const response = await fetch(`/api/coordination-insights?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch coordination insights");
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  const { data: memberCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/wishlist/member-counts", selectedFamilyId],
    queryFn: async () => {
      const params = new URLSearchParams({ familyId: selectedFamilyId! });
      const response = await fetch(`/api/wishlist/member-counts?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch member counts");
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  const { data: purchasesData } = useQuery<{ purchases: any[]; totalCount: number }>({
    queryKey: ["/api/purchases", selectedFamilyId],
    queryFn: async () => {
      const params = new URLSearchParams({ familyId: selectedFamilyId! });
      const response = await fetch(`/api/purchases?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch purchases");
      return response.json();
    },
    enabled: !!selectedFamilyId,
  });

  const updateAllocationsMutation = useMutation({
    mutationFn: async (newAllocations: any[]) => {
      const response = await fetch(`/api/families/${selectedFamilyId}/budget/allocations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",
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
        description: "Budget allocations have been saved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update budget",
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
        credentials: "include",
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
        description: "Off-wishlist purchase recorded",
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

  const christmasTheme = { primary: "#DC2626", accent: "#15803D", background: "#FEF2F2" };
  const currentFamily = families.find((f: any) => f.id === selectedFamilyId);
  const isOrganizer = currentFamily?.createdById === (user as any)?.id;

  if (!selectedFamilyId) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-center space-y-2">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-medium text-foreground">No Group Selected</h3>
          <p className="text-sm text-muted-foreground">Please select a group from the sidebar</p>
        </div>
      </div>
    );
  }

  const isLoading = budgetLoading || insightsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading coordination data...</p>
        </div>
      </div>
    );
  }

  const currentUserId = (user as any)?.id;
  const allMemberBudgets = budgetData?.memberBudgets || [];
  const otherMemberBudgets = allMemberBudgets.filter((m: any) => m.userId !== currentUserId);

  const handleStartEdit = () => {
    setIsEditing(true);
    const initialAllocations: Record<string, string> = {};
    otherMemberBudgets.forEach((member: any) => {
      const key = member.userId || member.managedProfileId;
      initialAllocations[key] = member.allocated.toString();
    });
    setAllocations(initialAllocations);
  };

  const handleSaveAllocations = () => {
    const actualAllocations: Record<string, string> = {};
    Object.keys(allocations).forEach(key => {
      const inputElement = document.getElementById(`budget-${key}`) as HTMLInputElement;
      if (inputElement) {
        actualAllocations[key] = inputElement.value;
      } else {
        actualAllocations[key] = allocations[key];
      }
    });

    const allocationArray = Object.entries(actualAllocations).map(([key, value]) => {
      const amount = parseFloat(value);
      
      if (isNaN(amount) || amount < 0 || !isFinite(amount)) {
        toast({
          title: "Invalid Budget",
          description: "All amounts must be non-negative numbers",
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

    if (allocationArray.some(a => a === null)) return;
    updateAllocationsMutation.mutate(allocationArray.filter(a => a !== null));
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

  const handleInsightClick = (insight: CoordinationInsight) => {
    if (insight.type === "high-priority") {
      setLocation('/my-list');
    } else if (insight.type === "no-gifts" && insight.memberId) {
      setLocation(`/members/${insight.memberId}`);
    } else if (insight.type === "personal-progress") {
      setLocation('/purchased');
    }
  };

  const getInsightIcon = (type: CoordinationInsight["type"]) => {
    switch (type) {
      case "high-priority":
        return <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />;
      case "no-gifts":
        return <Gift className="w-4 h-4 text-blue-500 flex-shrink-0" />;
      case "personal-progress":
        return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
      default:
        return <Gift className="w-4 h-4 flex-shrink-0" />;
    }
  };

  const totalMembers = allMemberBudgets.length;
  const membersWithBudget = allMemberBudgets.filter((m: any) => m.allocated > 0).length;
  
  const totalAllocated = allMemberBudgets.reduce((sum: number, m: any) => sum + (m.allocated || 0), 0);
  const totalSpent = allMemberBudgets.reduce((sum: number, m: any) => sum + (m.spent || 0), 0);
  const totalRemaining = totalAllocated - totalSpent;
  
  // Calculate total items on wishlists
  const totalItemsOnList = memberCounts 
    ? Object.values(memberCounts).reduce((sum, count) => sum + count, 0) 
    : 0;
  
  // Total purchases made
  const totalPurchases = purchasesData?.totalCount || purchasesData?.purchases?.length || 0;
  
  const hasBudgetSetup = totalAllocated > 0;
  const hasUrgentInsights = insights && insights.some(i => i.type === "high-priority" || i.type === "no-gifts");

  return (
    <div className="container mx-auto p-3 sm:p-4 space-y-4 max-w-6xl">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2" aria-label="Breadcrumb">
        <Link href="/my-wishlists" className="hover:text-foreground transition-colors" data-testid="link-my-wishlists">
          My Wishlists
        </Link>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
        <Link href="/my-list" className="hover:text-foreground transition-colors flex items-center gap-1" data-testid="link-christmas-wishlist">
          <TreePine className="w-3.5 h-3.5" style={{ color: christmasTheme.accent }} aria-hidden="true" />
          Christmas Wishlist
        </Link>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
        <span className="text-foreground font-medium">Gift Coordination</span>
      </nav>
      
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-lg shrink-0"
              style={{ backgroundColor: christmasTheme.background }}
            >
              <Gift 
                className="w-5 h-5" 
                style={{ color: christmasTheme.accent }}
                aria-hidden="true"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground" data-testid="title-gift-coordination">
                Christmas Gift Coordination
              </h1>
              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {currentFamily?.name || 'Group'}
                </Badge>
                <span className="hidden sm:inline">Coordinate gifts and track spending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Card className="col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">On Wishlists</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground" data-testid="stat-items-on-list">
              {totalItemsOnList}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Purchased</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground" data-testid="stat-purchased">
              {totalPurchases}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Members</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground" data-testid="stat-members">
              {totalMembers}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Spent</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground" data-testid="stat-total-spent">
              ${totalSpent.toFixed(0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="card-coordination-insights">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4" style={{ color: christmasTheme.primary }} />
              Coordination Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(!insights || insights.length === 0) ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Everything looks great! No urgent tasks.</span>
              </div>
            ) : (
              insights.map((insight, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2.5 p-2.5 rounded-md hover-elevate cursor-pointer"
                  onClick={() => handleInsightClick(insight)}
                  data-testid={`insight-${insight.type}-${index}`}
                >
                  {getInsightIcon(insight.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{insight.message}</p>
                  </div>
                  {insight.count !== undefined && (
                    <Badge variant="secondary" className="flex-shrink-0">
                      {insight.count}
                    </Badge>
                  )}
                </div>
              ))
            )}
            <div className="pt-2 border-t">
              <Link href="/purchased">
                <Button variant="outline" size="sm" className="w-full" data-testid="button-view-purchases">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  View All Purchases
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-budget-overview">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" style={{ color: christmasTheme.accent }} />
                Budget per Person
              </CardTitle>
              {!isEditing && isOrganizer && (
                <Button
                  onClick={handleStartEdit}
                  variant="ghost"
                  size="sm"
                  data-testid="button-edit-budget"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
              {isEditing && (
                <div className="flex gap-1">
                  <Button
                    onClick={handleSaveAllocations}
                    size="sm"
                    disabled={updateAllocationsMutation.isPending}
                    data-testid="button-save-budget"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="ghost"
                    size="sm"
                    data-testid="button-cancel-edit"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {otherMemberBudgets.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                No other members in your group yet.
              </div>
            ) : (
              otherMemberBudgets.map((member: any) => {
                const key = member.userId || member.managedProfileId;
                const itemCount = memberCounts?.[key] || 0;
                return (
                  <div key={key} className="p-2 rounded-md border" data-testid={`member-budget-${key}`}>
                    {!isEditing ? (
                      <div className="space-y-2">
                        <div 
                          className="flex items-center gap-2 cursor-pointer hover-elevate rounded-md p-1 -m-1"
                          onClick={() => setLocation(`/members/${key}`)}
                          data-testid={`link-member-wishlist-${key}`}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profileImageUrl} alt={member.displayName} />
                            <AvatarFallback className="text-xs">
                              {member.displayName?.split(' ').map((n: string) => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{member.displayName}</span>
                              <Badge variant="outline" className="text-xs">
                                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ${member.spent?.toFixed(0)} of ${member.allocated?.toFixed(0)}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          <div className={`text-sm font-bold ${
                            member.status === 'good' ? 'text-green-600 dark:text-green-400' :
                            member.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {member.allocated > 0 ? `${member.percentUsed?.toFixed(0)}%` : '-'}
                          </div>
                        </div>
                        {member.allocated > 0 && (
                          <Progress value={Math.min(member.percentUsed, 100)} className="h-1" />
                        )}
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenLogPurchase(member);
                          }}
                          variant="ghost"
                          size="sm"
                          className="w-full h-7 text-xs"
                          data-testid={`button-log-purchase-${key}`}
                        >
                          <ShoppingBag className="w-3 h-3 mr-1" />
                          Log Purchase
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.profileImageUrl} alt={member.displayName} />
                          <AvatarFallback className="text-xs">
                            {member.displayName?.split(' ').map((n: string) => n[0]).join('') || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm font-medium truncate">
                          {member.displayName}
                        </span>
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
                            className="w-16 h-8 text-sm"
                            data-testid={`input-budget-${key}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {!hasBudgetSetup && isOrganizer && !isEditing && (
              <Button
                onClick={handleStartEdit}
                variant="outline"
                className="w-full"
                data-testid="button-setup-budget"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Set Up Budget
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={logPurchaseDialog.open} onOpenChange={(open) => !open && handleCloseLogPurchase()}>
        <DialogContent data-testid="dialog-log-purchase">
          <DialogHeader>
            <DialogTitle>Log Off-Wishlist Purchase</DialogTitle>
            <DialogDescription>
              Record a gift you bought for {logPurchaseDialog.member?.displayName} that wasn't on their wishlist.
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
                placeholder="e.g., Blue sweater, Board game"
                value={purchaseForm.description}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, description: e.target.value })}
                data-testid="input-purchase-description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-from">Where from</Label>
              <Input
                id="purchase-from"
                placeholder="e.g., Amazon, Target"
                value={purchaseForm.purchasedFrom}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, purchasedFrom: e.target.value })}
                data-testid="input-purchase-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-notes">Private notes</Label>
              <Textarea
                id="purchase-notes"
                placeholder="Optional notes (only you can see)"
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                rows={2}
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
