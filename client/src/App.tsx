import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AnalysisPage } from './pages/AnalysisPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExerciseProgressPage } from './pages/ExerciseProgressPage';
import { ExportPage } from './pages/ExportPage';
import { FoodPage } from './pages/FoodPage';
import { HistoryPage } from './pages/HistoryPage';
import { MorePage } from './pages/MorePage';
import { SettingsPage } from './pages/SettingsPage';
import { TrainPage } from './pages/TrainPage';
import { WeeklyReviewPage } from './pages/WeeklyReviewPage';
import { WeighPage } from './pages/WeighPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/weigh" element={<WeighPage />} />
        <Route path="/food" element={<FoodPage />} />
        {/* The old combined page is now split in two. */}
        <Route path="/log" element={<Navigate to="/weigh" replace />} />
        <Route path="/train" element={<TrainPage />} />
        <Route path="/train/exercise" element={<ExerciseProgressPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/weekly" element={<WeeklyReviewPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
