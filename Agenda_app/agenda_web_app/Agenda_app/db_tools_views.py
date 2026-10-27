"""Whole-agenda export/import as JSON. Works on any database backend (SQLite locally, Neon in production)."""
from __future__ import annotations

import json
from datetime import datetime

from django.db import transaction
from django.http import JsonResponse
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from category.models import Category
from category.serializers import CategorySerializer
from event.models import Event, Event_list
from event.serializers import EventListSerializer, EventSerializer

FORMAT = 'agendaops'
VERSION = 1


class InvalidBackup(Exception):
    pass


class ExportView(APIView):
    def get(self, request):
        payload = {
            'format': FORMAT,
            'version': VERSION,
            'exported_at': datetime.now().isoformat(timespec='seconds'),
            'categories': CategorySerializer(Category.objects.order_by('id'), many=True).data,
            'event_lists': EventListSerializer(Event_list.objects.order_by('id'), many=True).data,
            'events': EventSerializer(Event.objects.order_by('id'), many=True).data,
        }
        response = JsonResponse(payload, json_dumps_params={'ensure_ascii': False, 'indent': 2})
        filename = f"agenda-backup-{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


def _save(serializer_class, data, what):
    serializer = serializer_class(data=data)
    if not serializer.is_valid():
        raise InvalidBackup(f'Invalid {what}: {serializer.errors}')
    return serializer.save()


class ImportView(APIView):
    """Replace every category, list and event with the contents of an export file, all or nothing."""

    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'err': 'No backup file provided.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payload = json.load(uploaded)
        except (ValueError, UnicodeDecodeError):
            return Response({'err': 'The file is not a valid AgendaOPS backup (JSON expected).'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(payload, dict) or payload.get('format') != FORMAT:
            return Response({'err': 'The file is not an AgendaOPS backup.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                Category.objects.all().delete()  # cascades to lists and events
                # Ids are re-created; the file's ids only link its rows together.
                category_ids = {}
                for row in payload.get('categories', []):
                    category_ids[row['id']] = _save(CategorySerializer, {'title': row['title']}, 'category').id
                list_ids = {}
                for row in payload.get('event_lists', []):
                    data = {'title': row['title'], 'category': category_ids.get(row['category'])}
                    list_ids[row['id']] = _save(EventListSerializer, data, 'event list').id
                events = payload.get('events', [])
                for row in events:
                    data = {k: v for k, v in row.items() if k != 'id'}
                    data['event_list'] = list_ids.get(row.get('event_list'))
                    _save(EventSerializer, data, 'event')
        except (InvalidBackup, KeyError, TypeError) as error:
            return Response({'err': f'Import cancelled, nothing was changed. {error}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'msg': 'Data imported.',
                'counts': {'categories': len(category_ids), 'event_lists': len(list_ids), 'events': len(events)},
            }
        )
