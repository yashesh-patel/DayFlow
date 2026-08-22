import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import {
  SalaryBreakdown as Breakdown,
  formatCurrency,
  formatPercent,
} from "@/lib/salary";
import { cn } from "@/lib/utils";

interface RowProps {
  index?: number;
  label: string;
  description?: string;
  amount: number;
  percentage?: number;
  tone?: "default" | "negative";
}

const ComponentRow = ({
  index,
  label,
  description,
  amount,
  percentage,
  tone = "default",
}: RowProps) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b border-border/60 last:border-0">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">
        {index !== undefined && (
          <span className="text-muted-foreground mr-1.5">{index}.</span>
        )}
        {label}
      </p>
      {description && (
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="text-right flex-shrink-0">
      <p
        className={cn(
          "font-mono text-sm font-semibold",
          tone === "negative" && "text-destructive",
        )}
      >
        {tone === "negative" ? "-" : ""}
        {formatCurrency(amount)}
      </p>
      <p className="text-xs text-muted-foreground">
        {percentage !== undefined
          ? `${formatPercent(percentage)} / month`
          : "/ month"}
      </p>
    </div>
  </div>
);

interface SalaryBreakdownProps {
  breakdown: Breakdown;
  /** Hide the "Wage Type / Wage" summary strip (e.g. inside a dialog). */
  compact?: boolean;
  className?: string;
}

/**
 * Full salary structure -- components, PF and tax -- rendered from a computed
 * breakdown. Shared by the HR payroll view and the employee payroll view so
 * both always show the same numbers.
 */
const SalaryBreakdown = ({
  breakdown,
  compact = false,
  className,
}: SalaryBreakdownProps) => {
  return (
    <div className={cn("space-y-6", className)}>
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Wage Type</p>
            <p className="text-base font-semibold mt-0.5">Fixed wage</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Monthly Wage</p>
            <p className="text-base font-semibold mt-0.5 font-mono">
              {formatCurrency(breakdown.monthlyWage)}
            </p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Annual Wage (CTC)</p>
            <p className="text-base font-semibold mt-0.5 font-mono">
              {formatCurrency(breakdown.annualWage)}
            </p>
          </div>
        </div>
      )}

      {breakdown.isOverAllocated && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-warning-foreground">
            The fixed components exceed this wage, so Fixed Allowance is nil and
            the total is above the defined wage. Raise the wage or lower the
            Standard Allowance.
          </p>
        </div>
      )}

      {/* Salary Components */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Salary Components</CardTitle>
          <CardDescription>
            Calculated automatically from the defined wage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {breakdown.components.map((component, i) => (
            <ComponentRow
              key={component.key}
              index={i + 1}
              label={component.label}
              description={component.description}
              amount={component.value}
              percentage={component.percentage}
            />
          ))}
          <div className="flex items-center justify-between pt-4 mt-2 border-t-2">
            <span className="font-semibold">Gross Salary</span>
            <span className="font-mono font-bold">
              {formatCurrency(breakdown.grossMonthly)}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provident Fund */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              Provident Fund (PF) Contribution
            </CardTitle>
            <CardDescription>Calculated on the basic salary</CardDescription>
          </CardHeader>
          <CardContent>
            <ComponentRow
              index={1}
              label={breakdown.pfEmployee.label}
              description={breakdown.pfEmployee.description}
              amount={breakdown.pfEmployee.value}
              percentage={breakdown.pfEmployee.percentage}
            />
            <ComponentRow
              index={2}
              label={breakdown.pfEmployer.label}
              description={breakdown.pfEmployer.description}
              amount={breakdown.pfEmployer.value}
              percentage={breakdown.pfEmployer.percentage}
            />
          </CardContent>
        </Card>

        {/* Tax Deductions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Tax Deductions</CardTitle>
            <CardDescription>Deducted from the gross salary</CardDescription>
          </CardHeader>
          <CardContent>
            <ComponentRow
              index={1}
              label={breakdown.professionalTax.label}
              description={breakdown.professionalTax.description}
              amount={breakdown.professionalTax.value}
            />
            <div className="mt-4 space-y-2 rounded-lg bg-muted/50 p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gross Salary</span>
                <span className="font-mono">
                  {formatCurrency(breakdown.grossMonthly)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Total Deductions (PF + Tax)
                </span>
                <span className="font-mono text-destructive">
                  -{formatCurrency(breakdown.totalDeductions)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold">
                <span>Net Pay</span>
                <span className="font-mono text-success">
                  {formatCurrency(breakdown.netMonthly)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SalaryBreakdown;
