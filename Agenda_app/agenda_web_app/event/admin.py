from django.contrib import admin

from .models import Event, Event_list

admin.site.register([Event, Event_list])
