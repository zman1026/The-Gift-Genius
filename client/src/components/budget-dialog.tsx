import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBudget: number | null;
  onSave: (budget: number | null) => void;
  isSaving: boolean;
}

export function BudgetDialog({ open, onOpenChange, currentBudget, onSave, isSaving }: BudgetDialogProps) {
  const [budgetValue, setBudgetValue] = useState(currentBudget?.toString() || "");

  // Sync budget value with currentBudget when dialog opens or budget changes
  useEffect(() => {
    if (open) {
      setBudgetValue(currentBudget?.toString() || "");
    }
  }, [open, currentBudget]);

  const handleSave = () => {
    const value = budgetValue.trim();
    if (value === "" || value === "0") {
      onSave(null); // Remove budget
    } else {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed > 0) {
        onSave(parsed);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Your Gift-Buying Budget</DialogTitle>
          <DialogDescription>
            Track how much you personally plan to spend on gifts for others in this group.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="budget">Budget Amount ($)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="budget"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={budgetValue}
                onChange={(e) => setBudgetValue(e.target.value)}
                className="pl-9"
                data-testid="input-budget-amount"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter 0 or leave empty to remove the budget
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            data-testid="button-cancel-budget"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-budget"
          >
            {isSaving ? "Saving..." : "Save Budget"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
