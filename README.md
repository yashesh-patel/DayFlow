# Dayflow

A full-stack HR management system built with modern web technologies. Dayflow helps organizations manage employees, payroll, attendance, leave, and tasks efficiently.

## 🚀 Features

- **Authentication & Security**: Secure user authentication with JWT, password hashing with bcryptjs
- **Employee Management**: Complete employee profile management with validation
- **Payroll Management**: Payroll processing and tracking
- **Attendance Tracking**: Monitor employee attendance and records
- **Leave Management**: Manage employee leave requests and approvals
- **Task Management**: Create and track employee tasks
- **Client Management**: Manage client information and relationships
- **Email Notifications**: Automated email notifications via Nodemailer
- **Scheduled Tasks**: Cron-based job scheduling for automated processes
- **File Management**: Handle file uploads and management

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js v5.2
- **Database**: PostgreSQL
- **Authentication**: JWT (jsonwebtoken)
- **Security**: bcryptjs for password hashing
- **Email**: Nodemailer
- **Task Scheduling**: node-cron
- **File Upload**: Multer
- **Development**: Nodemon

### Frontend
- **Framework**: React 18.3
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI)
- **Form Management**: React Hook Form + Zod validation
- **HTTP Client**: TanStack React Query
- **Routing**: React Router DOM
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Theming**: next-themes

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL database

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Dayflow
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure your database and JWT credentials in .env
# Required variables:
# - DATABASE_URL=postgresql://user:password@localhost:5432/dayflow
# - JWT_SECRET=your-secret-key
# - NODE_ENV=development
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Create .env file if needed
```

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend runs on `http://localhost:5000` (or your configured port)

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on `http://localhost:5173` (or your configured port)

### Production Mode

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## 📁 Project Structure

```
Dayflow/
├── backend/
│   ├── src/
│   │   ├── controllers/      # Route controllers
│   │   ├── routes/           # API routes
│   │   ├── middlewares/       # Express middlewares
│   │   ├── lib/               # Utility functions
│   │   └── index.js          # Express server entry point
│   ├── package.json
│   └── .env                  # Environment variables
│
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── App.tsx           # Main app component
│   │   └── main.tsx          # Entry point
│   ├── package.json
│   └── vite.config.ts        # Vite configuration
│
└── README.md
```

## 🔐 Environment Variables

### Backend (.env)
```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dayflow

# Server
PORT=5000
NODE_ENV=development

# Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d

# Email Service (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Employees
- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get employee details
- `POST /api/employees` - Create employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Payroll
- `GET /api/payroll` - Get payroll records
- `POST /api/payroll` - Create payroll record
- `GET /api/payroll/:id` - Get payroll details

### Leave Management
- `GET /api/leave` - Get leave records
- `POST /api/leave` - Request leave
- `PUT /api/leave/:id` - Approve/reject leave

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance/:employeeId` - Get employee attendance

### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client

## 🧪 Testing

Run linting on frontend:
```bash
cd frontend
npm run lint
```

4. Open a Pull Request

## 📝 License

This project is licensed under the ISC License - see the LICENSE file for details.
