from django.urls import path
from .views import (
    EventAPIview,
    EventHandlerAPIview,
    EventListHandlerAPIview,
    EventlistAPIview,
    EventonlitAPIview,
    EventPriorityAPIview
)

urlpatterns = [
    path('eventlists/',EventlistAPIview.as_view(),name='eventlist-list'),
    path('eventlists/<int:pk>/', EventListHandlerAPIview.as_view(), name='eventlist-detail'),
    path("events/", EventAPIview.as_view(), name="event-list"),
    path("events/<int:pk>", EventHandlerAPIview.as_view(), name="event-detail"),
    path("events/eventlist/<int:eventlist_id>", EventonlitAPIview.as_view(), name="event-by-eventlist"),
    path("events/priority/", EventPriorityAPIview.as_view(), name="events-by-priority")
]
