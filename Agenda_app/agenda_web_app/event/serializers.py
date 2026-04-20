from rest_framework import serializers
from category.models import Category as cat 
from .models import Event , Event_list 

class EventSerializers(serializers.ModelSerializer):
    def validate(self, attrs):
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {'end_date': 'End date must be greater than or equal to start date.'}
            )

        return attrs

    class Meta:
        model=Event
        fields= "__all__"
    

class EventListSerializers(serializers.ModelSerializer):
    class Meta:
        model=Event_list
        fields= "__all__"
    
