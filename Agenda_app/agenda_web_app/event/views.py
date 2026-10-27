from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Event, Event_list
from .serializers import EventSerializer, EventListSerializer


def save_or_400(serializer, success_status=status.HTTP_200_OK):
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=success_status)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EventListAPIView(APIView):
    def get(self, request):
        return Response(EventListSerializer(Event_list.objects.all(), many=True).data)

    def post(self, request):
        return save_or_400(EventListSerializer(data=request.data), status.HTTP_201_CREATED)


class EventListDetailAPIView(APIView):
    def delete(self, request, pk):
        # Deleting an event list cascades to its events via FK on_delete=models.CASCADE.
        get_object_or_404(Event_list, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventAPIView(APIView):
    def get(self, request):
        return Response(EventSerializer(Event.objects.all(), many=True).data)

    def post(self, request):
        return save_or_400(EventSerializer(data=request.data), status.HTTP_201_CREATED)


class EventDetailAPIView(APIView):
    def get(self, request, pk):
        return Response(EventSerializer(get_object_or_404(Event, pk=pk)).data)

    def put(self, request, pk):
        return save_or_400(EventSerializer(get_object_or_404(Event, pk=pk), data=request.data))

    def delete(self, request, pk):
        get_object_or_404(Event, pk=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventsByPriorityAPIView(APIView):
    def get(self, request):
        priority = request.query_params.get('priority')
        events = Event.objects.all()
        if priority:
            if priority not in dict(Event.PRIORITY_CHOICES):
                return Response({'err': f'invalid priority: {priority}'}, status=status.HTTP_400_BAD_REQUEST)
            events = events.filter(priroty=priority)
        return Response(EventSerializer(events, many=True).data)


class EventsByListAPIView(APIView):
    def get(self, request, eventlist_id):
        events = Event.objects.filter(event_list_id=eventlist_id)
        return Response(EventSerializer(events, many=True).data)
