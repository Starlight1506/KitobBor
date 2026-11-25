-- 1. Foydalanuvchilar jadvali (RBAC uchun)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL, -- MVP uchun oddiy, keyin bcrypt qilamiz
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'admin')),
    full_name VARCHAR(100) NOT NULL,
    nfc_uid VARCHAR(50)
);

-- 2. Kitoblar jadvali (.xlsx shu yerga yuklanadi)
CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Umumiy',
    location VARCHAR(150) DEFAULT 'Zal: 1 | Javon: A | Tokcha: 1',
    available BOOLEAN DEFAULT TRUE
);

-- 3. Bronlar jadvali (2 soatlik band qilish)
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active' -- active, completed, cancelled
);

-- Dastlabki test akkauntlari
INSERT INTO users (username, password, role, full_name, nfc_uid)
VALUES 
    ('user', '1234', 'user', 'Talaba #1042', '04 1A 2B 3C'),
    ('admin', 'admin123', 'admin', 'Kutubxonachi', NULL)
ON CONFLICT (username) DO NOTHING;
