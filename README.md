<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
# hireTrack
# hireTrack

# ATS (Applicant Tracking System) Backend

A comprehensive NestJS + Prisma + PostgreSQL backend for an Applicant Tracking System with authentication, role-based access control, resume parsing, and job management.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication with access & refresh tokens
- User registration and login with email + password
- Role-based access control (ADMIN, RECRUITER, CANDIDATE)
- Role-based guards for protected endpoints
- Password hashing with bcrypt

### 📄 Resume Parsing Module
- Resume upload (PDF/DOCX) with file validation
- Resume parsing service with placeholder for external parsers
- Automatic extraction of skills, education, and experience
- Storage of parsed data in candidate profiles

### 💼 ATS Core Features
- **Jobs**: Full CRUD operations for job postings (Recruiters/Admins only)
- **Applications**: Candidates can apply to jobs with resume upload
- **Admin Dashboard**: Comprehensive admin interface for managing users, jobs, and applications
- **User Management**: Profile management for all user types

### 🛡️ Security & Validation
- Input validation with class-validator
- Role-based access control (RBAC)
- Rate limiting with ThrottlerModule
- CORS enabled
- Comprehensive error handling

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport
- **Validation**: class-validator & class-transformer
- **File Upload**: Multer
- **Security**: bcrypt for password hashing

## Database Schema

### Core Models
- **User**: Authentication and user management
- **JobPosting**: Job listings with requirements and status
- **Candidate**: Candidate profiles with parsed resume data
- **Application**: Job applications with status tracking
- **ResumeParse**: Parsed resume data storage

### Enums
- **Role**: ADMIN, RECRUITER, CANDIDATE
- **ApplicationStatus**: APPLIED, REVIEWED, INTERVIEWED, OFFERED, REJECTED, HIRED

## API Endpoints

### Authentication (`/auth`)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token

### Jobs (`/jobs`)
- `GET /jobs` - Get all jobs (public)
- `GET /jobs/:id` - Get job by ID (public)
- `POST /jobs` - Create job (RECRUITER, ADMIN)
- `PUT /jobs/:id` - Update job (owner or ADMIN)
- `DELETE /jobs/:id` - Delete job (owner or ADMIN)
- `GET /jobs/recruiter/my-jobs` - Get recruiter's jobs

### Applications (`/applications`)
- `POST /applications` - Apply to job (CANDIDATE)
- `GET /applications/my-applications` - Get candidate's applications
- `GET /applications/job/:jobId` - Get applications for job (owner or ADMIN)
- `PUT /applications/:id/status` - Update application status (owner or ADMIN)
- `GET /applications/admin/all` - Get all applications (ADMIN)

### Resume (`/resume`)
- `POST /resume/upload` - Upload and parse resume (CANDIDATE)
- `GET /resume/profile` - Get candidate's resume profile

### User Management (`/user`)
- `GET /user/profile` - Get user profile
- `PUT /user/profile` - Update user profile
- `GET /user/candidate-profile` - Get candidate profile (CANDIDATE)

### Admin Dashboard (`/admin`)
- `GET /admin/dashboard` - Get dashboard statistics (ADMIN)
- `GET /admin/users` - Get all users (ADMIN)
- `GET /admin/users/:id` - Get user details (ADMIN)

## Installation & Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- npm or yarn

### Environment Variables
Create a `.env` file in the root directory:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/ats_db"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3000
```

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ats-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. **Run the application**
   ```bash
   # Development
   npm run start:dev
   
   # Production
   npm run build
   npm run start:prod
   ```

## Usage Examples

### Register a New User
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidate@example.com",
    "password": "password123",
    "name": "John Doe",
    "role": "CANDIDATE",
    "phone": "+1234567890"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "candidate@example.com",
    "password": "password123"
  }'
```

### Create a Job (Recruiter)
```bash
curl -X POST http://localhost:3000/jobs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Backend Developer",
    "description": "We are looking for an experienced backend developer...",
    "location": "Remote",
    "salary": "$80,000 - $120,000",
    "requirements": ["Node.js", "TypeScript", "PostgreSQL", "NestJS"]
  }'
```

### Apply to a Job (Candidate)
```bash
curl -X POST http://localhost:3000/applications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job-uuid-here",
    "coverLetter": "I am excited to apply for this position...",
    "resumeUrl": "https://example.com/resume.pdf"
  }'
```

## Resume Parsing Integration

The resume parsing service includes a placeholder function that can be easily replaced with:

1. **pyresparser** via microservice
2. **resume-parser** npm package
3. **AI services** like OpenAI for parsing
4. **Custom parsing logic**

To integrate an external parser, update the `parseResume` method in `src/resume/resume.service.ts`.

## Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── guards/          # JWT and role guards
│   ├── strategies/      # Passport strategies
│   ├── decorators/      # Role decorators
│   └── ...
├── common/              # Shared DTOs and utilities
│   └── dto/            # Data transfer objects
├── job/                 # Job management
├── application/         # Application management
├── resume/              # Resume parsing
├── admin/               # Admin dashboard
├── user/                # User management
└── prisma/              # Database configuration
```

## Development

### Available Scripts
- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build the application
- `npm run start:prod` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Database Management
- `npx prisma studio` - Open Prisma Studio for database management
- `npx prisma migrate dev` - Create and apply migrations
- `npx prisma db push` - Push schema changes to database

## Security Considerations

- All passwords are hashed using bcrypt
- JWT tokens have expiration times
- Role-based access control on all protected endpoints
- Input validation on all endpoints
- Rate limiting to prevent abuse
- CORS configured for frontend integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
