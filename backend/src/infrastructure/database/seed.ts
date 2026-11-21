import { db } from './connection';
import { roles, userSettings, users } from './schema';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('Seeding database...');

  // Seed roles
  const defaultRoles = [
    { name: 'USER', description: 'Người dùng thông thường', isSystem: true },
    { name: 'MODERATOR', description: 'Kiểm duyệt nội dung', isSystem: true },
    { name: 'ADMIN', description: 'Quản trị hệ thống', isSystem: true },
    { name: 'SUPER_ADMIN', description: 'Quản trị tối cao', isSystem: true },
  ];

  for (const role of defaultRoles) {
    await db.insert(roles).values(role).onConflictDoNothing();
  }

  // Tạo trigger tự động tạo settings khi có user mới
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION create_user_settings()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO user_settings (user_id)
      VALUES (NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS after_user_insert_settings ON users;
    CREATE TRIGGER after_user_insert_settings
      AFTER INSERT ON users
      FOR EACH ROW EXECUTE FUNCTION create_user_settings();
  `);

  console.log('✅ Seed completed');
  process.exit(0);
}

seed().catch(console.error);