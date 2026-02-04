from django.db import models



class Event_list(models.Model):
    title= models.CharField(max_length=100)
    category = models.ForeignKey('category.Category', on_delete=models.CASCADE)
    
class Event (models.Model):
    PRIORITY_CHOICES=[
        ('low' , 'faible'),
        ('medium' , 'moyen'),
        ('high' , 'fort')
    ]
    
    title=models.CharField(max_length=200)
    description=models.TextField(blank=True)
    event_list=models.ForeignKey(Event_list, on_delete=models.CASCADE , related_name="events")
    planned_date=models.DateTimeField()
    priroty=models.CharField(max_length=10,choices=PRIORITY_CHOICES)
    notified=models.BooleanField(default=False)