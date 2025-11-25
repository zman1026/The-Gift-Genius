import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useFamily } from "@/contexts/FamilyContext";
import { Gift, Users, DollarSign, CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface BudgetData {
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  memberBudgets: Array<{
    id: string;
    name: string;
    allocated: number;
    spent: number;
    remaining: number;
  }>;
}

interface MemberGiftStatus {
  memberId: string;
  memberName: string;
  hasReceivedGift: boolean;
  giftCount: number;
}

export function GiftGivingProgress() {
  const { selectedFamilyId, families } = useFamily();
  const currentFamily = families.find((f: any) => f.id === selectedFamilyId);

  const { data: budgetData, isLoading: budgetLoading, isError: budgetError } = useQuery<BudgetData>({
    queryKey: ['/api/families', selectedFamilyId, 'budget'],
    enabled: !!selectedFamilyId,
  });

  const { data: giftStatus, isLoading: giftStatusLoading, isError: giftStatusError } = useQuery<MemberGiftStatus[]>({
    queryKey: ['/api/families', selectedFamilyId, 'gift-status'],
    enabled: !!selectedFamilyId,
  });

  if (budgetLoading || giftStatusLoading) {
    return (
      <Card data-testid="gift-giving-progress-loading">
        <CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (budgetError || giftStatusError) {
    return (
      <Card data-testid="gift-giving-progress-error">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Gift className="w-4 h-4" />
            <span className="text-sm">Unable to load gift progress</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalMembers = giftStatus?.length || budgetData?.memberBudgets?.length || 0;
  const membersGifted = giftStatus?.filter(m => m.hasReceivedGift).length || 0;
  const giftProgressPercent = totalMembers > 0 ? (membersGifted / totalMembers) * 100 : 0;
  
  // SVG circle math: circumference = 2 * PI * radius
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius; // ~97.39
  const progressOffset = circumference - (giftProgressPercent / 100) * circumference;
  
  const hasBudget = budgetData && budgetData.totalAllocated > 0;
  const budgetProgress = hasBudget 
    ? Math.min(100, (budgetData.totalSpent / budgetData.totalAllocated) * 100)
    : 0;
  
  const allGifted = totalMembers > 0 && membersGifted === totalMembers;
  const giftProgressComplete = giftProgressPercent === 100;
  const isUnderBudget = hasBudget && budgetData.totalSpent <= budgetData.totalAllocated;

  return (
    <Card className="overflow-hidden" data-testid="gift-giving-progress">
      <CardContent className="p-0">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gift className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Your Gift-Giving Progress</h3>
            </div>
            <Link href="/gift-coordination">
              <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-view-details">
                Details
                <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>Members Gifted</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r={radius}
                      fill="none"
                      className="stroke-muted"
                      strokeWidth="3"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r={radius}
                      fill="none"
                      className="stroke-primary transition-all duration-500"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={progressOffset}
                    />
                  </svg>
                  {allGifted && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-members-gifted">
                    {membersGifted}<span className="text-lg text-muted-foreground">/{totalMembers}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {allGifted ? "All done!" : `${totalMembers - membersGifted} to go`}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="w-4 h-4" />
                <span>Budget Used</span>
              </div>
              {hasBudget ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-bold text-foreground" data-testid="text-budget-spent">
                      ${budgetData.totalSpent.toFixed(0)}
                    </p>
                    <span className="text-sm text-muted-foreground">
                      / ${budgetData.totalAllocated.toFixed(0)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        budgetProgress > 90 ? 'bg-orange-500' : 
                        budgetProgress > 100 ? 'bg-red-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(100, budgetProgress)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isUnderBudget 
                      ? `$${budgetData.totalRemaining.toFixed(0)} remaining`
                      : `$${Math.abs(budgetData.totalRemaining).toFixed(0)} over budget`
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">No budget set</p>
                  <Link href="/gift-coordination">
                    <Button variant="outline" size="sm" className="text-xs" data-testid="button-set-budget">
                      Set Budget
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {(allGifted || (hasBudget && budgetProgress >= 100)) && (
          <div 
            className={`px-4 py-2 text-center text-sm font-medium ${
              allGifted && isUnderBudget
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : 'bg-primary/10 text-primary'
            }`}
          >
            {allGifted && isUnderBudget 
              ? "Amazing! You've gifted everyone and stayed on budget!"
              : allGifted 
                ? "You've bought gifts for everyone!"
                : "Budget fully used"
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
}
