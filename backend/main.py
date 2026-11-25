from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from backend.database import get_db_connection

app = FastAPI(title="KitobBor API", version="1.0")

# Frontend (5500-port) backend (8000-port) bilan bemalol gaplashishi uchun CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= PYDANTIC MODELLAR (So'rov shablonlari) =================
class LoginRequest(BaseModel):
    username: str
    password: str

class BookCreateRequest(BaseModel):
    title: str
    author: str
    category: str = "Umumiy"
    location: str = "Zal: 1 | Javon: A | Tokcha: 1"

class ReserveRequest(BaseModel):
    user_id: int
    book_id: int

# ================= 1. AUTH (LOGIN) =================
@app.post("/api/login")
def login(data: LoginRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, username, role, full_name, nfc_uid FROM users WHERE username = %s AND password = %s",
        (data.username.strip().lower(), data.password)
    )
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Login yoki parol noto'g'ri")
    return user

# ================= 2. KITOBLAR (KATALOG VA ADMIN) =================
@app.get("/api/books")
def get_books():
    conn = get_db_connection()
    cur = conn.cursor()
    # Muddati o'tib ketgan bronlarni avtomatik yopish
    cur.execute("UPDATE reservations SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()")
    cur.execute("""
        SELECT b.*, r.expires_at, r.user_id AS reserved_by
        FROM books b
        LEFT JOIN reservations r ON b.id = r.book_id AND r.status = 'active'
        ORDER BY b.id DESC
    """)
    books = cur.fetchall()
    conn.commit()
    cur.close()
    conn.close()
    return books

@app.post("/api/books")
def add_book(data: BookCreateRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO books (title, author, category, location, available)
        VALUES (%s, %s, %s, %s, TRUE)
        RETURNING *
        """,
        (data.title, data.author, data.category, data.location)
    )
    new_book = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return new_book

@app.patch("/api/books/{book_id}/toggle")
def toggle_book_status(book_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT available FROM books WHERE id = %s", (book_id,))
    book = cur.fetchone()
    if not book:
        cur.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Kitob topilmadi")

    new_status = not book["available"]
    cur.execute("UPDATE books SET available = %s WHERE id = %s RETURNING *", (new_status, book_id))
    updated = cur.fetchone()

    # Agar kitob qayta mavjud qilinsa, aktiv bronni yopamiz
    if new_status:
        cur.execute("UPDATE reservations SET status = 'cancelled' WHERE book_id = %s AND status = 'active'", (book_id,))

    conn.commit()
    cur.close()
    conn.close()
    return updated

# ================= 3. BRON QILISH VA NFC TASDIQLASH =================
@app.post("/api/reserve")
def reserve_book(data: ReserveRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    expires = datetime.now() + timedelta(hours=2)
    cur.execute(
        """
        INSERT INTO reservations (user_id, book_id, expires_at, status)
        VALUES (%s, %s, %s, 'active')
        RETURNING id, user_id, book_id, expires_at
        """,
        (data.user_id, data.book_id, expires)
    )
    res = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Kitob 2 soatga bron qilindi", "reservation": res}

@app.delete("/api/reserve/{book_id}")
def cancel_reservation(book_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE reservations SET status = 'cancelled' WHERE book_id = %s AND status = 'active'",
        (book_id,)
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "Bron bekor qilindi"}

@app.post("/api/nfc/confirm")
def confirm_nfc_pickup(data: ReserveRequest):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "UPDATE reservations SET status = 'completed' WHERE book_id = %s AND status = 'active'",
        (data.book_id,)
    )
    cur.execute("UPDATE books SET available = FALSE WHERE id = %s", (data.book_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"message": "NFC orqali kitob topshirildi"}
