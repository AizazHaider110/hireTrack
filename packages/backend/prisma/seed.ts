import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create test users with different roles
  const users = [
    {
      email: 'admin@ats.com',
      password: 'admin123',
      name: 'Admin User',
      role: 'ADMIN',
    },
    {
      email: 'recruiter@ats.com',
      password: 'recruiter123',
      name: 'Recruiter User',
      role: 'RECRUITER',
    },
    {
      email: 'manager@ats.com',
      password: 'manager123',
      name: 'Hiring Manager',
      role: 'HIRING_MANAGER',
    },
    {
      email: 'interviewer@ats.com',
      password: 'interviewer123',
      name: 'Interviewer User',
      role: 'INTERVIEWER',
    },
  ];

  for (const userData of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      console.log(`User ${userData.email} already exists, skipping...`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        role: userData.role as any,
      },
    });

    console.log(`Created user: ${user.email} (${user.role})`);
  }

  console.log('Database seed completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
