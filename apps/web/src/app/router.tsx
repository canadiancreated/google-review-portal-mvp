import AppLayout from "./layout/AppLayout";
import AlertsPage from "../pages/AlertsPage";
import DashboardPage from "../pages/DashboardPage";
import EmployeeDetailPage from "../pages/EmployeeDetailPage";
import EmployeesPage from "../pages/EmployeesPage";
import ReviewChangesPage from "../pages/ReviewChangesPage";
import ReviewsPage from "../pages/ReviewsPage";

export function resolveRoute(pathname: string) {
  if (pathname === "/") {
    return (
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    );
  }

  if (pathname === "/reviews") {
    return (
      <AppLayout>
        <ReviewsPage />
      </AppLayout>
    );
  }

  if (pathname === "/alerts") {
    return (
      <AppLayout>
        <AlertsPage />
      </AppLayout>
    );
  }

  if (pathname === "/employees") {
    return (
      <AppLayout>
        <EmployeesPage />
      </AppLayout>
    );
  }

  if (pathname === "/changes") {
    return (
      <AppLayout>
        <ReviewChangesPage />
      </AppLayout>
    );
  }

  if (pathname.startsWith("/employees/")) {
    const employeeId = decodeURIComponent(pathname.replace("/employees/", "").trim());
    if (!employeeId) return null;
    return (
      <AppLayout>
        <EmployeeDetailPage employeeId={employeeId} />
      </AppLayout>
    );
  }

  return null;
}
