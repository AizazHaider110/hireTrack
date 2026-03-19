import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated } from '@/features/auth';
import { AppLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth';
import { LoginPage, DashboardPage, PipelinePage, UnauthorizedPage } from '@/pages';
import { Toaster } from '@/components/ui/toaster';

function App() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
          }
        />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          
          {/* Pipeline route */}
          <Route
            path="/pipeline"
            element={
              <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER']}>
                <PipelinePage />
              </ProtectedRoute>
            }
          />
        <Route
          path="/candidates"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER']}>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Candidates</h1>
                <p className="text-muted-foreground mt-2">Coming soon...</p>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER']}>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Jobs</h1>
                <p className="text-muted-foreground mt-2">Coming soon...</p>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/interviews"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER']}>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Interviews</h1>
                <p className="text-muted-foreground mt-2">Coming soon...</p>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/communication"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER']}>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Communication</h1>
                <p className="text-muted-foreground mt-2">Coming soon...</p>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'HIRING_MANAGER']}>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Analytics</h1>
                <p className="text-muted-foreground mt-2">Coming soon...</p>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'HIRING_MANAGER']}>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Teams</h1>
                <p className="text-muted-foreground mt-2">Coming soon...</p>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/talent-pool"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER']}>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Talent Pool</h1>
                <p className="text-muted-foreground mt-2">Coming soon...</p>
              </div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/*"
          element={
            <ProtectedRoute requiredRoles={['ADMIN']}>
              <div className="p-8">
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground mt-2">Coming soon...</p>
              </div>
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch all - redirect to dashboard or login */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />}
      />
    </Routes>
    <Toaster />
    </>
  );
}

export default App;
