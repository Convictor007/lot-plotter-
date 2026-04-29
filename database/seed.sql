-- Run after schema.sql. Password matches demo mock: dsadsadsa (bcrypt).
USE iassess;

INSERT INTO users (
  email,
  password_hash,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  'dareyes@my.cspc.edu.ph',
  '$2b$10$r16AEObUbIkM080c2Upg8uXvxwyLLtdwRwV3fAgdbDIKIzAGn4m2W',
  'citizen',
  1,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

INSERT INTO user_profiles (
  user_id,
  first_name,
  last_name,
  phone_number,
  gender,
  date_of_birth,
  created_at,
  updated_at
)
SELECT
  u.user_id,
  'Darryl John',
  'Reyes',
  '+63 912 345 6789',
  'Male',
  '1998-03-17',
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'dareyes@my.cspc.edu.ph'
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

INSERT INTO user_addresses (
  user_id,
  street_address,
  barangay,
  municipality,
  province,
  region,
  postal_code,
  is_primary,
  created_at,
  updated_at
)
SELECT
  u.user_id,
  NULL,
  'San Juan',
  'Balatan',
  'Camarines Sur',
  'South Luzon',
  NULL,
  1,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'dareyes@my.cspc.edu.ph'
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

INSERT INTO property_owners (
  user_id,
  verification_status,
  created_at,
  updated_at
)
SELECT
  u.user_id,
  'verified',
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'dareyes@my.cspc.edu.ph'
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

-- ---------------------------------------------------------------------------
-- Assessor user
-- ---------------------------------------------------------------------------
INSERT INTO users (
  email,
  password_hash,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  'assessor@iassess.local',
  '$2b$10$r16AEObUbIkM080c2Upg8uXvxwyLLtdwRwV3fAgdbDIKIzAGn4m2W',
  'assessor',
  1,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

INSERT INTO user_profiles (
  user_id,
  first_name,
  last_name,
  phone_number,
  gender,
  date_of_birth,
  created_at,
  updated_at
)
SELECT
  u.user_id,
  'Maria',
  'Santos',
  '+63 917 100 2000',
  'Female',
  NULL,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'assessor@iassess.local'
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

INSERT INTO user_addresses (
  user_id,
  street_address,
  barangay,
  municipality,
  province,
  region,
  postal_code,
  is_primary,
  created_at,
  updated_at
)
SELECT
  u.user_id,
  'Municipal Hall',
  'Poblacion',
  'Balatan',
  'Camarines Sur',
  'Bicol Region',
  NULL,
  1,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'assessor@iassess.local'
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

INSERT INTO assessors (
  user_id,
  employee_code,
  office_name,
  is_head_assessor,
  created_at,
  updated_at
)
SELECT
  u.user_id,
  'ASSESSOR-001',
  'Balatan Municipal Assessor',
  1,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'assessor@iassess.local'
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

-- ---------------------------------------------------------------------------
-- Admin monitor user
-- ---------------------------------------------------------------------------
INSERT INTO users (
  email,
  password_hash,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  'admin@iassess.local',
  '$2b$10$r16AEObUbIkM080c2Upg8uXvxwyLLtdwRwV3fAgdbDIKIzAGn4m2W',
  'admin',
  1,
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

INSERT INTO user_profiles (
  user_id,
  first_name,
  last_name,
  phone_number,
  gender,
  date_of_birth,
  created_at,
  updated_at
)
SELECT
  u.user_id,
  'System',
  'Administrator',
  NULL,
  NULL,
  NULL,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'admin@iassess.local'
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

INSERT INTO admins (
  user_id,
  created_at,
  updated_at
)
SELECT
  u.user_id,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'admin@iassess.local'
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);
