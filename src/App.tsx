/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './store';
import { AppLayout } from './ui/AppLayout';
import { Dashboard } from './ui/pages/Dashboard';
import { Attendance } from './ui/pages/Attendance';
import { AttendanceHistory } from './ui/pages/AttendanceHistory';
import { AttendanceReport } from './ui/pages/AttendanceReport';
import { Evaluations } from './ui/pages/Evaluations';
import { GradeReport } from './ui/pages/GradeReport';
import { SystemReset } from './ui/pages/SystemReset';

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/history" element={<AttendanceHistory />} />
            <Route path="/report" element={<AttendanceReport />} />
            <Route path="/evaluations" element={<Evaluations />} />
            <Route path="/grades" element={<GradeReport />} />
            <Route path="/reset" element={<SystemReset />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
