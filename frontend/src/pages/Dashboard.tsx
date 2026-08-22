import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  Users,
  UserCircle2,
  BadgeCheck,
} from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const isHr = user?.role === "hr";

  const quickLinks = isHr
    ? [
        {
          title: "Manage Employees",
          description: "Add, review, and update your team records.",
          href: "/employees",
          label: "Open Employees",
          icon: Users,
        },
        {
          title: "Payroll",
          description: "Review pay history and processing status.",
          href: "/payroll",
          label: "Open Payroll",
          icon: BadgeCheck,
        },
        {
          title: "Settings",
          description: "Adjust account and workspace preferences.",
          href: "/settings",
          label: "Open Settings",
          icon: UserCircle2,
        },
      ]
    : [
        {
          title: "Attendance",
          description:
            "Check in, check out, and review your attendance history.",
          href: "/attendance",
          label: "Open Attendance",
          icon: Clock3,
        },
        {
          title: "Leave",
          description: "Submit leave requests and track approval status.",
          href: "/leave",
          label: "Open Leave",
          icon: CalendarDays,
        },
        {
          title: "Profile",
          description: "Update your personal and job information.",
          href: "/profile",
          label: "Open Profile",
          icon: UserCircle2,
        },
      ];

  return (
    <div className="space-y-8 animate-fade-in">
      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-lg">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative overflow-hidden px-8 py-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,175,112,0.28),transparent_44%),linear-gradient(145deg,rgba(255,255,255,0.58),rgba(255,246,241,0.9))]" />
            <div className="relative space-y-5">
              <p className="text-sm uppercase tracking-[0.28em] text-muted-foreground">
                {isHr ? "Administrator Dashboard" : "Employee Dashboard"}
              </p>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight">
                Welcome back{user?.name ? `, ${user.name}` : ""}.
              </h1>
              <p className="max-w-xl text-muted-foreground">
                Use this workspace to keep your daily HR and employee operations
                in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title} className="border-border/60 bg-card/95">
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
                <Button asChild variant="outline" className="mt-4 rounded-2xl">
                  <Link to={item.href}>{item.label}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Dashboard;
