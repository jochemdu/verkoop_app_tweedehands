import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Uitnodigende lege staat i.p.v. een kale "geen data"-box. Optionele CTA
// (interne link). Icoon in een zachte accent-cirkel voor een vriendelijk accent.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-12 text-center">
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <Link href={action.href} className="btn btn-accent mt-1">
          {action.label}
        </Link>
      )}
    </div>
  );
}
