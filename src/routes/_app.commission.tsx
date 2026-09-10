import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/commission")({
  component: () => <Navigate to="/payroll" replace />,
});
