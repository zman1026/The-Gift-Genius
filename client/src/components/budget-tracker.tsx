import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingDown, Settings } from "lucide-react";

interface BudgetTrackerProps {
  budget: number | null;
  totalWishlistValue: number;
  onSetBudget: () => void;
}

export function BudgetTracker({ budget, totalWishlistValue, onSetBudget }: BudgetTrackerProps) {
  if (!budget || budget === 0) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-1">Set a Gift Budget</h3>
            <p className="text-sm text-muted-foreground">
              Track your family's gift spending limit
            </p>
          </div>
          <Button onClick={onSetBudget} size="sm" data-testid="button-set-budget">
            <Settings className="w-4 h-4 mr-2" />
            Set Budget
          </Button>
        </CardContent>
      </Card>
    );
  }

  const remaining = budget - totalWishlistValue;
  const percentUsed = Math.min((totalWishlistValue / budget) * 100, 100);
  const isOverBudget = remaining < 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Gift Budget
        </CardTitle>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onSetBudget}
          data-testid="button-edit-budget"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Budget Overview */}
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-2xl font-bold text-foreground" data-testid="text-budget-remaining">
              ${Math.abs(remaining).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isOverBudget ? "Over budget" : "Remaining"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-muted-foreground">
              ${totalWishlistValue.toFixed(2)} / ${budget.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Wishlist / Budget
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress 
            value={percentUsed} 
            className="h-2"
            data-testid="progress-budget"
          />
          <p className="text-xs text-muted-foreground text-right">
            {percentUsed.toFixed(0)}% used
          </p>
        </div>

        {/* Over Budget Warning */}
        {isOverBudget && (
          <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md">
            <TrendingDown className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs text-destructive">
              Your wishlist exceeds the budget by ${Math.abs(remaining).toFixed(2)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
