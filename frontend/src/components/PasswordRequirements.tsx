import { Check, X } from "lucide-react";
import { passwordRules } from "@/lib/password";
import { cn } from "@/lib/utils";

interface PasswordRequirementsProps {
  password: string;
  /** Hide the list until the user has typed something. */
  showWhenEmpty?: boolean;
  className?: string;
}

/**
 * Live checklist of the password rules enforced by the backend, so users see
 * why a password is rejected before they submit.
 */
const PasswordRequirements = ({
  password,
  showWhenEmpty = false,
  className,
}: PasswordRequirementsProps) => {
  if (!password && !showWhenEmpty) return null;

  return (
    <ul className={cn("grid grid-cols-2 gap-x-3 gap-y-1 pt-1", className)}>
      {passwordRules.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors",
              passed ? "text-success" : "text-muted-foreground",
            )}
          >
            {passed ? (
              <Check className="w-3 h-3 flex-shrink-0" />
            ) : (
              <X className="w-3 h-3 flex-shrink-0" />
            )}
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
};

export default PasswordRequirements;
