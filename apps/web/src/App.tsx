import { useCallback, useState } from "react"
import { Navigate, Route, Routes, useNavigate } from "react-router"
import { sileo, Toaster } from "sileo"
import { AuthRouteLoader } from "@/components/loader"
import { getToken } from "@/lib/auth"
import { AuthPage } from "@/pages/auth"
import { DashboardPage } from "@/pages/dashboard"
import { NotFoundPage } from "@/pages/not-found"
import { getAuthCopy, getStoredAuthLanguage } from "@/pages/auth-copy"

export default function App() {
  const navigate = useNavigate()
  const [showLoader, setShowLoader] = useState(false)
  const [destinationReady, setDestinationReady] = useState(false)
  const [loginSucceeded, setLoginSucceeded] = useState(false)

  const beginLoginTransition = useCallback(() => {
    setDestinationReady(false)
    setLoginSucceeded(false)
    setShowLoader(true)
  }, [])

  const markDestinationReady = useCallback((succeeded: boolean) => {
    setLoginSucceeded(succeeded)
    setDestinationReady(true)
  }, [])

  function finishLoginTransition() {
    setShowLoader(false)
    if (loginSucceeded) {
      const copy = getAuthCopy(getStoredAuthLanguage())
      sileo.success({
        title: copy.welcomeBackToast,
        description: copy.signedInToast,
      })
    }
  }

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
        <Route
          path="/dashboard"
          element={<DashboardPage onReady={markDestinationReady} />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {showLoader && (
        <AuthRouteLoader
          destinationReady={destinationReady}
          onNavigate={() => navigate("/dashboard", { replace: true })}
          onExited={finishLoginTransition}
          ariaLabel={getAuthCopy(getStoredAuthLanguage()).openingAccount}
        />
      )}
    </>
  )
}
