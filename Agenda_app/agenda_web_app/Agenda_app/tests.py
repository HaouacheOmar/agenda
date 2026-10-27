import json

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from category.models import Category
from event.models import Event, Event_list


def make_data(prefix='A'):
    category = Category.objects.create(title=f'{prefix} cat')
    event_list = Event_list.objects.create(title=f'{prefix} list', category=category)
    Event.objects.create(
        title=f'{prefix} event', event_list=event_list, priroty='high', description='d',
        start_date='2026-01-01T10:00:00Z', end_date='2026-01-01T11:00:00Z',
    )


class DataExportImportTests(APITestCase):
    def export(self):
        res = self.client.get('/data/export/')
        self.assertEqual(res.status_code, 200)
        return res

    def upload(self, content, name='backup.json'):
        body = content if isinstance(content, bytes) else json.dumps(content).encode()
        return self.client.post('/data/import/', {'file': SimpleUploadedFile(name, body)}, format='multipart')

    def test_export_is_a_downloadable_json_backup(self):
        make_data()
        res = self.export()
        self.assertIn('attachment; filename="agenda-backup-', res['Content-Disposition'])
        payload = json.loads(res.content)
        self.assertEqual(payload['format'], 'agendaops')
        self.assertEqual([c['title'] for c in payload['categories']], ['A cat'])
        self.assertEqual(payload['events'][0]['priroty'], 'high')

    def test_import_replaces_everything_with_the_backup(self):
        make_data('A')
        backup = json.loads(self.export().content)
        Category.objects.all().delete()
        make_data('B')

        res = self.upload(backup)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['counts'], {'categories': 1, 'event_lists': 1, 'events': 1})
        self.assertEqual(list(Event.objects.values_list('title', flat=True)), ['A event'])
        event = Event.objects.get()
        self.assertEqual(event.event_list.category.title, 'A cat')

    def test_round_trip_keeps_relations_when_ids_change(self):
        make_data('A')
        make_data('C')
        backup = json.loads(self.export().content)
        self.assertEqual(self.upload(backup).status_code, 200)
        self.assertEqual(
            sorted(Event.objects.values_list('title', 'event_list__title', 'event_list__category__title')),
            [('A event', 'A list', 'A cat'), ('C event', 'C list', 'C cat')],
        )

    def test_import_without_file_returns_400(self):
        self.assertEqual(self.client.post('/data/import/', {}, format='multipart').status_code, 400)

    def test_import_rejects_non_json(self):
        make_data()
        self.assertEqual(self.upload(b'not json').status_code, 400)
        self.assertEqual(Event.objects.count(), 1)

    def test_import_rejects_foreign_json(self):
        make_data()
        self.assertEqual(self.upload({'hello': 'world'}).status_code, 400)
        self.assertEqual(Event.objects.count(), 1)

    def test_invalid_row_rolls_back_everything(self):
        make_data('A')
        backup = json.loads(self.export().content)
        backup['events'][0]['end_date'] = '2025-01-01T00:00:00Z'  # before start
        res = self.upload(backup)
        self.assertEqual(res.status_code, 400)
        self.assertIn('nothing was changed', res.data['err'])
        self.assertEqual(list(Event.objects.values_list('title', flat=True)), ['A event'])
