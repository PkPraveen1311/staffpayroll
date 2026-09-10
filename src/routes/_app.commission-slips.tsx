import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/commission-slips")({
  component: () => <Navigate to="/payslips" replace />,
});
