import express, { Application } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { connectDB } from './config/database';
import authRoutes from './routes/auth';
import academicSessionRoutes from './routes/academicSessions';
import classGroupRoutes from './routes/classGroups';
import studentRoutes from './routes/students';
import staffRoutes from './routes/staff';
import teacherRoutes from './routes/teachers';
import migrationRoutes from './routes/migration';
import migrationsRoutes from './routes/migrations';
import dashboardRoutes from './routes/dashboard';
import attendanceRoutes from './routes/attendance';
import feesRoutes from './routes/fees';
import schoolRoutes from './routes/schools';
import uploadRoutes from './routes/uploads';
import promotionRoutes from './routes/promotion';
import subjectRoutes from './routes/subjects';
import subjectRegistrationRoutes from './routes/subjectRegistrations';
import resultRoutes from './routes/results';
import reportCardRoutes from './routes/reportCards';
import sessionRoutes from './routes/sessions';
import termRoutes from './routes/terms';
import periodRoutes from './routes/periods';
import classLevelRoutes from './routes/classLevels';

const app: Application = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/academic-sessions', academicSessionRoutes);
app.use('/api/classes', classGroupRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/migration', migrationRoutes); // Student CSV import - always enabled

// Schema migration routes only in development or with explicit flag
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_MIGRATIONS === 'true') {
  app.use('/api/migrations', migrationsRoutes);
}

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/promotion', promotionRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/subject-registrations', subjectRegistrationRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/report-cards', reportCardRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/terms', termRoutes);
app.use('/api/periods', periodRoutes);
app.use('/api/class-levels', classLevelRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    const isConnected = state === 1; // 1 = connected
    res.json({ ok: isConnected });
  } catch (error) {
    res.json({ ok: false });
  }
});

export { app };
