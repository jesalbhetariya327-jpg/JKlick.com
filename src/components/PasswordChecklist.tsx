import { Check, Circle } from "lucide-react";

import { PASSWORD_RULES } from "@/lib/password";
import { cn } from "@/lib/utils";

export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-2",
              ok ? "text-primary font-medium" : "text-muted-foreground",
            )}
          >
            {ok ? <Check className="size-3.5" /> : <Circle className="size-3.5" />}
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
