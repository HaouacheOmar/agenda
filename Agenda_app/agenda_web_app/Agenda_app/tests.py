import sqlite3
import tempfile
from pathlib import Path
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APISimpleTestCase

from . import db_tools_views
from .db_tools_views import MAX_BACKUPS, REQUIRED_TABLES


def make_sqlite(path, tables, marker='x'):
    with sqlite3.connect(path) as conn:
        for table in tables:
            conn.execute(f'CREATE TABLE {table} (id INTEGER PRIMARY KEY, note TEXT)')
        conn.execute(f"INSERT INTO {sorted(tables)[0]} (note) VALUES ('{marker}')")
    conn.close()


def read_marker(path):
    conn = sqlite3.connect(path)
    try:
        return conn.execute(f'SELECT note FROM {sorted(REQUIRED_TABLES)[0]}').fetchone()[0]
    finally:
        conn.close()


class SQLiteToolsTests(APISimpleTestCase):
    """Export/import run against a temporary database file, never the real one."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.db = self.dir / 'db.sqlite3'
        make_sqlite(self.db, REQUIRED_TABLES, marker='current')
        patcher = mock.patch.object(db_tools_views, 'get_sqlite_db_path', return_value=self.db)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)

    def upload(self, path):
        return self.client.post(
            '/data/import-sqlite/',
            {'database': SimpleUploadedFile('upload.sqlite3', Path(path).read_bytes())},
            format='multipart',
        )

    def test_export_returns_the_database_file(self):
        res = self.client.get('/data/export-sqlite/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('attachment; filename="agenda-backup-', res['Content-Disposition'])
        self.assertEqual(b''.join(res.streaming_content), self.db.read_bytes())

    def test_export_missing_file_returns_404(self):
        self.db.unlink()
        self.assertEqual(self.client.get('/data/export-sqlite/').status_code, 404)

    def test_import_without_file_returns_400(self):
        res = self.client.post('/data/import-sqlite/', {}, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_import_rejects_non_sqlite_file(self):
        bad = self.dir / 'bad.sqlite3'
        bad.write_bytes(b'not a database')
        res = self.upload(bad)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(read_marker(self.db), 'current')

    def test_import_rejects_database_missing_tables(self):
        partial = self.dir / 'partial.sqlite3'
        make_sqlite(partial, {'category_category'})
        res = self.upload(partial)
        self.assertEqual(res.status_code, 400)
        self.assertIn('event_event', res.data['err'])
        self.assertEqual(read_marker(self.db), 'current')

    def test_import_replaces_database_and_keeps_a_backup(self):
        new = self.dir / 'new.sqlite3'
        make_sqlite(new, REQUIRED_TABLES, marker='imported')
        res = self.upload(new)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(read_marker(self.db), 'imported')
        backup = self.dir / res.data['backup']
        self.assertEqual(read_marker(backup), 'current')
        # no temp upload files left behind
        self.assertEqual(sorted(p.name for p in self.dir.glob('tmp*')), [])

    def test_import_keeps_only_the_latest_backups(self):
        for i in range(MAX_BACKUPS + 2):
            (self.dir / f'db.backup.20260101_00000{i}.sqlite3').write_bytes(b'old')
        new = self.dir / 'new.sqlite3'
        make_sqlite(new, REQUIRED_TABLES)
        self.assertEqual(self.upload(new).status_code, 200)
        self.assertEqual(len(list(self.dir.glob('db.backup.*.sqlite3'))), MAX_BACKUPS)
