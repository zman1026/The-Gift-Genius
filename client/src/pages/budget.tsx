import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useFamily } from "@/contexts/FamilyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Users, Wallet, Target, Edit2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const familyBudgetSchema = z.object({
  totalBudget: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Please enter a valid budget amount",
  }),
});

const memberBudgetSchema = z.object({
  targetMemberId: z.string().min(1, "Please select a family member"),
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Please enter a valid budget amount",
  }),
});

type FamilyBudgetForm = z.infer<typeof familyBudgetSchema>;
type MemberBudgetForm = z.infer<typeof memberBudgetSchema>;

export default function BudgetPage() {
  const { toast } = useToast();
  const { selectedFamilyId, families } = useFamily();
  const { user } = useAuth();
  
  const selectedFamily = families?.find((f: any) => f.id === selectedFamilyId);
  const [isFamilyBudgetDialogOpen, setIsFamilyBudgetDialogOpen] = useState(false);
  const [isMemberBudgetDialogOpen, setIsMemberBudgetDialogOpen] = useState(false);

  const familyBudgetForm = useForm<FamilyBudgetForm>({
    resolver: zodResolver(familyBudgetSchema),
    defaultValues: {
      totalBudget: "",
    },
  });

  const memberBudgetForm = useForm<MemberBudgetForm>({
    resolver: zodResolver(memberBudgetSchema),
    defaultValues: {
      targetMemberId: "",
      amount: "",
    },
  });

  // Fetch family budget
  const { data: familyBudget, isLoading: familyBudgetLoading } = useQuery({
    queryKey: ['/api/budgets/family', selectedFamilyId],
    enabled: !!selectedFamilyId,
  });

  // Fetch budget summary
  const { data: budgetSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['/api/budgets/summary', selectedFamilyId],
    enabled: !!selectedFamilyId,
  });

  // Fetch family members for budget allocation
  const { data: familyMembers, isLoading: membersLoading } = useQuery({
    queryKey: ['/api/family/members', selectedFamilyId],
    enabled: !!selectedFamilyId,
  });

  const setFamilyBudgetMutation = useMutation({
    mutationFn: async (data: FamilyBudgetForm) => {
      return apiRequest("PUT", `/api/budgets/family/${selectedFamilyId}`, {
        totalBudget: data.totalBudget,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budgets/family', selectedFamilyId] });
      queryClient.invalidateQueries({ queryKey: ['/api/budgets/summary', selectedFamilyId] });
      toast({
        title: "Success",
        description: "Family budget updated successfully",
      });
      setIsFamilyBudgetDialogOpen(false);
      familyBudgetForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update family budget",
        variant: "destructive",
      });
    },
  });

  const setMemberBudgetMutation = useMutation({
    mutationFn: async (data: MemberBudgetForm) => {
      return apiRequest("POST", "/api/budgets/members", {
        familyId: selectedFamilyId,
        targetMemberId: data.targetMemberId,
        amount: data.amount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budgets/summary', selectedFamilyId] });
      toast({
        title: "Success",
        description: "Budget allocation updated successfully",
      });
      setIsMemberBudgetDialogOpen(false);
      memberBudgetForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set member budget",
        variant: "destructive",
      });
    },
  });

  const deleteMemberBudgetMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      return apiRequest("DELETE", `/api/budgets/members/${budgetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/budgets/summary', selectedFamilyId] });
      toast({
        title: "Success",
        description: "Budget allocation removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove budget",
        variant: "destructive",
      });
    },
  });

  const isOrganizer = selectedFamily && user && selectedFamily.createdById === user.id;
  const isLoading = familyBudgetLoading || summaryLoading || membersLoading;

  if (!selectedFamilyId) {
    return (
      <div className="p-6 md:p-8 lg:p-12">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Budget Management</CardTitle>
            <CardDescription>Please select a family to manage your budget</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const summary: any = budgetSummary || { totals: { budgeted: 0, allocated: 0, spent: 0, remaining: 0 }, memberBudgets: [], purchasesAndIntents: [] };
  const totals = summary.totals || { budgeted: 0, allocated: 0, spent: 0, remaining: 0 };
  const memberBudgets = summary.memberBudgets || [];
  const purchasesAndIntents = summary.purchasesAndIntents || [];

  // Calculate progress percentage
  const totalUsed = totals.allocated + totals.spent;
  const progressPercentage = totals.budgeted > 0 ? (totalUsed / totals.budgeted) * 100 : 0;

  // Determine status color
  const getProgressColor = () => {
    if (progressPercentage >= 100) return "text-destructive";
    if (progressPercentage >= 80) return "text-yellow-600";
    return "text-primary";
  };

  // Get family members excluding current user
  const otherMembers: any[] = Array.isArray(familyMembers) ? familyMembers.filter((m: any) => m.id !== user?.id) : [];

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl md:text-4xl font-semibold text-foreground">
            Budget Management
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Track your Christmas gift spending
          </p>
        </div>
        <div className="flex gap-2">
          {isOrganizer && (
            <Dialog open={isFamilyBudgetDialogOpen} onOpenChange={setIsFamilyBudgetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-set-family-budget">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Family Budget
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Family Budget</DialogTitle>
                  <DialogDescription>
                    Set the total budget for your family's Christmas gifts
                  </DialogDescription>
                </DialogHeader>
                <Form {...familyBudgetForm}>
                  <form onSubmit={familyBudgetForm.handleSubmit((data) => setFamilyBudgetMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={familyBudgetForm.control}
                      name="totalBudget"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Budget ($)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="500.00"
                              {...field}
                              data-testid="input-family-budget"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={setFamilyBudgetMutation.isPending}
                      data-testid="button-save-family-budget"
                    >
                      {setFamilyBudgetMutation.isPending ? "Saving..." : "Save Budget"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={isMemberBudgetDialogOpen} onOpenChange={setIsMemberBudgetDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-person-budget">
                <Users className="w-4 h-4 mr-2" />
                Set Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Set Per-Person Budget</DialogTitle>
                <DialogDescription>
                  Set how much you want to spend on each family member
                </DialogDescription>
              </DialogHeader>
              <Form {...memberBudgetForm}>
                <form onSubmit={memberBudgetForm.handleSubmit((data) => setMemberBudgetMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={memberBudgetForm.control}
                    name="targetMemberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Family Member</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-target-member">
                              <SelectValue placeholder="Select a family member" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {otherMembers.map((member: any) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.displayName || member.firstName || member.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={memberBudgetForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget Amount ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="100.00"
                            {...field}
                            data-testid="input-member-budget-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={setMemberBudgetMutation.isPending}
                    data-testid="button-save-member-budget"
                  >
                    {setMemberBudgetMutation.isPending ? "Saving..." : "Save Budget"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Budget Alerts */}
      {progressPercentage >= 100 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Budget Exceeded!</AlertTitle>
          <AlertDescription>
            You've exceeded your total budget. Consider adjusting your purchases or increasing your budget.
          </AlertDescription>
        </Alert>
      )}

      {progressPercentage >= 80 && progressPercentage < 100 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Approaching Budget Limit</AlertTitle>
          <AlertDescription>
            You've used {progressPercentage.toFixed(0)}% of your budget. Plan carefully to stay within limits.
          </AlertDescription>
        </Alert>
      )}

      {/* Budget Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-budget">
              ${totals.budgeted.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {familyBudget ? "Family-wide + Personal" : "Personal budgets only"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planned</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-allocated-budget">
              ${totals.allocated.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Items you intend to buy
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spent</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-spent-budget">
              ${totals.spent.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Items purchased
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getProgressColor()}`} data-testid="text-remaining-budget">
              ${totals.remaining.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Available to spend
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Progress</CardTitle>
          <CardDescription>Overall spending vs budget</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className={`font-medium ${getProgressColor()}`}>
                {progressPercentage.toFixed(0)}%
              </span>
            </div>
            <Progress value={Math.min(progressPercentage, 100)} className="h-2" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-sm font-medium">Planned Items</p>
              <p className="text-2xl font-bold text-yellow-600">{purchasesAndIntents.filter((p: any) => p.status === 'intended').length}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Purchased Items</p>
              <p className="text-2xl font-bold text-primary">{purchasesAndIntents.filter((p: any) => p.status === 'purchased').length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Person Budget Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Budget by Person</CardTitle>
          <CardDescription>How much you're spending on each family member</CardDescription>
        </CardHeader>
        <CardContent>
          {memberBudgets && memberBudgets.length > 0 ? (
            <div className="space-y-6">
              {memberBudgets.map((budget: any) => {
                const member = familyMembers?.find((m: any) => m.id === budget.targetMemberId);
                const memberUsed = budget.allocated + budget.spent;
                const memberProgress = budget.amount > 0 ? (memberUsed / budget.amount) * 100 : 0;
                const memberColor = memberProgress >= 100 ? "text-destructive" : memberProgress >= 80 ? "text-yellow-600" : "text-primary";

                return (
                  <div key={budget.id} className="space-y-2" data-testid={`budget-person-${budget.targetMemberId}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {member?.displayName || member?.firstName || member?.email || "Unknown"}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteMemberBudgetMutation.mutate(budget.id)}
                          data-testid={`button-delete-budget-${budget.targetMemberId}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            <span className={memberColor}>${memberUsed.toFixed(2)}</span>
                            <span className="text-muted-foreground"> / ${budget.amount.toFixed(2)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ${budget.allocated.toFixed(2)} planned • ${budget.spent.toFixed(2)} spent
                          </p>
                        </div>
                      </div>
                    </div>
                    <Progress value={Math.min(memberProgress, 100)} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No budgets set yet. Click "Set Budget" to allocate budgets for family members.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
