import os
from pathlib import Path

# Use PyMySQL as MySQLdb if available (makes running on Windows easier)
try:
    import pymysql
    pymysql.version_info = (2, 2, 7, "final", 0)
    pymysql.install_as_MySQLdb()
except Exception:
    pass
