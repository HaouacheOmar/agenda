from __future__ import annotations

from datetime import datetime
from pathlib import Path
import os
import shutil
import sqlite3
import tempfile

from django.conf import settings
from django.db import connections
from django.http import FileResponse
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView


REQUIRED_TABLES = {
    'django_migrations',
    'category_category',
    'event_event_list',
    'event_event',
}


def get_sqlite_db_path() -> Path:
    return Path(settings.DATABASES['default']['NAME'])


class ExportSQLiteView(APIView):
    def get(self, request):
        db_path = get_sqlite_db_path()
        if not db_path.exists():
            return Response({'err': 'SQLite database file not found.'}, status=status.HTTP_404_NOT_FOUND)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        file_name = f'agenda-backup-{timestamp}.sqlite3'
        return FileResponse(open(db_path, 'rb'), as_attachment=True, filename=file_name)


class ImportSQLiteView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get('database')
        if not uploaded_file:
            return Response({'err': 'No database file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        db_path = get_sqlite_db_path()
        db_path.parent.mkdir(parents=True, exist_ok=True)

        temp_fd, temp_name = tempfile.mkstemp(suffix='.sqlite3', dir=str(db_path.parent))
        os.close(temp_fd)
        temp_path = Path(temp_name)

        backup_name = None

        try:
            with temp_path.open('wb') as destination:
                for chunk in uploaded_file.chunks():
                    destination.write(chunk)

            try:
                connection = sqlite3.connect(str(temp_path))
                integrity_row = connection.execute('PRAGMA integrity_check;').fetchone()
                if not integrity_row or str(integrity_row[0]).lower() != 'ok':
                    return Response(
                        {'err': 'SQLite integrity check failed for uploaded file.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                table_rows = connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table';"
                ).fetchall()
                table_names = {row[0] for row in table_rows}
            finally:
                connection.close()

            missing_tables = sorted(REQUIRED_TABLES - table_names)
            if missing_tables:
                return Response(
                    {
                        'err': (
                            'Uploaded database is missing required tables: '
                            + ', '.join(missing_tables)
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            connections.close_all()

            if db_path.exists():
                backup_name = f"db.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}.sqlite3"
                backup_path = db_path.with_name(backup_name)
                shutil.copy2(db_path, backup_path)

            shutil.move(str(temp_path), str(db_path))

            response_payload = {'msg': 'Database imported successfully.'}
            if backup_name:
                response_payload['backup'] = backup_name

            return Response(response_payload, status=status.HTTP_200_OK)
        except sqlite3.DatabaseError:
            return Response(
                {'err': 'Uploaded file is not a valid SQLite database.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response(
                {'err': 'Failed to import SQLite database.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        finally:
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
