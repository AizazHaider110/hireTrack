import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated } from '@/features/auth';
import { AppLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth';
import {
  LoginPage, DashboardPage, PipelinePage, CandidatesPage,
  CandidateProfilePage, UnauthorizedPage, JobsPage, JobDetailPage,
  InterviewsPage, CommunicationPage, AnalyticsPage,
  TeamsPage, TeamDetailPage, TalentPoolPage, TalentProfilePage,
} from '@/pages';
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
              <CandidatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/candidates/:id"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER']}>
              <CandidateProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER']}>
              <JobsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/jobs/:id"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER']}>
              <JobDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/interviews"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER']}>
              <InterviewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/communication"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER']}>
              <CommunicationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'HIRING_MANAGER']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'HIRING_MANAGER']}>
              <TeamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams/:id"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'HIRING_MANAGER']}>
              <TeamDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/talent-pool"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER']}>
              <TalentPoolPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/talent-pool/:id"
          element={
            <ProtectedRoute requiredRoles={['ADMIN', 'RECRUITER', 'HIRING_MANAGER']}>
              <TalentProfilePage />
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
