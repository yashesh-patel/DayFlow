/**
 * Salary structure for a "Fixed wage" wage type.
 *
 * Every component is derived from the employee's monthly wage so the whole
 * breakdown recomputes the moment the wage changes, and the components always
 * sum to exactly the wage (never more) -- "Fixed Allowance" absorbs whatever is
 * left after the other components are taken out.
 */

export type ComputationBasis = "wage" | "basic" | "fixed" | "remainder";

export interface SalaryComponentDef {
  key: string;
  label: string;
  description: string;
  basis: ComputationBasis;
  /** Fraction of the basis (0.5 = 50%). Used by "wage" and "basic". */
  rate?: number;
  /** Flat monthly amount. Used by "fixed". */
  amount?: number;
}

/**
 * Rates are collected here so payroll policy can be tuned in one place (and
 * later driven from HR settings) rather than scattered through the UI.
 */
export const SALARY_CONFIG = {
  /** Employee provident fund, as a fraction of Basic. */
  pfEmployeeRate: 0.12,
  /** Employer provident fund contribution, as a fraction of Basic. */
  pfEmployerRate: 0.12,
  /** Flat monthly professional tax deducted from gross. */
  professionalTax: 200,
};

export const SALARY_COMPONENTS: SalaryComponentDef[] = [
  {
    key: "basic",
    label: "Basic Salary",
    description:
      "Define Basic salary from company cost compute it based on monthly wages.",
    basis: "wage",
    rate: 0.5,
  },
  {
    key: "hra",
    label: "House Rent Allowance",
    description: "HRA provided to employees 50% of the basic salary.",
    basis: "basic",
    rate: 0.5,
  },
  {
    key: "standard",
    label: "Standard Allowance",
    description:
      "A standard allowance is a predetermined, fixed amount provided to employee as part of their salary.",
    basis: "fixed",
    amount: 4167,
  },
  {
    key: "bonus",
    label: "Performance Bonus",
    description:
      "Variable amount paid during payroll. The value defined by the company and calculated as a % of the basic salary.",
    basis: "basic",
    rate: 0.0833,
  },
  {
    key: "lta",
    label: "Leave Travel Allowance",
    description:
      "LTA is paid by the company to employees to cover their travel expenses, and calculated as a % of the basic salary.",
    basis: "basic",
    rate: 0.0833,
  },
  {
    key: "fixed",
    label: "Fixed Allowance",
    description:
      "Fixed allowance portion of wages is determined after calculating all salary components.",
    basis: "remainder",
  },
];

export interface ComputedComponent extends SalaryComponentDef {
  /** Monthly amount in rupees. */
  value: number;
  /**
   * Share this component represents -- of the wage for Basic, of Basic for
   * everything else, matching how the structure is defined.
   */
  percentage: number;
}

export interface Deduction {
  key: string;
  label: string;
  description: string;
  value: number;
  /** Fraction of Basic, when the deduction is rate-based. */
  percentage?: number;
}

export interface SalaryBreakdown {
  monthlyWage: number;
  annualWage: number;
  components: ComputedComponent[];
  basic: number;
  grossMonthly: number;
  pfEmployee: Deduction;
  pfEmployer: Deduction;
  professionalTax: Deduction;
  /** Deductions taken out of the employee's gross (employer PF is not one). */
  totalDeductions: number;
  netMonthly: number;
  /** True when the fixed components alone already exceed the wage. */
  isOverAllocated: boolean;
}

/**
 * Computes the full salary structure from a monthly wage.
 * Pass `annual` when you hold a yearly CTC instead.
 */
export function computeSalaryBreakdown(
  wage: number,
  options: { annual?: boolean } = {},
): SalaryBreakdown {
  const monthlyWage = Math.max(
    0,
    options.annual ? (Number(wage) || 0) / 12 : Number(wage) || 0,
  );

  const basic = monthlyWage * (SALARY_COMPONENTS[0].rate ?? 0.5);

  // First pass: everything except the remainder component.
  const resolved = new Map<string, number>();
  for (const def of SALARY_COMPONENTS) {
    if (def.basis === "remainder") continue;
    if (def.basis === "wage") resolved.set(def.key, monthlyWage * (def.rate ?? 0));
    else if (def.basis === "basic") resolved.set(def.key, basic * (def.rate ?? 0));
    else if (def.basis === "fixed") resolved.set(def.key, def.amount ?? 0);
  }

  // Second pass: the remainder absorbs whatever is left, so the components sum
  // to the wage exactly and can never exceed it.
  const allocated = [...resolved.values()].reduce((sum, v) => sum + v, 0);
  const remainder = monthlyWage - allocated;
  for (const def of SALARY_COMPONENTS) {
    if (def.basis === "remainder") resolved.set(def.key, Math.max(0, remainder));
  }

  const components: ComputedComponent[] = SALARY_COMPONENTS.map((def) => {
    const value = resolved.get(def.key) ?? 0;
    // Basic is quoted against the wage; every other component against Basic.
    const denominator = def.basis === "wage" ? monthlyWage : basic;
    return {
      ...def,
      value,
      percentage: denominator > 0 ? (value / denominator) * 100 : 0,
    };
  });

  const grossMonthly = components.reduce((sum, c) => sum + c.value, 0);

  const pfEmployee: Deduction = {
    key: "pf_employee",
    label: "Employee",
    description: "PF is calculated based on the basic salary.",
    value: basic * SALARY_CONFIG.pfEmployeeRate,
    percentage: SALARY_CONFIG.pfEmployeeRate * 100,
  };
  const pfEmployer: Deduction = {
    key: "pf_employer",
    label: "Employer",
    description: "PF is calculated based on the basic salary.",
    value: basic * SALARY_CONFIG.pfEmployerRate,
    percentage: SALARY_CONFIG.pfEmployerRate * 100,
  };
  const professionalTax: Deduction = {
    key: "professional_tax",
    label: "Professional Tax",
    description: "Professional Tax deducted from the Gross salary.",
    value: monthlyWage > 0 ? SALARY_CONFIG.professionalTax : 0,
  };

  const totalDeductions = pfEmployee.value + professionalTax.value;

  return {
    monthlyWage,
    annualWage: monthlyWage * 12,
    components,
    basic,
    grossMonthly,
    pfEmployee,
    pfEmployer,
    professionalTax,
    totalDeductions,
    netMonthly: grossMonthly - totalDeductions,
    isOverAllocated: remainder < 0,
  };
}

export function formatCurrency(value: number, withPaise = true): string {
  return `₹${(Number(value) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: withPaise ? 2 : 0,
    maximumFractionDigits: withPaise ? 2 : 0,
  })}`;
}

export function formatPercent(value: number): string {
  return `${(Number(value) || 0).toFixed(2)}%`;
}
