from rest_framework import serializers
from category.models import Category as cat 
from .models import Event , Event_list 

class EventSerializers(serializers.ModelSerializer):
    class Meta:
        model=Event
        fields= "__all__"
    

class EventListSerializers(serializers.ModelSerializer):
    class Meta:
        model=Event_list
        fields= "__all__"
    
