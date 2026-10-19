from rest_framework.test import APITestCase

from event.models import Event, Event_list
from .models import Category


class CategoryAPITests(APITestCase):
    def test_list_is_newest_first(self):
        # auto_now_add ignores values passed to create(), so set the dates afterwards.
        old, new = Category.objects.create(title='Old'), Category.objects.create(title='New')
        Category.objects.filter(pk=old.pk).update(date_created='2026-01-01T00:00:00Z')
        Category.objects.filter(pk=new.pk).update(date_created='2026-02-01T00:00:00Z')
        titles = [c['title'] for c in self.client.get('/category/categories/').data]
        self.assertEqual(titles, ['New', 'Old'])

    def test_create(self):
        res = self.client.post('/category/categories/', {'title': 'Work'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(set(res.data), {'id', 'title', 'date_created'})

    def test_create_without_title_returns_400(self):
        res = self.client.post('/category/categories/', {}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('title', res.data)

    def test_delete_cascades_to_lists_and_events(self):
        category = Category.objects.create(title='Work')
        event_list = Event_list.objects.create(title='List', category=category)
        Event.objects.create(
            title='E', event_list=event_list, priroty='low',
            start_date='2026-01-01T10:00:00Z', end_date='2026-01-01T11:00:00Z',
        )
        res = self.client.delete(f'/category/categories/{category.id}/')
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Event_list.objects.exists())
        self.assertFalse(Event.objects.exists())

    def test_delete_missing_returns_404(self):
        self.assertEqual(self.client.delete('/category/categories/999/').status_code, 404)
