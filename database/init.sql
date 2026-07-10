-- AI Platform Database Initialization
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Roles enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'analyst', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE agent_status AS ENUM ('idle', 'running', 'error', 'disabled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recommendation_status AS ENUM ('pending', 'approved', 'rejected', 'applied');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE crm_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'won', 'lost');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE ai_platform TO ai_platform;
