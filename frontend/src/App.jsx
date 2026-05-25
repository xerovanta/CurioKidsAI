import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LearningRoom from './pages/LearningRoom';
import TrophyCase from './pages/TrophyCase';
import ParentAuth from './pages/ParentAuth';
import ParentDashboard from './pages/ParentDashboard';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/learning-room" element={<LearningRoom />} />
            <Route path="/trophy-case" element={<TrophyCase />} />
            <Route path="/parent-login" element={<ParentAuth />} />
            <Route path="/dashboard" element={<ParentDashboard />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;
