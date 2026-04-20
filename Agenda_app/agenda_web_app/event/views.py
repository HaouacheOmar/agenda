from django.shortcuts import render
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response as res
from rest_framework import authentication, permissions
from .models import Event , Event_list
from .serializers import EventSerializers , EventListSerializers


#this class handlles the creation and retrieval of  lists of events 
class EventlistAPIview(APIView):
    def get(self, request) : 
        event_list = Event_list.objects.all()
        serializer = EventListSerializers(event_list, many=True)
        return res(serializer.data)
    
    def post(self, request) :
        serializer = EventListSerializers(data=request.data)
        if serializer.is_valid() : 
            serializer.save()
            return res(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
        return res(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class EventListHandlerAPIview(APIView):
    def get_object(self, pk):
        try:
            return Event_list.objects.get(pk=pk)
        except Event_list.DoesNotExist:
            return None

    def delete(self, request, pk):
        event_list = self.get_object(pk=pk)
        if not event_list:
            return res(
                {'err': 'event list not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Deleting an event list cascades to its events via FK on_delete=models.CASCADE.
        event_list.delete()
        return res(status=status.HTTP_204_NO_CONTENT)
    

#this class handles the creations and retrieval of events 
class EventAPIview(APIView):
    def get(self, request):
        event = Event.objects.all()
        serializer = EventSerializers(event, many=True)
        return res(serializer.data)
    
    def post(self, request):
        serializer = EventSerializers(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return res(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
        return res(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
        
#this class handles retrieve , update , delete of an event 

class EventHandlerAPIview(APIView):
    def get_object(self,pk):
        try:
            return Event.objects.get(pk=pk)
        except Event.DoesNotExist:
            return None
    
    def get(self, request, pk):
        event = self.get_object(pk=pk)
        if not event :
            return res(
                {'err' : 'event not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = EventSerializers(event)
        return res (
            serializer.data,
            status=status.HTTP_200_OK
        )
    
    def put(self, request, pk):
        event = self.get_object(pk=pk)
        if not event :
            return res (
                {'err' : 'no event found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer= EventSerializers(event, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return res (
                {'msg' : 'data has been updated'},
                
            )
        return res(
            serializer.errors,
            status=status.HTTP_404_NOT_FOUND
        )
    
    def delete(self, request, pk):
        event = self.get_object(pk=pk)
        if not event :
            return res (
                {'err' : 'not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        event.delete()
        return res(
            status=status.HTTP_204_NO_CONTENT
        )
        

#this class handles retrieving events depends on its priority
class EventPriorityAPIview(APIView):
    def get(self, request):
        pr = request.query_params.get('priority' , None)
        if pr:
            events = Event.objects.filter(priroty=pr)
        else:
            events = Event.objects.all()
        serializer = EventSerializers(events, many=True)
        return res (
            serializer.data
        )
        
#this class handles retrieving events depends on a eventlist
class EventonlitAPIview(APIView):
    def get(self, request, eventlist_id) :
        events = Event.objects.filter(event_list_id=eventlist_id)
        serializer = EventSerializers(events, many=True)
        return res (
            serializer.data
        )
         
        

        
        

    


