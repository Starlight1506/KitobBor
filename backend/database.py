import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    return psycopg2.connect(
        dbname="kitobbor",
        user="postgres",
        password="1506",
        host="localhost",
        port="5433",
        cursor_factory=RealDictCursor
    )
