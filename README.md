# SchoolBridge

A school management and digital learning SaaS for private schools in Ijebu-Ode, Ogun State, Nigeria.

## Project Structure

```
School Bridge/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── config/            # Database configuration
│   │   ├── controllers/       # Route controllers
│   │   ├── middleware/        # Auth and multi-tenant middleware
│   │   ├── models/            # Mongoose models
│   │   ├── routes/            # API routes
│   │   ├── __tests__/         # Backend tests
│   │   ├── index.ts           # Server entry point
│   │   └── seed.ts            # Database seeding script
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                   # Environment variables
├── frontend/                   # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── contexts/          # React contexts (Auth)
│   │   ├── pages/             # Page components
│   │   ├── services/          # API service
│   │   ├── App.tsx            # Main app component
│   │   └── main.tsx           # Entry point
│   ├── package.json
│   ├── tailwind.config.js
│   └── .env                   # Environment variables
└── README.md
```

## Features Implemented (Week 1 - Foundation)

### Backend
- ✅ School model & signup (creates School + admin User in transaction)
- ✅ User model & JWT-based authentication
- ✅ AcademicSession model with CRUD
- ✅ ClassGroup model with CRUD
- ✅ Student model with CRUD (manual entry)
- ✅ Multi-tenant data isolation (schoolId scoping on all queries)
- ✅ Dashboard stats endpoint
- ✅ Backend tests for auth, multi-tenant isolation, and admissionNo uniqueness

### Frontend
- ✅ Signup and login pages
- ✅ Dashboard with stats (school name, total students, total classes)
- ✅ Left navigation with mobile responsiveness
- ✅ Classes management (create, list, edit, delete)
- ✅ Students management (create, list, edit, delete, view profile, filter by class)
- ✅ Academic Session settings (create, list, edit, delete)
- ✅ Placeholder pages for Migration, Attendance, Fees

### Key Features
- **Multi-tenant isolation**: Every query is scoped by schoolId, ensuring schools cannot access each other's data
- **Admission number uniqueness**: Enforced per school, but allows duplicates across different schools
- **Mobile-responsive**: Dashboard and all pages work on phone-width screens
- **JWT authentication**: Secure token-based auth with role-based access control

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (running locally or MongoDB Atlas connection string)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   cd "School Bridge"
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Configure backend environment**
   Create a `.env` file in the `backend` directory:
   ```
   MONGODB_URI=mongodb://localhost:27017/schoolbridge
   JWT_SECRET=your-secret-key-change-in-production
   PORT=5000
   ```

4. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

5. **Configure frontend environment**
   Create a `.env` file in the `frontend` directory:
   ```
   VITE_API_URL=http://localhost:5000/api
   ```

### Running the Application

1. **Start MongoDB**
   Make sure MongoDB is running on your local machine or update the MONGODB_URI in backend/.env with your MongoDB Atlas connection string.

2. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   The backend will run on http://localhost:5000

3. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will run on http://localhost:5173 (or another port if 5173 is taken)

4. **Access the application**
   Open http://localhost:5173 in your browser

### Seeding Demo Data

To seed the database with a demo school, admin account, 3 classes, and 20 students:

```bash
cd backend
npm run seed
```

**Demo credentials:**
- Email: admin@ijebuodecollege.com
- Password: admin123

### Running Tests

```bash
cd backend
npm test
```

Note: Tests require MongoDB to be running and may need MONGODB_URI_TEST environment variable set for test database isolation.

### Building for Production

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
```

The built frontend will be in the `frontend/dist` directory.

## Known Limitations

1. **Tests**: The Jest tests have timeout issues due to MongoDB connection. They need to be run with MongoDB running and may require additional configuration for proper test database isolation.

2. **Seeding**: The seed script requires MongoDB to be running locally. If using MongoDB Atlas, update the MONGODB_URI in backend/.env before running.

3. **Environment variables**: JWT_SECRET should be changed to a secure random string in production.

4. **No production deployment**: The project is set up for local development. For production, you'll need to:
   - Set up a production MongoDB instance
   - Configure proper environment variables
   - Set up reverse proxy (nginx) for the backend
   - Build and serve the frontend static files
   - Implement proper SSL/TLS certificates

## What's Stubbed (Coming in Future Weeks)

- **Migration**: Placeholder page - data import from spreadsheets will be implemented later
- **Attendance**: Placeholder page - attendance tracking will be implemented later
- **Fees**: Placeholder page - fee management will be implemented later
- **Lesson notes**: Not yet implemented
- **CBT exams**: Not yet implemented
- **Student login**: Not yet implemented - currently only admin/teacher login

## Technology Stack

### Backend
- Node.js + Express
- TypeScript
- MongoDB + Mongoose
- JWT for authentication
- bcryptjs for password hashing
- Jest + Supertest for testing

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios for API calls

## Development Notes

- The project uses a monorepo structure with separate backend and frontend folders
- All database queries are automatically scoped by schoolId for multi-tenant isolation
- The frontend uses a context-based authentication system with JWT token storage in localStorage
- All pages are mobile-responsive with a collapsible sidebar navigation
- The application is designed to work on phone browsers for demo purposes
