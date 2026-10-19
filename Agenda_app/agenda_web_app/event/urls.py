from django.urls import path
from .views import (
    EventAPIView,
    EventDetailAPIView,
    EventListAPIView,
    EventListDetailAPIView,
    EventsByListAPIView,
    EventsByPriorityAPIView,
)

urlpatterns = [
    path('eventlists/', EventListAPIView.as_view(), name='eventlist-list'),
    path('eventlists/<int:pk>/', EventListDetailAPIView.as_view(), name='eventlist-detail'),
    path("events/", EventAPIView.as_view(), name="event-list"),
    path("events/<int:pk>", EventDetailAPIView.as_view(), name="event-detail"),
    path("events/eventlist/<int:eventlist_id>", EventsByListAPIView.as_view(), name="event-by-eventlist"),
    path("events/priority/", EventsByPriorityAPIView.as_view(), name="events-by-priority"),
]
