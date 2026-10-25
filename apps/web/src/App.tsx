import { Navigate, Route, Routes } from "react-router"
import { Toaster } from "sileo"
import { getToken } from "@/features/auth/api"
import { AuthRouteLoader } from "@/features/auth/components/loader"
import { getAuthCopy, getStoredAuthLanguage } from "@/features/auth/copy"
import { AuthPage } from "@/features/auth/auth-page"
import { useLoginTransition } from "@/features/auth/use-login-transition"
import { DashboardPage } from "@/features/dashboard/dashboard-page"
import { AccountManagementPage } from "@/features/accounts/account-management-page"
import { DepartmentManagementPage } from "@/features/departments/department-management-page"
import { PortalRoute } from "@/components/layout/portal-route"
import { NotFoundPage } from "@/pages/not-found-page"

export default function App() {
  const {
    showLoader,
    destinationReady,
    beginLoginTransition,
    markDestinationReady,
    navigateToDashboard,
    finishLoginTransition,
  } = useLoginTransition()

  return (
    <>
      <Toaster
        position="bottom-right"
        options={{
          fill: "#253f8c",
          roundness: 12,
          styles: {
            title: "exp-toast-title",
            description: "exp-toast-description",
          },
        }}
      />
      <Routes>
        <Route
          path="/"
          element={
            <Navigate to={getToken() ? "/dashboard" : "/login"} replace />
          }
        />
        <Route
          path="/login"
          element={<AuthPage mode="login" onLoggedIn={beginLoginTransition} />}
        />
        <Route
          path="/register"
          element={
            <AuthPage mode="register" onLoggedIn={beginLoginTransition} />
          }
        />
        <Route element={<PortalRoute onReady={markDestinationReady} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/accounts" element={<AccountManagementPage />} />
          <Route path="/departments" element={<DepartmentManagementPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {showLoader && (
        <AuthRouteLoader
          destinationReady={destinationReady}
          onNavigate={navigateToDashboard}
          onExited={finishLoginTransition}
          ariaLabel={getAuthCopy(getStoredAuthLanguage()).openingAccount}
        />
      )}
    </>
  )
}
