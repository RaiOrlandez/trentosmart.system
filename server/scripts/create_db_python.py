import MySQLdb
import os
from dotenv import load_dotenv

load_dotenv()

host = os.getenv('MYSQL_HOST', '127.0.0.1')
user = os.getenv('MYSQL_USER', 'root')
password = os.getenv('MYSQL_PASSWORD', '')

print(f"Connecting to MySQL at {host} as {user}...")

try:
    conn = MySQLdb.connect(host=host, user=user, passwd=password)
    cursor = conn.cursor()
    cursor.execute("CREATE DATABASE IF NOT EXISTS transport CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    print("Database 'transport' created or already exists.")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Failed to create database: {e}")
