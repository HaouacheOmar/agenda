from rest_framework.test import APITestCase

from category.models import Category
from .models import Event, Event_list


class EventAPITests(APITestCase):
    def setUp(self):
        self.event_list = Event_list.objects.create(title='List', category=Category.objects.create(title='Cat'))
        self.event = Event.objects.create(
            title='E', event_list=self.event_list, priroty='high',
            start_date='2026-01-01T10:00:00Z', end_date='2026-01-01T11:00:00Z',
        )
        self.payload = {
            'title': 'E2', 'description': '', 'event_list': self.event_list.id, 'priroty': 'low',
            'start_date': '2026-01-02T10:00:00Z', 'end_date': '2026-01-02T11:00:00Z', 'notified': True,
        }

    def test_put_returns_updated_event(self):
        res = self.client.put(f'/event/events/{self.event.id}', self.payload, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['title'], 'E2')

    def test_put_invalid_returns_400(self):
        res = self.client.put(f'/event/events/{self.event.id}', {**self.payload, 'end_date': '2025-01-01T00:00:00Z'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('end_date', res.data)

    def test_missing_event_returns_404(self):
        self.assertEqual(self.client.get('/event/events/999').status_code, 404)
        self.assertEqual(self.client.delete('/event/eventlists/999/').status_code, 404)

    def test_priority_filter(self):
        self.assertEqual(len(self.client.get('/event/events/priority/?priority=high').data), 1)
        self.assertEqual(len(self.client.get('/event/events/priority/?priority=low').data), 0)
        self.assertEqual(self.client.get('/event/events/priority/?priority=urgent').status_code, 400)
