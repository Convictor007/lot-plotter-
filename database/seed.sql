-- Run after schema.sql. Password matches demo mock: dsadsadsa (bcrypt).
USE iassess;

INSERT INTO users (
  email,
  password_hash,
  role,
  first_name,
  last_name,
  phone_number,
  gender,
  age,
  date_of_birth,
  street_address,
  region,
  postal_code,
  barangay,
  municipality,
  province,
  verification_status,
  created_at,
  updated_at
) VALUES (
  'dareyes@my.cspc.edu.ph',
  '$2b$10$r16AEObUbIkM080c2Upg8uXvxwyLLtdwRwV3fAgdbDIKIzAGn4m2W',
  'citizen',
  'Darryl John',
  'Reyes',
  '+63 912 345 6789',
  'Male',
  27,
  '1998-03-17',
  NULL,
  'South Luzon',
  NULL,
  'San Juan',
  'Balatan',
  'Camarines Sur',
  'verified',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);
